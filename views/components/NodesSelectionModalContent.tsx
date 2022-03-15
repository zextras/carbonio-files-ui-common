/*
 * SPDX-FileCopyrightText: 2022 Zextras <https://www.zextras.com>
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { ApolloError, useApolloClient } from '@apollo/client';
import { Container, Text } from '@zextras/carbonio-design-system';
import findIndex from 'lodash/findIndex';
import map from 'lodash/map';
import reduce from 'lodash/reduce';
import some from 'lodash/some';
import { useTranslation } from 'react-i18next';

import { NodeAvatarIconContext } from '../../contexts';
import CHILD from '../../graphql/fragments/child.graphql';
import GET_BASE_NODE from '../../graphql/queries/getBaseNode.graphql';
import { useGetChildrenQuery } from '../../hooks/graphql/queries/useGetChildrenQuery';
import { useGetRootsListQuery } from '../../hooks/graphql/queries/useGetRootsListQuery';
import { useErrorHandler } from '../../hooks/useErrorHandler';
import { NodeListItemType, RootListItemType } from '../../types/common';
import {
	BaseNodeFragment,
	ChildFragment,
	GetBaseNodeQuery,
	GetBaseNodeQueryVariables
} from '../../types/graphql/types';
import { ArrayOneOrMore } from '../../types/utils';
import { isFile, isFolder } from '../../utils/ActionsFactory';
import { LoadingIcon } from './LoadingIcon';
import { ModalFooter } from './ModalFooter';
import { ModalHeader } from './ModalHeader';
import { ModalList } from './ModalList';
import { ModalRootsList } from './ModalRootsList';

type NodeWithMetadata = BaseNodeFragment;

interface NodesSelectionModalContentProps {
	title: string;
	confirmAction: (nodes: ArrayOneOrMore<NodeWithMetadata>) => void;
	confirmLabel: string;
	closeAction: () => void;
	isValidSelection?: (node: NodeWithMetadata | RootListItemType) => boolean;
	maxSelection?: number;
	disabledTooltip?: string;
	canSelectOpenedFolder?: boolean;
}

export const NodesSelectionModalContent: React.VFC<NodesSelectionModalContentProps> = ({
	title,
	confirmAction,
	confirmLabel,
	closeAction,
	isValidSelection = (): boolean => true, // by default all nodes are active,
	maxSelection,
	disabledTooltip,
	canSelectOpenedFolder
}) => {
	const [t] = useTranslation();
	const [openedFolder, setOpenedFolder] = useState<string>('');
	const mainContainerRef = useRef<HTMLDivElement | null>(null);
	const [selectedNodes, setSelectedNodes] = useState<NodeWithMetadata[]>([]);
	const selectedNodesIds = useMemo(() => map(selectedNodes, (node) => node.id), [selectedNodes]);
	const navigationOccurredRef = useRef(false);

	const selectId = useCallback(
		(node: NodeWithMetadata) => {
			setSelectedNodes((prevState) => {
				if (!maxSelection || maxSelection > 1) {
					const previousNodes = [...prevState];
					const index = findIndex(previousNodes, (prevNode) => prevNode.id === node.id);
					if (index > -1) {
						previousNodes.splice(index, 1);
					} else {
						previousNodes.push(node);
					}
					return previousNodes;
				}
				return [node];
			});
		},
		[maxSelection]
	);

	const unSelectAll = useCallback(() => {
		setSelectedNodes((prevState) => (prevState.length > 0 ? [] : prevState));
	}, []);

	const {
		data: currentFolder,
		loading,
		error: getChildrenError,
		hasMore,
		loadMore
	} = useGetChildrenQuery(openedFolder);
	const [error, setError] = useState<ApolloError | undefined>();
	// load roots data to check whether a node from root list is a valid root or a fake one
	const { data: rootsData } = useGetRootsListQuery();

	useErrorHandler(error, 'NODES_SELECTION_MODAL_CONTENT');

	const checkSelectable = useCallback(
		(node: NodeWithMetadata | RootListItemType) =>
			// folders and roots are never disabled since they must be navigable
			isValidSelection(node),
		[isValidSelection]
	);

	const checkDisabled = useCallback(
		(node: NodeWithMetadata | RootListItemType) =>
			// folders and roots are never disabled since they must be navigable
			isFile(node) && !checkSelectable(node),
		[checkSelectable]
	);

	const nodes = useMemo<Array<NodeListItemType>>(() => {
		if (
			currentFolder?.getNode &&
			isFolder(currentFolder.getNode) &&
			currentFolder.getNode.children.length > 0
		) {
			return reduce<typeof currentFolder.getNode.children[number], NodeListItemType[]>(
				currentFolder.getNode.children,
				(result, node) => {
					if (node) {
						result.push({
							...node,
							disabled: checkDisabled(node),
							selectable: checkSelectable(node)
						});
					}
					return result;
				},
				[]
			);
		}
		return [];
	}, [checkDisabled, checkSelectable, currentFolder]);

	const apolloClient = useApolloClient();

	const getBaseNodeData = useCallback(
		(node: Pick<NodeListItemType, 'id'>) =>
			// for nodes already loaded as child these query should read data in cache
			apolloClient.query<GetBaseNodeQuery, GetBaseNodeQueryVariables>({
				query: GET_BASE_NODE,
				variables: {
					node_id: node.id
				}
			}),
		[apolloClient]
	);

	const setSelectedNodeHandler = useCallback(
		(
			node: Pick<NodeListItemType | RootListItemType, 'id' | '__typename'> | null | undefined,
			event?: React.SyntheticEvent,
			reset?: boolean
		) => {
			/**
			 * Internal util function to set state
			 */
			const setSelectedNodeIfValid = (
				nodeWithMetadata: NodeWithMetadata | null | undefined
			): void => {
				// if is a node already loaded
				if (
					nodeWithMetadata &&
					isValidSelection(nodeWithMetadata) &&
					(canSelectOpenedFolder || nodeWithMetadata.id !== currentFolder?.getNode?.id)
				) {
					event && event.stopPropagation();
					// if is valid set it directly
					selectId(nodeWithMetadata);
				}
			};

			navigationOccurredRef.current = false;
			if (reset) {
				unSelectAll();
			}
			const cachedNode = node?.id
				? apolloClient.readFragment<ChildFragment>({
						fragment: CHILD,
						fragmentName: 'Child',
						// assuming it's a folder, not the best solution
						id: apolloClient.cache.identify(node)
				  })
				: null;
			if (cachedNode?.id) {
				// set directly cached data to make operation immediate
				setSelectedNodeIfValid(cachedNode);
			} else if (node?.id && some(rootsData?.getRootsList, (root) => root?.id === node.id)) {
				// if node is a Root load data in order to check its validity
				getBaseNodeData(node)
					.then((result) => {
						// avoid to set active node if navigation occurred while query was executing
						if (!navigationOccurredRef.current) {
							setSelectedNodeIfValid(result?.data.getNode);
						}
					})
					.catch((err) => {
						setError(err);
					});
			}
		},
		[
			apolloClient,
			canSelectOpenedFolder,
			currentFolder?.getNode?.id,
			getBaseNodeData,
			isValidSelection,
			rootsData?.getRootsList,
			selectId,
			unSelectAll
		]
	);

	const navigateTo = useCallback(
		(id: string) => {
			setOpenedFolder(id || '');
			navigationOccurredRef.current = true;
			if (canSelectOpenedFolder && id) {
				setSelectedNodeHandler({ id, __typename: 'Folder' }, undefined, true);
			} else {
				unSelectAll();
			}
		},
		[canSelectOpenedFolder, setSelectedNodeHandler, unSelectAll]
	);

	const closeHandler = useCallback(() => {
		setSelectedNodeHandler(undefined);
		closeAction();
	}, [closeAction, setSelectedNodeHandler]);

	const confirmHandler = useCallback(() => {
		// read all nodes from cache
		if (selectedNodes.length > 0) {
			confirmAction(selectedNodes as ArrayOneOrMore<NodeWithMetadata>);
		}
	}, [confirmAction, selectedNodes]);

	const confirmDisabled = useMemo(() => selectedNodes.length < 1, [selectedNodes]);

	const resetSelectedNodesHandler = useCallback(() => {
		if (canSelectOpenedFolder && (maxSelection === 1 || selectedNodes.length === 0)) {
			setSelectedNodeHandler(currentFolder?.getNode, undefined, true);
		}
	}, [
		canSelectOpenedFolder,
		currentFolder?.getNode,
		maxSelection,
		selectedNodes.length,
		setSelectedNodeHandler
	]);

	const clickModalHandler = useCallback(
		(event) => {
			if (event.target === mainContainerRef.current?.parentElement) {
				resetSelectedNodesHandler();
			}
		},
		[resetSelectedNodesHandler]
	);

	useEffect(() => {
		// since with modal manager we have not control on modal container, set the reset action through the main container parent
		// it's quite an ugly solution, let's say it's a TODO: find a better solution
		const containerParentElement = mainContainerRef?.current?.parentElement;
		containerParentElement && containerParentElement.addEventListener('click', clickModalHandler);

		return (): void => {
			containerParentElement &&
				containerParentElement.removeEventListener('click', clickModalHandler);
		};
	}, [clickModalHandler]);

	const modalHeight = useMemo(() => (nodes?.length >= 10 ? '60vh' : '40vh'), [nodes?.length]);

	return (
		<Container
			padding={{ all: 'large' }}
			mainAlignment="flex-start"
			crossAlignment="flex-start"
			minHeight="40vh"
			height={modalHeight}
			maxHeight="60vh"
			onClick={resetSelectedNodesHandler}
			ref={mainContainerRef}
		>
			<ModalHeader title={title} closeHandler={closeHandler} />
			<NodeAvatarIconContext.Provider
				value={{
					tooltipLabel: disabledTooltip,
					tooltipDisabled: (nodeDisabled: boolean): boolean => nodeDisabled
				}}
			>
				{currentFolder?.getNode ? (
					<ModalList
						folderId={currentFolder.getNode.id}
						nodes={nodes}
						activeNodes={selectedNodesIds}
						setActiveNode={setSelectedNodeHandler}
						loadMore={loadMore}
						hasMore={hasMore}
						navigateTo={navigateTo}
						error={getChildrenError}
						loading={loading}
						limitNavigation={false}
						allowRootNavigation
					/>
				) : (
					(!loading && (
						<ModalRootsList
							activeNodes={selectedNodesIds}
							setActiveNode={setSelectedNodeHandler}
							navigateTo={navigateTo}
							checkDisabled={checkDisabled}
							checkSelectable={checkSelectable}
							showTrash={false}
						/>
					)) || (
						<Container
							mainAlignment="flex-end"
							crossAlignment="flex-start"
							orientation="horizontal"
						>
							<LoadingIcon icon="Refresh" color="primary" />
						</Container>
					)
				)}
			</NodeAvatarIconContext.Provider>
			<ModalFooter
				confirmLabel={confirmLabel}
				confirmHandler={confirmHandler}
				confirmDisabled={confirmDisabled}
			>
				{(!maxSelection || maxSelection > 1) && selectedNodes.length > 0 && (
					<Container mainAlignment="flex-start" crossAlignment="center" orientation="horizontal">
						<Text size="small" weight="light">
							{t('modal.nodesSelection.selectedCount', '{{count}} element selected', {
								count: selectedNodes.length
							})}
						</Text>
					</Container>
				)}
			</ModalFooter>
		</Container>
	);
};
