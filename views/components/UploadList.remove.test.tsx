/*
 * SPDX-FileCopyrightText: 2022 Zextras <https://www.zextras.com>
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */
describe('Upload List', () => {
	describe('Remove', () => {
		describe('Selection Mode', () => {
			test.todo('Action is visible even if selected items have all a different status');

			test.todo(
				'Action remove all items from the list and stop the upload of the items which are not completed'
			);
		});

		describe('Contextual Menu', () => {
			test.todo('Action is visible if item is failed');

			test.todo('Action is visible if item is loading');

			test.todo('Action is visible if item is queued');

			test.todo('Action is visible if item is completed');
		});

		describe('Hover bar', () => {
			test.todo('Action is visible if item is failed');

			test.todo('Action is visible if item is loading');

			test.todo('Action is visible if item is queued');

			test.todo('Action is visible if item is completed');
		});
	});
});
