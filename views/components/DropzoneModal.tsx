/*
 * SPDX-FileCopyrightText: 2022 Zextras <https://www.zextras.com>
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import React, { useMemo } from 'react';

import { Container, Icon, Padding, Text } from '@zextras/carbonio-design-system';
import map from 'lodash/map';
import styled, { css, FlattenSimpleInterpolation } from 'styled-components';

const BackDropLayoutInnerBox = styled(Container)`
	position: absolute;
	top: 50%;
	left: 50%;
	transform: translate(-50%, -50%);
	border-radius: 20px;
`;

const BackDropLayoutContentBox = styled(Container)<{ $disabled?: boolean }>`
	border-radius: 10px;
	box-sizing: border-box;
	//box-sizing: border-box;
	background-image: ${({ $disabled }): FlattenSimpleInterpolation =>
		$disabled
			? css`url("data:image/svg+xml,%3csvg width='100%25' height='100%25' xmlns='http://www.w3.org/2000/svg'%3e%3crect width='100%25' height='100%25' fill='none' rx='10' ry='10' stroke='%23828282FF' stroke-width='3' stroke-dasharray='8%2c 8' stroke-dashoffset='0' stroke-linecap='square'/%3e%3c/svg%3e")`
			: css`url("data:image/svg+xml,%3csvg width='100%25' height='100%25' xmlns='http://www.w3.org/2000/svg'%3e%3crect width='100%25' height='100%25' fill='none' rx='10' ry='10' stroke='%232B73D2FF' stroke-width='3' stroke-dasharray='8%2c 8' stroke-dashoffset='0' stroke-linecap='square'/%3e%3c/svg%3e")`};
`;

const DropBoxIconGroup = styled(Container)`
	margin-bottom: 8px;
	height: 40px;
`;

const DetailText = styled(Text)`
	text-align: center;
	white-space: pre-line;
	line-height: calc(
		${({ theme, size }): string => theme.sizes.font[size || 'medium']} +
			(${({ theme, size }): string => theme.sizes.font[size || 'medium']} / 2)
	);
`;

interface DropzoneModalProps {
	title: string;
	message: string;
	icons: string[];
	disabled?: boolean;
}

export const DropzoneModal: React.VFC<DropzoneModalProps> = ({
	title,
	message,
	disabled,
	icons
}) => {
	const color = useMemo(() => (disabled ? 'secondary' : 'primary'), [disabled]);

	const iconItems = useMemo(
		() =>
			map(icons, (icon, index) => {
				const size =
					(icons.length % 2 === 0 &&
						(index === icons.length / 2 || index === icons.length / 2 - 1)) ||
					(icons.length % 2 > 0 && index === Math.floor(icons.length / 2))
						? '35px'
						: '28px';
				return (
					<Padding right="small" left="small" key={`icon-${index}`}>
						<Icon icon={icon} height={size} width={size} color={color} />
					</Padding>
				);
			}),
		[color, icons]
	);

	return (
		<BackDropLayoutInnerBox
			minHeight="180"
			maxWidth="90%"
			background="gray6"
			height="fit"
			width="fit"
		>
			<Padding all="medium">
				<BackDropLayoutContentBox
					padding={{ vertical: 'large', horizontal: 'extralarge' }}
					color={color}
					$disabled={disabled}
				>
					<Container mainAlignment="center">
						<DropBoxIconGroup mainAlignment="center" orientation="horizontal">
							{iconItems}
						</DropBoxIconGroup>
						<Container mainAlignment="center" height="auto" padding={{ vertical: 'large' }}>
							<Text size="large" color={color} weight="bold">
								{title}
							</Text>
							<Padding top="large" />
							<DetailText size="small" weight="regular" color={color} overflow="break-word">
								{message}
							</DetailText>
						</Container>
					</Container>
				</BackDropLayoutContentBox>
			</Padding>
		</BackDropLayoutInnerBox>
	);
};
