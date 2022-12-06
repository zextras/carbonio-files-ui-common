/*
 * SPDX-FileCopyrightText: 2022 Zextras <https://www.zextras.com>
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */
import React, { useMemo } from 'react';

import { useReactiveVar } from '@apollo/client';
import { CollapsingActions, Container } from '@zextras/carbonio-design-system';
import drop from 'lodash/drop';
import isEqual from 'lodash/isEqual';
import map from 'lodash/map';
import { useTranslation } from 'react-i18next';

import { useActiveNode } from '../../../hooks/useActiveNode';
import { uploadVar } from '../../apollo/uploadVar';
import { useGetBaseNodeQuery } from '../../hooks/graphql/queries/useGetBaseNodeQuery';
import { useMemoCompare } from '../../hooks/useMemoCompare';
import { useUploadActions } from '../../hooks/useUploadActions';
import { UploadItem } from '../../types/common';
import { NodeType } from '../../types/graphql/types';
import {
	flatUploadItemChildrenIds,
	getUploadNodeType,
	isUploadFolderItem
} from '../../utils/uploadUtils';
import { humanFileSize } from '../../utils/utils';
import { DisplayerHeader } from './DisplayerHeader';
import { NodeContent } from './NodeContent';
import { PathRow, PathRowProps } from './PathRow';
import { DisplayerContentContainer } from './StyledComponents';
import { TextRowWithShim } from './TextRowWithShim';
import { UploadNodeDetailsListItem } from './UploadNodeDetailsListItem';

interface UploadDisplayerNodeProps {
	uploadItem: UploadItem;
}

export const UploadDisplayerNode = ({ uploadItem }: UploadDisplayerNodeProps): JSX.Element => {
	const [t] = useTranslation();
	const { removeActiveNode } = useActiveNode();

	const actions = useUploadActions([uploadItem]);
	const uploadStatusMap = useReactiveVar<{ [id: string]: UploadItem }>(uploadVar);

	const ids = useMemo(
		() => drop(flatUploadItemChildrenIds(uploadItem.id, uploadStatusMap)),
		[uploadItem.id, uploadStatusMap]
	);

	const memoIds = useMemoCompare(ids, (prev, next) => isEqual(prev, next));

	const contentItems = useMemo(() => {
		if (isUploadFolderItem(uploadItem)) {
			return map(memoIds, (childItemId) => <UploadNodeDetailsListItem id={childItemId} />);
		}
		return undefined;
	}, [memoIds, uploadItem]);

	const { data: parentData, loading: loadingParent } = useGetBaseNodeQuery(
		uploadItem.parentNodeId || ''
	);

	const parentNode = useMemo<PathRowProps>(() => {
		if (!loadingParent) {
			if (parentData?.getNode) {
				return parentData.getNode;
			}
			const path: string[] = uploadItem.fullPath.split('/');
			if (path.length > 0) {
				if (path.length > 1) {
					return {
						name: path[path.length - 2],
						type: NodeType.Folder,
						rootId: undefined,
						id: uploadItem.parentId || `${uploadItem.id}-parent-${Date.now().toLocaleString()}`
					};
				}
				return {
					name: path[path.length - 1],
					type: NodeType.Other,
					rootId: undefined,
					id: uploadItem.id
				};
			}
		}
		return {
			name: '',
			type: NodeType.Other,
			rootId: undefined,
			id: ''
		};
	}, [loadingParent, parentData, uploadItem.fullPath, uploadItem.id, uploadItem.parentId]);

	return (
		<>
			<DisplayerHeader
				name={uploadItem.file?.name || ''}
				type={getUploadNodeType(uploadItem)}
				closeAction={removeActiveNode}
				mimeType={uploadItem.file?.type}
			/>
			<Container
				orientation="horizontal"
				mainAlignment="flex-end"
				crossAlignment="center"
				height="auto"
				padding={{ horizontal: 'large', vertical: 'small' }}
				data-testid="displayer-actions-header"
			>
				<CollapsingActions actions={actions} />
			</Container>
			<DisplayerContentContainer
				height={'fill'}
				background={'gray5'}
				padding={{ horizontal: 'large' }}
				mainAlignment={'flex-start'}
				data-testid="displayer-content"
			>
				<Container
					mainAlignment={'flex-start'}
					background={'gray5'}
					height={'auto'}
					maxHeight={'100%'}
					data-testid="node-details"
					gap="0.75rem"
				>
					<Container
						mainAlignment={'flex-start'}
						crossAlignment={'flex-start'}
						height={'fit'}
						padding={{ all: 'large' }}
						background={'gray6'}
					>
						{uploadItem.file?.type && (
							<TextRowWithShim
								loading={false}
								label={t('displayer.details.size', 'Size')}
								content={humanFileSize(uploadItem.file.size ?? 0)}
								shimmerWidth="5rem"
							/>
						)}
						<PathRow
							id={parentNode.id}
							name={parentNode.name}
							type={parentNode.type}
							rootId={parentNode.rootId}
						/>
					</Container>
					{contentItems !== undefined && (
						<NodeContent id={uploadItem.id} loading={false} hasMore={false}>
							{contentItems}
						</NodeContent>
					)}
				</Container>
			</DisplayerContentContainer>
		</>
	);
};
