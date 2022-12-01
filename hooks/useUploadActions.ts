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
import { Action, UploadItem } from '../types/common';
import { MakeRequired } from '../types/utils';
import { buildActionItems, getPermittedUploadActions } from '../utils/ActionsFactory';
import { scrollToNodeItem } from '../utils/utils';
import { useUpload } from './useUpload';

export function useUploadActions(nodes: MakeRequired<Partial<UploadItem>, 'id'>[]): DSAction[] {
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
		if (node?.parentId) {
			if (nodes.length === 1) {
				const destination = `/?folder=${node.parentId}&node=${node.id}`;
				navigateTo(destination);
				scrollToNodeItem(node.id);
			} else {
				navigateToFolder(node.parentId);
			}
		}
	}, [navigateTo, navigateToFolder, node?.id, node?.parentId, nodes.length]);

	const permittedUploadActions = useMemo(() => getPermittedUploadActions(nodes), [nodes]);

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
