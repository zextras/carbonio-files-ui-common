/*
 * SPDX-FileCopyrightText: 2022 Zextras <https://www.zextras.com>
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

/* eslint-disable arrow-body-style,camelcase */

import React, { useCallback, useContext, useMemo } from 'react';

import {
	Container,
	Dropdown,
	DropdownItem,
	IconButton,
	Padding,
	Tooltip
} from '@zextras/carbonio-design-system';
import { PreviewsManagerContext } from '@zextras/carbonio-ui-preview';
import drop from 'lodash/drop';
import includes from 'lodash/includes';
import map from 'lodash/map';
import take from 'lodash/take';
import { useTranslation } from 'react-i18next';

import { useActiveNode } from '../../../hooks/useActiveNode';
import { useSendViaMail } from '../../../hooks/useSendViaMail';
import useUserInfo from '../../../hooks/useUserInfo';
import { DISPLAYER_TABS, PREVIEW_TYPE } from '../../constants';
import { useDeleteNodesMutation } from '../../hooks/graphql/mutations/useDeleteNodesMutation';
import { useFlagNodesMutation } from '../../hooks/graphql/mutations/useFlagNodesMutation';
import { useRestoreNodesMutation } from '../../hooks/graphql/mutations/useRestoreNodesMutation';
import { useTrashNodesMutation } from '../../hooks/graphql/mutations/useTrashNodesMutation';
import { useUpdateNodeMutation } from '../../hooks/graphql/mutations/useUpdateNodeMutation';
import { useCopyModal } from '../../hooks/modals/useCopyModal';
import { useDeletePermanentlyModal } from '../../hooks/modals/useDeletePermanentlyModal';
import { useMoveModal } from '../../hooks/modals/useMoveModal';
import { useRenameModal } from '../../hooks/modals/useRenameModal';
import { Action, GetNodeParentType } from '../../types/common';
import { File, MakeOptional, Node } from '../../types/graphql/types';
import {
	ActionItem,
	ActionsFactoryNodeType,
	buildActionItems,
	getAllPermittedActions,
	isFile
} from '../../utils/ActionsFactory';
import { downloadNode, isSupportedByPreview, openNodeWithDocs } from '../../utils/utils';

interface DisplayerActionsParams {
	node: ActionsFactoryNodeType &
		Pick<Node, 'rootId' | 'id' | 'name'> &
		GetNodeParentType &
		MakeOptional<Pick<File, 'version'>, 'version'>;
}

