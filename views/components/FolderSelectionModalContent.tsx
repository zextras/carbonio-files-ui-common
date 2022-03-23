/*
 * SPDX-FileCopyrightText: 2022 Zextras <https://www.zextras.com>
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { useApolloClient } from '@apollo/client';
import { Checkbox, Container, Row, Text } from '@zextras/carbonio-design-system';
import noop from 'lodash/noop';
import reduce from 'lodash/reduce';
import { useTranslation } from 'react-i18next';

import { ROOTS } from '../../constants';
import BASE_NODE from '../../graphql/fragments/baseNode.graphql';
import { useGetChildrenQuery } from '../../hooks/graphql/queries/useGetChildrenQuery';
import { useGetPathQuery } from '../../hooks/graphql/queries/useGetPathQuery';
import { NodeListItemType, RootListItemType } from '../../types/common';
import { BaseNodeFragment, Folder } from '../../types/graphql/types';
import { isFile } from '../../utils/ActionsFactory';
import { ModalFooter } from './ModalFooter';
import { ModalHeader } from './ModalHeader';
import { ModalList } from './ModalList';
import { ModalRootsList } from './ModalRootsList';

interface FolderSelectionModalContentProps {
	folderId?: string;
	cascadeDefault?: boolean;
	confirmAction: (folder: Pick<Folder, 'id' | 'name'>, cascade: boolean) => void;
	closeAction?: () => void;
}

export const FolderSelectionModalContent: React.VFC<FolderSelectionModalContentProps> = ({
	folderId,
	cascadeDefault = false,
	confirmAction,
	closeAction
}) => {
	const [t] = useTranslation();
	const { data: currentFilterPathData } = useGetPathQuery(
		folderId !== ROOTS.SHARED_WITH_ME ? folderId : undefined
	);

	const [selectedFolder, setSelectedFolder] = useState<
		Pick<NodeListItemType, 'id' | 'name'> | undefined | null
	>();
	const [cascade, setCascade] = useState(cascadeDefault);
	const [openedFolder, setOpenedFolder] = useState<string>('');
	const {
		data: currentFolder,
		loading,
		error,
		hasMore,
		loadMore
	} = useGetChildrenQuery(openedFolder);

	useEffect(() => {
		if (currentFilterPathData?.getPath) {
			const { length } = currentFilterPathData.getPath;
			if (length > 0) {
				setSelectedFolder(currentFilterPathData.getPath[length - 1] || undefined);
				if (length > 1) {
					setOpenedFolder(currentFilterPathData.getPath[length - 2]?.id || '');
				}
			}
		} else if (folderId) {
			setSelectedFolder({
				id: folderId,
				/* i18next-extract-disable-next-line */
				name: t('node.alias.name', folderId, { context: folderId })
			});
		} else {
			setSelectedFolder(undefined);
		}
	}, [currentFilterPathData, folderId, t]);

	const checkSelectable = useCallback(
		(node: NodeListItemType | RootListItemType) => !isFile(node),
		[]
	);

	const checkDisabled = useCallback(
		(node: NodeListItemType | RootListItemType) => isFile(node),
		[]
	);

	const nodes = useMemo<Array<NodeListItemType>>(() => {
		if (
			currentFolder?.getNode?.__typename === 'Folder' &&
			currentFolder.getNode.children.length > 0
		) {
			return reduce(
				currentFolder.getNode.children,
				(result: NodeListItemType[], node) => {
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
	}, [checkDisabled, checkSelectable, currentFolder?.getNode]);

	const closeHandler = useCallback(() => {
		setSelectedFolder(undefined);
		closeAction && closeAction();
	}, [closeAction]);

	const confirmHandler = useCallback(() => {
		if (selectedFolder) {
			confirmAction(selectedFolder, cascade);
			closeHandler();
		}
	}, [selectedFolder, confirmAction, cascade, closeHandler]);

	const apolloClient = useApolloClient();

	const navigateTo = useCallback(
		(id: string) => {
			setOpenedFolder(id);
			const node = apolloClient.readFragment<BaseNodeFragment>({
				fragment: BASE_NODE,
				fragmentName: 'BaseNode',
				// assuming it's a folder, not the best solution
				id: apolloClient.cache.identify({ __typename: 'Folder', id })
			});
			if (node) {
				setSelectedFolder(node);
			} else {
				setSelectedFolder(undefined);
			}
		},
		[apolloClient]
	);

	const setDestinationFolderHandler = useCallback(
		(
			node: Pick<NodeListItemType, 'id' | 'name' | 'disabled'>,
			event: React.SyntheticEvent | Event
		) => {
			const destination =
				(node && !node.disabled && node) ||
				(openedFolder === currentFolder?.getNode?.id && currentFolder.getNode) ||
				undefined;
			setSelectedFolder(destination);
			event.stopPropagation();
		},
		[currentFolder, openedFolder]
	);

	const resetDestinationFolderHandler = useCallback(() => {
		setSelectedFolder(currentFolder?.getNode);
	}, [currentFolder]);

	const toggleCascade = useCallback((event: React.SyntheticEvent | Event) => {
		setCascade((prevState) => !prevState);
		event.stopPropagation();
	}, []);

	const confirmDisabled = useMemo(
		() => !selectedFolder || (selectedFolder.id === folderId && cascade === cascadeDefault),
		[selectedFolder, folderId, cascade, cascadeDefault]
	);

	return (
		<Container
			padding={{ all: 'large' }}
			mainAlignment="flex-start"
			crossAlignment="flex-start"
			minHeight="57vh"
			maxHeight="57vh"
			onClick={resetDestinationFolderHandler}
		>
			<ModalHeader
				title={t('search.advancedSearch.modal.folder.modal.title', 'Select a folder')}
				closeHandler={closeHandler}
			/>
			<Container padding={{ vertical: 'small' }} mainAlignment="center" crossAlignment="flex-start">
				<Text overflow="break-word" size="small">
					{t(
						'search.advancedSearch.modal.folder.modal.subtitle',
						'Result will be searched only inside the selected folder'
					)}
				</Text>
			</Container>
			{currentFolder?.getNode ? (
				<ModalList
					folderId={currentFolder.getNode.id}
					nodes={nodes}
					activeNodes={selectedFolder?.id}
					setActiveNode={setDestinationFolderHandler}
					loadMore={loadMore}
					hasMore={hasMore}
					navigateTo={navigateTo}
					error={error}
					loading={loading}
					limitNavigation={false}
					allowRootNavigation
				/>
			) : (
				(!loading && (
					<ModalRootsList
						activeNodes={selectedFolder?.id}
						setActiveNode={setDestinationFolderHandler}
						navigateTo={navigateTo}
						checkDisabled={checkDisabled}
						checkSelectable={checkSelectable}
						showTrash
					/>
				)) || (
					<ModalList
						folderId=""
						nodes={[]}
						setActiveNode={noop}
						loadMore={noop}
						hasMore={false}
						navigateTo={noop}
						loading
					/>
				)
			)}
			<Row padding={{ top: 'large', bottom: 'small' }}>
				<Checkbox
					value={cascade}
					onClick={toggleCascade}
					label={t(
						'search.advancedSearch.modal.folder.modal.cascade',
						'search also in contained folders'
					)}
				/>
			</Row>
			<ModalFooter
				confirmLabel={t('search.advancedSearch.modal.folder.modal.confirm', 'Choose folder')}
				confirmHandler={confirmHandler}
				confirmDisabled={confirmDisabled}
				cancelHandler={closeHandler}
				cancelLabel={t('search.advancedSearch.modal.folder.modal.cancel', 'Go back')}
				cancelButtonColor="secondary"
			/>
		</Container>
	);
};
