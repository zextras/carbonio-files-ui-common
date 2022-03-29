/*
 * SPDX-FileCopyrightText: 2022 Zextras <https://www.zextras.com>
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */
import { createContext } from 'react';

export const ListContext = createContext<{
	isEmpty: boolean;
	setIsEmpty: (empty: boolean) => void;
	// describe whether the list relates to a query or not.
	// Should be false only when no data should be shown because no query has been executed
	queryCalled?: boolean | undefined;
	setQueryCalled?: (queryCalled: boolean) => void;
}>({
	isEmpty: true,
	setIsEmpty: () => {
		// not implemented
	}
});

export const NodeAvatarIconContext = createContext<{
	tooltipLabel?: string;
	tooltipDisabled:
		| boolean
		| (({ disabled, selectable }: { disabled: boolean; selectable: boolean }) => boolean);
}>({ tooltipDisabled: true });
