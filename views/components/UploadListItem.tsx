/*
 * SPDX-FileCopyrightText: 2022 Zextras <https://www.zextras.com>
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import React, { useCallback, useMemo, useState } from 'react';

import { Container, Icon, Padding, Row, Text } from '@zextras/carbonio-design-system';
import { useTranslation } from 'react-i18next';
import styled from 'styled-components';

import { useNavigation } from '../../../hooks/useNavigation';
import { LIST_ITEM_HEIGHT } from '../../constants';
import { Breadcrumbs } from '../../design_system_fork/Breadcrumbs';
import { useUpload } from '../../hooks/useUpload';
import { UploadStatus } from '../../types/common';
import { Maybe, Node } from '../../types/graphql/types';
import { Action, buildActionItems } from '../../utils/ActionsFactory';
import { buildCrumbs, humanFileSize, scrollToNodeItem } from '../../utils/utils';
import { ContextualMenu } from './ContextualMenu';
import { NodeAvatarIcon } from './NodeAvatarIcon';
import { NodeHoverBar } from './NodeHoverBar';
import { HoverBarContainer, HoverContainer, ListItemContainer } from './StyledComponents';

interface UploadListItemProps {
	id: string;
	nodeId?: string;
	name: string;
	parent?: Maybe<Pick<Node, 'id' | 'name' | 'type'>>;
	size: number;
	extension?: string;
	mimeType: string;
	status: UploadStatus;
	percentage: number;
	permittedContextualMenuActions: Partial<Record<Action, boolean>>;
	permittedHoverBarActions: Partial<Record<Action, boolean>>;
	isSelected: boolean;
	isSelectionModeActive: boolean;
	selectId: (id: string) => void;
}

const CustomText = styled(Text)`
	text-transform: uppercase;
`;

const CustomBreadcrumbs = styled(Breadcrumbs)`
	width: auto;
`;

export const UploadListItem: React.VFC<UploadListItemProps> = React.memo(
	({
		id,
		nodeId,
		name,
		parent,
		size,
		extension: _extension,
		mimeType: _mimeType,
		status,
		percentage,
		isSelected,
		isSelectionModeActive,
		selectId,
		permittedHoverBarActions,
		permittedContextualMenuActions
	}) => {
		const [t] = useTranslation();
		const [isContextualMenuActive, setIsContextualMenuActive] = useState(false);
		const { navigateToFolder, navigateTo } = useNavigation();

		const openContextualMenuHandler = useCallback(() => {
			setIsContextualMenuActive(true);
		}, []);

		const closeContextualMenuHandler = useCallback(() => {
			setIsContextualMenuActive(false);
		}, []);

		const { removeById, retryById } = useUpload();

		const items = useMemo(
			() => ({
				[Action.GoToFolder]: {
					id: 'GoToFolder ',
					icon: 'FolderOutline',
					label: t('actions.goToFolder', 'Go to destination folder'),
					click: (): void => {
						if (parent && nodeId) {
							const destination = `/?folder=${parent.id}&node=${nodeId}`;
							navigateTo(destination);
							scrollToNodeItem(nodeId);
						} else if (parent) {
							navigateToFolder(parent.id);
						}
					}
				},
				[Action.RetryUpload]: {
					id: 'RetryUpload',
					icon: 'PlayCircleOutline',
					label: t('actions.retryUpload', 'Retry upload'),
					click: (): void => {
						retryById([id]);
					}
				},

				[Action.removeUpload]: {
					id: 'removeUpload',
					icon: 'CloseCircleOutline',
					label: t('actions.removeUpload', 'Remove upload'),
					click: (): void => {
						removeById([id]);
					}
				}
			}),
			[id, navigateTo, navigateToFolder, nodeId, parent, removeById, retryById, t]
		);

		const permittedContextualMenuActionItems = useMemo(
			() => buildActionItems(items, permittedContextualMenuActions),
			[items, permittedContextualMenuActions]
		);
		const permittedHoverBarActionItems = useMemo(
			() => buildActionItems(items, permittedHoverBarActions),
			[items, permittedHoverBarActions]
		);

		const selectIdCallback = useCallback(
			(event) => {
				event.stopPropagation();
				selectId(id);
			},
			[id, selectId]
		);

		const crumbs = useMemo(() => (parent ? buildCrumbs(parent, undefined, t) : []), [parent, t]);

		const statusIcon = useMemo(() => {
			switch (status) {
				case UploadStatus.COMPLETED:
					return <Icon icon="CheckmarkCircle2" color="success" />;
				case UploadStatus.LOADING:
					return <Icon icon="AnimatedLoader" />;
				case UploadStatus.FAILED:
					return <Icon icon="AlertCircle" color="error" />;
				default:
					return <Icon icon="AnimatedLoader" />;
			}
		}, [status]);

		return (
			<ContextualMenu
				onOpen={openContextualMenuHandler}
				onClose={closeContextualMenuHandler}
				actions={permittedContextualMenuActionItems}
				disabled={isSelectionModeActive}
			>
				<ListItemContainer
					height="fit"
					crossAlignment="flex-end"
					contextualMenuActive={isContextualMenuActive}
					data-testid={`node-item-${id}`}
				>
					<HoverContainer
						height={LIST_ITEM_HEIGHT}
						wrap="nowrap"
						mainAlignment="flex-start"
						crossAlignment="center"
						padding={{ all: 'small' }}
						width="fill"
					>
						<NodeAvatarIcon
							selectionModeActive={isSelectionModeActive}
							selected={isSelected}
							onClick={selectIdCallback}
							icon="CloudUploadOutline"
						/>
						<Container
							orientation="vertical"
							crossAlignment="flex-start"
							mainAlignment="space-around"
							padding={{ horizontal: 'large' }}
							minWidth={0}
						>
							<Row padding={{ vertical: 'extrasmall' }}>
								<Text overflow="ellipsis" size="small">
									{name}
								</Text>
							</Row>
							<Row wrap="nowrap" height="fit" mainAlignment="flex-start" width="fill">
								<CustomBreadcrumbs crumbs={crumbs} size="small" color="secondary" />
							</Row>
						</Container>
						<Container orientation="vertical" mainAlignment="space-around" width="fit">
							<Container
								orientation="horizontal"
								padding={{ vertical: 'extrasmall' }}
								mainAlignment="flex-end"
							>
								<Text size="small">{percentage}%</Text>
								<Padding left="extrasmall">{statusIcon}</Padding>
							</Container>
							<Container
								orientation="horizontal"
								padding={{ vertical: 'extrasmall' }}
								mainAlignment="flex-end"
							>
								<CustomText size="extrasmall" overflow="ellipsis" color="gray1">
									{humanFileSize(size)}
								</CustomText>
							</Container>
						</Container>
					</HoverContainer>
					{!isSelectionModeActive && (
						<HoverBarContainer
							wrap="nowrap"
							mainAlignment="flex-end"
							height="fill"
							data-testid="hover-bar"
						>
							<NodeHoverBar actions={permittedHoverBarActionItems} />
						</HoverBarContainer>
					)}
				</ListItemContainer>
			</ContextualMenu>
		);
	}
);

UploadListItem.displayName = 'UploadListItem';
