/*
 * SPDX-FileCopyrightText: 2022 Zextras <https://www.zextras.com>
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import React, { useCallback, useState, useEffect, useMemo } from 'react';

import { AvatarProps, Palette, Theme } from '@mui/material';
import {
	Popover,
	Chip as DSChip,
	getColor,
	useCombinedRefs,
	Icon
} from '@zextras/carbonio-design-system';
import styled from 'styled-components';

import { Avatar } from '../../../mui/Avatar';
import { Chip, ChipProps } from '../../../mui/Chip';

const CustomPopover = styled(Popover)`
	z-index: 1000;
`;

const ActiveChip = styled(DSChip)<{ $active: boolean }>`
	background: ${({ background, $active, theme }): string =>
		getColor(`${background}.${$active ? 'active' : 'regular'}`, theme)};
`;

export interface ChipWithPopoverProps extends Omit<ChipProps, 'children' | 'color'> {
	onClose?: (event?: React.SyntheticEvent | KeyboardEvent) => void;
	openPopoverOnClick?: boolean;
	popoverOpen?: boolean;
	onClick?: (event: React.SyntheticEvent) => void;
	children: (closePopover: () => void) => JSX.Element;
	onValueChange?: (newState: boolean) => void;
	background?: ChipProps['color'];
	hasAvatar?: boolean;
	avatarLabel?: React.ReactNode;
	avatarBackground?: keyof Palette;
	avatarIcon?: keyof Theme['icons'];
	avatarColor?: keyof Palette;
	avatarPicture?: string;
}

export const ChipWithPopover = React.forwardRef<HTMLDivElement, ChipWithPopoverProps>(
	function ChipWithPopoverFn(
		{
			onClose,
			background,
			openPopoverOnClick = true,
			popoverOpen = false,
			onClick,
			children,
			onValueChange,
			hasAvatar = true,
			avatarLabel,
			avatarBackground,
			avatarIcon,
			avatarColor,
			avatarPicture,
			...rest
		},
		ref
	) {
		const innerRef = useCombinedRefs<HTMLDivElement>(ref);
		const [open, setOpen] = useState(popoverOpen);

		useEffect(() => {
			setOpen(popoverOpen);
		}, [popoverOpen]);

		const setOpenToFalse = useCallback(() => {
			if (onValueChange) {
				onValueChange(false);
			} else {
				setOpen(false);
			}
		}, [onValueChange]);

		const onCloseChip = useCallback(
			(ev: React.MouseEvent<HTMLButtonElement> | KeyboardEvent) => {
				if (innerRef && innerRef.current) {
					// required to close all opened popover
					innerRef.current.click();
				}
				if (onClose) {
					onClose(ev);
				}
			},
			[innerRef, onClose]
		);

		const onClickChip = useCallback<React.MouseEventHandler>(
			(ev) => {
				if (openPopoverOnClick) {
					if (onValueChange) {
						onValueChange(true);
					} else {
						setOpen(true);
					}
				}
				if (onClick) {
					onClick(ev);
				}
			},
			[openPopoverOnClick, onClick, onValueChange]
		);

		const { size, label, actions } = rest;

		const AvatarComponent = useMemo<JSX.Element | undefined>(() => {
			if (hasAvatar) {
				const props: Partial<AvatarProps> = {};
				if (avatarBackground) {
					props.sx = { ...props.sx, bgcolor: avatarBackground };
				}
				if (avatarIcon) {
					props.children = <Icon icon={avatarIcon} color={avatarColor} />;
				} else if (avatarLabel) {
					props.children = avatarLabel;
					if (avatarColor) {
						props.color = avatarColor;
					}
				} else {
					props.children = label;
				}
				return <Avatar src={avatarPicture} {...props} />;
			}
			return undefined;
		}, [avatarBackground, avatarColor, avatarIcon, avatarLabel, avatarPicture, hasAvatar, label]);

		return (
			<>
				<div ref={innerRef} data-testid="chip-with-popover">
					<Chip
						label={label}
						size={size}
						onClick={openPopoverOnClick || onClick ? onClickChip : undefined}
						onDelete={onClose ? onCloseChip : undefined}
						actions={actions}
						avatar={AvatarComponent}
						color={background}
					/>
					{/* <ActiveChip */}
					{/*	$active={open} */}
					{/*	background={background} */}
					{/*	onClose={onClose ? onCloseChip : undefined} */}
					{/*	onClick={openPopoverOnClick || onClick ? onClickChip : undefined} */}
					{/*	{...rest} */}
					{/* /> */}
				</div>
				<CustomPopover
					open={open}
					anchorEl={innerRef}
					styleAsModal
					placement="bottom-start"
					onClose={setOpenToFalse}
				>
					{children(setOpenToFalse)}
				</CustomPopover>
			</>
		);
	}
);
