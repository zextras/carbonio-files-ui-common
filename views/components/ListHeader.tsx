/*
 * SPDX-FileCopyrightText: 2022 Zextras <https://www.zextras.com>
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import React, { useMemo } from 'react';

import {
	Button,
	Divider,
	Dropdown,
	IconButton,
	Row,
	Tooltip
} from '@zextras/carbonio-design-system';
import drop from 'lodash/drop';
import map from 'lodash/map';
import size from 'lodash/size';
import take from 'lodash/take';
import { useTranslation } from 'react-i18next';

import { ActionItem } from '../../utils/ActionsFactory';

export interface ListHeaderProps {
	isSelectionModeActive: boolean;
	unSelectAll: () => void;
	selectAll: () => void;
	isAllSelected: boolean;
	exitSelectionMode: () => void;
	permittedSelectionModeActionsItems: ActionItem[];
	hide?: boolean;
	firstCustomComponent?: React.ReactNode;
	secondCustomComponent?: React.ReactNode;
	headerEndComponent?: React.ReactNode;
}

export const ListHeader: React.VFC<ListHeaderProps> = ({
	isSelectionModeActive,
	unSelectAll,
	selectAll,
	isAllSelected,
	exitSelectionMode,
	permittedSelectionModeActionsItems = [],
	hide = false,
	firstCustomComponent,
	secondCustomComponent,
	headerEndComponent
}) => {
	const [t] = useTranslation();

	const permittedSelectionModePrimaryActionsIconButtons = useMemo(
		() =>
			map(take(permittedSelectionModeActionsItems, 3), (actionItem) => (
				<Tooltip label={actionItem.label} key={actionItem.id}>
					<IconButton
						icon={actionItem.icon}
						size="large"
						iconColor="primary"
						onClick={actionItem.click || ((): void => undefined)}
						disabled={actionItem.disabled}
					/>
				</Tooltip>
			)),
		[permittedSelectionModeActionsItems]
	);

	return !isSelectionModeActive ? (
		<>
			{!hide && (
				<>
					<Row
						minHeight={48}
						height="auto"
						background="gray5"
						mainAlignment="space-between"
						padding={{ left: 'medium' }}
						wrap="nowrap"
						width="fill"
						maxWidth="100%"
						data-testid="list-header"
						flexShrink={0}
						flexGrow={1}
					>
						{firstCustomComponent}
						<Row mainAlignment="flex-end" wrap="nowrap">
							{headerEndComponent}
						</Row>
					</Row>
					<Divider color="gray3" />
				</>
			)}
			{secondCustomComponent}
		</>
	) : (
		<>
			<Row
				height={48}
				background="gray5"
				mainAlignment="space-between"
				padding={{ vertical: 'medium' }}
				wrap="nowrap"
				width="fill"
				data-testid="list-header-selectionModeActive"
			>
				<Row mainAlignment="flex-start" wrap="nowrap" flexGrow={1}>
					<Tooltip label={t('selectionMode.header.exit', 'Exit selection mode')}>
						<IconButton
							icon="ArrowBackOutline"
							size="large"
							iconColor="primary"
							onClick={exitSelectionMode}
						/>
					</Tooltip>
					{isAllSelected ? (
						<Button
							type="ghost"
							label={t('selectionMode.header.unselectAll', 'Deselect all')}
							color="primary"
							onClick={unSelectAll}
						/>
					) : (
						<Button
							type="ghost"
							label={t('selectionMode.header.selectAll', 'Select all')}
							color="primary"
							onClick={selectAll}
						/>
					)}
				</Row>
				<Row mainAlignment="flex-end" wrap="nowrap" flexGrow={1}>
					{permittedSelectionModePrimaryActionsIconButtons}
					{size(drop(permittedSelectionModeActionsItems, 3)) > 0 && (
						<Dropdown items={drop(permittedSelectionModeActionsItems, 3)} placement="bottom-end">
							<IconButton
								icon="MoreVertical"
								size="large"
								iconColor="primary"
								onClick={(): void => undefined}
							/>
						</Dropdown>
					)}
				</Row>
			</Row>
			<Divider color="gray3" />
		</>
	);
};
