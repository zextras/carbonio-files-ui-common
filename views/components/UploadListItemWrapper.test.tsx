/*
 * SPDX-FileCopyrightText: 2022 Zextras <https://www.zextras.com>
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import React from 'react';

import { fireEvent, screen } from '@testing-library/react';

import { UseNavigationHook } from '../../../hooks/useNavigation';
import { UseUploadHook } from '../../hooks/useUpload';
import { populateFolder } from '../../mocks/mockUtils';
import { UploadStatus, UploadItem } from '../../types/common';
import { GetBaseNodeQuery, GetBaseNodeQueryVariables } from '../../types/graphql/types';
import { mockGetBaseNode } from '../../utils/mockUtils';
import { buildBreadCrumbRegExp, setup } from '../../utils/testUtils';
import { humanFileSize } from '../../utils/utils';
import { UploadListItemWrapper } from './UploadListItemWrapper';

const mockedUseUploadHook: ReturnType<UseUploadHook> = {
	add: jest.fn(),
	update: jest.fn(),
	removeById: jest.fn(),
	removeByNodeId: jest.fn(),
	removeAllCompleted: jest.fn(),
	retryById: jest.fn()
};

const mockedUseNavigationHook: ReturnType<UseNavigationHook> = {
	navigateTo: jest.fn(),
	navigateToFolder: jest.fn(),
	navigateBack: jest.fn
};

jest.mock('../../hooks/useUpload', () => ({
	useUpload: (): ReturnType<UseUploadHook> => mockedUseUploadHook
}));

jest.mock('../../../hooks/useNavigation', () => ({
	useNavigation: (): ReturnType<UseNavigationHook> => mockedUseNavigationHook
}));

describe('Upload List Item Wrapper', () => {
	test('File name, destination folder, progress and size are visible', async () => {
		const destinationFolder = populateFolder();
		const fileBlob = new File(['uploading file'], 'file1.txt', { type: 'text/plain' });
		const file: UploadItem = {
			file: fileBlob,
			progress: 20,
			parentId: destinationFolder.id,
			id: 'fileToUploadId',
			status: UploadStatus.LOADING,
			name: fileBlob.name,
			parentNodeId: destinationFolder.id,
			fullPath: fileBlob.webkitRelativePath,
			nodeId: null
		};
		const mockSelectId = jest.fn();

		const mocks = [mockGetBaseNode({ node_id: destinationFolder.id }, destinationFolder)];

		const { findByTextWithMarkup } = setup(
			<UploadListItemWrapper
				node={file}
				isSelected={false}
				isSelectionModeActive={false}
				selectId={mockSelectId}
			/>,
			{ mocks }
		);

		expect(screen.getByText(file.name)).toBeVisible();
		const destinationFolderItem = await findByTextWithMarkup(
			buildBreadCrumbRegExp(destinationFolder.name)
		);
		expect(destinationFolderItem).toBeVisible();
		if (file.file) {
			expect(screen.getByText(humanFileSize(file.file.size))).toBeVisible();
		}
		expect(screen.getByText(new RegExp(`${file.progress}\\s*%`, 'm'))).toBeVisible();
		expect(screen.getByTestId('icon: AnimatedLoader')).toBeVisible();
	});

	test('Retry action is hidden if uploading is in progress', async () => {
		const destinationFolder = populateFolder();
		const fileBlob = new File(['uploading file'], 'file1.txt', { type: 'text/plain' });
		const file: UploadItem = {
			file: fileBlob,
			progress: 20,
			parentId: destinationFolder.id,
			id: 'fileToUploadId',
			status: UploadStatus.LOADING,
			name: fileBlob.name,
			parentNodeId: destinationFolder.id,
			fullPath: fileBlob.webkitRelativePath,
			nodeId: null
		};
		const mockSelectId = jest.fn();

		const mockedGetBaseNodeRequest = mockGetBaseNode(
			{ node_id: destinationFolder.id },
			destinationFolder
		);
		global.apolloClient.writeQuery<GetBaseNodeQuery, GetBaseNodeQueryVariables>({
			...mockedGetBaseNodeRequest.request,
			data: {
				getNode: destinationFolder
			}
		});

		const { user } = setup(
			<UploadListItemWrapper
				node={file}
				isSelected={false}
				isSelectionModeActive={false}
				selectId={mockSelectId}
			/>,
			{ mocks: [] }
		);

		expect(screen.getByText(file.name)).toBeVisible();
		// hover bar
		await user.hover(screen.getByText(file.name));
		expect(screen.queryByTestId('icon: PlayCircleOutline')).not.toBeInTheDocument();
		expect(screen.getByTestId('icon: CloseCircleOutline')).toBeInTheDocument();
		expect(screen.getByTestId('icon: FolderOutline')).toBeInTheDocument();
		await user.click(screen.getByTestId('icon: CloseCircleOutline'));
		await user.click(screen.getByTestId('icon: FolderOutline'));
		expect(mockedUseUploadHook.removeById).toHaveBeenCalledWith([file.id]);
		expect(mockedUseNavigationHook.navigateToFolder).toHaveBeenCalledWith(destinationFolder.id);
		// contextual menu
		fireEvent.contextMenu(screen.getByText(file.name));
		await screen.findByText(/go to destination folder/i);
		expect(screen.queryByText(/retry upload/i)).not.toBeInTheDocument();
		expect(screen.getByText(/remove upload/i)).not.toHaveAttribute('disabled', '');
		expect(screen.getByText(/go to destination folder/i)).not.toHaveAttribute('disabled', '');
	});

	test('File name, destination folder, queued label and size are visible', async () => {
		const destinationFolder = populateFolder();
		const fileBlob = new File(['uploading file'], 'file1.txt', { type: 'text/plain' });
		const file: UploadItem = {
			file: fileBlob,
			progress: 0,
			parentId: destinationFolder.id,
			id: 'fileToUploadId',
			status: UploadStatus.QUEUED,
			name: 'file1.txt',
			parentNodeId: destinationFolder.id,
			nodeId: null,
			fullPath: fileBlob.webkitRelativePath
		};
		const mockSelectId = jest.fn();

		const mocks = [mockGetBaseNode({ node_id: destinationFolder.id }, destinationFolder)];

		const { findByTextWithMarkup } = setup(
			<UploadListItemWrapper
				node={file}
				isSelected={false}
				isSelectionModeActive={false}
				selectId={mockSelectId}
			/>,
			{ mocks }
		);

		expect(screen.getByText(file.name)).toBeVisible();
		const destinationFolderItem = await findByTextWithMarkup(
			buildBreadCrumbRegExp(destinationFolder.name)
		);
		expect(destinationFolderItem).toBeVisible();
		if (file.file) {
			expect(screen.getByText(humanFileSize(file.file.size))).toBeVisible();
		}
		expect(screen.getByText('Queued')).toBeVisible();
		expect(screen.getByTestId('icon: AnimatedLoader')).toBeVisible();
	});

	test.todo('Progress for files is shown with the percentage');

	test.todo(
		'Progress for folders is shown as the fraction of loaded items on the total content count. The folder itself is included in the fraction values'
	);

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

	test.todo(
		'If all items of the content of a folder finished, all with success, the progress of the folder shows the total count of items on both values of the fraction'
	);

	test.todo(
		'If there is at least one item of the content of a folder still loading, the status of the folder is also loading'
	);
});
