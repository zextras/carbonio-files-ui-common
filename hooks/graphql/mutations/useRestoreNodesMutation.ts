/*
 * SPDX-FileCopyrightText: 2022 Zextras <https://www.zextras.com>
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { useCallback, useMemo } from 'react';

import { FetchResult, useMutation } from '@apollo/client';
import { useSnackbar } from '@zextras/carbonio-design-system';
import filter from 'lodash/filter';
import find from 'lodash/find';
import forEach from 'lodash/forEach';
import map from 'lodash/map';
import reduce from 'lodash/reduce';
import size from 'lodash/size';
import { useTranslation } from 'react-i18next';
import { useLocation, useParams } from 'react-router-dom';

import { useActiveNode } from '../../../../hooks/useActiveNode';
import { useNavigation } from '../../../../hooks/useNavigation';
import { searchParamsVar } from '../../../apollo/searchVar';
import { ROOTS } from '../../../constants';
import RESTORE_NODES from '../../../graphql/mutations/restoreNodes.graphql';
import FIND_NODES from '../../../graphql/queries/findNodes.graphql';
import { FindNodesCachedObject } from '../../../types/apollo';
import { GetNodeParentType, Node } from '../../../types/common';
import { RestoreNodesMutation, RestoreNodesMutationVariables } from '../../../types/graphql/types';
import { isSearchView, isTrashView } from '../../../utils/utils';
import { useErrorHandler } from '../../useErrorHandler';

type UseRestoreRequiredNodeType = Pick<Node, 'id' | '__typename'> & GetNodeParentType;

export type RestoreType = (
	...nodes: UseRestoreRequiredNodeType[]
) => Promise<FetchResult<RestoreNodesMutation>>;

/**
 * Mutation to restore one or more nodes.
 * Use an optimistic response to update the cache
 * Can return error: ErrorCode.NODE_WRITE_ERROR
 */
export function useRestoreNodesMutation(): RestoreType {
	const createSnackbar = useSnackbar();
	const [t] = useTranslation();
	const { navigateToFolder } = useNavigation();
	const params = useParams<{ filter: string }>();
	const location = useLocation();
	const { activeNodeId, removeActiveNode } = useActiveNode();
	const [restoreNodesMutation, { error }] = useMutation<
		RestoreNodesMutation,
		RestoreNodesMutationVariables
	>(RESTORE_NODES, {
		errorPolicy: 'all'
	});

	useErrorHandler(error, 'RESTORE_NODES');

	const onlyTrashed = useMemo(() => {
		const { folderId } = searchParamsVar();
		// close displayer of the node it is restored from the trash
		// or from a view which includes only trashed nodes
		return isTrashView(params) || (isSearchView(location) && folderId?.value === ROOTS.TRASH);
	}, [params, location]);

	const restoreNodes: RestoreType = useCallback(
		(...nodes: UseRestoreRequiredNodeType[]) => {
			const nodesIds: string[] = map(nodes, (node: UseRestoreRequiredNodeType) => node.id);

			return restoreNodesMutation({
				variables: {
					node_ids: nodesIds
				},
				optimisticResponse: {
					__typename: 'Mutation',
					restoreNodes: map(nodes, (node) => ({ ...node, parent: null, rootId: ROOTS.LOCAL_ROOT }))
				},
				update(cache, { data }) {
					if (data?.restoreNodes) {
						const restoredNodes = filter(data.restoreNodes, (node) => !!node);
						cache.modify({
							fields: {
								findNodes(
									existingNodesRefs: FindNodesCachedObject | undefined,
									{ readField, DELETE }
								): FindNodesCachedObject | undefined {
									if (existingNodesRefs?.args?.folder_id === ROOTS.TRASH) {
										const ordered = filter(existingNodesRefs.nodes?.ordered, (node) => {
											const nodeId = readField<string>('id', node);
											return !find(restoredNodes, (restoredNode) => restoredNode?.id === nodeId);
										});
										const unOrdered = filter(existingNodesRefs.nodes?.unOrdered, (node) => {
											const nodeId = readField<string>('id', node);
											return !find(restoredNodes, (restoredNode) => restoredNode?.id === nodeId);
										});

										if (
											existingNodesRefs.page_token &&
											size(ordered) === 0 &&
											size(unOrdered) === 0
										) {
											return DELETE;
										}

										return {
											args: existingNodesRefs.args,
											page_token: existingNodesRefs.page_token,
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

						forEach(restoredNodes, (node) => {
							if (node) {
								if (activeNodeId && node.id === activeNodeId && onlyTrashed) {
									removeActiveNode();
								}

								if (node.parent) {
									// clear cached children for destination folder
									cache.evict({ id: cache.identify(node.parent), fieldName: 'children' });
									cache.gc();
								}
							}
						});
					}
				},
				onQueryUpdated(observableQuery, diff) {
					if (observableQuery.options.query === FIND_NODES) {
						if (diff.missing) {
							return observableQuery.refetch();
						}
					}
					return observableQuery.reobserve();
				}
			}).then((result) => {
				if (result?.data?.restoreNodes && size(result?.data?.restoreNodes) === size(nodes)) {
					const parents = reduce(
						result.data.restoreNodes,
						(parentList, restoredNode) => {
							if (restoredNode?.parent && !parentList.includes(restoredNode.parent.id)) {
								parentList.push(restoredNode.parent.id);
							}
							return parentList;
						},
						[] as string[]
					);
					createSnackbar({
						key: new Date().toLocaleString(),
						type: 'success',
						label: t('snackbar.restore.success', 'Success'),
						replace: true,
						onActionClick: () => {
							if (parents.length === 1) {
								navigateToFolder(parents[0]);
							}
						},
						actionLabel: t('snackbar.restore.showInFolder', 'Show in folder'),
						// show action button only if all nodes have the same parent
						hideButton: parents.length !== 1
					});
				}
				return result;
			});
		},
		[
			restoreNodesMutation,
			onlyTrashed,
			activeNodeId,
			removeActiveNode,
			createSnackbar,
			t,
			navigateToFolder
		]
	);

	return restoreNodes;
}
