/*
 * SPDX-FileCopyrightText: 2022 Zextras <https://www.zextras.com>
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import React from 'react';

import { Container, Divider, Icon, IconButton, Row, Text } from '@zextras/carbonio-design-system';

import { Maybe, NodeType } from '../../types/graphql/types';
import { getIconByFileType } from '../../utils/utils';

interface DisplayerHeaderParams {
	name: string;
	type: NodeType;
	mimeType?: Maybe<string>;
	closeAction: () => void;
	trashed?: boolean;
}

export const DisplayerHeader: React.VFC<DisplayerHeaderParams> = ({
	name,
	type,
	mimeType,
	closeAction,
	trashed
}) => (
	<>
		<Container
			data-testid="DisplayerHeader"
			orientation="horizontal"
			height="48px"
			background="gray5"
			mainAlignment="space-between"
			crossAlignment="center"
			padding={{ left: 'large', right: 'extrasmall' }}
			style={{ minHeight: '48px' }}
		>
			<Icon size="large" icon={(trashed && 'Trash2Outline') || getIconByFileType(type, mimeType)} />
			<Row mainAlignment="flex-start" padding={{ left: 'large' }} takeAvailableSpace>
				<Text>{name}</Text>
			</Row>
			<IconButton icon="Close" onClick={closeAction} />
		</Container>
		<Divider color="gray3" />
	</>
);
