/*
 * SPDX-FileCopyrightText: 2022 Zextras <https://www.zextras.com>
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */
import { useCallback, useMemo } from 'react';

import { Action as DSAction } from '@zextras/carbonio-design-system';
import map from 'lodash/map';
import { useTranslation } from 'react-i18next';

import { useNavigation } from '../../hooks/useNavigation';
import { Action } from '../types/common';
import { UploadItem, UploadStatus } from '../types/graphql/client-types';
import { MakeRequired } from '../types/utils';
import {
	ActionsFactoryCheckerMap,
	ActionsFactoryUploadItem,
	buildActionItems,
	getPermittedUploadActions
} from '../utils/ActionsFactory';
import { scrollToNodeItem } from '../utils/utils';
import { useUpload } from './useUpload';

export function useUploadActions(
	nodes: MakeRequired<Partial<UploadItem>, 'id'>[],
	isDetailsListItem = false
): DSAction[] {
	const [t] = useTranslation();
	const { removeById, retryById } = useUpload();
	const node = nodes.length > 0 ? nodes[0] : undefined;

	const nodeIds = useMemo(() => map(nodes, (item) => item.id), [nodes]);

	const removeUpload = useCallback(() => {
		removeById(nodeIds);
	}, [removeById, nodeIds]);

	const retryUpload = useCallback(() => {
		retryById(nodeIds);
	}, [nodeIds, retryById]);

	const { navigateToFolder, navigateTo } = useNavigation();

	const goToFolderSelection = useCallback(() => {
		if (node?.parentNodeId) {
			if (nodes.length === 1) {
				if (node.nodeId) {
					const destination = `/?folder=${node.parentNodeId}&node=${node.nodeId}`;
					navigateTo(destination);
					scrollToNodeItem(node.nodeId);
				}
				navigateToFolder(node.parentNodeId);
			} else {
				navigateToFolder(node.parentNodeId);
			}
		}
	}, [navigateTo, navigateToFolder, node, nodes.length]);

	const actionCheckers = useMemo<ActionsFactoryCheckerMap>(
		() => ({
			[Action.GoToFolder]: (actionsFactoryUploadItem): boolean => {
				if (isDetailsListItem) {
					return (actionsFactoryUploadItem[0] as ActionsFactoryUploadItem).nodeId !== null;
				}
				return true;
			},
			[Action.removeUpload]: (actionsFactoryUploadItem): boolean => {
				if (isDetailsListItem) {
					return (
						(actionsFactoryUploadItem[0] as ActionsFactoryUploadItem).status !==
						UploadStatus.COMPLETED
					);
				}
				return true;
			}
		}),
		[isDetailsListItem]
	);

	const permittedUploadActions = useMemo(
		() => getPermittedUploadActions(nodes, actionCheckers),
		[actionCheckers, nodes]
	);

	const items = useMemo<Partial<Record<Action, DSAction>>>(
		() => ({
			[Action.removeUpload]: {
				id: 'removeUpload',
				icon: 'CloseCircleOutline',
				label: t('actions.removeUpload', 'Remove upload'),
				onClick: removeUpload
			},
			[Action.RetryUpload]: {
				id: 'RetryUpload',
				icon: 'PlayCircleOutline',
				label: t('actions.retryUpload', 'Retry upload'),
				onClick: retryUpload
			},
			[Action.GoToFolder]: {
				id: 'GoToFolder ',
				icon: 'FolderOutline',
				label: t('actions.goToFolder', 'Go to destination folder'),
				onClick: goToFolderSelection
			}
		}),
		[removeUpload, goToFolderSelection, retryUpload, t]
	);

	return useMemo(
		() => buildActionItems(items, permittedUploadActions),
		[items, permittedUploadActions]
	);
}
