/*
 * SPDX-FileCopyrightText: 2022 Zextras <https://www.zextras.com>
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import React, { useCallback } from 'react';

import { Button, Container, Divider, Padding, Tooltip } from '@zextras/carbonio-design-system';
import { useTranslation } from 'react-i18next';

interface ModalFooterProps {
	confirmLabel: string;
	confirmHandler: (event: React.SyntheticEvent) => void;
	confirmDisabled?: boolean;
	confirmDisabledTooltip?: string;
	cancelLabel?: string;
	cancelHandler?: (event: React.SyntheticEvent) => void;
	cancelDisabled?: boolean;
	cancelButtonColor?: string;
	children?: React.ReactNode;
}

export const ModalFooter: React.VFC<ModalFooterProps> = ({
	confirmLabel,
	confirmHandler,
	confirmDisabled,
	confirmDisabledTooltip,
	cancelLabel,
	cancelHandler,
	cancelDisabled,
	cancelButtonColor,
	children
}) => {
	const [t] = useTranslation();

	const stopPropagation = useCallback((event: React.SyntheticEvent) => {
		event.stopPropagation();
	}, []);

	return (
		<Container padding={{ vertical: 'small' }} minHeight={0} height="auto">
			<Divider />
			<Container
				orientation="horizontal"
				mainAlignment="flex-end"
				crossAlignment="flex-end"
				padding={{ top: 'small' }}
				height="auto"
			>
				{children}
				{cancelHandler && (
					<Padding left="small" onClick={stopPropagation}>
						<Button
							color={cancelButtonColor || 'primary'}
							type="outlined"
							onClick={cancelHandler}
							label={cancelLabel || t('modal.button.cancel')}
							disabled={cancelDisabled}
						/>
					</Padding>
				)}
				<Padding left="small" onClick={stopPropagation}>
					<Tooltip
						label={confirmDisabledTooltip}
						disabled={!confirmDisabledTooltip || !confirmDisabled}
					>
						<Button
							color="primary"
							onClick={confirmHandler}
							label={confirmLabel}
							disabled={confirmDisabled}
						/>
					</Tooltip>
				</Padding>
			</Container>
		</Container>
	);
};