export const DisplayerActions: React.VFC<DisplayerActionsParams> = ({ node }) => {
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

	const { me } = useUserInfo();

	const permittedDisplayerActions: Action[] = useMemo(
		() =>
			getAllPermittedActions(
				[node],
				// TODO: REMOVE CHECK ON ROOT WHEN BE WILL NOT RETURN LOCAL_ROOT AS PARENT FOR SHARED NODES
				me
			),
		[me, node]
	);

	const { openMoveNodesModal } = useMoveModal();

	const { openCopyNodesModal } = useCopyModal();

	const [updateNode] = useUpdateNodeMutation();

	const updateNodeAction = useCallback((id, name) => updateNode(id, name), [updateNode]);

	const { openRenameModal } = useRenameModal(updateNodeAction);

	const { sendViaMail } = useSendViaMail();

	const sendViaMailCallback = useCallback(() => {
		sendViaMail(node.id);
	}, [node, sendViaMail]);

	const { setActiveNode } = useActiveNode();

	const manageShares = useCallback(() => {
		setActiveNode(node.id, DISPLAYER_TABS.sharing);
	}, [node.id, setActiveNode]);

	const { openPreview } = useContext(PreviewsManagerContext);

	const [$isSupportedByPreview] = useMemo<
		[boolean, typeof PREVIEW_TYPE[keyof typeof PREVIEW_TYPE] | undefined]
	>(() => isSupportedByPreview((isFile(node) && node.mime_type) || undefined), [node]);

	const preview = useCallback(() => {
		if ($isSupportedByPreview) {
			openPreview(node.id);
		} else if (includes(permittedDisplayerActions, Action.OpenWithDocs)) {
			// if preview is not supported and document can be opened with docs, open editor
			openNodeWithDocs(node.id);
		}
	}, [$isSupportedByPreview, permittedDisplayerActions, openPreview, node.id]);

	const itemsMap = useMemo<Partial<Record<Action, ActionItem>>>(
		() => ({
			[Action.Edit]: {
				id: 'Edit',
				icon: 'Edit2Outline',
				label: t('actions.edit', 'Edit'),
				click: (): void => {
					openNodeWithDocs(node.id);
				}
			},
			[Action.Preview]: {
				id: 'Preview',
				icon: 'MaximizeOutline',
				label: t('actions.preview', 'Preview'),
				click: preview
			},
			[Action.SendViaMail]: {
				id: 'SendViaMail',
				icon: 'EmailOutline',
				label: t('actions.sendViaMail', 'Send via mail'),
				click: sendViaMailCallback
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
			[Action.ManageShares]: {
				id: 'ManageShares',
				icon: 'ShareOutline',
				label: t('actions.manageShares', 'Manage Shares'),
				click: manageShares
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
			[Action.OpenWithDocs]: {
				id: 'OpenWithDocs',
				icon: 'BookOpenOutline',
				label: t('actions.openWithDocs', 'Open document'),
				click: (): void => {
					openNodeWithDocs(node.id);
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
			[Action.Move]: {
				id: 'Move',
				icon: 'MoveOutline',
				label: t('actions.move', 'Move'),
				click: (): void => {
					openMoveNodesModal([node], node.parent?.id);
				}
			},
			[Action.Rename]: {
				id: 'Rename',
				icon: 'EditOutline',
				label: t('actions.rename', 'Rename'),
				click: (): void => {
					openRenameModal(node);
				}
			},
			[Action.MoveToTrash]: {
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
			manageShares,
			markNodesForDeletionCallback,
			node,
			openCopyNodesModal,
			openDeletePermanentlyModal,
			openMoveNodesModal,
			openRenameModal,
			preview,
			restoreNodeCallback,
			sendViaMailCallback,
			t,
			toggleFlag
		]
	);

	const permittedDisplayerPrimaryActionsIconButtons = map(
		take(permittedDisplayerActions, 3),
		(value: Action) => {
			const item = itemsMap[value];
			return (
				(item && (
					<Padding left="extrasmall" key={item.label}>
						<Tooltip label={item.label}>
							<IconButton
								icon={item.icon}
								size="medium"
								key={value}
								onClick={(ev: React.MouseEvent<HTMLButtonElement> | KeyboardEvent): void => {
									if (ev) ev.preventDefault();
									if (itemsMap && item.click) {
										const clickFn = item.click as () => void;
										clickFn();
									}
								}}
							/>
						</Tooltip>
					</Padding>
				)) ||
				null
			);
		}
	);

	const permittedDisplayerSecondaryActionsItems = useMemo<DropdownItem[]>(
		() => buildActionItems(itemsMap, drop(permittedDisplayerActions, 3)),
		[itemsMap, permittedDisplayerActions]
	);

	return (
		<Container
			orientation="horizontal"
			mainAlignment="flex-end"
			crossAlignment="center"
			height="auto"
			padding={{ horizontal: 'large', vertical: 'small' }}
			data-testid="displayer-actions-header"
		>
			{permittedDisplayerPrimaryActionsIconButtons}

			{permittedDisplayerSecondaryActionsItems.length > 0 && (
				<Padding left="extrasmall">
					<Dropdown placement="bottom-end" items={permittedDisplayerSecondaryActionsItems}>
						<IconButton size="medium" icon="MoreVertical" onClick={(): void => undefined} />
					</Dropdown>
				</Padding>
			)}
		</Container>
	);
};
