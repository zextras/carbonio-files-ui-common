/*
 * SPDX-FileCopyrightText: 2022 Zextras <https://www.zextras.com>
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */
import {
	styled,
	IconButton as MuiIconButton,
	IconButtonProps as MuiIconButtonProps,
	Interpolation,
	Palette,
	PaletteColor
} from '@mui/material';

import { PickByValue } from '../types/utils';

export interface IconButtonProps extends MuiIconButtonProps {
	backgroundColor?: keyof PickByValue<Palette, PaletteColor>;
}

export const IconButton = styled(MuiIconButton)<IconButtonProps>`
	background-color: ${({ theme, backgroundColor }): Interpolation<unknown> =>
		backgroundColor && theme.palette[backgroundColor].main};
`;
