/*
 * SPDX-FileCopyrightText: 2022 Zextras <https://www.zextras.com>
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import React from 'react';

import {
	Divider,
	IconButton,
	Row,
	TextWithTooltip,
	Tooltip
} from '@zextras/carbonio-design-system';
import { useTranslation } from 'react-i18next';
import styled from 'styled-components';

const ModalTitle = styled(TextWithTooltip)`
	box-sizing: border-box;
	width: 100%;
	min-width: 0;
	flex-grow: 1;
	flex-shrink: 1;
	flex-basis: 0;
`;

const ModalCloseIcon = styled(IconButton)`
	padding: ${({ theme }): string => theme.sizes.padding.extrasmall};
`;

interface ModalHeaderProps {
	title: string;
	closeHandler: () => void;
}

export const ModalHeader: React.VFC<ModalHeaderProps> = ({ title, closeHandler }) => {
	const [t] = useTranslation();

	return (
		<Row orientation="horizontal" mainAlignment="space-between" width="100%" flexGrow={0}>
			<ModalTitle weight="bold" size="medium">
				{title}
			</ModalTitle>
			<Tooltip label={t('modal.close.tooltip', 'Close')}>
				<ModalCloseIcon size="medium" onClick={closeHandler} icon="Close" />
			</Tooltip>
			<Divider />
		</Row>
	);
};
