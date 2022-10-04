/*
 * SPDX-FileCopyrightText: 2022 Zextras <https://www.zextras.com>
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */
import React, { useMemo } from 'react';

import {
	ButtonProps,
	Chip as MuiChip,
	ChipProps as MuiChipProps,
	IconButton,
	Palette,
	Stack,
	Theme,
	Tooltip,
	TooltipProps
} from '@mui/material';
import { Icon } from '@zextras/carbonio-design-system';
import map from 'lodash/map';

type ChipAction = {
	/** Chip action icon color */
	color?: keyof Palette;
	/** Chip action disabled status */
	disabled?: boolean;
	/** Chip action icon */
	icon: keyof Theme['icons'];
	/** Chip action id (required for key attribute) */
	id: string;
	/** Chip action label value. It is shown in a tooltip. To not render the tooltip, just don't value the prop.
	 * Tooltips of the actions are not shown in case the chip is disabled */
	label?: string;
} & (
	| {
			/** Chip action type */
			type: 'button';
			/** Chip action click callback (button type only). NB: onClick event IS propagated. It's up to the dev to eventually stop the propagation */
			onClick: ButtonProps['onClick'];
			/** Chip action background (button type only) */
			background?: keyof Palette;
	  }
	| {
			/** Chip action type */
			type: 'icon';
	  }
);

interface ChipProps extends MuiChipProps {
	/** Chip actions (buttons or icons) */
	actions?: ChipAction[];
	/** Chip error. If a string is provided it is shown in a tooltip */
	error?: boolean | string;
	/** Tooltip placement */
	tooltipPlacement?: TooltipProps['placement'];
}

export const Chip = React.forwardRef<HTMLDivElement, ChipProps>(function ChipFn(
	{ actions, label, size, disabled, error, tooltipPlacement, ...rest },
	ref
) {
	const labelComponent = useMemo(() => {
		if (actions) {
			const actionsComp = map(actions, (action) => (
				<Tooltip
					title={action.label}
					key={action.id}
					enterDelay={500}
					disableHoverListener={!action.label}
					placement={tooltipPlacement}
				>
					<span>
						{action.type === 'icon' && (
							<Icon
								icon={action.icon}
								color={error ? 'gray6' : action.color}
								disabled={!!disabled || action.disabled}
								size={size}
							/>
						)}
						{action.type === 'button' && (
							<IconButton
								aria-label={action.label}
								size={size}
								onClick={action.onClick}
								sx={
									(size === 'small' && { padding: '2px' }) ||
									(size === 'medium' && { padding: '4px' }) ||
									undefined
								}
								backgroundColor={error || !action.background ? 'gray5' : action.background}
							>
								<Icon
									icon={action.icon}
									disabled={!!disabled || action.disabled}
									size={size}
									color={error ? 'gray6' : action.color}
								/>
							</IconButton>
						)}
					</span>
				</Tooltip>
			));

			return (
				<Stack
					spacing={(size === 'small' && 0.25) || (size === 'medium' && 0.5) || undefined}
					direction="row"
				>
					{label}
					{actionsComp}
				</Stack>
			);
		}
		return label;
	}, [actions, disabled, error, label, size, tooltipPlacement]);

	return <MuiChip label={labelComponent} size={size} disabled={disabled} {...rest} ref={ref} />;
});
