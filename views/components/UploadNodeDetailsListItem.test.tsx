/*
 * SPDX-FileCopyrightText: 2022 Zextras <https://www.zextras.com>
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */
describe('Upload Node Details List Item', () => {
	test.todo('The progress of the upload is visible for each item contained inside the folder');

	test.todo(
		'Progress for folders is shown as the fraction of loaded items on the total content count. The folder itself is included in the fraction values'
	);

	test.todo('If the item is loading, the loading icon is shown');

	test.todo('If the item is failed, the failed icon is shown');

	test.todo(
		'If the item is a folder, and at least one sub-item is still loading, the loading icon is shown'
	);

	test.todo('If the item is queued, the progress is hidden and the queued label is shown');

	test.todo('The name of the item is visible');

	test.todo('The path of the item is visible, starting from the root folder');
});
