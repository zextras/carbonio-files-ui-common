/*
 * SPDX-FileCopyrightText: 2022 Zextras <https://www.zextras.com>
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import React from 'react';

import {
	act,
	fireEvent,
	screen,
	waitFor,
	waitForElementToBeRemoved,
	within
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import forEach from 'lodash/forEach';
import map from 'lodash/map';
import { graphql } from 'msw';

import server from '../../../mocks/server';
import { uploadVar } from '../../apollo/uploadVar';
import { ROOTS } from '../../constants';
import { populateFolder, populateNodes } from '../../mocks/mockUtils';
import { UploadStatus, UploadType } from '../../types/common';
import {
	File as FilesFile,
	Folder,
	GetChildQuery,
	GetChildQueryVariables,
	GetChildrenQuery,
	GetChildrenQueryVariables,
	Maybe
} from '../../types/graphql/types';
import { getChildrenVariables, mockGetBaseNode, mockGetChildren } from '../../utils/mockUtils';
import { render } from '../../utils/testUtils';
import { UploadList } from './UploadList';

describe('Upload list', () => {
	describe('Drag and drop', () => {
		test('Drag of files in the upload list shows upload dropzone with dropzone message. Drop triggers upload in local root', async () => {
			const localRoot = populateFolder(0, ROOTS.LOCAL_ROOT);
			const uploadedFiles = populateNodes(2, 'File') as FilesFile[];
			const files: File[] = [];
			forEach(uploadedFiles, (file) => {
				// eslint-disable-next-line no-param-reassign
				file.parent = localRoot;
				files.push(new File(['(⌐□_□)'], file.name, { type: file.mime_type }));
			});
			let reqIndex = 0;

			// write local root data in cache as if it was already loaded
			const getChildrenMockedQuery = mockGetChildren(getChildrenVariables(localRoot.id), localRoot);
			global.apolloClient.cache.writeQuery<GetChildrenQuery, GetChildrenQueryVariables>({
				...getChildrenMockedQuery.request,
				data: {
					getNode: localRoot
				}
			});

			server.use(
				graphql.query<GetChildQuery, GetChildQueryVariables>('getChild', (req, res, ctx) => {
					const { node_id: id } = req.variables;
					const result = (reqIndex < uploadedFiles.length && uploadedFiles[reqIndex]) || null;
					if (result) {
						result.id = id;
					}
					reqIndex += 1;
					return res(ctx.data({ getNode: result }));
				})
			);

			const dataTransferObj = {
				types: ['Files'],
				files
			};

			const mocks = [mockGetBaseNode({ node_id: localRoot.id }, localRoot)];

			render(<UploadList />, { mocks });

			await screen.findByText(/nothing here/gi);

			fireEvent.dragEnter(screen.getByText(/nothing here/gi), {
				dataTransfer: dataTransferObj
			});

			await screen.findByTestId('dropzone-overlay');
			expect(
				screen.getByText(/Drop here your attachments to quick-add them to your Home/gm)
			).toBeVisible();

			fireEvent.drop(screen.getByText(/nothing here/gi), {
				dataTransfer: dataTransferObj
			});

			await screen.findByText(uploadedFiles[0].name);
			const snackbar = await screen.findByText(/upload occurred in Files' home/i);
			await waitForElementToBeRemoved(snackbar);

			expect(screen.getAllByTestId('node-item', { exact: false })).toHaveLength(
				uploadedFiles.length
			);
			expect(screen.queryByText(/Drop here your attachments/gm)).not.toBeInTheDocument();

			await waitFor(() => {
				const localRootCachedData = global.apolloClient.readQuery<
					GetChildrenQuery,
					GetChildrenQueryVariables
				>(getChildrenMockedQuery.request);
				return expect(
					(localRootCachedData?.getNode as Maybe<Folder> | undefined)?.children || []
				).toHaveLength(uploadedFiles.length);
			});
		});

		test('Drag of a node is not permitted and does nothing', async () => {
			const localRoot = populateFolder(0, ROOTS.LOCAL_ROOT);
			const uploadedFiles = populateNodes(2, 'File') as FilesFile[];
			const files: File[] = [];
			forEach(uploadedFiles, (file) => {
				// eslint-disable-next-line no-param-reassign
				file.parent = localRoot;
				files.push(new File(['(⌐□_□)'], file.name, { type: file.mime_type }));
			});
			const uploadList = map<FilesFile, UploadType>(uploadedFiles, (file, index) => ({
				file: files[index],
				parentId: localRoot.id,
				nodeId: file.id,
				status: UploadStatus.COMPLETED,
				percentage: 100,
				id: file.id
			}));
			uploadVar(uploadList);

			const nodesToDrag = [uploadedFiles[0]];

			let dataTransferData: Record<string, string> = {};
			let dataTransferTypes: string[] = [];
			const dataTransfer = (): unknown => ({
				setDragImage: jest.fn(),
				items: dataTransferData,
				setData: jest.fn().mockImplementation((type: string, data: string) => {
					dataTransferData[type] = data;
					dataTransferTypes.includes(type) || dataTransferTypes.push(type);
				}),
				getData: jest.fn().mockImplementation((type: string) => dataTransferData[type]),
				types: dataTransferTypes,
				clearData: jest.fn().mockImplementation(() => {
					dataTransferTypes = [];
					dataTransferData = {};
				})
			});

			const mocks = [mockGetBaseNode({ node_id: localRoot.id }, localRoot)];

			render(<UploadList />, { mocks });

			const itemToDrag = await screen.findByText(nodesToDrag[0].name);
			await waitFor(
				() =>
					new Promise((resolve) => {
						setTimeout(resolve, 1);
					})
			);
			fireEvent.dragStart(itemToDrag, { dataTransfer: dataTransfer() });
			fireEvent.dragEnter(itemToDrag, { dataTransfer: dataTransfer() });
			await waitFor(
				() =>
					new Promise((resolve) => {
						setTimeout(resolve, 100);
					})
			);
			// drag image item is not shown
			const draggedNodeItem = screen.getByText(nodesToDrag[0].name);
			expect(draggedNodeItem).toBeInTheDocument();
			expect(draggedNodeItem).not.toHaveAttribute('disabled', '');
			expect(screen.queryByTestId('dropzone-overlay')).not.toBeInTheDocument();
		});

		test('Drop of mixed files and folder in the upload list shows folder item as failed and a snackbar to inform upload of folder is not allowed', async () => {
			const localRoot = populateFolder(0, ROOTS.LOCAL_ROOT);
			const uploadedFiles = populateNodes(2, 'File') as FilesFile[];
			const files: File[] = [];
			// invalid folder (file without size nor type)
			uploadedFiles[0].parent = localRoot;
			files.push(new File([], uploadedFiles[0].name, { type: '' }));
			// valid file
			uploadedFiles[1].parent = localRoot;
			files.push(new File(['(⌐□_□)'], uploadedFiles[1].name, { type: uploadedFiles[1].mime_type }));

			let reqIndex = 0;

			// write local root data in cache as if it was already loaded
			const getChildrenMockedQuery = mockGetChildren(getChildrenVariables(localRoot.id), localRoot);
			global.apolloClient.cache.writeQuery<GetChildrenQuery, GetChildrenQueryVariables>({
				...getChildrenMockedQuery.request,
				data: {
					getNode: localRoot
				}
			});

			server.use(
				graphql.query<GetChildQuery, GetChildQueryVariables>('getChild', (req, res, ctx) => {
					const { node_id: id } = req.variables;
					const result = (reqIndex < uploadedFiles.length && uploadedFiles[reqIndex]) || null;
					if (result) {
						result.id = id;
					}
					reqIndex += 1;
					return res(ctx.data({ getNode: result }));
				})
			);

			const dataTransferObj = {
				types: ['Files'],
				files
			};

			const mocks = [mockGetBaseNode({ node_id: localRoot.id }, localRoot)];

			render(<UploadList />, { mocks });

			await screen.findByText(/nothing here/gi);

			fireEvent.dragEnter(screen.getByText(/nothing here/gi), {
				dataTransfer: dataTransferObj
			});

			await screen.findByTestId('dropzone-overlay');
			expect(
				screen.getByText(/Drop here your attachments to quick-add them to your Home/gm)
			).toBeVisible();

			fireEvent.drop(screen.getByText(/nothing here/gi), {
				dataTransfer: dataTransferObj
			});

			// snackbar with action to open additional info modal is shown
			await screen.findByText(uploadedFiles[0].name);
			const snackbar = await screen.findByText(/some items have not been uploaded/i);
			expect(screen.getByRole('button', { name: /more info/i })).toBeInTheDocument();
			userEvent.click(screen.getByRole('button', { name: /more info/i }));
			await screen.findByText(/additional info/i);
			await waitForElementToBeRemoved(snackbar);

			expect(screen.getByText(/additional info/i)).toBeInTheDocument();
			expect(
				screen.getByText(/Folders cannot be uploaded. If you are trying to upload a file/i)
			).toBeInTheDocument();
			expect(screen.getByTestId('icon: Close')).toBeInTheDocument();
			userEvent.click(screen.getByTestId('icon: Close'));
			expect(screen.queryByText(/additional info/i)).not.toBeInTheDocument();

			expect(screen.getAllByTestId('node-item', { exact: false })).toHaveLength(
				uploadedFiles.length
			);
			expect(screen.queryByText(/Drop here your attachments/gm)).not.toBeInTheDocument();

			await waitFor(() => {
				const localRootCachedData = global.apolloClient.readQuery<
					GetChildrenQuery,
					GetChildrenQueryVariables
				>(getChildrenMockedQuery.request);
				return expect(
					(localRootCachedData?.getNode as Maybe<Folder> | undefined)?.children || []
				).toHaveLength(1);
			});

			expect(screen.getByText(uploadedFiles[0].name)).toBeVisible();
			expect(screen.getByTestId('icon: AlertCircle')).toBeVisible();
			const folderItem = screen.getByTestId('node-item-0');
			expect(within(folderItem).getByTestId('icon: PlayCircleOutline')).not.toHaveAttribute(
				'disabled',
				''
			);
			act(() => {
				userEvent.click(within(folderItem).getByTestId('icon: PlayCircleOutline'));
			});
			const snackbar2 = await screen.findByText(/folders cannot be uploaded/i);
			expect(screen.getByRole('button', { name: /more info/i })).toBeInTheDocument();
			await waitForElementToBeRemoved(snackbar2);
			expect(screen.getByText(uploadedFiles[1].name)).toBeVisible();
			expect(screen.getByTestId('icon: CheckmarkCircle2')).toBeVisible();
		});
	});
});
