/*
 * SPDX-FileCopyrightText: 2022 Zextras <https://www.zextras.com>
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import React, { useMemo } from 'react';

import { useReactiveVar } from '@apollo/client';
import { Container } from '@zextras/carbonio-design-system';

import { useActiveNode } from '../../../hooks/useActiveNode';
import { uploadVar } from '../../apollo/uploadVar';
import { UploadItem } from '../../types/common';
import { EmptyDisplayer } from './EmptyDisplayer';
import { UploadDisplayerNode } from './UploadDisplayerNode';

export interface DisplayerProps {
	translationKey: string;
	icons?: string[];
}

export const UploadDisplayer: React.VFC<DisplayerProps> = ({ translationKey, icons = [] }) => {
	const { activeNodeId } = useActiveNode();
	const uploadStatusMap = useReactiveVar<{ [id: string]: UploadItem }>(uploadVar);
	const node = useMemo(
		() => (activeNodeId && uploadStatusMap[activeNodeId]) || undefined,
		[activeNodeId, uploadStatusMap]
	);

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
