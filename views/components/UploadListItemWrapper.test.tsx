/*
 * SPDX-FileCopyrightText: 2022 Zextras <https://www.zextras.com>
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import React from 'react';

import { fireEvent, screen } from '@testing-library/react';

import { UseNavigationHook } from '../../../hooks/useNavigation';
import { ACTION_REGEXP, ICON_REGEXP, SELECTORS } from '../../constants/test';
import { UseUploadHook } from '../../hooks/useUpload';
import {
	populateFolder,
	populateUploadFolderItem,
	populateUploadItem
} from '../../mocks/mockUtils';
import { UploadItem, UploadStatus } from '../../types/common';
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
		const file = populateUploadItem({
			progress: 20,
			parentId: destinationFolder.id,
			status: UploadStatus.LOADING,
			parentNodeId: destinationFolder.id
		});
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

	describe('Retry action', () => {
		describe('Contextual menu', () => {
			test('Action is hidden if status is loading', async () => {
				const destinationFolder = populateFolder();
				const file = populateUploadItem({
					status: UploadStatus.LOADING,
					parentNodeId: destinationFolder.id
				});
				const mockSelectId = jest.fn();

				const mocks = [mockGetBaseNode({ node_id: destinationFolder.id }, destinationFolder)];
				setup(
					<UploadListItemWrapper
						node={file}
						isSelected={false}
						isSelectionModeActive={false}
						selectId={mockSelectId}
					/>,
					{ mocks }
				);

				const item = screen.getByText(file.name);
				expect(item).toBeVisible();
				fireEvent.contextMenu(item);
				await screen.findByTestId(SELECTORS.dropdownList);
				expect(screen.queryByText(ACTION_REGEXP.retryUpload)).not.toBeInTheDocument();
			});

			test('Action is hidden if status is completed', async () => {
				const destinationFolder = populateFolder();
				const file = populateUploadItem({
					status: UploadStatus.COMPLETED,
					parentNodeId: destinationFolder.id
				});
				const mockSelectId = jest.fn();

				const mocks = [mockGetBaseNode({ node_id: destinationFolder.id }, destinationFolder)];
				setup(
					<UploadListItemWrapper
						node={file}
						isSelected={false}
						isSelectionModeActive={false}
						selectId={mockSelectId}
					/>,
					{ mocks }
				);

				const item = screen.getByText(file.name);
				expect(item).toBeVisible();
				fireEvent.contextMenu(item);
				await screen.findByTestId(SELECTORS.dropdownList);
				expect(screen.queryByText(ACTION_REGEXP.retryUpload)).not.toBeInTheDocument();
			});

			test('Action is hidden if status is queued', async () => {
				const destinationFolder = populateFolder();
				const file = populateUploadItem({
					status: UploadStatus.QUEUED,
					parentNodeId: destinationFolder.id
				});
				const mockSelectId = jest.fn();

				const mocks = [mockGetBaseNode({ node_id: destinationFolder.id }, destinationFolder)];

				setup(
					<UploadListItemWrapper
						node={file}
						isSelected={false}
						isSelectionModeActive={false}
						selectId={mockSelectId}
					/>,
					{ mocks }
				);

				const item = screen.getByText(file.name);
				expect(item).toBeVisible();
				fireEvent.contextMenu(item);
				await screen.findByTestId(SELECTORS.dropdownList);
				expect(screen.queryByText(ACTION_REGEXP.retryUpload)).not.toBeInTheDocument();
			});

			test('Action is visible if status is failed', async () => {
				const destinationFolder = populateFolder();
				const file = populateUploadItem({
					status: UploadStatus.FAILED,
					parentNodeId: destinationFolder.id
				});
				const mockSelectId = jest.fn();

				const mocks = [mockGetBaseNode({ node_id: destinationFolder.id }, destinationFolder)];
				setup(
					<UploadListItemWrapper
						node={file}
						isSelected={false}
						isSelectionModeActive={false}
						selectId={mockSelectId}
					/>,
					{ mocks }
				);

				const item = screen.getByText(file.name);
				expect(item).toBeVisible();
				fireEvent.contextMenu(item);
				await screen.findByTestId(SELECTORS.dropdownList);
				expect(screen.getByText(ACTION_REGEXP.retryUpload)).toBeVisible();
			});
		});

		describe('Hover bar', () => {
			test('Action is hidden if status is loading', async () => {
				const destinationFolder = populateFolder();
				const file = populateUploadItem({
					status: UploadStatus.LOADING,
					parentNodeId: destinationFolder.id
				});
				const mockSelectId = jest.fn();

				const mocks = [mockGetBaseNode({ node_id: destinationFolder.id }, destinationFolder)];
				const { user } = setup(
					<UploadListItemWrapper
						node={file}
						isSelected={false}
						isSelectionModeActive={false}
						selectId={mockSelectId}
					/>,
					{ mocks }
				);

				const item = screen.getByText(file.name);
				expect(item).toBeVisible();
				await user.hover(item);
				expect(screen.queryByTestId(ICON_REGEXP.retryUpload)).not.toBeInTheDocument();
			});

			test('Action is hidden if status is completed', async () => {
				const destinationFolder = populateFolder();
				const file = populateUploadItem({
					status: UploadStatus.COMPLETED,
					parentNodeId: destinationFolder.id
				});
				const mockSelectId = jest.fn();

				const mocks = [mockGetBaseNode({ node_id: destinationFolder.id }, destinationFolder)];
				const { user } = setup(
					<UploadListItemWrapper
						node={file}
						isSelected={false}
						isSelectionModeActive={false}
						selectId={mockSelectId}
					/>,
					{ mocks }
				);

				const item = screen.getByText(file.name);
				expect(item).toBeVisible();
				await user.hover(item);
				expect(screen.queryByTestId(ICON_REGEXP.retryUpload)).not.toBeInTheDocument();
			});

			test('Action is hidden if status is queued', async () => {
				const destinationFolder = populateFolder();
				const file = populateUploadItem({
					status: UploadStatus.QUEUED,
					parentNodeId: destinationFolder.id
				});
				const mockSelectId = jest.fn();

				const mocks = [mockGetBaseNode({ node_id: destinationFolder.id }, destinationFolder)];

				const { user } = setup(
					<UploadListItemWrapper
						node={file}
						isSelected={false}
						isSelectionModeActive={false}
						selectId={mockSelectId}
					/>,
					{ mocks }
				);

				const item = screen.getByText(file.name);
				expect(item).toBeVisible();
				await user.hover(item);
				expect(screen.queryByTestId(ICON_REGEXP.retryUpload)).not.toBeInTheDocument();
			});

			test('Action is visible if status is failed', async () => {
				const destinationFolder = populateFolder();
				const file = populateUploadItem({
					status: UploadStatus.FAILED,
					parentNodeId: destinationFolder.id
				});
				const mockSelectId = jest.fn();

				const mocks = [mockGetBaseNode({ node_id: destinationFolder.id }, destinationFolder)];
				const { user } = setup(
					<UploadListItemWrapper
						node={file}
						isSelected={false}
						isSelectionModeActive={false}
						selectId={mockSelectId}
					/>,
					{ mocks }
				);

				const item = screen.getByText(file.name);
				expect(item).toBeVisible();
				await user.hover(item);
				expect(screen.getByTestId(ICON_REGEXP.retryUpload)).toBeInTheDocument();
			});
		});
	});

	test('If item is queued, queued label is shown instead of the progress', async () => {
		const file: UploadItem = populateUploadItem({ status: UploadStatus.QUEUED });
		const mockSelectId = jest.fn();

		setup(
			<UploadListItemWrapper
				node={file}
				isSelected={false}
				isSelectionModeActive={false}
				selectId={mockSelectId}
			/>,
			{ mocks: [] }
		);

		expect(screen.getByText(/queued/i)).toBeVisible();
		expect(screen.getByTestId('icon: AnimatedLoader')).toBeVisible();
		expect(screen.queryByText(/\d+\s*%/)).not.toBeInTheDocument();
	});

	test('Progress for files is shown with the percentage', async () => {
		const uploadItem = populateUploadItem({ progress: 45, status: UploadStatus.LOADING });

		const selectFn = jest.fn();
		setup(
			<UploadListItemWrapper
				node={uploadItem}
				isSelected={false}
				isSelectionModeActive={false}
				selectId={selectFn}
			/>,
			{ mocks: [] }
		);

		expect(screen.getByText(/45\s*%/)).toBeVisible();
	});

	test('Progress for folders is shown as the fraction of loaded items on the total content count. The folder itself is included in the fraction values', async () => {
		const uploadItem = populateUploadFolderItem({
			failedCount: 2,
			progress: 3,
			contentCount: 10,
			status: UploadStatus.LOADING
		});

		const selectFn = jest.fn();
		setup(
			<UploadListItemWrapper
				node={uploadItem}
				isSelected={false}
				isSelectionModeActive={false}
				selectId={selectFn}
			/>,
			{ mocks: [] }
		);

		expect(screen.getByText(/3\/10/)).toBeVisible();
	});

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
