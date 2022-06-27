/*
 * SPDX-FileCopyrightText: 2022 Zextras <https://www.zextras.com>
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { useCallback, useEffect, useState } from 'react';

import { QueryOptions, QueryResult, useQuery, useReactiveVar } from '@apollo/client';

import { nodeSortVar } from '../../../apollo/nodeSortVar';
import { NODES_LOAD_LIMIT, SHARES_LOAD_LIMIT } from '../../../constants';
import GET_NODE from '../../../graphql/queries/getNode.graphql';
import { GetNodeQuery, GetNodeQueryVariables } from '../../../types/graphql/types';
import { useErrorHandler } from '../../useErrorHandler';

interface GetNodeQueryHook extends Pick<QueryResult<GetNodeQuery>, 'data' | 'loading' | 'error'> {
	loadMore: () => void;
	hasMore: boolean;
}

/**
 * Can return error: ErrorCode.FILE_VERSION_NOT_FOUND, ErrorCode.NODE_NOT_FOUND
 */
export function useGetNodeQuery(
	nodeId?: string,
	sharesLimit = SHARES_LOAD_LIMIT,
	options: Omit<
		QueryOptions<GetNodeQuery, GetNodeQueryVariables>,
		'query' | 'variables' | 'skip'
	> = {}
): GetNodeQueryHook {
	const [hasMore, setHasMore] = useState(false);
	const [lastChild, setLastChild] = useState<string | null | undefined>(undefined);
	const nodeSort = useReactiveVar(nodeSortVar);
	const { data, loading, error, fetchMore } = useQuery<GetNodeQuery, GetNodeQueryVariables>(
		GET_NODE,
		{
			variables: {
				node_id: nodeId || '',
				children_limit: NODES_LOAD_LIMIT,
				sort: nodeSort,
				shares_limit: sharesLimit
			},
			skip: !nodeId,
			notifyOnNetworkStatusChange: true,
			errorPolicy: 'all',
			...options
		}
	);
	useErrorHandler(error, 'GET_NODE');

	useEffect(() => {
		// every time data change check if cursor is set.
		// If so, there is a new page
		// otherwise there are no more children to load
		let cursor = null;
		if (data?.getNode?.__typename === 'Folder') {
			cursor = data.getNode.cursor;
		}
		setLastChild(cursor);
		setHasMore(cursor !== null);
	}, [data]);

	const loadMore = useCallback(() => {
		fetchMore({
			variables: {
				cursor: lastChild
			}
		}).catch((err) => {
			console.error(err);
		});
	}, [lastChild, fetchMore]);

	return { data, loading, error, loadMore, hasMore };
}
