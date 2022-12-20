/*
 * SPDX-FileCopyrightText: 2022 Zextras <https://www.zextras.com>
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */
import React from 'react';

import { screen } from '@testing-library/react';

import { ICON_REGEXP } from '../../constants/test';
import { populateFolder, populateLocalRoot } from '../../mocks/mockUtils';
import { mockGetBaseNode } from '../../utils/mockUtils';
import { createDataTransfer, setup, uploadWithDnD } from '../../utils/testUtils';
import { UploadList } from './UploadList';

describe('Upload List', () => {
	describe('Folder', () => {
		test.todo(
			'When an item of a folder completes, the counter of the loaded items is incremented by 1, independently from its depth inside the tree of content'
		);

		test.todo(
			'A folder has status complete only when all the items of the content are in status completed'
		);

		test.todo(
			'If all items of the content of a folder finished, some with a failure, the progress of the folder shows only the completed'
		);

		test.todo(
			'If all items of the content of a folder finished, some with a failure, the status of the folder is failed'
		);

		test('If all items of the content of a folder finished, all with success, the progress of the folder shows the total count of items on both values of the fraction', async () => {
			const localRoot = populateLocalRoot();
			const folder = populateFolder(10);
			folder.parent = localRoot;
			const subFolder = populateFolder(10);
			folder.children.nodes.push(subFolder);
			const subSubFolder = populateFolder();
			subFolder.children.nodes.push(subSubFolder);

			const totalItemsCount =
				folder.children.nodes.length +
				subFolder.children.nodes.length +
				subSubFolder.children.nodes.length +
				1;

			const dataTransferObj = createDataTransfer([folder]);

			const mocks = [mockGetBaseNode({ node_id: localRoot.id }, localRoot)];

			setup(<UploadList />, { mocks });

			const dropzone = await screen.findByText(/nothing here/i);
			await uploadWithDnD(dropzone, dataTransferObj);

			await screen.findByText(folder.name);
			await screen.findByTestId(ICON_REGEXP.uploadCompleted);
			expect(screen.getByText(`${totalItemsCount}/${totalItemsCount}`)).toBeVisible();
		});

		test.todo(
			'If there is at least one item of the content of a folder still loading, the status of the folder is also loading'
		);
	});
});
