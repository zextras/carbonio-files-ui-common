/*
 * SPDX-FileCopyrightText: 2022 Zextras <https://www.zextras.com>
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

/**
 * @see https://files.zimbra.com/docs/soap_api/8.8.15/api-reference/zimbraMail/AutoComplete.html
 */
export interface AutocompleteRequest {
	includeGal: 0 | 1;
	name: { _content: string };
}

export interface AutocompleteResponse {
	match: Array<ContactMatch>;
}

export interface ContactMatch {
	email: string;
	type?: string;
	ranking?: number;
	isGroup?: 0 | 1;
	exp?: 0 | 1;
	id?: string;
	l?: string;
	display?: string;
	first?: string;
	middle?: string;
	last?: string;
	full?: string;
	nick?: string;
	company?: string;
	fileas?: string;
}
