/*
 * SPDX-FileCopyrightText: 2022 Zextras <https://www.zextras.com>
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */
import type { Theme as DSTheme } from '@zextras/carbonio-design-system';

declare module 'styled-components' {
	// eslint-disable-next-line @typescript-eslint/no-empty-interface
	export interface DefaultTheme extends DSTheme {}
}

declare module 'styled-components/test-utils' {
	import { AnyStyledComponent } from 'styled-components';

	export const find: (
		element: Element,
		styledComponent: AnyStyledComponent
	) => HTMLElementTagNameMap[string] | null;
}
