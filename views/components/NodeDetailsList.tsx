/*
 * SPDX-FileCopyrightText: 2022 Zextras <https://www.zextras.com>
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import React, { useEffect, useMemo, useRef } from 'react';

import { Row } from '@zextras/carbonio-design-system';
import reduce from 'lodash/reduce';

import { LIST_ITEM_HEIGHT } from '../../constants';
import { ChildFragment, Maybe } from '../../types/graphql/types';
import { LoadingIcon } from './LoadingIcon';
import { NodeDetailsListItem } from './NodeDetailsListItem';
import { ScrollContainer } from './StyledComponents';

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
	const loadMoreRef = useRef<Element>(null);
	const loadMoreObserverRef = useRef<IntersectionObserver | null>(null);
	const scrollContainerRef = useRef<Element>(null);

	// eslint-disable-next-line arrow-body-style
	const items = useMemo(() => {
		return reduce(
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
		);
	}, [nodes]);

	useEffect(() => {
		// init the observer that let to load more items when scroll reaches bottom
		const options = {
			// root element is the scrollable container
			root: scrollContainerRef.current,
			// call action when entire element is visible
			threshold: 0.5
		};
		loadMoreObserverRef.current = new IntersectionObserver(async (entries) => {
			const entry = entries[0];
			if (entry.isIntersecting) {
				await loadMore();
			}
		}, options);

		return (): void => {
			// disconnect all observed element because current the observer is going to be recreated
			loadMoreObserverRef.current && loadMoreObserverRef.current.disconnect();
		};
	}, [loadMore]);

	useEffect(() => {
		// attach the observer to the element that is going to trigger the action
		if (hasMore && !loading) {
			if (loadMoreRef.current) {
				loadMoreObserverRef.current && loadMoreObserverRef.current.observe(loadMoreRef.current);
			}
		}

		return (): void => {
			loadMoreObserverRef.current && loadMoreObserverRef.current.disconnect();
		};
	}, [hasMore, loading, loadMore]);

	return (
		<ScrollContainer
			mainAlignment="flex-start"
			height="auto"
			maxHeight="100%"
			ref={scrollContainerRef}
		>
			{items}
			{/* TODO: replace icon button with a placeholder? */}
			{hasMore && (
				<Row minHeight={LIST_ITEM_HEIGHT}>
					<LoadingIcon icon="Refresh" onClick={loadMore} ref={loadMoreRef} />
				</Row>
			)}
		</ScrollContainer>
	);
};
