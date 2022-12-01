/*
 * SPDX-FileCopyrightText: 2022 Zextras <https://www.zextras.com>
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import React, { useCallback } from 'react';

import { useActiveNode } from '../../../hooks/useActiveNode';
import { useGetBaseNodeQuery } from '../../hooks/graphql/queries/useGetBaseNodeQuery';
import { useUploadActions } from '../../hooks/useUploadActions';
import { UploadItem } from '../../types/common';
import { UploadListItem } from './UploadListItem';

interface UploadListItemWrapperProps {
	node: UploadItem;
	isSelected: boolean;
	isSelectionModeActive: boolean;
	selectId: (id: string) => void;
}

export const UploadListItemWrapper: React.VFC<UploadListItemWrapperProps> = ({
	node,
	isSelected,
	isSelectionModeActive,
	selectId
}) => {
	const permittedUploadActionItems = useUploadActions([node]);

	const { data: parentData } = useGetBaseNodeQuery(node.parentNodeId || '');

	const { setActiveNode, activeNodeId } = useActiveNode();

	const setActive = useCallback(() => {
		setActiveNode(node.id);
	}, [node.id, setActiveNode]);

	return (
		<UploadListItem
			id={node.id}
			nodeId={node.nodeId || undefined}
			name={node.name}
			mimeType={node.file?.type || ''}
			size={node.file?.size || 0}
			status={node.status}
			percentage={node.progress}
			parent={parentData?.getNode}
			isSelected={isSelected}
			selectId={selectId}
			isSelectionModeActive={isSelectionModeActive}
			permittedHoverBarActionItems={permittedUploadActionItems}
			permittedContextualMenuActionItems={permittedUploadActionItems}
			isActive={activeNodeId === node.id}
			setActive={setActive}
		/>
	);
};
