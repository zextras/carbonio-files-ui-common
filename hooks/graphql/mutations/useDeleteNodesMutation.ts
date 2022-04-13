/*
 * SPDX-FileCopyrightText: 2022 Zextras <https://www.zextras.com>
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { useCallback } from 'react';

import { FetchResult, useMutation } from '@apollo/client';
import filter from 'lodash/filter';
import map from 'lodash/map';
import size from 'lodash/size';
import { useTranslation } from 'react-i18next';

import DELETE_NODES from '../../../graphql/mutations/deleteNodes.graphql';
import FIND_NODES from '../../../graphql/queries/findNodes.graphql';
import { FindNodesCachedObject } from '../../../types/apollo';
import { PickIdNodeType } from '../../../types/common';
import { DeleteNodesMutation, DeleteNodesMutationVariables } from '../../../types/graphql/types';
import { useCreateSnackbar } from '../../useCreateSnackbar';
import { useErrorHandler } from '../../useErrorHandler';

export type DeleteNodesType = (
	...nodes: PickIdNodeType[]
) => Promise<FetchResult<DeleteNodesMutation>>;

/**
 * Mutation to delete permanently one or more nodes.
 * Use an optimistic response to update the cache
 * Can return error: ErrorCode.FILE_VERSION_NOT_FOUND, ErrorCode.NODE_NOT_FOUND
 */
export function useDeleteNodesMutation(): DeleteNodesType {
	const createSnackbar = useCreateSnackbar();
	const [t] = useTranslation();
	const [deleteNodesMutation, { error }] = useMutation<
		DeleteNodesMutation,
		DeleteNodesMutationVariables
	>(DELETE_NODES, {
		errorPolicy: 'all'
	});

	useErrorHandler(error, 'DELETE_NODES');

	const deleteNodes = useCallback<DeleteNodesType>(
		(...nodes: PickIdNodeType[]) => {
			const nodesIds: string[] = map(nodes, (node: PickIdNodeType) => node.id);

			return deleteNodesMutation({
				variables: {
					node_ids: nodesIds
				},
				optimisticResponse: {
					__typename: 'Mutation',
					deleteNodes: nodesIds
				},
				update(cache, { data }) {
					if (data?.deleteNodes) {
						const deletedNodes = data.deleteNodes;
						cache.modify({
							fields: {
								findNodes(
									existingNodesRefs: FindNodesCachedObject | undefined,
									{ readField, DELETE }
								): FindNodesCachedObject | undefined {
									if (existingNodesRefs?.args) {
										const ordered = filter(existingNodesRefs.nodes?.ordered, (node) => {
											const nodeId = readField<string>('id', node);
											return !!nodeId && !deletedNodes.includes(nodeId);
										});
										const unOrdered = filter(existingNodesRefs.nodes?.unOrdered, (node) => {
											const nodeId = readField<string>('id', node);
											return !!nodeId && !deletedNodes.includes(nodeId);
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

						cache.gc();
					}
				},
				onQueryUpdated(observableQuery, diff) {
					if (observableQuery.options.query === FIND_NODES && diff.missing) {
						return observableQuery.refetch();
					}
					return false;
				}
			}).then((value) => {
				createSnackbar({
					key: new Date().toLocaleString(),
					type: 'info',
					label: t('snackbar.deletePermanently.success', 'Success'),
					replace: true,
					hideButton: true
				});
				return value;
			});
		},
		[createSnackbar, deleteNodesMutation, t]
	);

	return deleteNodes;
}
