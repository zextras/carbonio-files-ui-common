/*
 * SPDX-FileCopyrightText: 2022 Zextras <https://www.zextras.com>
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import React, { useMemo } from 'react';

import { useQuery } from '@apollo/client';
import { Container, Text } from '@zextras/carbonio-design-system';
import reduce from 'lodash/reduce';

import { LIST_ITEM_AVATAR_HEIGHT_COMPACT } from '../../constants';
import { Breadcrumbs } from '../../design_system_fork/Breadcrumbs';
import GET_UPLOAD_ITEM from '../../graphql/queries/getUploadItem.graphql';
import { useUploadActions } from '../../hooks/useUploadActions';
import { Crumb, UploadItem } from '../../types/common';
import { getUploadNodeType, isUploadFolderItem } from '../../utils/uploadUtils';
import { getIconByFileType } from '../../utils/utils';
import { NodeAvatarIcon } from './NodeAvatarIcon';
import { NodeHoverBar } from './NodeHoverBar';
import { HoverContainer, ListItemContainer } from './StyledComponents';
import { UploadStatusIcon } from './UploadStatusIcon';

interface UploadNodeDetailsListItemProps {
	id: string;
}

export const UploadNodeDetailsListItem = ({ id }: UploadNodeDetailsListItemProps): JSX.Element => {
	const { data } = useQuery(GET_UPLOAD_ITEM, { variables: { id } });

	const item = useMemo<UploadItem | undefined>(() => data?.getUploadItem, [data]);

	const crumbs = useMemo<Crumb[]>(
		() =>
			reduce<string, Crumb[]>(
				item?.fullPath.split('/'),
				(accumulator, pathEntry, index, initialArray) => {
					if (pathEntry && index < initialArray.length - 1) {
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
			),
		[item?.fullPath]
	);

	const hoverActions = useUploadActions(item ? [item] : [], true);

	return (
		(item && (
			<ListItemContainer
				height={'fit'}
				crossAlignment="flex-end"
				data-testid={`details-node-item-${item.id}`}
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
						icon={`${getIconByFileType(getUploadNodeType(item))}Outline`}
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
							{item.name}
						</Text>
						<Breadcrumbs crumbs={crumbs} $size={'extrasmall'} color={'gray0.disabled'} />
					</Container>
					<Text size={'small'}>
						{(isUploadFolderItem(item) && `${item.progress}/${item.contentCount}`) ||
							`${item.progress}%`}
					</Text>
					<Text size={'small'}>{isUploadFolderItem(item) && `failed: ${item.failedCount}`}</Text>
					<Text size={'small'}>{`status: ${item.status}`}</Text>
					<UploadStatusIcon status={item.status} />
				</HoverContainer>
				<NodeHoverBar
					actions={hoverActions}
					height={'100%'}
					width={`calc(100% - ${LIST_ITEM_AVATAR_HEIGHT_COMPACT})`}
					padding={{ right: '0.5rem' }}
				/>
			</ListItemContainer>
		)) || <></>
	);
};
