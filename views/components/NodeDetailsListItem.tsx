/*
 * SPDX-FileCopyrightText: 2022 Zextras <https://www.zextras.com>
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import React, { useMemo } from 'react';

import { Avatar, Padding, Row, Text } from '@zextras/carbonio-design-system';
import { useTranslation } from 'react-i18next';
import styled from 'styled-components';

import useUserInfo from '../../../hooks/useUserInfo';
import { LIST_ITEM_HEIGHT_DETAILS } from '../../constants';
import { Maybe, NodeType, User } from '../../types/graphql/types';
import { formatDate, getIconByFileType } from '../../utils/utils';

interface NodeDetailsListItemProps {
	id: string;
	name: string;
	type: NodeType;
	mimeType?: Maybe<string>;
	owner: Partial<User>;
	updatedAt: number;
}

const FileIconPreview = styled(Avatar)`
	border-radius: 8px;
	height: 32px;
	width: 32px;
	flex: 0 0 auto;
	align-self: center;

	& > svg {
		color: ${(props): string => props.theme.palette.secondary.regular} !important;
		min-height: 16px;
		min-width: 16px;
		width: 16px;
		height: 16px;
	}
`;

export const NodeDetailsListItem: React.VFC<NodeDetailsListItemProps> = ({
	id,
	type,
	name = '',
	owner,
	updatedAt,
	mimeType
}) => {
	const userInfo = useUserInfo();
	const [t] = useTranslation();

	const displayName = useMemo(() => {
		if (owner && owner.id !== userInfo.me) {
			return owner.full_name;
		}
		return t('displayer.list.you', 'You');
	}, [owner, t, userInfo.me]);

	return (
		<Row
			id={id}
			data-testid={`details-node-item-${id}`}
			mainAlignment="flex-start"
			width="fill"
			height={LIST_ITEM_HEIGHT_DETAILS}
			padding={{ all: 'small' }}
		>
			<FileIconPreview
				icon={`${getIconByFileType(type, mimeType)}`}
				background="gray3"
				label="."
				data-testid="file-icon-preview"
			/>
			<Row flexGrow={2} mainAlignment="flex-start" padding={{ horizontal: 'small' }}>
				<Text overflow="ellipsis" size="small">
					{name}
				</Text>
			</Row>
			<Padding right="extrasmall">
				<Text overflow="ellipsis" size="extrasmall">
					{displayName}
				</Text>
			</Padding>
			{updatedAt && (
				<>
					{displayName && <Text>&middot;</Text>}
					<Padding left="extrasmall">
						<Text color="gray1" size="extrasmall">
							{formatDate(updatedAt, 'DD/MM/YYYY', userInfo.zimbraPrefTimeZoneId)}
						</Text>
					</Padding>
				</>
			)}
		</Row>
	);
};
