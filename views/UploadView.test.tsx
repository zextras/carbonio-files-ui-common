/*
 * SPDX-FileCopyrightText: 2022 Zextras <https://www.zextras.com>
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */
import React from 'react';

import { screen, waitFor } from '@testing-library/react';
import keyBy from 'lodash/keyBy';

import { CreateOptionsContent } from '../../hooks/useCreateOptions';
import { uploadVar } from '../apollo/uploadVar';
import { ICON_REGEXP } from '../constants/test';
import {
	populateFolder,
	populateLocalRoot,
	populateNodes,
	populateUploadItems
} from '../mocks/mockUtils';
import { Node, UploadStatus } from '../types/common';
import { mockGetBaseNode } from '../utils/mockUtils';
import { createDataTransfer, setup, uploadWithDnD } from '../utils/testUtils';
import UploadView from './UploadView';

jest.mock('../../hooks/useCreateOptions', () => ({
	useCreateOptions: (): CreateOptionsContent => ({
		setCreateOptions: jest.fn(),
		removeCreateOptions: jest.fn()
	})
}));

describe('Upload view', () => {
	describe('Drag and drop', () => {
		test('When the first item uploaded is a folder, open displayer for this folder', async () => {
			const localRoot = populateLocalRoot();
			const folder = populateFolder(2);
			folder.parent = localRoot;
			const otherUploads = populateNodes(2);
			otherUploads.forEach((node) => {
				node.parent = localRoot;
			});

			const dataTransferObj = createDataTransfer([folder, ...otherUploads]);

			const mocks = [mockGetBaseNode({ node_id: localRoot.id }, localRoot)];

			const { findByRoleWithIcon } = setup(<UploadView />, { mocks });

			const dropzone = await screen.findByText(/nothing here/i);
			await uploadWithDnD(dropzone, dataTransferObj);
			await screen.findByText(otherUploads[0].name);
			// wait for the displayer to open
			await findByRoleWithIcon('button', { icon: ICON_REGEXP.goToFolder });
			// wait for every upload to complete
			await screen.findAllByTestId(ICON_REGEXP.uploadCompleted);
			expect(screen.getAllByText(folder.name)).toHaveLength(2);
			expect(screen.getByText(/path/i)).toBeVisible();
			expect(screen.getByText(/content/i)).toBeVisible();
			expect(screen.getByText((folder.children.nodes[0] as Node).name)).toBeVisible();
			expect(screen.getByText((folder.children.nodes[1] as Node).name)).toBeVisible();
		});

		test('When the first item uploaded is a folder, but the upload list is not empty, does not open displayer', async () => {
			const localRoot = populateLocalRoot();
			const folder = populateFolder(2);
			folder.parent = localRoot;
			const otherUploads = populateNodes(2);
			otherUploads.forEach((node) => {
				node.parent = localRoot;
			});

			const uploadItemsInList = populateUploadItems(2);
			uploadItemsInList.forEach((item) => {
				item.status = UploadStatus.COMPLETED;
			});
			uploadVar(keyBy(uploadItemsInList, (uploadItem) => uploadItem.id));

			const dataTransferObj = createDataTransfer([folder, ...otherUploads]);

			const mocks = [mockGetBaseNode({ node_id: localRoot.id }, localRoot)];

			const { queryByRoleWithIcon } = setup(<UploadView />, { mocks });

			const dropzone = await screen.findByText(uploadItemsInList[0].name);
			await uploadWithDnD(dropzone, dataTransferObj);
			await screen.findByText(otherUploads[0].name);
			// wait for every upload to complete
			await waitFor(() =>
				expect(screen.getAllByTestId(ICON_REGEXP.uploadCompleted)).toHaveLength(5)
			);
			expect(
				queryByRoleWithIcon('button', { icon: ICON_REGEXP.goToFolder })
			).not.toBeInTheDocument();
			// folder name is visible only 1 time because displayer is closed
			expect(screen.getByText(folder.name)).toBeVisible();
			expect(screen.queryByText(/path/i)).not.toBeInTheDocument();
			expect(screen.queryByText(/content/i)).not.toBeInTheDocument();
			expect(screen.queryByText((folder.children.nodes[0] as Node).name)).not.toBeInTheDocument();
			expect(screen.queryByText((folder.children.nodes[1] as Node).name)).not.toBeInTheDocument();
		});

		test('When the first item uploaded is a file and a folder is also uploaded, does not open displayer for this folder', async () => {
			const localRoot = populateLocalRoot();
			const folder = populateFolder(2);
			folder.parent = localRoot;
			const otherUploads = populateNodes(2, 'File');
			otherUploads.forEach((node) => {
				node.parent = localRoot;
			});

			const dataTransferObj = createDataTransfer([...otherUploads, folder]);

			const mocks = [mockGetBaseNode({ node_id: localRoot.id }, localRoot)];

			const { queryByRoleWithIcon } = setup(<UploadView />, { mocks });

			const dropzone = await screen.findByText(/nothing here/i);
			await uploadWithDnD(dropzone, dataTransferObj);
			await screen.findByText(otherUploads[0].name);
			// wait for every upload to complete
			await screen.findAllByTestId(ICON_REGEXP.uploadCompleted);
			expect(
				queryByRoleWithIcon('button', { icon: ICON_REGEXP.goToFolder })
			).not.toBeInTheDocument();
			// folder name is visible only 1 time because displayer is closed
			expect(screen.getByText(folder.name)).toBeVisible();
			expect(screen.queryByText(/path/i)).not.toBeInTheDocument();
			expect(screen.queryByText(/content/i)).not.toBeInTheDocument();
			expect(screen.queryByText((folder.children.nodes[0] as Node).name)).not.toBeInTheDocument();
			expect(screen.queryByText((folder.children.nodes[1] as Node).name)).not.toBeInTheDocument();
		});
	});
});
