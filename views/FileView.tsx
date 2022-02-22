/*
 * SPDX-FileCopyrightText: 2022 Zextras <https://www.zextras.com>
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import React, { useEffect, useState } from 'react';

import { Container, Responsive } from '@zextras/carbonio-design-system';
import { ACTION_TYPES } from '@zextras/carbonio-shell-ui';
import noop from 'lodash/noop';
import { useTranslation } from 'react-i18next';

import { FILES_APP_ID } from '../../constants';
import { useCreateOptions } from '../../hooks/useCreateOptions';
import { DISPLAYER_WIDTH, LIST_WIDTH } from '../constants';
import { ListContext } from '../contexts';
import useQueryParam from '../hooks/useQueryParam';
import { Displayer } from './components/Displayer';
import FileList from './components/FileList';

const FileView: React.VFC = () => {
	const fileId = useQueryParam('file');
	const [t] = useTranslation();
	const { setCreateOptions } = useCreateOptions();
	const [isEmpty, setIsEmpty] = useState(false);

	useEffect(() => {
		setCreateOptions(
			{
				id: 'upload-file',
				type: ACTION_TYPES.NEW,
				action: () => ({
					type: ACTION_TYPES.NEW,
					group: FILES_APP_ID,
					id: 'upload-file',
					label: t('create.options.new.upload', 'Upload'),
					icon: 'CloudUploadOutline',
					click: noop,
					primary: true,
					disabled: true
				})
			},
			{
				id: 'create-folder',
				type: ACTION_TYPES.NEW,
				action: () => ({
					id: 'create-folder',
					group: FILES_APP_ID,
					type: ACTION_TYPES.NEW,
					label: t('create.options.new.folder', 'New Folder'),
					icon: 'FolderOutline',
					click: noop,
					disabled: true
				})
			},
			{
				id: 'create-docs-document',
				type: ACTION_TYPES.NEW,
				action: () => ({
					id: 'create-docs-document',
					group: FILES_APP_ID,
					type: ACTION_TYPES.NEW,
					label: t('create.options.new.document', 'New Document'),
					icon: 'FileTextOutline',
					click: noop,
					disabled: true
				})
			},
			{
				id: 'create-docs-spreadsheet',
				type: ACTION_TYPES.NEW,
				action: () => ({
					id: 'create-docs-spreadsheet',
					group: FILES_APP_ID,
					type: ACTION_TYPES.NEW,
					label: t('create.options.new.spreadsheet', 'New Spreadsheet'),
					icon: 'FileCalcOutline',
					click: noop,
					disabled: true
				})
			},
			{
				id: 'create-docs-presentation',
				type: ACTION_TYPES.NEW,
				action: () => ({
					id: 'create-docs-presentation',
					group: FILES_APP_ID,
					type: ACTION_TYPES.NEW,
					label: t('create.options.new.presentation', 'New Presentation'),
					icon: 'FilePresentationOutline',
					click: noop,
					disabled: true
				})
			}
		);

		return (): void => {
			setCreateOptions({
				type: ACTION_TYPES.NEW,
				id: 'upload-file',
				action: () => ({
					id: 'upload-file',
					primary: true,
					group: FILES_APP_ID,
					type: ACTION_TYPES.NEW,
					label: t('create.options.new.upload', 'Upload'),
					icon: 'CloudUploadOutline',
					click: noop,
					disabled: false
				})
			});
		};
	}, [setCreateOptions, t]);

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
						<FileList fileId={fileId || ''} canUploadFile={false} />
					</Container>
					<Container
						width={DISPLAYER_WIDTH}
						mainAlignment="flex-start"
						crossAlignment="flex-start"
						borderRadius="none"
						style={{ maxHeight: '100%' }}
					>
						<Displayer translationKey="displayer.generic" />
					</Container>
				</Responsive>
				<Responsive mode="mobile" target={window.top}>
					<FileList fileId={fileId || ''} canUploadFile={false} />
				</Responsive>
			</Container>
		</ListContext.Provider>
	);
};

export default FileView;
