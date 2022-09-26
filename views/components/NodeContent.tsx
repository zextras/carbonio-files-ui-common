/*
 * SPDX-FileCopyrightText: 2022 Zextras <https://www.zextras.com>
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */
import React from 'react';

import { Container, Padding, Shimmer, Text } from '@zextras/carbonio-design-system';
import { useTranslation } from 'react-i18next';

import { LIST_ITEM_HEIGHT_DETAILS } from '../../constants';
import { ChildFragment, Maybe } from '../../types/graphql/types';
import { EmptyFolder } from './EmptyFolder';
import { NodeDetailsList } from './NodeDetailsList';
import { DisplayerContentContainer, ShimmerText } from './StyledComponents';

const ShimmerNodeDetailsItem = (): JSX.Element => (
	<Container
		orientation="horizontal"
		mainAlignment="flex-start"
		width="fill"
		height={LIST_ITEM_HEIGHT_DETAILS}
		padding={{ all: 'small' }}
	>
		<Container width="fit" height="fit">
			<Shimmer.Avatar size="medium" radius="0.5rem" />
		</Container>
		<Padding horizontal="small">
			<ShimmerText $size="small" width="9.375rem" />
		</Padding>
		<Container orientation="horizontal" mainAlignment="flex-end">
			<ShimmerText $size="small" width="3.75rem" />
		</Container>
	</Container>
);

export const NodeContent = ({
	hasMore,
	id,
	loadMore,
	loading,
	nodes
}: {
	nodes?: Array<Maybe<ChildFragment> | undefined>;
	id: string;
	loading: boolean;
	hasMore?: boolean;
	loadMore: () => void;
}): JSX.Element => {
	const [t] = useTranslation();

	return (
		<DisplayerContentContainer
			mainAlignment={'flex-start'}
			crossAlignment={'flex-start'}
			minHeight={nodes && nodes.length > 7 ? '25rem' : '0rem'}
			data-testid={`details-list-${id || ''}`}
			background={'gray6'}
			padding={{ all: 'large' }}
			height={'fit'}
			maxHeight="25rem"
		>
			<Padding bottom="large">
				<Text>{t('displayer.details.content', 'Content')}</Text>
			</Padding>
			{nodes && nodes.length > 0 && (
				<NodeDetailsList nodes={nodes} loading={loading} hasMore={hasMore} loadMore={loadMore} />
			)}
			{!loading && nodes && nodes.length === 0 && (
				<EmptyFolder
					message={t('empty.folder.displayerContent', 'This folder has no content')}
					size="extrasmall"
					weight="regular"
				/>
			)}
			{loading && !nodes && <ShimmerNodeDetailsItem />}
		</DisplayerContentContainer>
	);
};
