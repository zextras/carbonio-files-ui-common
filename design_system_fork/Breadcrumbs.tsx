/*
 * SPDX-FileCopyrightText: 2022 Zextras <https://www.zextras.com>
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Breadcrumbs as DsBreadcrumbs, getColor } from '@zextras/carbonio-design-system';
import styled, { css } from 'styled-components';

export type DropdownProps = Record<string, unknown> & {
	onOpen?: () => void;
	onClose?: () => void;
};

export type CollapserProps = Record<string, unknown>;

export const Breadcrumbs = styled(DsBreadcrumbs)`
	[class^='Text'] {
		font-size: ${({ theme, size = 'medium' }): string => theme.sizes.font[size]};

		${({ theme, color }): string =>
			color &&
			css`
				color: ${getColor(color, theme)};
			`};
	}
`;
