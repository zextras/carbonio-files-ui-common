/*
 * SPDX-FileCopyrightText: 2022 Zextras <https://www.zextras.com>
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { makeVar, Reference } from '@apollo/client';

export const nodeListCursorVar = makeVar<Record<string, Reference | null | undefined>>({});
