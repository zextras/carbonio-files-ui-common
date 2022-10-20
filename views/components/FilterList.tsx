/*
 * SPDX-FileCopyrightText: 2022 Zextras <https://www.zextras.com>
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import React, { useMemo } from 'react';

import filter from 'lodash/filter';

import { useFindNodesQuery } from '../../hooks/graphql/queries/useFindNodesQuery';
import { Crumb, NodeListItemType, SearchParams } from '../../types/common';
import { NodeSort } from '../../types/graphql/types';
import { NonNullableListItem, Unwrap } from '../../types/utils';
import { List } from './List';

interface FilterListProps extends Omit<SearchParams, 'keywords'> {
	canUploadFile?: boolean;
	crumbs: Crumb[];
	sort: NodeSort;
	emptyListMessage: string;
}

export const FilterList: React.VFC<FilterListProps> = ({
	flagged,
	sharedByMe,
	sharedWithMe,
	folderId,
	canUploadFile,
	cascade,
	directShare,
	crumbs,
	sort,
	emptyListMessage
}) => {
	const {
		data: findNodesResult,
		loading,
		hasMore,
		loadMore
	} = useFindNodesQuery({
		flagged,
		sharedByMe,
		sharedWithMe,
		folderId,
		cascade,
		directShare,
		sort
	});

	const nodes = useMemo<NodeListItemType[]>(() => {
		if (findNodesResult?.findNodes?.nodes && findNodesResult.findNodes.nodes.length > 0) {
			const $nodes = findNodesResult.findNodes.nodes;
			return filter<Unwrap<typeof $nodes>, NonNullableListItem<typeof $nodes>>(
				$nodes,
				(node): node is NonNullableListItem<typeof $nodes> => !!node
			);
		}
		return [];
	}, [findNodesResult]);

	return (
		<List
			nodes={nodes}
			loading={loading}
			hasMore={hasMore}
			loadMore={loadMore}
			crumbs={crumbs}
			canUpload={canUploadFile}
			mainList={false}
			emptyListMessage={emptyListMessage}
		/>
	);
};
