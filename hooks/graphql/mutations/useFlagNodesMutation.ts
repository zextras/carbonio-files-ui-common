/*
 * SPDX-FileCopyrightText: 2022 Zextras <https://www.zextras.com>
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { useCallback, useContext } from 'react';

import { FetchResult, useMutation } from '@apollo/client';
import { SnackbarManagerContext } from '@zextras/carbonio-design-system';
import filter from 'lodash/filter';
import find from 'lodash/find';
import forEach from 'lodash/forEach';
import map from 'lodash/map';
import size from 'lodash/size';
import { useTranslation } from 'react-i18next';
import { useLocation, useParams } from 'react-router-dom';

import { searchParamsVar } from '../../../apollo/searchVar';
import FLAG_NODES from '../../../graphql/mutations/flagNodes.graphql';
import FIND_NODES from '../../../graphql/queries/findNodes.graphql';
import { FindNodesCachedObject } from '../../../types/apollo';
import { PickIdNodeType } from '../../../types/common';
import { FlagNodesMutation, FlagNodesMutationVariables } from '../../../types/graphql/types';
import { isSearchView } from '../../../utils/utils';
import { useErrorHandler } from '../../useErrorHandler';

export type FlagNodesType = (
	flagValue: boolean,
	...nodes: PickIdNodeType[]
) => Promise<FetchResult<FlagNodesMutation>>;

/**
 * Mutation to update the flag for one or more nodes.
 * Use an optimistic response to update the cache.
 * Receive an optional callback as param to perform additional context-specific updates.
 *
 */

type CreateSnackbarObjectType = {
	key: string;
	type: string;
	label: string;
	replace: boolean;
	hideButton: boolean;
};
type CreateSnackbarFunctionType = (createSnackbarObject: CreateSnackbarObjectType) => void;

export function useFlagNodesMutation(): FlagNodesType {
	const location = useLocation();
	const { filter: filterParam } = useParams<{ filter: string }>();
	const isFlaggedFilter = filterParam === 'flagged';
	const [t] = useTranslation();
	const createSnackbar = useContext<CreateSnackbarFunctionType>(SnackbarManagerContext);
	const [flagNodesMutation, { error }] = useMutation<FlagNodesMutation, FlagNodesMutationVariables>(
		FLAG_NODES,
		{
			errorPolicy: 'all'
		}
	);

	const flagNodes: FlagNodesType = useCallback(
		(flagValue: boolean, ...nodes: PickIdNodeType[]) => {
			const nodesIds: string[] = map(nodes, (node: PickIdNodeType) => node.id);

			return flagNodesMutation({
				variables: {
					node_ids: nodesIds,
					flag: flagValue
				},
				optimisticResponse: {
					__typename: 'Mutation',
					flagNodes: nodesIds
				},
				update(cache, { data }) {
					if (data?.flagNodes) {
						const flaggedNodes = data.flagNodes;
						// update single node
						forEach(flaggedNodes, (id) => {
							const node = find(nodes, ['id', id]);
							if (node) {
								cache.modify({
									id: cache.identify(node),
									fields: {
										flagged(): boolean {
											return flagValue;
										}
									}
								});
							}
						});
						// update flagged filter list
						cache.modify({
							fields: {
								findNodes(
									existingNodesRefs: FindNodesCachedObject | undefined,
									{ readField, DELETE }
								): FindNodesCachedObject | undefined {
									if (existingNodesRefs?.args?.flagged && !flagValue) {
										// in case of unflag action remove items from the filter
										const ordered = filter(existingNodesRefs.nodes?.ordered, (node) => {
											const nodeId = readField<string>('id', node);
											return !!nodeId && !flaggedNodes.includes(nodeId);
										});
										const unOrdered = filter(existingNodesRefs.nodes?.unOrdered, (node) => {
											const nodeId = readField<string>('id', node);
											return !!nodeId && !flaggedNodes.includes(nodeId);
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
									// if no update is needed, return existing data (new requests are handled with navigation)
									return existingNodesRefs;
								}
							}
						});
						if (isFlaggedFilter || (isSearchView(location) && searchParamsVar().flagged?.value)) {
							createSnackbar({
								key: 'filterList.toggleFlag.success',
								type: 'success',
								label: t('snackbar.unflag.success', 'Item unflagged successfully'),
								replace: true,
								hideButton: true
							});
						}
					}
				},
				onQueryUpdated(observableQuery, diff) {
					if (observableQuery.options.query === FIND_NODES && diff.missing) {
						return observableQuery.refetch();
					}
					return false;
				}
			});
		},
		[createSnackbar, flagNodesMutation, isFlaggedFilter, location, t]
	);
	useErrorHandler(error, 'FLAG_NODES');

	return flagNodes;
}
