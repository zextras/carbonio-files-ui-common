/*
 * SPDX-FileCopyrightText: 2022 Zextras <https://www.zextras.com>
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import React, { useMemo } from 'react';

import { useGetBaseNodeQuery } from '../../hooks/graphql/queries/useGetBaseNodeQuery';
import { UploadType } from '../../types/common';
import { getPermittedUploadActions } from '../../utils/ActionsFactory';
import { UploadListItem } from './UploadListItem';

interface UploadListItemWrapperProps {
	node: UploadType;
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
	const permittedUploadActions = useMemo(() => getPermittedUploadActions([node]), [node]);

	const { data: parentData } = useGetBaseNodeQuery(node.parentId);

	return (
		<UploadListItem
			id={node.id}
			nodeId={node.nodeId}
			name={node.file.name}
			mimeType={node.file.type}
			size={node.file.size}
			status={node.status}
			percentage={node.percentage}
			parent={parentData?.getNode}
			isSelected={isSelected}
			selectId={selectId}
			isSelectionModeActive={isSelectionModeActive}
			permittedHoverBarActions={permittedUploadActions}
			permittedContextualMenuActions={permittedUploadActions}
		/>
	);
};
