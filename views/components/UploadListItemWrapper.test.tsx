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
import { UploadStatus, UploadType } from '../../types/common';
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
	test('File name, destination folder, percentage and size are visible', async () => {
		const destinationFolder = populateFolder();
		const file: UploadType = {
			file: new File(['uploading file'], 'file1.txt', { type: 'text/plain' }),
			percentage: 20,
			parentId: destinationFolder.id,
			id: 'fileToUploadId',
			status: UploadStatus.LOADING
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

		expect(screen.getByText(file.file.name)).toBeVisible();
		const destinationFolderItem = await findByTextWithMarkup(
			buildBreadCrumbRegExp(destinationFolder.name)
		);
		expect(destinationFolderItem).toBeVisible();
		expect(screen.getByText(humanFileSize(file.file.size))).toBeVisible();
		expect(screen.getByText(new RegExp(`${file.percentage}\\s*%`, 'm'))).toBeVisible();
		expect(screen.getByTestId('icon: AnimatedLoader')).toBeVisible();
	});

	test('Retry action is hidden if uploading is in progress', async () => {
		const destinationFolder = populateFolder();
		const file: UploadType = {
			file: new File(['uploading file'], 'file1.txt', { type: 'text/plain' }),
			percentage: 20,
			parentId: destinationFolder.id,
			id: 'fileToUploadId',
			status: UploadStatus.LOADING
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

		expect(screen.getByText(file.file.name)).toBeVisible();
		// hover bar
		await user.hover(screen.getByText(file.file.name));
		expect(screen.queryByTestId('icon: PlayCircleOutline')).not.toBeInTheDocument();
		expect(screen.getByTestId('icon: CloseCircleOutline')).toBeInTheDocument();
		expect(screen.getByTestId('icon: FolderOutline')).toBeInTheDocument();
		await user.click(screen.getByTestId('icon: CloseCircleOutline'));
		await user.click(screen.getByTestId('icon: FolderOutline'));
		expect(mockedUseUploadHook.removeById).toHaveBeenCalledWith([file.id]);
		expect(mockedUseNavigationHook.navigateToFolder).toHaveBeenCalledWith(destinationFolder.id);
		// contextual menu
		fireEvent.contextMenu(screen.getByText(file.file.name));
		await screen.findByText(/go to destination folder/i);
		expect(screen.queryByText(/retry upload/i)).not.toBeInTheDocument();
		expect(screen.getByText(/remove upload/i)).not.toHaveAttribute('disabled', '');
		expect(screen.getByText(/go to destination folder/i)).not.toHaveAttribute('disabled', '');
	});

	test('File name, destination folder, queued label and size are visible', async () => {
		const destinationFolder = populateFolder();
		const file: UploadType = {
			file: new File(['uploading file'], 'file1.txt', { type: 'text/plain' }),
			percentage: 0,
			parentId: destinationFolder.id,
			id: 'fileToUploadId',
			status: UploadStatus.QUEUED
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

		expect(screen.getByText(file.file.name)).toBeVisible();
		const destinationFolderItem = await findByTextWithMarkup(
			buildBreadCrumbRegExp(destinationFolder.name)
		);
		expect(destinationFolderItem).toBeVisible();
		expect(screen.getByText(humanFileSize(file.file.size))).toBeVisible();
		expect(screen.getByText('Queued')).toBeVisible();
		expect(screen.getByTestId('icon: AnimatedLoader')).toBeVisible();
	});
});
