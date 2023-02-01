/*
 * SPDX-FileCopyrightText: 2022 Zextras <https://www.zextras.com>
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import React, { useCallback, useMemo, useState } from 'react';

import { ChipInput, ChipInputProps, ChipItem } from '@zextras/carbonio-design-system';
import isEmpty from 'lodash/isEmpty';
import reduce from 'lodash/reduce';
import { useTranslation } from 'react-i18next';

import { AdvancedFilters } from '../../types/common';
import { NodeType } from '../../types/graphql/types';

interface ItemTypeChipInputProps {
	currentFilters: AdvancedFilters;
	updateFilter: (
		key: keyof AdvancedFilters,
		value: AdvancedFilters[typeof key] | undefined
	) => void;
}

export const ItemTypeChipInput: React.VFC<ItemTypeChipInputProps> = ({
	currentFilters,
	updateFilter
}) => {
	const [t] = useTranslation();
	const [filterValue, setFilterValue] = useState<string | null>(null);

	const itemTypeOnType = useCallback<NonNullable<ChipInputProps['onInputType']>>((ev) => {
		if (ev.key.length === 1 || ev.key === 'Delete' || ev.key === 'Backspace') {
			setFilterValue(ev.textContent);
		}
	}, []);

	const itemTypeOnChange = useCallback<NonNullable<ChipInputProps['onChange']>>(
		(newItemType) => {
			setFilterValue(null);
			if (!isEmpty(newItemType)) {
				updateFilter('type', {
					label: newItemType[0].label,
					avatarBackground: 'secondary',
					avatarIcon: newItemType[0].avatarIcon,
					onClick: (event) => {
						event.stopPropagation();
					},
					value: (newItemType[0].value as string) || undefined
				});
			} else {
				updateFilter('type', undefined);
			}
		},
		[updateFilter]
	);

	const itemTypeChipInputValue = useMemo<ChipItem[]>(() => {
		if (currentFilters.type) {
			return [{ ...currentFilters.type, background: 'gray2' }];
		}
		return [];
	}, [currentFilters.type]);

	const dropdownItems = useMemo(() => {
		if (itemTypeChipInputValue.length > 0) {
			return [];
		}
		return reduce<
			{ id: string; label: string; icon: string; value: NodeType; avatarIcon: string },
			NonNullable<ChipInputProps['options']>
		>(
			[
				{
					label: t('search.advancedSearch.modal.itemType.dropdownOption.folder', 'Folder'),
					id: 'Folder',
					icon: 'FolderOutline',
					value: NodeType.Folder,
					avatarIcon: 'Folder'
				},
				{
					label: t('search.advancedSearch.modal.itemType.dropdownOption.document', 'Document'),
					id: 'Document',
					icon: 'FileTextOutline',
					value: NodeType.Text,
					avatarIcon: 'FileText'
				},
				{
					label: t(
						'search.advancedSearch.modal.itemType.dropdownOption.spreadsheet',
						'Spreadsheet'
					),
					id: 'Spreadsheet',
					icon: 'FileCalcOutline',
					value: NodeType.Spreadsheet,
					avatarIcon: 'FileCalc'
				},
				{
					label: t(
						'search.advancedSearch.modal.itemType.dropdownOption.presentation',
						'Presentation'
					),
					id: 'Presentation',
					icon: 'FilePresentationOutline',
					value: NodeType.Presentation,
					avatarIcon: 'FilePresentation'
				},
				{
					label: t('search.advancedSearch.modal.itemType.dropdownOption.image', 'Image'),
					id: 'Image',
					icon: 'ImageOutline',
					value: NodeType.Image,
					avatarIcon: 'Image'
				},
				{
					label: t('search.advancedSearch.modal.itemType.dropdownOption.video', 'Video'),
					id: 'Video',
					icon: 'VideoOutline',
					value: NodeType.Video,
					avatarIcon: 'Video'
				},
				{
					label: t('search.advancedSearch.modal.itemType.dropdownOption.audio', 'Audio'),
					id: 'Audio',
					icon: 'MusicOutline',
					value: NodeType.Audio,
					avatarIcon: 'Music'
				}
			],
			(accumulator, item) => {
				if (filterValue === null || item.label.toLowerCase().includes(filterValue.toLowerCase())) {
					accumulator.push({
						icon: item.icon,
						label: item.label,
						id: `$${item.id}`,
						value: { ...item }
					});
				}
				return accumulator;
			},
			[]
		);
	}, [itemTypeChipInputValue.length, filterValue, t]);

	return (
		<ChipInput
			placeholder={t('search.advancedSearch.modal.itemType.label', 'Item type')}
			background="gray5"
			confirmChipOnSpace={false}
			confirmChipOnBlur={false}
			value={itemTypeChipInputValue}
			separators={['']}
			disableOptions={false}
			maxChips={1}
			onChange={itemTypeOnChange}
			onInputType={itemTypeOnType}
			options={dropdownItems}
			icon={'ChevronDown'}
			singleSelection
			requireUniqueChips
		/>
	);
};
