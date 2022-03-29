/*
 * SPDX-FileCopyrightText: 2022 Zextras <https://www.zextras.com>
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */
import React from 'react';

import { Button, Text } from '@zextras/carbonio-design-system';
import styled from 'styled-components';

import { ContainerWithGap } from './ContainerWithGap';

const FakeModalContainer = styled(ContainerWithGap)`
	border-radius: 16px;
	padding: 32px 64px 32px 64px;
`;

const AttachmentLink = styled.a`
	text-decoration: none;
`;

interface PreviewCriteriaAlternativeContentProps {
	downloadSrc: string;
	openSrc: string;
}

export const PreviewCriteriaAlternativeContent: React.VFC<
	PreviewCriteriaAlternativeContentProps
> = ({ downloadSrc, openSrc }) => (
	<FakeModalContainer
		background="gray0"
		crossAlignment="center"
		height="fit"
		width="fit"
		gap="16px"
	>
		<Text size="large" color="gray6">
			{'Whoopsie Doopsie!'}
		</Text>
		<Text size="medium" color="gray6" weight="bold">
			{'This file exceedes the maximum limit of weight we support and cannot be displayed'}
		</Text>
		<ContainerWithGap orientation="horizontal" height="fit" gap="8px">
			<Button label="DOWNLOAD FILE" icon="DownloadOutline" size="fill" />
			<Button label="OPEN ON A SEPARATE TAB" icon="DiagonalArrowRightUp" size="fill" />
		</ContainerWithGap>
		<Text size="small" color="gray6">
			{'Please, download it or open it on another tab'}
		</Text>
	</FakeModalContainer>
);

// <AttachmentLink href={downloadSrc} rel="nofollow noreferrer noopener">
