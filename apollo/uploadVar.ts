/*
 * SPDX-FileCopyrightText: 2022 Zextras <https://www.zextras.com>
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { makeVar } from '@apollo/client';

import { UploadType } from '../types/common';

export type UploadRecord = { [id: string]: UploadType };

export const uploadVar = makeVar<UploadRecord>({});

export interface UploadFunctions {
	abort: () => void;
	retry: (file: UploadType) => UploadFunctions['abort'];
}

export const uploadFunctionsVar = makeVar<{ [id: string]: UploadFunctions }>({});
