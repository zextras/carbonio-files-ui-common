/*
 * SPDX-FileCopyrightText: 2022 Zextras <https://www.zextras.com>
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { useCallback } from 'react';

import { ApolloQueryResult, QueryResult, useQuery, useReactiveVar } from '@apollo/client';
import isEqual from 'lodash/isEqual';

import { nodeSortVar } from '../../../apollo/nodeSortVar';
import { NODES_LOAD_LIMIT } from '../../../constants';
import FIND_NODES from '../../../graphql/queries/findNodes.graphql';
import { SearchParams } from '../../../types/common';
import { FindNodesQuery, FindNodesQueryVariables } from '../../../types/graphql/types';
import { useErrorHandler } from '../../useErrorHandler';
import { useMemoCompare } from '../../useMemoCompare';

export interface FindNodesQueryHookReturnType extends QueryResult<FindNodesQuery> {
	hasMore: boolean;
	loadMore: () => Promise<ApolloQueryResult<FindNodesQuery>>;
	pageToken?: string | null;
}

export function useFindNodesQuery({
	flagged,
	sharedWithMe,
	sharedByMe,
	folderId,
	cascade,
	keywords,
	directShare
}: SearchParams): FindNodesQueryHookReturnType {
	const nodeSort = useReactiveVar(nodeSortVar);

	const { data, fetchMore, ...queryResult } = useQuery<FindNodesQuery, FindNodesQueryVariables>(
		FIND_NODES,
		{
			fetchPolicy: 'network-only',
			// set next fetch policy to cache-first so that re-renders does not trigger new network queries
			nextFetchPolicy: 'cache-first',
			variables: {
				keywords,
				flagged,
				shared_with_me: sharedWithMe,
				shared_by_me: sharedByMe,
				folder_id: folderId,
				cascade,
				limit: NODES_LOAD_LIMIT,
				sort: nodeSort,
				direct_share: directShare
			},
			skip:
				!flagged &&
				!sharedWithMe &&
				!sharedByMe &&
				!folderId &&
				(!keywords || keywords.length === 0),
			notifyOnNetworkStatusChange: true,
			errorPolicy: 'all'
		}
	);

	const error = useMemoCompare(queryResult.error, (prev, next) => isEqual(prev, next));

	useErrorHandler(error, 'GET_CHILDREN');

	const loadMore = useCallback(
		() =>
			fetchMore({
				variables: {
					page_token: data?.findNodes?.page_token
				}
			}).catch((err) => {
				console.error(err);
				return err;
			}),
		[data, fetchMore]
	);

	return {
		...queryResult,
		data,
		fetchMore,
		hasMore: data?.findNodes?.page_token !== null,
		pageToken: data?.findNodes?.page_token,
		loadMore
	};
}
