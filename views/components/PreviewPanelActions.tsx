/*
 * SPDX-FileCopyrightText: 2022 Zextras <https://www.zextras.com>
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

/* eslint-disable arrow-body-style,camelcase */

import React, { useCallback, useMemo } from 'react';

import { Container, Dropdown, IconButton, Padding, Tooltip } from '@zextras/carbonio-design-system';
import difference from 'lodash/difference';
import map from 'lodash/map';
import union from 'lodash/union';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';

import useUserInfo from '../../../hooks/useUserInfo';
import { ROOTS } from '../../constants';
import { useDeleteNodesMutation } from '../../hooks/graphql/mutations/useDeleteNodesMutation';
import { useFlagNodesMutation } from '../../hooks/graphql/mutations/useFlagNodesMutation';
import { useRestoreNodesMutation } from '../../hooks/graphql/mutations/useRestoreNodesMutation';
import { useTrashNodesMutation } from '../../hooks/graphql/mutations/useTrashNodesMutation';
import { useUpdateNodeMutation } from '../../hooks/graphql/mutations/useUpdateNodeMutation';
import { useCopyModal } from '../../hooks/modals/useCopyModal';
import { useDeletePermanentlyModal } from '../../hooks/modals/useDeletePermanentlyModal';
import { useMoveModal } from '../../hooks/modals/useMoveModal';
import { useRenameModal } from '../../hooks/modals/useRenameModal';
import { GetNodeParentType } from '../../types/common';
import { File, MakeOptional, Node } from '../../types/graphql/types';
import {
	Action,
	ActionItem,
	ActionsFactoryNodeType,
	buildActionItems,
	getPermittedPreviewPanelPrimaryActions,
	getPermittedPreviewPanelSecondaryActions,
	isFolder,
	trashedNodeActions
} from '../../utils/ActionsFactory';
import { downloadNode, isTrashView, openNodeWithDocs } from '../../utils/utils';

interface PreviewPanelActionsParams {
	node: ActionsFactoryNodeType &
		Pick<Node, 'rootId' | 'id' | 'name'> &
		GetNodeParentType &
		MakeOptional<Pick<File, 'version'>, 'version'>;
}

