/*
 * SPDX-FileCopyrightText: 2022 Zextras <https://www.zextras.com>
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { useCallback, useEffect, useState } from 'react';

import { QueryResult, useQuery, useReactiveVar } from '@apollo/client';
import isEqual from 'lodash/isEqual';

import { nodeSortVar } from '../../../apollo/nodeSortVar';
import { NODES_LOAD_LIMIT } from '../../../constants';
import GET_CHILDREN from '../../../graphql/queries/getChildren.graphql';
import { GetChildrenQuery, GetChildrenQueryVariables } from '../../../types/graphql/types';
import { useErrorHandler } from '../../useErrorHandler';
import { useMemoCompare } from '../../useMemoCompare';

interface GetChildrenQueryHookReturnType extends QueryResult<GetChildrenQuery> {
	hasMore: boolean;
	lastChild: string | null | undefined;
	loadMore: () => void;
}

/**
 * Can return error: ErrorCode.FILE_VERSION_NOT_FOUND, ErrorCode.NODE_NOT_FOUND
 */
export function useGetChildrenQuery(
	parentNode: string,
	displayName?: string
): GetChildrenQueryHookReturnType {
	const [hasMore, setHasMore] = useState(false);
	const [lastChild, setLastChild] = useState<string | null | undefined>(undefined);
	const nodeSort = useReactiveVar(nodeSortVar);

	const { data, fetchMore, ...queryResult } = useQuery<GetChildrenQuery, GetChildrenQueryVariables>(
		GET_CHILDREN,
		{
			variables: {
				node_id: parentNode,
				children_limit: NODES_LOAD_LIMIT,
				sort: nodeSort
			},
			skip: !parentNode,
			displayName,
			errorPolicy: 'all'
		}
	);

	const error = useMemoCompare(queryResult.error, (prev, next) => isEqual(prev, next));

	useErrorHandler(error, 'GET_CHILDREN');

	useEffect(() => {
		// every time data change check if cursor is set.
		// If so, there is a new page
		// otherwise there are no more children to load
		if (data?.getNode) {
			let cursor = null;
			if (data?.getNode?.__typename === 'Folder') {
				cursor = data.getNode.cursor;
			}
			setLastChild(cursor);
			setHasMore(cursor !== null);
		}
	}, [data]);

	const loadMore = useCallback(() => {
		if (data?.getNode?.__typename === 'Folder') {
			fetchMore({
				variables: {
					cursor: data.getNode.cursor
				}
			}).catch((err) => {
				console.error(err);
				return err;
			});
		}
	}, [fetchMore, data]);

	return { ...queryResult, fetchMore, data, hasMore, lastChild, loadMore };
}
