/*
 * SPDX-FileCopyrightText: 2022 Zextras <https://www.zextras.com>
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */
describe('Upload List', () => {
	describe('Retry', () => {
		describe('Selection Mode', () => {
			test.todo('Action is visible if all selected items are failed');

			test.todo('Action is hidden if at least one selected item is not failed');

			test.todo(
				'Action on multiple selection reset all selected item status from failed to loading and restart upload'
			);
		});

		describe('Contextual Menu', () => {
			test.todo('Action is visible if item is failed');

			test.todo('Action is hidden if item is loading');

			test.todo('Action is hidden if item is queued');

			test.todo('Action is hidden if item is completed');
		});

		describe('Hover bar', () => {
			test.todo('Action is visible if item is failed');

			test.todo('Action is hidden if item is loading');

			test.todo('Action is hidden if item is queued');

			test.todo('Action is hidden if item is completed');
		});
	});
});
