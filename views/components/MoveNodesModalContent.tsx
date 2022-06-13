/*
 * SPDX-FileCopyrightText: 2022 Zextras <https://www.zextras.com>
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Container, Text } from '@zextras/carbonio-design-system';
import find from 'lodash/find';
import reduce from 'lodash/reduce';
import { useTranslation } from 'react-i18next';

import useUserInfo from '../../../hooks/useUserInfo';
import { useMoveNodesMutation } from '../../hooks/graphql/mutations/useMoveNodesMutation';
import { useGetChildrenQuery } from '../../hooks/graphql/queries/useGetChildrenQuery';
import { Node, NodeListItemType } from '../../types/common';
import { Folder, GetChildrenQuery } from '../../types/graphql/types';
import { canBeMoveDestination, isFile, isFolder } from '../../utils/ActionsFactory';
import { ModalFooter } from './ModalFooter';
import { ModalHeader } from './ModalHeader';
import { ModalList } from './ModalList';

interface MoveNodesModalContentProps {
	nodesToMove: Array<Pick<Node, '__typename' | 'id' | 'owner'>>;
	folderId: string;
	closeAction?: () => void;
}

export const MoveNodesModalContent: React.VFC<MoveNodesModalContentProps> = ({
	closeAction,
	nodesToMove,
	folderId
}) => {
	const [t] = useTranslation();
	const [destinationFolder, setDestinationFolder] = useState<string>();
	const [openedFolder, setOpenedFolder] = useState<string>(folderId || '');
	const {
		data: currentFolder,
		loadMore,
		hasMore,
		loading,
		error
	} = useGetChildrenQuery(openedFolder);
	const mainContainerRef = useRef<HTMLDivElement>();

	/** Mutation to move nodes * */
	const { moveNodes, loading: moveNodesMutationLoading } = useMoveNodesMutation();

	const title = useMemo(
		() =>
			t('node.move.modal.title', 'Move items', {
				count: nodesToMove.length,
				replace: { node: nodesToMove.length === 1 && nodesToMove[0] }
			}),
		[nodesToMove, t]
	);

	const movingFile = useMemo(
		() => find(nodesToMove, (node) => isFile(node)) !== undefined,
		[nodesToMove]
	);

	const movingFolder = useMemo(
		() => find(nodesToMove, (node) => isFolder(node)) !== undefined,
		[nodesToMove]
	);

	const { me } = useUserInfo();

	const nodes = useMemo<Array<NodeListItemType>>(() => {
		if (
			currentFolder?.getNode?.__typename === 'Folder' &&
			currentFolder.getNode.children.length > 0
		) {
			return reduce(
				currentFolder.getNode.children,
				(result: NodeListItemType[], node) => {
					if (node) {
						// in move modal, if a node cannot be a move destination, then it is fully disabled
						// and cannot be navigated if it is a folder (out of workspace)
						const isSelectable = node && canBeMoveDestination(node, nodesToMove, me);
						result.push({
							...node,
							disabled: !isSelectable,
							selectable: isSelectable
						});
					}
					return result;
				},
				[]
			);
		}
		return [];
	}, [currentFolder, me, nodesToMove]);

	const closeHandler = useCallback(() => {
		setDestinationFolder(undefined);
		closeAction && closeAction();
	}, [closeAction]);

	const confirmHandler = useCallback(() => {
		const destinationFolderNode =
			destinationFolder === currentFolder?.getNode?.id
				? currentFolder?.getNode
				: find(nodes, ['id', destinationFolder]);

		// reset the opened folder so that the eviction of the children in the mutation does not run a new network query
		if (destinationFolderNode) {
			moveNodes(destinationFolderNode as Folder, ...nodesToMove).then((result) => {
				if (result.data?.moveNodes?.length === nodesToMove.length) {
					closeHandler();
				}
			});
		}
	}, [destinationFolder, currentFolder, nodes, moveNodes, nodesToMove, closeHandler]);

	const navigateTo = useCallback((id: string, event?: React.SyntheticEvent) => {
		setOpenedFolder(id);
		setDestinationFolder(id);
		event && event.stopPropagation();
	}, []);

	const setDestinationFolderHandler = useCallback(
		(node: Pick<NodeListItemType, 'id' | 'disabled'>, event: React.SyntheticEvent) => {
			const destinationId =
				(node && !node.disabled && node.id) || (currentFolder as GetChildrenQuery)?.getNode?.id;
			setDestinationFolder(destinationId);
			event.stopPropagation();
		},
		[currentFolder]
	);

	const resetDestinationFolderHandler = useCallback(() => {
		setDestinationFolder(currentFolder?.getNode?.id);
	}, [currentFolder]);

	const clickModalHandler = useCallback(
		(event) => {
			if (event.target === mainContainerRef.current?.parentElement) {
				resetDestinationFolderHandler();
			}
		},
		[resetDestinationFolderHandler]
	);

	useEffect(() => {
		// since with modal manager we have not control on modal container, set the reset action through the main container parent
		// it's quite an ugly solution, let's say it's a TODO: find a better solution
		const containerElement = mainContainerRef?.current;
		if (containerElement?.parentElement) {
			mainContainerRef.current?.parentNode?.addEventListener('click', clickModalHandler);
		}

		return (): void => {
			containerElement?.parentNode?.removeEventListener('click', clickModalHandler);
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
			onClick={resetDestinationFolderHandler}
			ref={mainContainerRef}
		>
			<ModalHeader title={title} closeHandler={closeHandler} />
			<Container
				padding={{ vertical: 'small' }}
				mainAlignment="center"
				crossAlignment="flex-start"
				height="fit"
			>
				<Text overflow="break-word" size="small">
					{t('node.move.modal.subtitle', 'Select a destination folder:')}
				</Text>
			</Container>
			<ModalList
				folderId={currentFolder?.getNode?.id || ''}
				nodes={nodes}
				activeNodes={destinationFolder}
				setActiveNode={setDestinationFolderHandler}
				loadMore={loadMore}
				hasMore={hasMore}
				navigateTo={navigateTo}
				loading={loading}
				writingFile={movingFile}
				writingFolder={movingFolder}
				limitNavigation
			/>
			<ModalFooter
				confirmLabel={t('node.move.modal.button.confirm', 'Move')}
				confirmHandler={confirmHandler}
				confirmDisabled={
					!destinationFolder || destinationFolder === folderId || moveNodesMutationLoading
				}
				confirmDisabledTooltip={t(
					'node.move.modal.button.tooltip.confirm',
					"You can't perform this action here"
				)}
			/>
		</Container>
	);
};