export const PreviewPanelActions: React.VFC<PreviewPanelActionsParams> = ({ node }) => {
	const [t] = useTranslation();

	/** Mutation to update the flag status */
	const toggleFlag = useFlagNodesMutation();

	/** Mutation to mark nodes for deletion */
	const markNodesForDeletion = useTrashNodesMutation();

	const markNodesForDeletionCallback = useCallback(() => {
		markNodesForDeletion(node);
	}, [node, markNodesForDeletion]);

	/** Mutation to delete permanently nodes */
	const deletePermanently = useDeleteNodesMutation();

	const deletePermanentlyCallback = useCallback(
		() => deletePermanently(node),
		[node, deletePermanently]
	);

	/** Mutation to restore nodes */
	const restore = useRestoreNodesMutation();

	const restoreNodeCallback = useCallback(() => {
		restore(node);
	}, [node, restore]);

	const { openDeletePermanentlyModal } = useDeletePermanentlyModal(deletePermanentlyCallback);

	const params = useParams();
	const isATrashFilter = useMemo(() => isTrashView(params), [params]);

	const actionsToRemoveIfInsideTrash = useMemo(() => {
		if (isATrashFilter) {
			return difference(Object.values(Action), trashedNodeActions);
		}
		return [];
	}, [isATrashFilter]);

	const actionsToRemove = useMemo(() => {
		if (node.rootId === ROOTS.TRASH) {
			return [Action.MarkForDeletion];
		}
		return trashedNodeActions;
	}, [node]);

	const actionsToRemoveIfIsAFolder = useMemo(() => {
		if (isFolder(node)) {
			return [Action.OpenWithDocs];
		}
		return [];
	}, [node]);

	const permittedPreviewPanelPrimaryActions: Partial<Record<Action, boolean>> = useMemo(
		() =>
			getPermittedPreviewPanelPrimaryActions(
				[node],
				union(actionsToRemove, actionsToRemoveIfInsideTrash)
			),
		[actionsToRemove, actionsToRemoveIfInsideTrash, node]
	);

	const { me } = useUserInfo();

	const permittedPreviewPanelSecondaryActions: Partial<Record<Action, boolean>> = useMemo(
		() =>
			getPermittedPreviewPanelSecondaryActions(
				[node],
				union(actionsToRemove, actionsToRemoveIfInsideTrash, actionsToRemoveIfIsAFolder),
				// TODO: REMOVE CHECK ON ROOT WHEN BE WILL NOT RETURN LOCAL_ROOT AS PARENT FOR SHARED NODES
				me
			),
		[actionsToRemove, actionsToRemoveIfInsideTrash, actionsToRemoveIfIsAFolder, me, node]
	);

	const { openMoveNodesModal } = useMoveModal();

	const { openCopyNodesModal } = useCopyModal();

	const [updateNode] = useUpdateNodeMutation();

	const updateNodeAction = useCallback((id, name) => updateNode(id, name), [updateNode]);

	const { openRenameModal } = useRenameModal(updateNodeAction);

	const itemsMap = useMemo<Partial<Record<Action, ActionItem>>>(
		() => ({
			[Action.OpenWithDocs]: {
				id: 'OpenWithDocs',
				icon: 'BookOpenOutline',
				label: t('actions.openWithDocs', 'Open document'),
				click: (): void => {
					openNodeWithDocs(node.id);
				}
			},
			[Action.MarkForDeletion]: {
				id: 'MarkForDeletion',
				icon: 'Trash2Outline',
				label: t('actions.moveToTrash', 'Move to Trash'),
				click: markNodesForDeletionCallback
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
				click: openDeletePermanentlyModal
			},
			[Action.Rename]: {
				id: 'Rename',
				icon: 'EditOutline',
				label: t('actions.rename', 'Rename'),
				click: (): void => {
					openRenameModal(node);
				}
			},
			[Action.Copy]: {
				id: 'Copy',
				icon: 'Copy',
				label: t('actions.copy', 'Copy'),
				click: (): void => {
					openCopyNodesModal([node], node.parent?.id);
				}
			},
			[Action.Flag]: {
				id: 'Flag',
				icon: 'FlagOutline',
				label: t('actions.flag', 'Flag'),
				click: (): void => {
					toggleFlag(true, node);
				}
			},
			[Action.UnFlag]: {
				id: 'UnFlag',
				icon: 'UnflagOutline',
				label: t('actions.unflag', 'Unflag'),
				click: (): void => {
					toggleFlag(false, node);
				}
			},
			[Action.Download]: {
				id: 'Download',
				icon: 'Download',
				label: t('actions.download', 'Download'),
				click: (): void => {
					// download node without version to be sure last version is downlaoded
					downloadNode(node.id);
				}
			},
			[Action.Move]: {
				id: 'Move',
				icon: 'MoveOutline',
				label: t('actions.move', 'Move'),
				click: (): void => {
					openMoveNodesModal([node], node.parent?.id);
				}
			}
			// [Action.UpsertDescription]: {
			// 	id: 'Upsert',
			// 	icon: 'MoveOutline',
			// 	label: t('actions.updateDescription', 'Update description'),
			// 	click: (): void => {
			// 		// click:
			// 	}
			// }
		}),
		[
			markNodesForDeletionCallback,
			node,
			openCopyNodesModal,
			openDeletePermanentlyModal,
			openMoveNodesModal,
			openRenameModal,
			restoreNodeCallback,
			t,
			toggleFlag
		]
	);

	const permittedPreviewPanelPrimaryActionsIconButtons = map(
		permittedPreviewPanelPrimaryActions,
		(value: boolean, key: Action) => {
			return (
				<Padding left="extrasmall" key={itemsMap[key]?.label}>
					<Tooltip label={itemsMap[key]?.label}>
						<IconButton
							icon={itemsMap[key]?.icon}
							size="medium"
							key={key}
							onClick={(ev: React.MouseEvent<HTMLButtonElement>): void => {
								if (ev) ev.preventDefault();
								if (itemsMap && itemsMap[key]?.click) {
									const clickFn = itemsMap[key]?.click as () => void;
									clickFn();
								}
							}}
							disabled={!permittedPreviewPanelPrimaryActions[key]}
						/>
					</Tooltip>
				</Padding>
			);
		}
	);

	const permittedPreviewPanelSecondaryActionsItems = useMemo(
		() => buildActionItems(itemsMap, permittedPreviewPanelSecondaryActions),
		[itemsMap, permittedPreviewPanelSecondaryActions]
	);

	return (
		<Container
			orientation="horizontal"
			mainAlignment="flex-end"
			crossAlignment="center"
			height="auto"
			padding={{ horizontal: 'large', vertical: 'small' }}
		>
			{permittedPreviewPanelPrimaryActionsIconButtons}

			{permittedPreviewPanelSecondaryActionsItems.length > 0 && (
				<Padding left="extrasmall">
					<Dropdown placement="right-end" items={permittedPreviewPanelSecondaryActionsItems}>
						<IconButton size="medium" icon="MoreVertical" />
					</Dropdown>
				</Padding>
			)}
		</Container>
	);
};
