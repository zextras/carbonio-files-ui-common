/*
 * SPDX-FileCopyrightText: 2022 Zextras <https://www.zextras.com>
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { useCallback } from 'react';

import { FetchResult, useMutation } from '@apollo/client';
import find from 'lodash/find';
import forEach from 'lodash/forEach';
import map from 'lodash/map';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';

import { useActiveNode } from '../../../../hooks/useActiveNode';
import { useNavigation } from '../../../../hooks/useNavigation';
import MOVE_NODES from '../../../graphql/mutations/moveNodes.graphql';
import {
	Folder,
	MoveNodesMutation,
	MoveNodesMutationVariables,
	Node
} from '../../../types/graphql/types';
import { useCreateSnackbar } from '../../useCreateSnackbar';
import { useErrorHandler } from '../../useErrorHandler';
import useQueryParam from '../../useQueryParam';
import { useUpdateFolderContent } from '../useUpdateFolderContent';

export type MoveNodesType = (
	destinationFolder: Pick<Folder, '__typename' | 'id'>,
	...nodes: Array<Pick<Node, 'id' | 'parent'>>
) => Promise<FetchResult<MoveNodesMutation>>;

/**
 * Can return error: ErrorCode.NODE_WRITE_ERROR
 */
export function useMoveNodesMutation(): MoveNodesType {
	const [t] = useTranslation();
	const createSnackbar = useCreateSnackbar();
	const { rootId } = useParams<{ rootId: string }>();
	const folderId = useQueryParam('folder');
	const { activeNodeId, removeActiveNode } = useActiveNode();
	const { removeNodesFromFolder } = useUpdateFolderContent();
	const { navigateToFolder } = useNavigation();

	const [moveNodesMutation, { error }] = useMutation<MoveNodesMutation, MoveNodesMutationVariables>(
		MOVE_NODES,
		{
			errorPolicy: 'all',
			onCompleted({ moveNodes: moveNodesResult }) {
				if (moveNodesResult) {
					createSnackbar({
						key: new Date().toLocaleString(),
						type: 'info',
						label: t('snackbar.moveNodes.success', 'Item moved'),
						replace: true,
						actionLabel: t('snackbar.moveNodes.action', 'Go to folder'),
						onActionClick: () => {
							moveNodesResult[0].parent && navigateToFolder(moveNodesResult[0].parent.id);
						}
					});
				} else {
					createSnackbar({
						key: new Date().toLocaleString(),
						type: 'error',
						label: t('snackbar.moveNodes.error', 'Something went wrong, try again'),
						replace: true,
						hideButton: true
					});
				}
			}
		}
	);
	useErrorHandler(error, 'MOVE_NODES');

	const moveNodes: MoveNodesType = useCallback(
		(destinationFolder, ...nodes) => {
			const nodesIds = map(nodes, 'id');

			return moveNodesMutation({
				variables: {
					nodes_ids: nodesIds,
					destination_id: destinationFolder.id
				},
				update(cache, { data: result }) {
					// remove nodes from previous parents
					const currentFolderId = folderId || rootId;
					const parents: Record<string, Pick<Folder, 'id' | '__typename'>> = {};
					const nodesByParent: Record<string, string[]> = {};
					forEach(result?.moveNodes, (movedNode) => {
						const fromParent = find(nodes, ['id', movedNode.id])?.parent;
						if (fromParent && movedNode.parent?.id !== fromParent.id) {
							// close displayer of the node if it is moved from shown folder to another destination
							if (
								activeNodeId &&
								currentFolderId &&
								movedNode.id === activeNodeId &&
								fromParent.id === currentFolderId
							) {
								removeActiveNode();
							}

							if (fromParent.id in parents) {
								nodesByParent[fromParent.id].push(movedNode.id);
							} else {
								parents[fromParent.id] = fromParent;
								nodesByParent[fromParent.id] = [movedNode.id];
							}
						}
						cache.evict({
							fieldName: 'getPath',
							args: { id: movedNode.id }
						});
					});

					forEach(nodesByParent, (nodeIds, parentId) => {
						removeNodesFromFolder(parents[parentId], nodeIds);
					});

					// clear cached children for destination folder
					cache.evict({ id: cache.identify(destinationFolder), fieldName: 'children' });
					cache.gc();
				} /* ,
				onQueryUpdated(observableQuery, { complete }) {
					if (observableQuery.hasObservers()) {
						if (
							observableQuery.options.query === GET_PATH &&
							(observableQuery as ObservableQuery<GetPathQuery>).options.variables?.id ===
								destinationFolder.id
						) {
							// avoid refetch getPath for the destination (folder content opened in the displayer)
							return false;
						}
						if (
							observableQuery.options.query === GET_CHILDREN &&
							observableQuery.options.variables?.id === destinationFolder.id
						) {
							// avoid refetch getNode for the destination (folder content opened in the displayer)
							return false;
						}
					}
					console.log(observableQuery.queryName, observableQuery.options.variables);
					if (complete) {
						// eslint-disable-next-line consistent-return
						// if the query is complete, stick to the fetch policy set for the query

						return observableQuery.reobserve();
					}
					// otherwise, refetch the query unconditionally from the network
					return true;
				} */
			});
		},
		[activeNodeId, folderId, moveNodesMutation, removeActiveNode, removeNodesFromFolder, rootId]
	);

	return moveNodes;
}
