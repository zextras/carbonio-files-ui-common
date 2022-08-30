/*
 * SPDX-FileCopyrightText: 2022 Zextras <https://www.zextras.com>
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

/* eslint-disable arrow-body-style */
import React, { useCallback, useEffect, useRef, useState } from 'react';

import { Popover, Chip } from '@zextras/carbonio-design-system';
import styled from 'styled-components';

import { ChipProps } from '../../../types/common';

const CustomPopover = styled(Popover)`
	z-index: 1000;
`;

const ActiveChip = styled(Chip)`
	background: ${({ background, active, theme }): string => {
		return !active ? background : theme.palette[background].active;
	}};
`;

export interface ChipWithPopoverProps extends ChipProps {
	onClose?: (event?: React.SyntheticEvent) => void;
	background?: string;
	openPopoverOnClick?: boolean;
	popoverOpen?: boolean;
	onClick?: (event: React.SyntheticEvent) => void;
	children: (closePopover: () => void) => JSX.Element;
	onChange?: (newState: boolean) => void;
}

export const ChipWithPopover: React.VFC<ChipWithPopoverProps> = ({
	onClose,
	background,
	openPopoverOnClick = true,
	popoverOpen = false,
	onClick,
	children,
	onChange,
	...rest
}) => {
	const ref = useRef<HTMLDivElement>(null);
	const [open, setOpen] = useState(popoverOpen);

	useEffect(() => {
		setOpen(popoverOpen);
	}, [popoverOpen]);

	const setOpenToFalse = useCallback(() => {
		if (onChange) {
			onChange(false);
		} else {
			setOpen(false);
		}
	}, [onChange]);

	const onCloseChip = useCallback(
		(ev: React.SyntheticEvent) => {
			if (ref && ref.current) {
				// required to close all opened popover
				ref.current.click();
			}
			if (onClose) {
				onClose(ev);
			}
		},
		[ref, onClose]
	);

	const onClickChip = useCallback<React.MouseEventHandler>(
		(ev) => {
			if (openPopoverOnClick) {
				if (onChange) {
					onChange(true);
				} else {
					setOpen(true);
				}
			}
			if (onClick) {
				onClick(ev);
			}
		},
		[openPopoverOnClick, onClick, onChange]
	);

	return (
		<>
			<div ref={ref} data-testid="chip-with-popover">
				<ActiveChip
					active={open}
					background={background}
					onClose={onClose ? onCloseChip : undefined}
					onClick={openPopoverOnClick || onClick ? onClickChip : undefined}
					{...rest}
				/>
			</div>
			<CustomPopover
				open={open}
				anchorEl={ref}
				styleAsModal
				placement="bottom-start"
				onClose={setOpenToFalse}
			>
				{children(setOpenToFalse)}
			</CustomPopover>
		</>
	);
};
