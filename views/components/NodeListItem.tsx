/*
 * SPDX-FileCopyrightText: 2022 Zextras <https://www.zextras.com>
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import React, { useCallback, useContext, useMemo, useState } from 'react';

import { Container, Icon, Padding, Row, Text } from '@zextras/carbonio-design-system';
import debounce from 'lodash/debounce';
import includes from 'lodash/includes';
import some from 'lodash/some';
import { useTranslation } from 'react-i18next';
import styled, { css } from 'styled-components';

import { useActiveNode } from '../../../hooks/useActiveNode';
import useUserInfo from '../../../hooks/useUserInfo';
import {
	DISPLAYER_TABS,
	LIST_ITEM_AVATAR_HEIGHT,
	LIST_ITEM_HEIGHT,
	LIST_ITEM_HEIGHT_COMPACT,
	ROOTS
} from '../../constants';
import { useCreateSnackbar } from '../../hooks/useCreateSnackbar';
import { NodeType, User } from '../../types/graphql/types';
import { Action, ActionItem, ActionMap, buildActionItems } from '../../utils/ActionsFactory';
import {
	downloadNode,
	formatDate,
	getIconByFileType,
	getPdfPreviewSrc,
	getPreviewSrc,
	humanFileSize,
	openNodeWithDocs
} from '../../utils/utils';
import { ContextualMenu } from './ContextualMenu';
import { NodeAvatarIcon } from './NodeAvatarIcon';
import { NodeHoverBar } from './NodeHoverBar';
import { PreviewsManagerContext } from './preview/PreviewManager';
import { HoverBarContainer, HoverContainer, ListItemContainer } from './StyledComponents';

const CustomText = styled(Text)`
	text-transform: uppercase;
`;

const FlexContainer = styled(Container)`
	flex-grow: ${({ flexGrow }): number => flexGrow || 1};
	flex-shrink: ${({ flexShrink }): number => flexShrink || 1};
	flex-basis: ${({ flexBasis }): string => flexBasis || 'auto'};
	${({ margin }): string =>
		margin &&
		`
		${
			margin.left &&
			css`
				margin-left: ${margin.left};
			`
		}
		${
			margin.right &&
			css`
				margin-left: ${margin.left};
			`
		}
	`}
`;

interface NodeListItemProps {
	id: string;
	name: string;
	type: NodeType;
	extension?: string | null;
	mimeType?: string;
	updatedAt?: number;
	size?: number;
	owner?: User;
	lastEditor?: User | null;
	incomingShare?: boolean;
	outgoingShare?: boolean;
	linkActive?: boolean;
	flagActive?: boolean;
	toggleFlagTrue?: () => void;
	toggleFlagFalse?: () => void;
	markNodesForDeletionCallback?: () => void;
	restoreNodeCallback?: () => void;
	moveNodesCallback?: () => void;
	copyNodesCallback?: () => void;
	// Selection props
	isSelected?: boolean;
	isSelectionModeActive?: boolean;
	selectId?: (id: string) => void;
	permittedHoverBarActions?: ActionMap;
	permittedContextualMenuActions?: ActionMap;
	renameNode?: () => void;
	isActive?: boolean;
	setActive?: (event: React.SyntheticEvent) => void;
	compact?: boolean;
	navigateTo?: (id: string, event?: React.SyntheticEvent) => void;
	disabled?: boolean;
	selectable?: boolean;
	trashed?: boolean;
	deletePermanentlyCallback?: () => void;
	selectionContextualMenuActionsItems?: ActionItem[];
	dragging?: boolean;
	version?: number;
}

const NodeListItemComponent: React.VFC<NodeListItemProps> = ({
	id,
	name,
	type,
	extension,
	mimeType,
	updatedAt,
	size,
	owner,
	lastEditor,
	incomingShare = false,
	outgoingShare = false,
	linkActive = false,
	flagActive = false,
	toggleFlagTrue,
	toggleFlagFalse,
	markNodesForDeletionCallback,
	restoreNodeCallback,
	moveNodesCallback,
	copyNodesCallback,
	// Selection props
	isSelected,
	isSelectionModeActive,
	selectId,
	permittedHoverBarActions = {},
	permittedContextualMenuActions = {},
	renameNode,
	isActive,
	setActive = (): void => undefined,
	compact,
	navigateTo = (): void => undefined,
	disabled = false,
	selectable = true,
	trashed,
	deletePermanentlyCallback,
	selectionContextualMenuActionsItems,
	dragging = false,
	version
}) => {
	const [t] = useTranslation();
	const { createPreview } = useContext(PreviewsManagerContext);
	const { setActiveNode } = useActiveNode();

	const usePdfPreviewFallback = useMemo(() => {
		if (size) {
			return size > 20971520;
		}
		return true;
	}, [size]);
	const userInfo = useUserInfo();
	const [isContextualMenuActive, setIsContextualMenuActive] = useState(false);
	const selectIdCallback = useCallback(
		(event: React.SyntheticEvent) => {
			if (selectId) {
				event.preventDefault();
				selectId(id);
			}
		},
		[id, selectId]
	);

	const createSnackbar = useCreateSnackbar();

	const itemsMap = useMemo<Partial<Record<Action, ActionItem>>>(
		() => ({
			[Action.OpenWithDocs]: {
				id: 'OpenWithDocs',
				icon: 'BookOpenOutline',
				label: t('actions.openWithDocs', 'Open document'),
				click: (): void => {
					openNodeWithDocs(id);
				}
			},
			[Action.MarkForDeletion]: {
				id: 'MarkForDeletion',
				icon: 'Trash2Outline',
				label: t('actions.moveToTrash', 'Move to Trash'),
				click: markNodesForDeletionCallback
			},
			[Action.Rename]: {
				id: 'Rename',
				icon: 'Edit2Outline',
				label: t('actions.rename', 'Rename'),
				click: renameNode
			},
			[Action.Copy]: {
				id: 'Copy',
				icon: 'Copy',
				label: t('actions.copy', 'Copy'),
				click: copyNodesCallback
			},
			[Action.Move]: {
				id: 'Move',
				icon: 'MoveOutline',
				label: t('actions.move', 'Move'),
				click: moveNodesCallback
			},
			[Action.Flag]: {
				id: 'Flag',
				icon: 'FlagOutline',
				label: t('actions.flag', 'Flag'),
				click: toggleFlagTrue
			},
			[Action.UnFlag]: {
				id: 'Unflag',
				icon: 'UnflagOutline',
				label: t('actions.unflag', 'Unflag'),
				click: toggleFlagFalse
			},
			[Action.Download]: {
				id: 'Download',
				icon: 'Download',
				label: t('actions.download', 'Download'),
				click: (): void => {
					// download node without version to be sure last version is downloaded
					downloadNode(id);
					createSnackbar({
						key: new Date().toLocaleString(),
						type: 'info',
						label: t('snackbar.download.start', 'Your download will start soon'),
						replace: true,
						hideButton: true
					});
				}
			},
			[Action.Restore]: {
				id: 'Restore',
				icon: 'RestoreOutline',
				label: t('actions.restore', 'Restore'),
				click: restoreNodeCallback
			},
			[Action.DeletePermanently]: {
				id: 'DeletePermanently',
				icon: 'DeletePermanentlyOutline',
				label: t('actions.deletePermanently', 'Delete Permanently'),
				click: deletePermanentlyCallback
			}
		}),
		[
			t,
			markNodesForDeletionCallback,
			renameNode,
			copyNodesCallback,
			moveNodesCallback,
			toggleFlagTrue,
			toggleFlagFalse,
			restoreNodeCallback,
			deletePermanentlyCallback,
			id,
			createSnackbar
		]
	);

	const permittedHoverBarActionsItems = useMemo(
		() => buildActionItems(itemsMap, permittedHoverBarActions),
		[itemsMap, permittedHoverBarActions]
	);

	const permittedContextualMenuActionsItems = useMemo(
		() => buildActionItems(itemsMap, permittedContextualMenuActions),
		[itemsMap, permittedContextualMenuActions]
	);

	const isNavigable = useMemo(
		() =>
			type === NodeType.Folder || type === NodeType.Root || some(ROOTS, (rootId) => rootId === id),
		[id, type]
	);

	const openNode = useCallback(
		(event: React.SyntheticEvent) => {
			// remove text selection on double click
			if (window.getSelection) {
				const selection = window.getSelection();
				selection && selection.removeAllRanges();
			}

			if (!isSelectionModeActive && !disabled && !trashed) {
				if (isNavigable) {
					navigateTo(id, event);
				} else if (
					permittedContextualMenuActions[Action.OpenWithDocs] &&
					permittedContextualMenuActions[Action.OpenWithDocs] === true
				) {
					openNodeWithDocs(id);
				} else if (type === NodeType.Image) {
					createPreview({
						previewType: 'image',
						filename: name,
						extension: extension || undefined,
						size: (size && humanFileSize(size)) || undefined,
						actions: [
							{
								icon: 'DriveOutline',
								id: 'DriveOutline',
								tooltipLabel: t('preview.actions.tooltip.addCollaborator', 'Add collaborator'),
								onClick: (): void => setActiveNode(id, DISPLAYER_TABS.sharing)
							},
							{
								icon: 'DownloadOutline',
								tooltipLabel: t('preview.actions.tooltip.download', 'Download'),
								id: 'DownloadOutline',
								onClick: (): void => downloadNode(id)
							}
						],
						closeAction: {
							id: 'close-action',
							icon: 'ArrowBackOutline',
							tooltipLabel: t('preview.close.tooltip', 'Close')
						},
						src: version ? getPreviewSrc(id, version, 0, 0, 'high') : ''
					});
				} else if (includes(mimeType, 'pdf')) {
					createPreview({
						previewType: 'pdf',
						filename: name,
						extension: extension || undefined,
						size: (size && humanFileSize(size)) || undefined,
						useFallback: usePdfPreviewFallback,
						actions: [
							{
								icon: 'DriveOutline',
								id: 'DriveOutline',
								tooltipLabel: t('preview.actions.tooltip.addCollaborator', 'Add collaborator'),
								onClick: (): void => setActiveNode(id, DISPLAYER_TABS.sharing)
							},
							{
								icon: 'DownloadOutline',
								tooltipLabel: t('preview.actions.tooltip.download', 'Download'),
								id: 'DownloadOutline',
								onClick: (): void => downloadNode(id)
							}
						],
						closeAction: {
							id: 'close-action',
							icon: 'ArrowBackOutline',
							tooltipLabel: t('preview.close.tooltip', 'Close')
						},
						src: version ? getPdfPreviewSrc(id, version) : ''
					});
				}
			}
		},
		[
			isSelectionModeActive,
			disabled,
			trashed,
			isNavigable,
			permittedContextualMenuActions,
			type,
			mimeType,
			navigateTo,
			id,
			createPreview,
			name,
			extension,
			size,
			t,
			version,
			setActiveNode,
			usePdfPreviewFallback
		]
	);

	const setActiveDebounced = useMemo(
		() =>
			debounce(
				(event: React.SyntheticEvent) => {
					setActive(event);
				},
				200,
				{ leading: false, trailing: true }
			),
		[setActive]
	);

	const doubleClickHandler = useCallback(
		(event: React.SyntheticEvent) => {
			setActiveDebounced.cancel();
			openNode(event);
		},
		[openNode, setActiveDebounced]
	);

	const displayName = useMemo(() => {
		if (lastEditor && lastEditor.id !== owner?.id) {
			return lastEditor.full_name;
		}
		if (owner && owner.id !== userInfo.me) {
			return owner.full_name;
		}
		return '';
	}, [lastEditor, owner, userInfo.me]);

	const openContextualMenuHandler = useCallback(() => {
		setIsContextualMenuActive(true);
	}, []);

	const closeContextualMenuHandler = useCallback(() => {
		setIsContextualMenuActive(false);
	}, []);

	const preventTextSelection = useCallback<React.MouseEventHandler>((e: React.MouseEvent): void => {
		if (e.detail > 1) {
			e.preventDefault();
		}
	}, []);

	return (
		<Container id={id}>
			<ContextualMenu
				disabled={
					(disabled || isSelectionModeActive || compact) &&
					selectionContextualMenuActionsItems === undefined
				}
				onOpen={openContextualMenuHandler}
				onClose={closeContextualMenuHandler}
				actions={selectionContextualMenuActionsItems || permittedContextualMenuActionsItems}
			>
				<ListItemContainer
					height="fit"
					onClick={compact ? setActive : setActiveDebounced}
					onDoubleClick={doubleClickHandler}
					data-testid={`node-item-${id}`}
					crossAlignment="flex-end"
					contextualMenuActive={isContextualMenuActive}
					disableHover={isContextualMenuActive || dragging || disabled}
					disabled={disabled}
					onMouseDown={preventTextSelection}
				>
					<HoverContainer
						height={compact ? LIST_ITEM_HEIGHT_COMPACT : LIST_ITEM_HEIGHT}
						wrap="nowrap"
						mainAlignment="flex-start"
						crossAlignment="center"
						padding={{ all: 'small' }}
						width="fill"
						background={isActive ? 'highlight' : 'gray6'}
					>
						<NodeAvatarIcon
							selectionModeActive={isSelectionModeActive}
							selected={isSelected}
							onClick={selectIdCallback}
							compact={compact}
							disabled={disabled}
							selectable={selectable}
							icon={getIconByFileType(type, mimeType || id)}
						/>
						<Container
							orientation="vertical"
							crossAlignment="flex-start"
							mainAlignment="space-around"
							padding={{ left: 'large' }}
							minWidth="auto"
							width="fill"
							maxWidth={`calc(100% - ${LIST_ITEM_AVATAR_HEIGHT}px)`}
						>
							<Row
								padding={{ vertical: 'extrasmall' }}
								width="fill"
								wrap="nowrap"
								mainAlignment="space-between"
							>
								<Text overflow="ellipsis" disabled={disabled} size="medium">
									{name}
								</Text>
								{!compact && (
									<Container orientation="horizontal" mainAlignment="flex-end" width="fit">
										{flagActive && (
											<Padding left="extrasmall">
												<Icon icon="Flag" color="error" disabled={disabled} />
											</Padding>
										)}
										{linkActive && (
											<Padding left="extrasmall">
												<Icon icon="Link2" disabled={disabled} />
											</Padding>
										)}
										{incomingShare && (
											<Padding left="extrasmall">
												<Icon icon="ArrowCircleLeft" customColor="#AB47BC" disabled={disabled} />
											</Padding>
										)}
										{outgoingShare && (
											<Padding left="extrasmall">
												<Icon icon="ArrowCircleRight" customColor="#FFB74D" disabled={disabled} />
											</Padding>
										)}
										<Padding left="extrasmall">
											<Text size="extrasmall" color="gray1" disabled={disabled}>
												{formatDate(updatedAt, undefined, userInfo.zimbraPrefTimeZoneId)}
											</Text>
										</Padding>
									</Container>
								)}
							</Row>
							{!compact && (
								<Row
									padding={{ vertical: 'extrasmall' }}
									width="fill"
									wrap="nowrap"
									mainAlignment="flex-start"
								>
									<FlexContainer
										flexShrink={0}
										mainAlignment="flex-start"
										orientation="horizontal"
										width="fit"
									>
										<CustomText color="gray1" disabled={disabled} size="small">
											{/* i18next-extract-disable-next-line */}
											{extension || t(`node.type.${type.toLowerCase()}`, type)}
										</CustomText>
										{size != null && (
											<Padding left="small">
												<CustomText color="gray1" disabled={disabled} size="small">
													{humanFileSize(size)}
												</CustomText>
											</Padding>
										)}
									</FlexContainer>
									{displayName && (
										<FlexContainer
											width="fit"
											minWidth={0}
											flexShrink={1}
											orientation="horizontal"
											mainAlignment="flex-end"
											padding={{ left: 'small' }}
										>
											<Text size="extrasmall" overflow="ellipsis">
												{displayName}
											</Text>
										</FlexContainer>
									)}
								</Row>
							)}
						</Container>
					</HoverContainer>

					{!compact && !isSelectionModeActive && !dragging && (
						<HoverBarContainer
							wrap="nowrap"
							mainAlignment="flex-end"
							height="fill"
							data-testid="hover-bar"
						>
							<NodeHoverBar actions={permittedHoverBarActionsItems} />
						</HoverBarContainer>
					)}
				</ListItemContainer>
			</ContextualMenu>
		</Container>
	);
};

export const NodeListItem = React.memo(NodeListItemComponent);
