/*
 * SPDX-FileCopyrightText: 2022 Zextras <https://www.zextras.com>
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { useContext } from 'react';

import { SnackbarManagerContext } from '@zextras/carbonio-design-system';

export interface SnackbarProps {
	label: string;
	key: string;
	type: 'success' | 'info' | 'warning' | 'error';
	actionLabel?: string;
	onActionClick?: () => void;
	onClose?: () => void;
	disableAutoHide?: boolean;
	hideButton?: boolean;
	zIndex?: number;
	autoHideTimeout?: number;
	replace?: boolean;
}

export function useCreateSnackbar(): (snackbarProps: SnackbarProps) => void {
	const createSnackbar = useContext<(snackbarProps: SnackbarProps) => void>(SnackbarManagerContext);
	return createSnackbar;
}
