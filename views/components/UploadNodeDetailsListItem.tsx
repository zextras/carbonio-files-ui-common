/*
 * SPDX-FileCopyrightText: 2022 Zextras <https://www.zextras.com>
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import React, { useMemo } from 'react';

import { Container, Text } from '@zextras/carbonio-design-system';
import reduce from 'lodash/reduce';

import { LIST_ITEM_AVATAR_HEIGHT_COMPACT } from '../../constants';
import { Breadcrumbs } from '../../design_system_fork/Breadcrumbs';
import { useUploadActions } from '../../hooks/useUploadActions';
import { Crumb, UploadType } from '../../types/common';
import { MakeOptional } from '../../types/utils';
import { getIconByFileType, getUploadNodeType } from '../../utils/utils';
import { NodeAvatarIcon } from './NodeAvatarIcon';
import { NodeHoverBar } from './NodeHoverBar';
import { HoverContainer, ListItemContainer } from './StyledComponents';
import { UploadStatusIcon } from './UploadStatusIcon';

type UploadContentType = MakeOptional<UploadType, 'parentId'>;

interface UploadNodeDetailsListItemProps {
	node: UploadContentType;
}

export const UploadNodeDetailsListItem = ({
	node
}: UploadNodeDetailsListItemProps): JSX.Element => {
	const { id, status, percentage, file, fileSystemEntry } = node;

	const crumbs = useMemo<Crumb[]>(() => {
		const path = fileSystemEntry?.fullPath.split('/') || [];
		return reduce<string, Crumb[]>(
			path,
			(accumulator, pathEntry, index) => {
				if (pathEntry && index < path.length - 1) {
					accumulator.push({
						id: `path-${index}`,
						label: pathEntry,
						disabled: true,
						onClick: undefined
					});
				}
				return accumulator;
			},
			[]
		);
	}, [fileSystemEntry?.fullPath]);

	const hoverActions = useUploadActions([node]);

	return (
		<ListItemContainer
			height={'fit'}
			crossAlignment="flex-end"
			data-testid={`details-node-item-${id}`}
		>
			<HoverContainer
				wrap={'nowrap'}
				mainAlignment={'flex-start'}
				crossAlignment={'center'}
				padding={{ all: 'small' }}
				width={'fill'}
				background={'gray6'}
				orientation={'horizontal'}
				gap={'0.5rem'}
			>
				<NodeAvatarIcon
					selectionModeActive={false}
					selected={false}
					icon={`${getIconByFileType(getUploadNodeType(node))}Outline`}
					compact
				/>
				<Container
					orientation="vertical"
					width={'auto'}
					flexGrow={1}
					flexShrink={1}
					mainAlignment="flex-start"
					crossAlignment={'flex-start'}
					minWidth={0}
				>
					<Text overflow="ellipsis" size="small">
						{file.name}
					</Text>
					<Breadcrumbs crumbs={crumbs} $size={'extrasmall'} color={'gray0.disabled'} />
				</Container>
				<Text size={'small'}>{percentage}</Text>
				<UploadStatusIcon status={status} />
			</HoverContainer>
			<NodeHoverBar
				actions={hoverActions}
				height={'100%'}
				width={`calc(100% - ${LIST_ITEM_AVATAR_HEIGHT_COMPACT})`}
				padding={{ right: '0.5rem' }}
			/>
		</ListItemContainer>
	);
};
