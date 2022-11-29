/*
 * SPDX-FileCopyrightText: 2022 Zextras <https://www.zextras.com>
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */
import React, { useMemo } from 'react';

import { CollapsingActions, Container } from '@zextras/carbonio-design-system';
import map from 'lodash/map';
import { useTranslation } from 'react-i18next';

import { useActiveNode } from '../../../hooks/useActiveNode';
import { useGetBaseNodeQuery } from '../../hooks/graphql/queries/useGetBaseNodeQuery';
import { useUploadActions } from '../../hooks/useUploadActions';
import { UploadType } from '../../types/common';
import { NodeType } from '../../types/graphql/types';
import { getUploadNodeType, humanFileSize } from '../../utils/utils';
import { DisplayerHeader } from './DisplayerHeader';
import { NodeContent } from './NodeContent';
import { PathRow, PathRowProps } from './PathRow';
import { DisplayerContentContainer } from './StyledComponents';
import { TextRowWithShim } from './TextRowWithShim';
import { UploadNodeDetailsListItem } from './UploadNodeDetailsListItem';

interface UploadDisplayerNodeProps {
	node: UploadType;
}

export const UploadDisplayerNode = ({ node }: UploadDisplayerNodeProps): JSX.Element => {
	const [t] = useTranslation();
	const { removeActiveNode } = useActiveNode();

	const actions = useUploadActions([node]);

	const contentItems = useMemo(
		() =>
			node.children
				? map(node.children, (uploadItem) => <UploadNodeDetailsListItem node={uploadItem} />)
				: undefined,
		[node.children]
	);

	const { data: parentData, loading: loadingParent } = useGetBaseNodeQuery(node.parentId);

	const parentNode = useMemo<PathRowProps>(() => {
		if (!loadingParent) {
			if (parentData?.getNode) {
				return parentData.getNode;
			}
			const path = node.fileSystemEntry?.fullPath.split('/') || [];
			if (path.length > 0) {
				if (path.length > 1) {
					return {
						name: path[path.length - 2],
						type: NodeType.Folder,
						rootId: undefined,
						id: node.parentId || `${node.id}-parent-${Date.now().toLocaleString()}`
					};
				}
				return {
					name: path[path.length - 1],
					type: NodeType.Other,
					rootId: undefined,
					id: node.id
				};
			}
		}
		return {
			name: '',
			type: NodeType.Other,
			rootId: undefined,
			id: ''
		};
	}, [loadingParent, node.fileSystemEntry?.fullPath, node.id, node.parentId, parentData?.getNode]);

	return (
		<>
			<DisplayerHeader
				name={node.file.name}
				type={getUploadNodeType(node)}
				closeAction={removeActiveNode}
				mimeType={node.file.type}
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
					data-testid="node-details"
					gap="0.75rem"
				>
					<DisplayerContentContainer
						mainAlignment={'flex-start'}
						crossAlignment={'flex-start'}
						height={'fit'}
						padding={{ all: 'large' }}
						background={'gray6'}
					>
						{node.file.type && (
							<TextRowWithShim
								loading={false}
								label={t('displayer.details.size', 'Size')}
								content={humanFileSize(node.file.size ?? 0)}
								shimmerWidth="5rem"
							/>
						)}
						<PathRow
							id={parentNode.id}
							name={parentNode.name}
							type={parentNode.type}
							rootId={parentNode.rootId}
						/>
					</DisplayerContentContainer>
					{contentItems !== undefined && (
						<NodeContent id={node.id} loading={false} hasMore={false}>
							{contentItems}
						</NodeContent>
					)}
				</Container>
			</DisplayerContentContainer>
		</>
	);
};
