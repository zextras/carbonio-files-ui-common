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

export interface NodesPage {
	// eslint-disable-next-line camelcase
	page_token: string;
	nodes: Reference[];
}

export interface NodesPageCachedObject {
	// eslint-disable-next-line camelcase
	page_token: string;
	nodes: NodesListCachedObject | undefined;
}

export interface FindNodesCachedObject extends NodesPageCachedObject {
	args: QueryFindNodesArgs | null;
}
