/*
 * SPDX-FileCopyrightText: 2022 Zextras <https://www.zextras.com>
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { useCallback, useMemo } from 'react';

import { FetchResult, gql, useMutation } from '@apollo/client';
import filter from 'lodash/filter';
import find from 'lodash/find';
import forEach from 'lodash/forEach';
import map from 'lodash/map';
import partition from 'lodash/partition';
import size from 'lodash/size';
import { useTranslation } from 'react-i18next';
import { useLocation, useParams } from 'react-router-dom';

import { useActiveNode } from '../../../../hooks/useActiveNode';
import { useNavigation } from '../../../../hooks/useNavigation';
import useUserInfo from '../../../../hooks/useUserInfo';
import { ROOTS } from '../../../constants';
import TRASH_NODES from '../../../graphql/mutations/trashNodes.graphql';
import FIND_NODES from '../../../graphql/queries/findNodes.graphql';
import GET_CHILDREN from '../../../graphql/queries/getChildren.graphql';
import { FindNodesCachedObject } from '../../../types/apollo';
import { PickIdNodeType } from '../../../types/common';
import {
	Folder,
	Node,
	TrashNodesMutation,
	TrashNodesMutationVariables
} from '../../../types/graphql/types';
import { DeepPick } from '../../../types/utils';
import { isTrashedVisible } from '../../../utils/utils';
import { useCreateSnackbar } from '../../useCreateSnackbar';
import { useErrorHandler } from '../../useErrorHandler';
import { useUpload } from '../../useUpload';
import { useUpdateFolderContent } from '../useUpdateFolderContent';

export type TrashNodesType = (
	...nodes: Array<PickIdNodeType & DeepPick<Node, 'owner', 'id'>>
) => Promise<FetchResult<TrashNodesMutation>>;

/**
 * Mutation to mark for deletion for one or more nodes.
 * Use an optimistic response to update the cache
 * Can return error: ErrorCode.NODE_WRITE_ERROR
 */
export function useTrashNodesMutation(): TrashNodesType {
	const createSnackbar = useCreateSnackbar();
	const { removeByNodeId } = useUpload();
	const [t] = useTranslation();
	const { navigateTo } = useNavigation();
	const { activeNodeId, removeActiveNode } = useActiveNode();
	const { removeNodesFromFolder } = useUpdateFolderContent();

	const [trashNodesMutation, { error }] = useMutation<
		TrashNodesMutation,
		TrashNodesMutationVariables
	>(TRASH_NODES, {
		errorPolicy: 'all'
	});

	useErrorHandler(error, 'TRASH_NODES');

	const params = useParams();
	const location = useLocation();
	const includeTrashed = useMemo(() => isTrashedVisible(params, location), [params, location]);
	const { me: loggedUser } = useUserInfo();

	const trashNodes: TrashNodesType = useCallback(
		(...nodes) => {
			const nodesIds = map(nodes, (node) => node.id);

			return trashNodesMutation({
				variables: {
					node_ids: nodesIds
				},
				optimisticResponse: {
					__typename: 'Mutation',
					trashNodes: nodesIds
				},
				update(cache, { data }) {
					if (data?.trashNodes) {
						const trashedNodes = data.trashNodes;
						cache.modify({
							fields: {
								findNodes(
									existingNodesRefs: FindNodesCachedObject | undefined,
									{ readField, DELETE }
								): FindNodesCachedObject | undefined {
									if (
										existingNodesRefs?.args?.folder_id &&
										existingNodesRefs.args.folder_id !== ROOTS.TRASH
									) {
										const ordered = filter(existingNodesRefs.nodes?.ordered, (node) => {
											const nodeId = readField<string>('id', node);
											return !!nodeId && !trashedNodes.includes(nodeId);
										});
										const unOrdered = filter(existingNodesRefs.nodes?.unOrdered, (node) => {
											const nodeId = readField<string>('id', node);
											return !!nodeId && !trashedNodes.includes(nodeId);
										});

										if (
											existingNodesRefs.pageToken &&
											size(ordered) === 0 &&
											size(unOrdered) === 0
										) {
											return DELETE;
										}

										return {
											args: existingNodesRefs.args,
											pageToken: existingNodesRefs.pageToken,
											nodes: {
												ordered,
												unOrdered
											}
										};
									}
									return existingNodesRefs;
								}
							}
						});

						const parents: Record<string, Pick<Folder, 'id' | '__typename'>> = {};
						const nodesByParent: Record<string, string[]> = {};
						forEach(data.trashNodes, (id) => {
							const node = find(nodes, ['id', id]);
							if (node) {
								// close displayer of the node it is trashed from any view
								// that does not include trashed nodes
								if (activeNodeId && node.id === activeNodeId && !includeTrashed) {
									removeActiveNode();
								}

								const parentFolder: Node | null = cache.readFragment({
									id: cache.identify(node),
									fragment: gql`
										fragment ParentId on Node {
											parent {
												id
											}
										}
									`
								});

								if (parentFolder?.parent) {
									const { parent } = parentFolder;
									if (parent.id in parents) {
										nodesByParent[parent.id].push(id);
									} else {
										parents[parent.id] = parent;
										nodesByParent[parent.id] = [id];
									}
								}

								cache.modify({
									id: cache.identify(node),
									fields: {
										rootId(): string {
											return ROOTS.TRASH;
										}
									}
								});
							}
						});
						forEach(nodesByParent, (nodeIds, parentId) => {
							removeNodesFromFolder(parents[parentId], nodeIds);
						});
					}
				},
				onQueryUpdated(observableQuery, diff) {
					if (observableQuery.options.query === FIND_NODES && diff.missing) {
						return observableQuery.refetch();
					}
					if (observableQuery.options.query === GET_CHILDREN) {
						return observableQuery.reobserve();
					}
					return false;
				}
			}).then(({ data }) => {
				if (data?.trashNodes) {
					removeByNodeId(data.trashNodes);
					const [ownedNodes, sharedNodes] = partition(
						nodes,
						(node) => node.owner.id === loggedUser
					);
					createSnackbar({
						key: new Date().toLocaleString(),
						type: 'success',
						label: t('snackbar.markForDeletion.success', 'Item moved to trash'),
						replace: true,
						hideButton: ownedNodes.length > 0 && sharedNodes.length > 0,
						onActionClick: () => {
							navigateTo(ownedNodes.length > 0 ? '/filter/myTrash' : '/filter/sharedTrash');
						},
						actionLabel: t('snackbar.markForDeletion.showTrash', 'Open Trash Folder')
					});
				}
				return { data };
			});
		},
		[
			trashNodesMutation,
			activeNodeId,
			includeTrashed,
			removeActiveNode,
			removeNodesFromFolder,
			removeByNodeId,
			createSnackbar,
			t,
			loggedUser,
			navigateTo
		]
	);

	return trashNodes;
}
