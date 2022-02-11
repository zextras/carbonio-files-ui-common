/*
 * SPDX-FileCopyrightText: 2022 Zextras <https://www.zextras.com>
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import React, { useCallback, useEffect, useMemo } from 'react';

import filter from 'lodash/filter';
import { useTranslation } from 'react-i18next';

import { useActiveNode } from '../../../hooks/useActiveNode';
import { useCreateFolderMutation } from '../../hooks/graphql/mutations/useCreateFolderMutation';
import { useGetChildrenQuery } from '../../hooks/graphql/queries/useGetChildrenQuery';
import { useCreateModal } from '../../hooks/modals/useCreateModal';
import { useCreateDocsFile } from '../../hooks/useCreateDocsFile';
import { DocsType, NodeListItemType } from '../../types/common';
import { NonNullableListItem, Unwrap } from '../../types/utils';
import { isFolder } from '../../utils/ActionsFactory';
import { List } from './List';

interface FolderListProps {
	folderId: string;
	newFolder?: boolean;
	setNewFolder: (value: boolean) => void;
	newFile?: DocsType;
	setNewFile: (type: DocsType | undefined) => void;
	canUploadFile: boolean;
	fillerWithActions?: JSX.Element;
}

const FolderList: React.VFC<FolderListProps> = ({
	folderId,
	newFolder,
	setNewFolder,
	newFile,
	setNewFile,
	canUploadFile,
	fillerWithActions
}) => {
	const [t] = useTranslation();
	const { data: currentFolder, loading, hasMore, loadMore } = useGetChildrenQuery(folderId);

	const [createFolder] = useCreateFolderMutation();

	const { setActiveNode } = useActiveNode();

	const createFolderAction = useCallback(
		(_parentId, newName) => {
			if (currentFolder?.getNode && isFolder(currentFolder.getNode)) {
				return createFolder(currentFolder.getNode, newName).then((result) => {
					result.data && setActiveNode(result.data.createFolder.id);
					return result;
				});
			}
			return Promise.reject(new Error('cannot create folder on invalid node'));
		},
		[createFolder, currentFolder?.getNode, setActiveNode]
	);

	const createDocsFile = useCreateDocsFile();

	const createDocsFileAction = useCallback(
		(_parentId, newName) => {
			if (currentFolder?.getNode && isFolder(currentFolder.getNode) && newFile) {
				return createDocsFile(currentFolder?.getNode, newName, newFile).then((result) => {
					result?.data?.getNode && setActiveNode(result.data.getNode.id);
					return result;
				});
			}
			return Promise.reject(new Error('cannot create folder: invalid node or file type'));
		},
		[createDocsFile, currentFolder?.getNode, newFile, setActiveNode]
	);

	const resetNewFolder = useCallback(() => {
		setNewFolder(false);
	}, [setNewFolder]);

	const resetNewFile = useCallback(() => {
		setNewFile(undefined);
	}, [setNewFile]);

	const { openCreateModal: openCreateFolderModal } = useCreateModal(
		t('folder.create.modal.title', 'Create New folder'),
		t('folder.create.modal.input.label.name', 'Folder Name'),
		createFolderAction,
		resetNewFolder
	);

	const { openCreateModal: openCreateFileModal } = useCreateModal(
		// be careful: the following key is not parsed by i18next-extract, it must be added manually to the en.json file
		/* i18next-extract-disable-next-line */
		t(
			`docs.create.modal.title.${(newFile || 'document').toLowerCase()}`,
			`Create New ${(newFile || 'document').toLowerCase()}`
		),
		// be careful: the following key is not parsed by i18next-extract, it must be added manually to the en.json file
		/* i18next-extract-disable-next-line */
		t(
			`docs.create.modal.input.label.name.${(newFile || 'document').toLowerCase()}`,
			`${(newFile || 'document').toLowerCase()} Name`
		),
		createDocsFileAction,
		resetNewFile
	);

	useEffect(() => {
		if (newFolder) {
			openCreateFolderModal(folderId);
		}
	}, [folderId, newFolder, openCreateFolderModal]);

	useEffect(() => {
		if (newFile) {
			openCreateFileModal(folderId);
		}
	}, [openCreateFileModal, folderId, newFile]);

	const nodes = useMemo<NodeListItemType[]>(() => {
		if (
			currentFolder?.getNode &&
			isFolder(currentFolder.getNode) &&
			currentFolder.getNode.children.length > 0
		) {
			const { children } = currentFolder.getNode;
			return filter<Unwrap<typeof children>, NonNullableListItem<typeof children>>(
				children,
				(child): child is NonNullableListItem<typeof children> => child != null
			);
		}
		return [];
	}, [currentFolder]);

	return (
		<List
			nodes={nodes}
			folderId={folderId}
			hasMore={hasMore}
			loadMore={loadMore}
			loading={loading}
			canUpload={canUploadFile}
			fillerWithActions={fillerWithActions}
			emptyListMessage={t('empty.folder.hint', "It looks like there's nothing here.")}
			mainList={canUploadFile}
		/>
	);
};

export default FolderList;
