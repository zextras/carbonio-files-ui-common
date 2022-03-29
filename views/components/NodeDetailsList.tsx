/*
 * SPDX-FileCopyrightText: 2022 Zextras <https://www.zextras.com>
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import React, { useMemo } from 'react';

import reduce from 'lodash/reduce';

import { ChildFragment, Maybe } from '../../types/graphql/types';
import { NodeDetailsListItem } from './NodeDetailsListItem';
import { ScrollContainer } from './ScrollContainer';

interface NodeDetailsListProps {
	hasMore?: boolean;
	loading: boolean;
	nodes: Array<Maybe<ChildFragment> | undefined>;
	loadMore: () => void;
}

export const NodeDetailsList: React.VFC<NodeDetailsListProps> = ({
	nodes,
	hasMore,
	loading,
	loadMore
}) => {
	const items = useMemo(
		() =>
			reduce(
				nodes,
				(resultArray: JSX.Element[], node) => {
					if (node) {
						resultArray.push(
							<NodeDetailsListItem
								key={node.id}
								id={node.id}
								name={node.name}
								type={node.type}
								updatedAt={node.updated_at}
								owner={node.owner}
								mimeType={node.__typename === 'File' ? node.mime_type : undefined}
							/>
						);
					}
					return resultArray;
				},
				[]
			),
		[nodes]
	);

	return (
		<ScrollContainer hasMore={!!hasMore} loadMore={loadMore} loading={loading}>
			{items}
		</ScrollContainer>
	);
};
