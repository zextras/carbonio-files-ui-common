/*
 * SPDX-FileCopyrightText: 2022 Zextras <https://www.zextras.com>
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import React, { useCallback } from 'react';

import { useModal } from '@zextras/carbonio-design-system';

import { GetNodeParentType, Node } from '../../types/common';
import { CopyNodesModalContent } from '../../views/components/CopyNodesModalContent';

export type OpenCopyModal = (
	nodes: Array<Pick<Node, '__typename' | 'id'> & GetNodeParentType>,
	fromFolder?: string
) => void;

export function useCopyModal(copyNodesActionCallback?: () => void): {
	openCopyNodesModal: OpenCopyModal;
} {
	const createModal = useModal();

	const openCopyNodesModal = useCallback<OpenCopyModal>(
		(nodes, fromFolder) => {
			const closeModal = createModal(
				{
					maxHeight: '60vh',
					onClose: () => {
						closeModal();
					},
					children: (
						<CopyNodesModalContent
							closeAction={(): void => {
								copyNodesActionCallback && copyNodesActionCallback();
								closeModal();
							}}
							nodesToCopy={nodes}
							folderId={fromFolder}
						/>
					)
				},
				true
			);
		},
		[createModal, copyNodesActionCallback]
	);

	return { openCopyNodesModal };
}
