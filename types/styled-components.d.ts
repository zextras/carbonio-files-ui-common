/*
 * SPDX-FileCopyrightText: 2022 Zextras <https://www.zextras.com>
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */
declare module 'styled-components/test-utils' {
	import { StyledComponent } from 'styled-components';

	export const find: (
		element: Element,
		styledComponent: StyledComponent<any, any>
	) => HTMLElementTagNameMap[string] | null;
}
