/*
 * SPDX-FileCopyrightText: 2022 Zextras <https://www.zextras.com>
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import React from 'react';

import { fireEvent, screen, waitFor, waitForElementToBeRemoved } from '@testing-library/react';
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

			await screen.findByText(/nothing here/i);

			fireEvent.dragEnter(screen.getByText(/nothing here/i), {
				dataTransfer: dataTransferObj
			});

			await screen.findByTestId('dropzone-overlay');
			expect(
				screen.getByText(/Drop here your attachments to quick-add them to your Home/m)
			).toBeVisible();

			fireEvent.drop(screen.getByText(/nothing here/i), {
				dataTransfer: dataTransferObj
			});

			await screen.findByText(uploadedFiles[0].name);
			const snackbar = await screen.findByText(/upload occurred in Files' home/i);
			await waitForElementToBeRemoved(snackbar);

			expect(screen.getAllByTestId('node-item', { exact: false })).toHaveLength(
				uploadedFiles.length
			);
			expect(screen.queryByText(/Drop here your attachments/m)).not.toBeInTheDocument();

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
	});
});
