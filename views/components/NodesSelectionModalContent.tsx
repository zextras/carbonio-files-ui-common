/*
 * SPDX-FileCopyrightText: 2022 Zextras <https://www.zextras.com>
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import React, { useCallback, useMemo, useState } from 'react';

import { ApolloError, useApolloClient } from '@apollo/client';
import { Container, Text } from '@zextras/carbonio-design-system';
import reduce from 'lodash/reduce';
import some from 'lodash/some';
import { useTranslation } from 'react-i18next';

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
import { isFolder } from '../../utils/ActionsFactory';
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
	isValidSelection?: (node: NodeWithMetadata) => boolean;
}

export const NodesSelectionModalContent: React.VFC<NodesSelectionModalContentProps> = ({
	title,
	confirmAction,
	confirmLabel,
	closeAction,
	isValidSelection = (): boolean => true // by default all nodes are active
}) => {
	const [t] = useTranslation();
	const [selectedNodes, setSelectedNodes] = useState<
		ArrayOneOrMore<NodeWithMetadata> | undefined
	>();
	const [openedFolder, setOpenedFolder] = useState<string>('');
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
							disabled: !isValidSelection(node)
						});
					}
					return result;
				},
				[]
			);
		}
		return [];
	}, [isValidSelection, currentFolder]);

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
			event?: React.SyntheticEvent
		) => {
			/**
			 * Internal util function to set state
			 */
			const setSelectedNodeIfValid = (
				nodeWithMetadata: NodeWithMetadata | null | undefined
			): void => {
				// if is a node already loaded
				if (nodeWithMetadata && isValidSelection(nodeWithMetadata)) {
					// if is valid set it directly
					setSelectedNodes([nodeWithMetadata]);
				} else if (nodeWithMetadata?.id && nodeWithMetadata.id !== currentFolder?.getNode?.id) {
					// if node is not the opened folder, try to set currentFolder as the selected node
					setSelectedNodeHandler(currentFolder?.getNode);
				} else {
					// otherwise, reset state to undefined
					setSelectedNodes(undefined);
				}
			};

			// TODO: manage multiple selection
			event && event.stopPropagation();
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
						setSelectedNodeIfValid(result?.data.getNode);
					})
					.catch((err) => {
						setError(err);
						// TODO: in case of multiple selection, leave state as it is and reset selection check icon instead
						// current root potentially is a valid selection, but cannot be read because of some error
						// reset state so that it is clear that no item is selected
						setSelectedNodes(undefined);
					});
			} else {
				// node is not in cache nor is a valid root
				setSelectedNodeIfValid(undefined);
			}
		},
		[
			apolloClient,
			currentFolder?.getNode,
			getBaseNodeData,
			isValidSelection,
			rootsData?.getRootsList
		]
	);

	const navigateTo = useCallback(
		(id: string) => {
			setOpenedFolder(id || '');
			setSelectedNodeHandler({ id, __typename: 'Folder' });
		},
		[setSelectedNodeHandler]
	);

	const closeHandler = useCallback(() => {
		setSelectedNodeHandler(undefined);
		closeAction();
	}, [closeAction, setSelectedNodeHandler]);

	const confirmHandler = useCallback(() => {
		if (selectedNodes) {
			confirmAction(selectedNodes);
		}
	}, [confirmAction, selectedNodes]);

	const confirmDisabled = useMemo(() => !selectedNodes, [selectedNodes]);

	const resetSelectedNodesHandler = useCallback(() => {
		setSelectedNodeHandler(currentFolder?.getNode);
	}, [currentFolder?.getNode, setSelectedNodeHandler]);

	const modalHeight = useMemo(() => (nodes?.length >= 10 ? '60vh' : '40vh'), [nodes?.length]);

	const checkDisabled = useCallback(
		(node: NodeWithMetadata) => !isValidSelection(node),
		[isValidSelection]
	);

	return (
		<Container
			padding={{ all: 'large' }}
			mainAlignment="flex-start"
			crossAlignment="flex-start"
			minHeight="40vh"
			height={modalHeight}
			maxHeight="60vh"
			onClick={resetSelectedNodesHandler}
		>
			<ModalHeader title={title} closeHandler={closeHandler} />
			{currentFolder?.getNode ? (
				<ModalList
					folderId={currentFolder.getNode.id}
					nodes={nodes}
					activeNode={(selectedNodes?.length === 1 && selectedNodes[0].id) || undefined}
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
						activeNode={(selectedNodes?.length === 1 && selectedNodes[0].id) || undefined}
						setActiveNode={setSelectedNodeHandler}
						navigateTo={navigateTo}
						checkDisabled={checkDisabled}
						showTrash={false}
					/>
				)) || (
					<Container mainAlignment="flex-end" crossAlignment="flex-start" orientation="horizontal">
						<LoadingIcon icon="Refresh" color="primary" />
					</Container>
				)
			)}
			<ModalFooter
				confirmLabel={confirmLabel}
				confirmHandler={confirmHandler}
				confirmDisabled={confirmDisabled}
			>
				{selectedNodes && (
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
