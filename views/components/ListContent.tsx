/*
 * SPDX-FileCopyrightText: 2022 Zextras <https://www.zextras.com>
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Row, useCombinedRefs } from '@zextras/carbonio-design-system';
import filter from 'lodash/filter';
import forEach from 'lodash/forEach';
import map from 'lodash/map';
import styled from 'styled-components';

import useUserInfo from '../../../hooks/useUserInfo';
import { draggedItemsVar } from '../../apollo/dragAndDropVar';
import { DRAG_TYPES, LIST_ITEM_HEIGHT } from '../../constants';
import { DeleteNodesType } from '../../hooks/graphql/mutations/useDeleteNodesMutation';
import { GetNodeParentType, NodeListItemType, PickIdNodeType } from '../../types/common';
import { Node } from '../../types/graphql/types';
import { DeepPick } from '../../types/utils';
import {
	Action,
	ActionItem,
	ActionsFactoryCheckerMap,
	getPermittedActions,
	isFile
} from '../../utils/ActionsFactory';
import { Draggable } from './Draggable';
import { LoadingIcon } from './LoadingIcon';
import { NodeListItem } from './NodeListItem';
import { NodeListItemWrapper } from './NodeListItemWrapper';
import { ScrollContainer } from './StyledComponents';

const DragImageContainer = styled.div`
	position: absolute;
	top: -5000px;
	left: -5000px;
	transform: translate(-100%, -100%);
	width: 100%;
`;

interface ListContentProps {
	nodes: NodeListItemType[];
	selectedMap?: Record<string, boolean>;
	selectId?: (id: string) => void;
	isSelectionModeActive?: boolean;
	exitSelectionMode?: () => void;
	toggleFlag?: (flagValue: boolean, ...nodes: PickIdNodeType[]) => void;
	renameNode?: (node: Pick<Node, 'id' | 'name'>) => void;
	markNodesForDeletion?: (
		...nodes: Array<Pick<NodeListItemType, 'id'> & DeepPick<NodeListItemType, 'owner', 'id'>>
	) => void;
	restore?: (
		...nodes: Array<Pick<NodeListItemType, '__typename' | 'id'> & GetNodeParentType>
	) => void;
	deletePermanently?: DeleteNodesType;
	moveNodes?: (...nodes: Array<Pick<NodeListItemType, '__typename' | 'id' | 'owner'>>) => void;
	copyNodes?: (...nodes: Array<Pick<NodeListItemType, '__typename' | 'id'>>) => void;
	activeNode?: string;
	setActiveNode?: (
		node: Pick<NodeListItemType, 'id' | 'disabled' | 'name' | '__typename'>,
		event: React.SyntheticEvent
	) => void;
	compact?: boolean;
	navigateTo?: (id: string, event?: React.SyntheticEvent) => void;
	loading?: boolean;
	hasMore?: boolean;
	loadMore?: () => void;
	draggable?: boolean;
	customCheckers?: ActionsFactoryCheckerMap;
	selectionContextualMenuActionsItems?: ActionItem[];
	fillerWithActions?: JSX.Element;
}

export const ListContent = React.forwardRef<HTMLDivElement, ListContentProps>(
	function ListContentFn(
		{
			nodes,
			selectedMap = {},
			selectId,
			isSelectionModeActive,
			exitSelectionMode,
			toggleFlag,
			renameNode,
			markNodesForDeletion,
			restore,
			deletePermanently,
			moveNodes,
			copyNodes,
			activeNode,
			setActiveNode,
			compact,
			navigateTo,
			loading,
			hasMore,
			loadMore = (): void => undefined,
			draggable = false,
			customCheckers,
			selectionContextualMenuActionsItems,
			fillerWithActions
		},
		ref
	) {
		const loadMoreRef = useRef<HTMLElement>(null);
		const loadMoreObserverRef = useRef<IntersectionObserver>();
		const scrollContainerRef = useCombinedRefs(ref) as React.MutableRefObject<HTMLDivElement>;
		const dragImageRef = useRef<HTMLDivElement>(null);

		const { me } = useUserInfo();

		const [dragImage, setDragImage] = useState<JSX.Element[]>([]);

		const dragStartHandler = useCallback<
			(node: NodeListItemType) => React.DragEventHandler<HTMLElement>
		>(
			(node) =>
				(event): void => {
					forEach(DRAG_TYPES, (dragType) => event.dataTransfer.clearData(dragType));
					const nodesToDrag: NodeListItemType[] = [];
					if (isSelectionModeActive) {
						nodesToDrag.push(...filter(nodes, ({ id }) => !!selectedMap[id]));
					} else {
						nodesToDrag.push(node);
					}
					const draggedItemsTmp: JSX.Element[] = [];
					const permittedActions = getPermittedActions(
						nodesToDrag,
						[Action.Move, Action.MarkForDeletion],
						me,
						customCheckers
					);
					forEach(nodesToDrag, (nodeToDrag) => {
						draggedItemsTmp.push(
							<NodeListItem
								key={`dragged-${nodeToDrag.id}`}
								id={`dragged-${nodeToDrag.id}`}
								name={nodeToDrag.name}
								type={nodeToDrag.type}
								extension={(isFile(nodeToDrag) && nodeToDrag.extension) || undefined}
								mimeType={(isFile(nodeToDrag) && nodeToDrag.mime_type) || undefined}
								updatedAt={nodeToDrag.updated_at}
								owner={nodeToDrag.owner}
								lastEditor={nodeToDrag.last_editor}
								incomingShare={me !== nodeToDrag.owner?.id}
								outgoingShare={
									me === nodeToDrag.owner?.id && nodeToDrag.shares && nodeToDrag.shares.length > 0
								}
								size={(isFile(nodeToDrag) && nodeToDrag.size) || undefined}
								flagActive={nodeToDrag.flagged}
							/>
						);
					});
					setDragImage(draggedItemsTmp);
					dragImageRef.current && event.dataTransfer.setDragImage(dragImageRef.current, 0, 0);
					draggedItemsVar(nodesToDrag);
					if (permittedActions.MOVE) {
						event.dataTransfer.setData(DRAG_TYPES.move, JSON.stringify(nodesToDrag));
					}
					if (permittedActions.MARK_FOR_DELETION) {
						event.dataTransfer.setData(DRAG_TYPES.markForDeletion, JSON.stringify(nodesToDrag));
					}
				},
			[customCheckers, isSelectionModeActive, me, nodes, selectedMap]
		);

		const dragEndHandler = useCallback(() => {
			setDragImage([]);
			draggedItemsVar(null);
		}, []);

		const items = useMemo(
			() =>
				map(nodes, (node) => (
					<Draggable
						draggable={draggable}
						onDragStart={dragStartHandler(node)}
						onDragEnd={dragEndHandler}
						key={node.id}
						effect="move"
					>
						<NodeListItemWrapper
							node={node}
							toggleFlag={toggleFlag}
							markNodesForDeletion={markNodesForDeletion}
							restore={restore}
							deletePermanently={deletePermanently}
							moveNodes={moveNodes}
							copyNodes={copyNodes}
							isSelected={selectedMap && selectedMap[node.id]}
							isSelectionModeActive={isSelectionModeActive}
							selectId={selectId}
							exitSelectionMode={exitSelectionMode}
							renameNode={renameNode}
							isActive={activeNode === node.id}
							setActive={setActiveNode}
							compact={compact}
							navigateTo={navigateTo}
							selectionContextualMenuActionsItems={
								selectedMap && selectedMap[node.id]
									? selectionContextualMenuActionsItems
									: undefined
							}
						/>
					</Draggable>
				)),
			[
				nodes,
				draggable,
				dragEndHandler,
				toggleFlag,
				markNodesForDeletion,
				restore,
				deletePermanently,
				moveNodes,
				copyNodes,
				selectedMap,
				isSelectionModeActive,
				selectId,
				exitSelectionMode,
				renameNode,
				activeNode,
				setActiveNode,
				compact,
				navigateTo,
				selectionContextualMenuActionsItems,
				dragStartHandler
			]
		);

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
		}, [loadMore, scrollContainerRef]);

		useEffect(() => {
			// attach the observer to the element that is going to trigger the action
			if (hasMore && !loading) {
				if (loadMoreRef.current && loadMoreObserverRef.current) {
					loadMoreObserverRef.current.observe(loadMoreRef.current);
				}
			}

			return (): void => {
				loadMoreObserverRef.current && loadMoreObserverRef.current.disconnect();
			};
		}, [hasMore, loading, loadMore]);

		return (
			<>
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
					{fillerWithActions &&
						React.cloneElement(fillerWithActions, {
							children: <Row height={LIST_ITEM_HEIGHT / 2} />
						})}
				</ScrollContainer>
				<DragImageContainer ref={dragImageRef}>{dragImage}</DragImageContainer>
			</>
		);
	}
);
