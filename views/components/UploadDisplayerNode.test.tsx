/*
 * SPDX-FileCopyrightText: 2022 Zextras <https://www.zextras.com>
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */
describe('Upload Displayer Node', () => {
	describe('Header actions', () => {
		test.todo('Go to folder is visible for every status');

		test.todo('Retry for file is visible only when item status is failed');

		test.todo(
			'Retry for folder is visible when item status is failed or one of the items of the content is failed'
		);

		test.todo('Retry restart upload of only failed items and not the completed ones');
	});
});
