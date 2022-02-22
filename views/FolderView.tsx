/*
 * SPDX-FileCopyrightText: 2022 Zextras <https://www.zextras.com>
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { useQuery } from '@apollo/client';
import { Container, Responsive } from '@zextras/carbonio-design-system';
import { ACTION_TYPES } from '@zextras/carbonio-shell-ui';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';

import { useCreateOptions } from '../../hooks/useCreateOptions';
import { DISPLAYER_WIDTH, FILES_APP_ID, LIST_WIDTH, ROOTS } from '../constants';
import { ListContext } from '../contexts';
import GET_PERMISSIONS from '../graphql/queries/getPermissions.graphql';
import useQueryParam from '../hooks/useQueryParam';
import { useUpload } from '../hooks/useUpload';
import { DocsType, URLParams } from '../types/common';
import { ActionItem, canCreateFile, canCreateFolder, canUploadFile } from '../utils/ActionsFactory';
import { inputElement } from '../utils/utils';
import { Displayer } from './components/Displayer';
import { EmptySpaceFiller } from './components/EmptySpaceFiller';
import FolderList from './components/FolderList';

const FolderView: React.VFC = () => {
	const { rootId } = useParams<URLParams>();
	const folderId = useQueryParam('folder');
	const [newFolder, setNewFolder] = useState(false);
	const [newFile, setNewFile] = useState<DocsType | undefined>();
	const [t] = useTranslation();
	const { setCreateOptions } = useCreateOptions();
	const [isEmpty, setIsEmpty] = useState(false);

	const { add } = useUpload();

	const inputElementOnchange = useCallback(
		(ev: Event) => {
			if (ev.currentTarget instanceof HTMLInputElement && ev.currentTarget.files) {
				add(ev.currentTarget.files, folderId || rootId || ROOTS.LOCAL_ROOT);
				// required to select 2 times the same file/files
				if (ev.target instanceof HTMLInputElement) {
					ev.target.value = '';
				}
			}
		},
		[add, folderId, rootId]
	);

	const { data: permissionsData } = useQuery(GET_PERMISSIONS, {
		variables: {
			id: folderId || rootId || ROOTS.LOCAL_ROOT
		}
	});

	const isCanUploadFile = useMemo(
		() => permissionsData?.getNode && canUploadFile(permissionsData.getNode),
		[permissionsData]
	);

	const isCanCreateFolder = useMemo(
		() => permissionsData?.getNode && canCreateFolder(permissionsData.getNode),
		[permissionsData]
	);

	const isCanCreateFile = useMemo(
		() => permissionsData?.getNode && canCreateFile(permissionsData.getNode),
		[permissionsData]
	);

	const createFolderAction = useCallback((event) => {
		event && event.stopPropagation();
		setNewFolder(true);
	}, []);

	const createDocumentAction = useCallback((event) => {
		event && event.stopPropagation();
		setNewFile(DocsType.DOCUMENT);
	}, []);

	const createSpreadsheetAction = useCallback((event) => {
		event && event.stopPropagation();
		setNewFile(DocsType.SPREADSHEET);
	}, []);

	const createPresentationAction = useCallback((event) => {
		event && event.stopPropagation();
		setNewFile(DocsType.PRESENTATION);
	}, []);

	const actions = useMemo<ActionItem[]>(() => {
		const fillerActions: ActionItem[] = [];
		fillerActions.push(
			{
				id: 'create-folder',
				label: t('create.options.new.folder', 'New Folder'),
				icon: 'FolderOutline',
				click: createFolderAction,
				disabled: !isCanCreateFolder
			},
			{
				id: 'create-docs-document',
				label: t('create.options.new.document', 'New Document'),
				icon: 'FileTextOutline',
				click: createDocumentAction,
				disabled: !isCanCreateFile
			},
			{
				id: 'create-docs-spreadsheet',
				label: t('create.options.new.spreadsheet', 'New Spreadsheet'),
				icon: 'FileCalcOutline',
				click: createSpreadsheetAction,
				disabled: !isCanCreateFile
			},
			{
				id: 'create-docs-presentation',
				label: t('create.options.new.presentation', 'New Presentation'),
				icon: 'FilePresentationOutline',
				click: createPresentationAction,
				disabled: !isCanCreateFile
			}
		);
		return fillerActions;
	}, [
		createDocumentAction,
		createFolderAction,
		createPresentationAction,
		createSpreadsheetAction,
		isCanCreateFile,
		isCanCreateFolder,
		t
	]);

	useEffect(() => {
		setCreateOptions(
			{
				type: ACTION_TYPES.NEW,
				id: 'upload-file',
				action: () => ({
					type: ACTION_TYPES.NEW,
					id: 'upload-file',
					primary: true,
					group: FILES_APP_ID,
					label: t('create.options.new.upload', 'Upload'),
					icon: 'CloudUploadOutline',
					click: (event): void => {
						// eslint-disable-next-line @typescript-eslint/ban-ts-comment
						// @ts-ignore
						event && event.stopPropagation();
						inputElement.click();
						inputElement.onchange = inputElementOnchange;
					},
					disabled: !isCanUploadFile
				})
			},
			{
				type: ACTION_TYPES.NEW,
				id: 'create-folder',
				action: () => ({
					type: ACTION_TYPES.NEW,
					id: 'create-folder',
					group: FILES_APP_ID,
					label: t('create.options.new.folder', 'New Folder'),
					icon: 'FolderOutline',
					click: createFolderAction,
					disabled: !isCanCreateFolder
				})
			},
			{
				type: ACTION_TYPES.NEW,
				id: 'create-docs-document',
				action: () => ({
					type: ACTION_TYPES.NEW,
					id: 'create-docs-document',
					group: FILES_APP_ID,
					label: t('create.options.new.document', 'New Document'),
					icon: 'FileTextOutline',
					click: createDocumentAction,
					disabled: !isCanCreateFile
				})
			},
			{
				type: ACTION_TYPES.NEW,
				id: 'create-docs-spreadsheet',
				action: () => ({
					type: ACTION_TYPES.NEW,
					id: 'create-docs-spreadsheet',
					group: FILES_APP_ID,
					label: t('create.options.new.spreadsheet', 'New Spreadsheet'),
					icon: 'FileCalcOutline',
					click: createSpreadsheetAction,
					disabled: !isCanCreateFile
				})
			},
			{
				type: ACTION_TYPES.NEW,
				id: 'create-docs-presentation',
				action: () => ({
					type: ACTION_TYPES.NEW,
					id: 'create-docs-presentation',
					group: FILES_APP_ID,
					label: t('create.options.new.presentation', 'New Presentation'),
					icon: 'FilePresentationOutline',
					click: createPresentationAction,
					disabled: !isCanCreateFile
				})
			}
		);

		return (): void => {
			setCreateOptions({
				type: ACTION_TYPES.NEW,
				id: 'upload-file',
				action: () => ({
					type: ACTION_TYPES.NEW,
					id: 'upload-file',
					primary: true,
					group: FILES_APP_ID,
					label: t('create.options.new.upload', 'Upload'),
					icon: 'CloudUploadOutline',
					click: (event): void => {
						// eslint-disable-next-line @typescript-eslint/ban-ts-comment
						// @ts-ignore
						event && event.stopPropagation();
						inputElement.click();
						inputElement.onchange = inputElementOnchange;
					},
					disabled: !isCanUploadFile
				})
			});
		};
	}, [
		createDocumentAction,
		createFolderAction,
		createPresentationAction,
		createSpreadsheetAction,
		inputElementOnchange,
		isCanCreateFile,
		isCanCreateFolder,
		isCanUploadFile,
		setCreateOptions,
		t
	]);

	return (
		<ListContext.Provider value={{ isEmpty, setIsEmpty }}>
			<Container
				orientation="row"
				crossAlignment="flex-start"
				mainAlignment="flex-start"
				width="fill"
				height="fill"
				background="gray5"
				borderRadius="none"
				maxHeight="100%"
			>
				<Responsive mode="desktop" target={window.top}>
					<Container
						width={LIST_WIDTH}
						mainAlignment="flex-start"
						crossAlignment="unset"
						borderRadius="none"
						background="gray6"
					>
						<FolderList
							folderId={folderId || rootId || ROOTS.LOCAL_ROOT}
							newFolder={newFolder}
							setNewFolder={setNewFolder}
							newFile={newFile}
							setNewFile={setNewFile}
							canUploadFile={isCanUploadFile}
							fillerWithActions={<EmptySpaceFiller actions={actions} />}
						/>
					</Container>
					<Container
						width={DISPLAYER_WIDTH}
						mainAlignment="flex-start"
						crossAlignment="flex-start"
						borderRadius="none"
						style={{ maxHeight: '100%' }}
					>
						<Displayer translationKey="displayer.folder" />
					</Container>
				</Responsive>
				<Responsive mode="mobile" target={window.top}>
					<FolderList
						folderId={folderId || rootId || ROOTS.LOCAL_ROOT}
						newFolder={newFolder}
						setNewFolder={setNewFolder}
						newFile={newFile}
						setNewFile={setNewFile}
						canUploadFile={isCanUploadFile}
						fillerWithActions={<EmptySpaceFiller actions={actions} />}
					/>
				</Responsive>
			</Container>
		</ListContext.Provider>
	);
};

export default FolderView;
