/*
 * SPDX-FileCopyrightText: 2022 Zextras <https://www.zextras.com>
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import React, { useCallback, useMemo, useState } from 'react';

import { Container, Icon, Padding, Row, Text, Tooltip } from '@zextras/carbonio-design-system';
import includes from 'lodash/includes';
import some from 'lodash/some';
import { useTranslation } from 'react-i18next';
import styled, { css } from 'styled-components';

import { useActiveNode } from '../../../hooks/useActiveNode';
import useUserInfo from '../../../hooks/useUserInfo';
import {
	DISPLAYER_TABS,
	DOWNLOAD_PATH,
	LIST_ITEM_AVATAR_HEIGHT,
	LIST_ITEM_HEIGHT,
	LIST_ITEM_HEIGHT_COMPACT,
	REST_ENDPOINT,
	ROOTS
} from '../../constants';
import { useCreateSnackbar } from '../../hooks/useCreateSnackbar';
import { NodeType, User } from '../../types/graphql/types';
import { Action, ActionItem, ActionMap, buildActionItems } from '../../utils/ActionsFactory';
import { invokeWithin } from '../../utils/invokeWithin';
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
import { NodeHoverBar } from './NodeHoverBar';
import PdfPreviewer from './previewer/PdfPreviewer';
import Previewer from './previewer/Previewer';
import {
	CheckedAvatar,
	FileIconPreview,
	HoverBarContainer,
	HoverContainer,
	ListItemContainer,
	UncheckedAvatar
} from './StyledComponents';

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
	selectId = (): void => undefined,
	permittedHoverBarActions = {},
	permittedContextualMenuActions = {},
	renameNode,
	isActive,
	setActive = (): void => undefined,
	compact,
	navigateTo = (): void => undefined,
	disabled,
	trashed,
	deletePermanentlyCallback,
	selectionContextualMenuActionsItems,
	dragging = false,
	version
}) => {
	const [t] = useTranslation();
	const [showPreviewer, setShowPreviewer] = useState(false);
	const [showPdfPreviewer, setShowPdfPreviewer] = useState(false);
	const showPreviewerCallback = useCallback(() => setShowPreviewer(true), []);
	const hidePreviewerCallback = useCallback(() => setShowPreviewer(false), []);
	const showPdfPreviewerCallback = useCallback(() => setShowPdfPreviewer(true), []);
	const hidePdfPreviewerCallback = useCallback(() => setShowPdfPreviewer(false), []);
	const { activeNodeId, setActiveNode } = useActiveNode();

	const usePdfPreviewerFallback = useMemo(() => {
		if (size) {
			return size > 10485760; // 20971520;
		}
		return true;
	}, [size]);
	const userInfo = useUserInfo();
	const [isContextualMenuActive, setIsContextualMenuActive] = useState(false);
	const selectIdCallback = useCallback(
		(event: React.SyntheticEvent) => {
			event.stopPropagation();
			selectId(id);
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

	const openNode = useCallback(
		(event: React.SyntheticEvent) => {
			// remove text selection on double click
			if (window.getSelection) {
				const selection = window.getSelection();
				selection && selection.removeAllRanges();
			}

			if (!isSelectionModeActive && !disabled && !trashed) {
				if (
					type === NodeType.Folder ||
					type === NodeType.Root ||
					some(ROOTS, (rootId) => rootId === id)
				) {
					navigateTo(id, event);
				} else if (
					permittedContextualMenuActions[Action.OpenWithDocs] &&
					permittedContextualMenuActions[Action.OpenWithDocs] === true
				) {
					openNodeWithDocs(id);
				} else if (type === NodeType.Image) {
					showPreviewerCallback();
				} else if (includes(mimeType, 'pdf')) {
					showPdfPreviewerCallback();
				}
			}
		},
		[
			isSelectionModeActive,
			disabled,
			trashed,
			type,
			permittedContextualMenuActions,
			mimeType,
			id,
			navigateTo,
			showPreviewerCallback,
			showPdfPreviewerCallback
		]
	);

	const setActiveOrOpenNode = useMemo(
		() => invokeWithin(setActive, openNode, 200),
		[openNode, setActive]
	);
	const setActiveOrOpenNodeCallback = useCallback(
		(event: React.SyntheticEvent) => {
			if (!compact) {
				setActiveOrOpenNode(event);
			} else {
				setActive(event);
			}
		},
		[compact, setActive, setActiveOrOpenNode]
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

	return (
		<Container id={id} data-testid={`nodeListItem-${id}`}>
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
					onClick={setActiveOrOpenNodeCallback}
					onDoubleClick={compact ? openNode : undefined}
					data-testid={`node-item-${id}`}
					crossAlignment="flex-end"
					contextualMenuActive={isContextualMenuActive}
					disableHover={isContextualMenuActive || dragging || disabled}
					disabled={disabled}
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
						{isSelectionModeActive ? (
							<>
								{isSelected ? (
									<CheckedAvatar
										label=""
										data-testid={`checkedAvatar`}
										icon="Checkmark"
										background="primary"
										onClick={selectIdCallback}
									/>
								) : (
									<UncheckedAvatar
										label=""
										background="gray6"
										data-testid={`unCheckedAvatar`}
										onClick={selectIdCallback}
									/>
								)}
							</>
						) : (
							<>
								{!compact ? (
									<Tooltip label={t('selectionMode.node.tooltip', 'Activate selection mode')}>
										<FileIconPreview
											icon={getIconByFileType(type, mimeType || id)}
											background="gray3"
											label="."
											onClick={selectIdCallback}
											data-testid="file-icon-preview"
										/>
									</Tooltip>
								) : (
									<Icon
										size="large"
										icon={`${getIconByFileType(type, mimeType || id)}Outline`}
										disabled={disabled}
									/>
								)}
							</>
						)}
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
											<a
												target="_blank"
												href={`${REST_ENDPOINT}${DOWNLOAD_PATH}/${encodeURIComponent(
													id
												)}/${version}`}
												rel="nofollow noreferrer noopener"
											>
												<Text size="extrasmall" overflow="ellipsis">
													{displayName}
												</Text>
											</a>
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
			<Previewer
				filename={name}
				extension={extension || undefined}
				size={(size && humanFileSize(size)) || undefined}
				actions={[]}
				src={version ? getPreviewSrc(id, version, 0, 0, 'high') : ''}
				show={showPreviewer}
				onClose={hidePreviewerCallback}
				closeTooltipLabel={t('previewer.close.tooltip', 'Close')}
			/>
			<PdfPreviewer
				filename={name}
				extension={extension || undefined}
				size={(size && humanFileSize(size)) || undefined}
				useFallback={usePdfPreviewerFallback}
				actions={[
					{
						icon: 'DriveOutline',
						id: 'DriveOutline',
						tooltipLabel: t('previewer.actions.tooltip.addCollaborator', 'Add collaborator'),
						onClick: (): void => setActiveNode(id, DISPLAYER_TABS.sharing)
					},
					{
						icon: 'DownloadOutline',
						tooltipLabel: t('previewer.actions.tooltip.download', 'Download'),
						id: 'DownloadOutline',
						onClick: (): void => downloadNode(id)
					}
				]}
				leftAction={{
					id: 'close-action',
					icon: 'ArrowBackOutline',
					onClick: hidePdfPreviewerCallback,
					tooltipLabel: t('previewer.close.tooltip', 'Close')
				}}
				src={version ? getPdfPreviewSrc(id, version) : ''}
				show={showPdfPreviewer}
				onClose={hidePdfPreviewerCallback}
			/>
		</Container>
	);
};

export const NodeListItem = React.memo(NodeListItemComponent);
