/*
 * SPDX-FileCopyrightText: 2022 Zextras <https://www.zextras.com>
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Reference } from '@apollo/client';

import { QueryFindNodesArgs } from './graphql/types';

export interface NodesListCachedObject {
	ordered: Reference[];
	unOrdered: Reference[];
}

export interface FindNodesCachedObject {
	args: QueryFindNodesArgs | null;
	// eslint-disable-next-line camelcase
	page_token: string;
	nodes: NodesListCachedObject | undefined;
}

export interface FindNodesObject {
	// eslint-disable-next-line camelcase
	page_token: string;
	nodes: Reference[];
}
