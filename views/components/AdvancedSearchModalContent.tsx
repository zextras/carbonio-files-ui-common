/*
 * SPDX-FileCopyrightText: 2022 Zextras <https://www.zextras.com>
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import React, { useCallback, useMemo, useState } from 'react';

import { ChipInput, Container, CustomModal, getColor, Row } from '@zextras/carbonio-design-system';
import every from 'lodash/every';
import isArray from 'lodash/isArray';
import isEmpty from 'lodash/isEmpty';
import isEqual from 'lodash/isEqual';
import { useTranslation } from 'react-i18next';
import styled from 'styled-components';

import { useActiveNode } from '../../../hooks/useActiveNode';
import { ROOTS } from '../../constants';
import { AdvancedFilters, ChipProps } from '../../types/common';
import { Folder } from '../../types/graphql/types';
import { AdvancedSwitch } from './AdvancedSwitch';
import { FolderSelectionModalContent } from './FolderSelectionModalContent';
import { ModalFooter } from './ModalFooter';
import { ModalHeader } from './ModalHeader';

const CustomChipInput = styled(ChipInput)`
	& div[contenteditable] {
		min-width: 1px;
		width: fit-content;
	}
`;

const FolderChipInput = styled(CustomChipInput)`
	cursor: pointer;
`;

const FolderChipInputContainer = styled(Container)`
	&:hover {
		& > div,
		${FolderChipInput} {
			background-color: ${getColor('gray5.hover')};
		}
	}
`;

interface AdvancedSearchModalContentProps {
	filters: AdvancedFilters;
	closeAction: () => void;
	searchAdvancedFilters: (advancedFilters: AdvancedFilters) => void;
}

export const AdvancedSearchModalContent: React.VFC<AdvancedSearchModalContentProps> = ({
	filters,
	closeAction,
	searchAdvancedFilters
}) => {
	const { activeNodeId, removeActiveNode } = useActiveNode();
	const [t] = useTranslation();
	const [currentFilters, setCurrentFilters] = useState<AdvancedFilters>(filters);
	const [keywordsTextContent, setKeywordsTextContent] = useState<string>();

	const searchDisabled = useMemo(
		() =>
			(isEmpty(currentFilters) ||
				every(currentFilters, (filter) => isEmpty(filter)) ||
				isEqual(currentFilters, filters)) &&
			isEmpty(keywordsTextContent),
		[currentFilters, filters, keywordsTextContent]
	);

	const confirmHandler = useCallback(() => {
		searchAdvancedFilters(currentFilters);
		if (activeNodeId) {
			removeActiveNode();
		}
		closeAction();
	}, [activeNodeId, closeAction, currentFilters, removeActiveNode, searchAdvancedFilters]);

	const closeHandler = useCallback(() => {
		closeAction();
	}, [closeAction]);

	const resetFilters = useCallback(() => {
		setCurrentFilters({});
	}, []);

	const updateFilter = useCallback(
		(key: keyof AdvancedFilters, value: AdvancedFilters[typeof key] | undefined) => {
			// if the filter is not set, delete the field from the filters
			if (isEmpty(value)) {
				setCurrentFilters((prevState) => {
					const newState = { ...prevState };
					delete newState[key];
					return newState;
				});
			} else {
				setCurrentFilters((prevState) => ({ ...prevState, [key]: value }));
			}
		},
		[]
	);

	const keywordsOnChange = useCallback(
		(newKeywords: AdvancedFilters['keywords']) => {
			updateFilter('keywords', newKeywords);
			setKeywordsTextContent('');
		},
		[updateFilter]
	);

	const keywordsOnAdd = useCallback<(keyword: string) => ChipProps>(
		(keyword: string) => ({
			label: keyword,
			hasAvatar: false,
			value: keyword,
			background: 'gray2'
		}),
		[]
	);

	const keywordsOnType = useCallback(
		({ textContent }: React.KeyboardEvent & { textContent: string }) => {
			setKeywordsTextContent(textContent);
		},
		[]
	);

	const flaggedOnChange = useCallback(
		(newValue) => {
			updateFilter(
				'flagged',
				newValue
					? {
							label: t('search.advancedSearch.modal.flagged.label', 'Flagged'),
							avatarIcon: 'Flag',
							avatarBackground: 'error',
							background: 'gray2',
							value: true
					  }
					: undefined
			);
		},
		[t, updateFilter]
	);

	const sharedOnChange = useCallback(
		(newValue) => {
			updateFilter(
				'sharedByMe',
				newValue
					? {
							label: t('search.advancedSearch.modal.shared.label', 'Shared'),
							avatarIcon: 'Share',
							avatarBackground: 'secondary',
							background: 'gray2',
							value: true
					  }
					: undefined
			);
		},
		[t, updateFilter]
	);

	const folderOnChange = useCallback(
		(folder: Pick<Folder, 'id' | 'name'> | never[], cascade?: boolean) => {
			if (!isArray(folder) && !isEmpty(folder)) {
				updateFilter('folderId', {
					/* i18next-extract-disable-next-line */
					label: t('node.alias.name', folder.name, { context: folder.id }),
					avatarIcon: 'Folder',
					avatarBackground: 'secondary',
					background: 'gray2',
					onClick: (event: React.SyntheticEvent): void => {
						event.stopPropagation();
					},
					value: (folder.id !== ROOTS.SHARED_WITH_ME && folder.id) || undefined
				});
				updateFilter(
					'sharedWithMe',
					(folder.id === ROOTS.LOCAL_ROOT && { value: false }) ||
						(folder.id === ROOTS.SHARED_WITH_ME && { value: true }) ||
						undefined
				);
				updateFilter('cascade', { value: cascade });
			} else {
				updateFilter('folderId', undefined);
				updateFilter('sharedWithMe', undefined);
				updateFilter('cascade', undefined);
			}
		},
		[t, updateFilter]
	);

	const [folderSelectionModalOpen, setFolderSelectionModalOpen] = useState(false);

	const openFolderSelectionModal = useCallback((event: React.SyntheticEvent) => {
		event.stopPropagation();
		setFolderSelectionModalOpen(true);
	}, []);

	const closeFolderSelectionModal = useCallback(() => {
		setFolderSelectionModalOpen(false);
	}, []);

	return (
		<>
			<Container padding={{ bottom: 'medium' }}>
				<ModalHeader
					title={t('search.advancedSearch.modal.title', 'Advanced Filters')}
					closeHandler={closeHandler}
				/>
				<Container padding={{ horizontal: 'medium', vertical: 'small' }}>
					<Row takeAvailableSpace wrap="nowrap" width="fill" crossAlignment="flex-start">
						<AdvancedSwitch
							label={t('search.advancedSearch.modal.flagged.label', 'Flagged')}
							description={t(
								'search.advancedSearch.modal.flagged.description',
								'Filter the results by items that have been flagged by you'
							)}
							onChange={flaggedOnChange}
							initialValue={!!currentFilters.flagged}
						/>
						<AdvancedSwitch
							label={t('search.advancedSearch.modal.shared.label', 'Shared')}
							description={t(
								'search.advancedSearch.modal.shared.description',
								'Filter the results by items that contain at least one collaborator besides you'
							)}
							onChange={sharedOnChange}
							initialValue={!!currentFilters.sharedByMe}
						/>
					</Row>
					<Row takeAvailableSpace wrap="nowrap" width="fill">
						<Container padding={{ all: 'extrasmall' }}>
							<CustomChipInput
								placeholder={t('search.advancedSearch.modal.keywords.label', 'Keywords')}
								background="gray5"
								value={currentFilters.keywords || []}
								onChange={keywordsOnChange}
								onAdd={keywordsOnAdd}
								separators={[',', ';', 'Enter']}
								onInputType={keywordsOnType}
								confirmChipOnSpace={false}
							/>
						</Container>
					</Row>
					<Row takeAvailableSpace wrap="nowrap" width="fill">
						<Container padding={{ all: 'extrasmall' }}>
							<FolderChipInputContainer>
								<FolderChipInput
									placeholder={t('search.advancedSearch.modal.folder.label', 'Select a folder')}
									background="gray5"
									value={(currentFilters.folderId && [currentFilters.folderId]) || []}
									icon="FolderOutline"
									onClick={openFolderSelectionModal}
									iconAction={openFolderSelectionModal}
									maxChips={1}
									onChange={folderOnChange}
								/>
							</FolderChipInputContainer>
						</Container>
					</Row>
				</Container>
				<ModalFooter
					confirmHandler={confirmHandler}
					confirmDisabled={searchDisabled}
					confirmLabel={t('search.advancedSearch.modal.button.confirm', 'Search')}
					cancelHandler={resetFilters}
					cancelLabel={t('search.advancedSearch.modal.button.reset', 'Reset filters')}
				/>
			</Container>
			<CustomModal
				maxHeight="90vh"
				onClose={closeFolderSelectionModal}
				open={folderSelectionModalOpen}
			>
				<FolderSelectionModalContent
					folderId={
						currentFilters.folderId?.value ||
						(currentFilters.sharedWithMe?.value && ROOTS.SHARED_WITH_ME) ||
						undefined
					}
					cascadeDefault={!!currentFilters.cascade?.value}
					confirmAction={folderOnChange}
					closeAction={closeFolderSelectionModal}
				/>
			</CustomModal>
		</>
	);
};
