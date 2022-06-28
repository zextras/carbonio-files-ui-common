/*
 * SPDX-FileCopyrightText: 2022 Zextras <https://www.zextras.com>
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import React, { useCallback, useContext, useEffect, useMemo } from 'react';

import { useReactiveVar } from '@apollo/client';
import { Container } from '@zextras/carbonio-design-system';
import filter from 'lodash/filter';
import includes from 'lodash/includes';
import map from 'lodash/map';
import size from 'lodash/size';
import { useTranslation } from 'react-i18next';

import ListHeader from '../../../components/ListHeader';
import { useNavigation } from '../../../hooks/useNavigation';
import { uploadVar } from '../../apollo/uploadVar';
import { DRAG_TYPES, ROOTS } from '../../constants';
import { ListContext } from '../../contexts';
import { useCreateSnackbar } from '../../hooks/useCreateSnackbar';
import useSelection from '../../hooks/useSelection';
import { useUpload } from '../../hooks/useUpload';
import { Action, UploadType } from '../../types/common';
import {
	ActionItem,
	buildActionItems,
	getPermittedUploadActions
} from '../../utils/ActionsFactory';
import { Dropzone } from './Dropzone';
import { EmptyFolder } from './EmptyFolder';
import { ScrollContainer } from './ScrollContainer';
import { RoundedButton } from './StyledComponents';
import { UploadListItemWrapper } from './UploadListItemWrapper';

export const UploadList: React.VFC = () => {
	const [t] = useTranslation();

	const { add, removeById, removeAllCompleted, retryById } = useUpload();
	const uploadStatusMap = useReactiveVar<{ [id: string]: UploadType }>(uploadVar);
	const uploadStatus = useMemo(() => map(uploadStatusMap, (value) => value), [uploadStatusMap]);

	const uploadStatusSizeIsZero = useMemo(() => uploadStatus.length === 0, [uploadStatus]);

	const { setIsEmpty } = useContext(ListContext);

	useEffect(() => {
		setIsEmpty(uploadStatusSizeIsZero);
	}, [setIsEmpty, uploadStatusSizeIsZero]);

	const crumbs = useMemo(
		() => [
			{
				id: 'uploadCrumbs',
				label: t('secondaryBar.uploads', 'Uploads')
			}
		],
		[t]
	);

	const {
		selectedIDs,
		selectedMap,
		selectId,
		isSelectionModeActive,
		unSelectAll,
		selectAll,
		exitSelectionMode
	} = useSelection(uploadStatus);

	const selectedItems = useMemo(
		() => filter(uploadStatus, (item) => includes(selectedIDs, item.id)),
		[uploadStatus, selectedIDs]
	);

	const permittedUploadActions = useMemo(
		() => getPermittedUploadActions(selectedItems),
		[selectedItems]
	);

	const items = useMemo(
		() =>
			map(uploadStatus, (item) => (
				<UploadListItemWrapper
					key={item.id}
					node={item}
					isSelected={selectedMap && selectedMap[item.id]}
					isSelectionModeActive={isSelectionModeActive}
					selectId={selectId}
				/>
			)),
		[isSelectionModeActive, uploadStatus, selectId, selectedMap]
	);

	const removeUploadSelection = useCallback(() => {
		removeById(selectedIDs);
		unSelectAll();
	}, [removeById, selectedIDs, unSelectAll]);

	const retryUploadSelection = useCallback(() => {
		retryById(selectedIDs);
		unSelectAll();
	}, [retryById, selectedIDs, unSelectAll]);

	const { navigateToFolder } = useNavigation();

	const goToFolderSelection = useCallback(() => {
		unSelectAll();
		navigateToFolder(selectedItems[0].parentId);
	}, [navigateToFolder, selectedItems, unSelectAll]);

	const itemsMap = useMemo<Partial<Record<Action, ActionItem>>>(
		() => ({
			[Action.removeUpload]: {
				id: 'removeUpload',
				icon: 'CloseCircleOutline',
				label: t('actions.removeUpload', 'Remove upload'),
				click: removeUploadSelection
			},
			[Action.RetryUpload]: {
				id: 'RetryUpload',
				icon: 'PlayCircleOutline',
				label: t('actions.retryUpload', 'Retry upload'),
				click: retryUploadSelection
			},
			[Action.GoToFolder]: {
				id: 'GoToFolder ',
				icon: 'FolderOutline',
				label: t('actions.goToFolder', 'Go to destination folder'),
				click: goToFolderSelection
			}
		}),
		[removeUploadSelection, goToFolderSelection, retryUploadSelection, t]
	);

	const permittedSelectionModePrimaryActionsItems = useMemo(
		() => buildActionItems(itemsMap, permittedUploadActions),
		[itemsMap, permittedUploadActions]
	);

	const createSnackbar = useCreateSnackbar();

	const uploadWithDragAndDrop = useCallback(
		(event) => {
			add(event.dataTransfer.files, ROOTS.LOCAL_ROOT, true);
			createSnackbar({
				key: new Date().toLocaleString(),
				type: 'info',
				label: t('uploads.destination.home', "Upload occurred in Files' Home"),
				actionLabel: t('snackbar.upload.goToFolder', 'Go to folder'),
				onActionClick: () => {
					navigateToFolder(ROOTS.LOCAL_ROOT);
				},
				replace: false,
				hideButton: true
			});
		},
		[add, createSnackbar, navigateToFolder, t]
	);

	const dropzoneModal = useMemo(
		() => ({
			title: t('uploads.dropzone.title.enabled', 'Drag&Drop Mode'),
			message: t(
				'uploads.dropzone.message.otherView.enabled',
				'Drop here your attachments \n to quick-add them to your Home'
			),
			icons: ['ImageOutline', 'FileAddOutline', 'FilmOutline']
		}),
		[t]
	);

	const headerAction = useMemo(
		() =>
			items.length > 0 && (
				<RoundedButton
					type="outlined"
					label={t('uploads.clean.completed', 'Clean completed uploads')}
					icon="CloseOutline"
					onClick={removeAllCompleted}
				/>
			),
		[items.length, removeAllCompleted, t]
	);

	return (
		<Container
			mainAlignment="flex-start"
			data-testid={'list-uploads'}
			maxHeight="100%"
			background="gray6"
		>
			<ListHeader
				crumbs={crumbs}
				isSelectionModeActive={isSelectionModeActive}
				unSelectAll={unSelectAll}
				selectAll={selectAll}
				permittedSelectionModeActionsItems={permittedSelectionModePrimaryActionsItems}
				actionComponent={headerAction}
				exitSelectionMode={exitSelectionMode}
				isAllSelected={size(selectedIDs) === size(items)}
			/>
			<Dropzone
				onDrop={uploadWithDragAndDrop}
				title={dropzoneModal.title}
				message={dropzoneModal.message}
				icons={dropzoneModal.icons}
				effect="copy"
				types={[DRAG_TYPES.upload]}
			>
				{(): JSX.Element =>
					items.length > 0 ? (
						<ScrollContainer>{items}</ScrollContainer>
					) : (
						<EmptyFolder message={t('empty.filter.hint', "It looks like there's nothing here.")} />
					)
				}
			</Dropzone>
		</Container>
	);
};
