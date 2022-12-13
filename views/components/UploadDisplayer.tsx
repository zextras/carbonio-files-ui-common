/*
 * SPDX-FileCopyrightText: 2022 Zextras <https://www.zextras.com>
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import React, { useMemo } from 'react';

import { useQuery } from '@apollo/client';
import { Container } from '@zextras/carbonio-design-system';

import { useActiveNode } from '../../../hooks/useActiveNode';
import GET_UPLOAD_ITEM from '../../graphql/queries/getUploadItem.graphql';
import { EmptyDisplayer } from './EmptyDisplayer';
import { UploadDisplayerNode } from './UploadDisplayerNode';

export interface DisplayerProps {
	translationKey: string;
	icons?: string[];
}

export const UploadDisplayer: React.VFC<DisplayerProps> = ({ translationKey, icons = [] }) => {
	const { activeNodeId } = useActiveNode();
	const { data } = useQuery(GET_UPLOAD_ITEM, {
		variables: { id: activeNodeId },
		skip: !activeNodeId
	});
	const node = useMemo(() => data?.getUploadItem, [data]);

	return (
		<Container
			orientation="vertical"
			mainAlignment="flex-start"
			crossAlignment="flex-start"
			data-testid="displayer"
		>
			{node ? (
				<UploadDisplayerNode uploadItem={node} />
			) : (
				<EmptyDisplayer icons={icons} translationKey={translationKey} />
			)}
		</Container>
	);
};
