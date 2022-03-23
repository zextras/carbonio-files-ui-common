/*
 * SPDX-FileCopyrightText: 2022 Zextras <https://www.zextras.com>
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { useEffect } from 'react';

import { ApolloError } from '@apollo/client';
import { useSnackbar } from '@zextras/carbonio-design-system';
import { useTranslation } from 'react-i18next';

import { captureException } from '../../utils/utils';
import { decodeError } from '../utils/utils';

export function useErrorHandler(error: ApolloError | undefined, consoleErrorName: string): void {
	const [t] = useTranslation();
	const createSnackbar = useSnackbar();

	useEffect(() => {
		if (error) {
			captureException(new Error(`Failure on ${consoleErrorName}`));
			console.error(`${consoleErrorName}: `, { ...error });
			createSnackbar({
				key: new Date().toLocaleString(),
				type: 'warning',
				label:
					decodeError(error, t) ||
					t('errorCode.code', 'Something went wrong', { context: 'Generic' }),
				replace: true,
				hideButton: true
			});
		}
	}, [consoleErrorName, createSnackbar, error, t]);
}
