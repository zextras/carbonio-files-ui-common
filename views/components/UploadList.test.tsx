/*
 * SPDX-FileCopyrightText: 2022 Zextras <https://www.zextras.com>
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import React from 'react';

import { faker } from '@faker-js/faker';
import {
	act,
	fireEvent,
	screen,
	waitFor,
	waitForElementToBeRemoved,
	within
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import filter from 'lodash/filter';
import find from 'lodash/find';
import forEach from 'lodash/forEach';
import keyBy from 'lodash/keyBy';
import { graphql, rest } from 'msw';

import server from '../../../mocks/server';
import { uploadVar } from '../../apollo/uploadVar';
import { REST_ENDPOINT, ROOTS, UPLOAD_PATH, UPLOAD_QUEUE_LIMIT } from '../../constants';
import {
	UploadRequestBody,
	UploadRequestParams,
	UploadResponse
} from '../../mocks/handleUploadFileRequest';
import { populateFolder, populateLocalRoot, populateNodes } from '../../mocks/mockUtils';
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
					(localRootCachedData?.getNode as Maybe<Folder> | undefined)?.children.nodes || []
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

			const uploadMap: { [id: string]: UploadType } = {};
			forEach(uploadedFiles, (file, index) => {
				uploadMap[file.id] = {
					file: files[index],
					parentId: localRoot.id,
					nodeId: file.id,
					status: UploadStatus.COMPLETED,
					percentage: 100,
					id: file.id
				};
			});

			uploadVar(uploadMap);

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

			// snackbar with action to open additional info modal is shown
			await screen.findByText(uploadedFiles[0].name);
			const snackbar = await screen.findByText(/some items have not been uploaded/i);
			expect(screen.getByRole('button', { name: /more info/i })).toBeInTheDocument();
			userEvent.click(screen.getByRole('button', { name: /more info/i }));
			await screen.findByText(/additional info/i);
			await waitForElementToBeRemoved(snackbar);

			expect(screen.getByText(/additional info/i)).toBeInTheDocument();
			expect(
				screen.getByText(/Folders cannot be uploaded. Instead, if you are trying to upload a file/i)
			).toBeInTheDocument();
			expect(screen.getByTestId('icon: Close')).toBeInTheDocument();
			userEvent.click(screen.getByTestId('icon: Close'));
			expect(screen.queryByText(/additional info/i)).not.toBeInTheDocument();

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
					(localRootCachedData?.getNode as Maybe<Folder> | undefined)?.children.nodes || []
				).toHaveLength(1);
			});

			expect(screen.getByText(uploadedFiles[0].name)).toBeVisible();
			expect(screen.getByTestId('icon: AlertCircle')).toBeVisible();
			const folderItem = screen.getByTestId(/node-item-0-\d*/);
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

		test('upload more then 3 files in the upload list queues excess elements', async () => {
			const localRoot = populateFolder(0, ROOTS.LOCAL_ROOT);
			const uploadedFiles = populateNodes(4, 'File') as FilesFile[];
			const files: File[] = [];
			forEach(uploadedFiles, (file) => {
				// eslint-disable-next-line no-param-reassign
				file.parent = localRoot;
				const f = new File(['😂😂😂😂'], file.name, { type: file.mime_type });
				files.push(f);
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
				}),
				rest.post<UploadRequestBody, UploadRequestParams, UploadResponse>(
					`${REST_ENDPOINT}${UPLOAD_PATH}`,
					(req, res, ctx) =>
						res(
							ctx.delay(1000),
							ctx.json({
								nodeId: faker.datatype.uuid()
							})
						)
				)
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

			const loadingIcons = await screen.findAllByTestId('icon: AnimatedLoader');
			expect(loadingIcons).toHaveLength(4);

			const uploadStatus = uploadVar();
			expect(
				filter(uploadStatus, (uploadItem) => uploadItem.status === UploadStatus.QUEUED)
			).toHaveLength(1);
			expect(
				filter(uploadStatus, (uploadItem) => uploadItem.status === UploadStatus.LOADING)
			).toHaveLength(3);

			const queuedElement = find(uploadStatus, ['status', UploadStatus.QUEUED]);
			let queuedItem: HTMLElement;
			let queuedIconLoader: HTMLElement;
			if (queuedElement) {
				queuedItem = await screen.findByTestId(`node-item-${queuedElement.id}`);
				expect(within(queuedItem).getByText(/queued/i)).toBeInTheDocument();
				queuedIconLoader = within(queuedItem).getByTestId('icon: AnimatedLoader');
				expect(queuedIconLoader).toBeInTheDocument();
			} else {
				fail();
			}

			const loadingItems = await screen.findAllByText('0%');
			expect(loadingItems).toHaveLength(3);

			expect(screen.getAllByTestId('node-item', { exact: false })).toHaveLength(
				uploadedFiles.length
			);
			expect(screen.queryByText(/Drop here your attachments/m)).not.toBeInTheDocument();

			await waitForElementToBeRemoved(queuedIconLoader, { timeout: 3000 });
			expect(within(queuedItem).getByTestId('icon: CheckmarkCircle2')).toBeInTheDocument();

			await waitFor(() => {
				const localRootCachedData = global.apolloClient.readQuery<
					GetChildrenQuery,
					GetChildrenQueryVariables
				>(getChildrenMockedQuery.request);
				return expect(
					(localRootCachedData?.getNode as Maybe<Folder> | undefined)?.children.nodes || []
				).toHaveLength(uploadedFiles.length);
			});
		});

		test('when an uploading item fails, the next in the queue is uploaded', async () => {
			const localRoot = populateLocalRoot();
			const uploadedFiles = populateNodes(4, 'File') as FilesFile[];
			const files: File[] = [];
			forEach(uploadedFiles, (file) => {
				file.parent = localRoot;
				const f = new File(['😂😂😂😂'], file.name, { type: file.mime_type });
				files.push(f);
			});
			let reqIndex = 0;

			server.use(
				graphql.query<GetChildQuery, GetChildQueryVariables>('getChild', (req, res, ctx) => {
					const { node_id: id } = req.variables;
					const result = (reqIndex < uploadedFiles.length && uploadedFiles[reqIndex]) || null;
					if (result) {
						result.id = id;
					}
					reqIndex += 1;
					return res(ctx.data({ getNode: result }));
				}),
				rest.post<UploadRequestBody, UploadRequestParams, UploadResponse>(
					`${REST_ENDPOINT}${UPLOAD_PATH}`,
					(req, res, ctx) => {
						const fileName =
							req.headers.get('filename') && window.atob(req.headers.get('filename') as string);
						if (fileName === uploadedFiles[0].name) {
							return res(ctx.delay(1000), ctx.status(500));
						}
						return res(ctx.delay(1000), ctx.json({ nodeId: faker.datatype.uuid() }));
					}
				)
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

			const snackbar = await screen.findByText(/Upload occurred in Files' Home/i);
			await screen.findAllByTestId('node-item-', { exact: false });
			await waitForElementToBeRemoved(snackbar);
			expect(screen.getAllByTestId('node-item-', { exact: false })).toHaveLength(
				uploadedFiles.length
			);
			expect(screen.getAllByTestId('icon: AnimatedLoader')).toHaveLength(uploadedFiles.length);
			expect(screen.getByText(/queued/i)).toBeVisible();
			// wait for the first request to fail
			await screen.findByTestId('icon: AlertCircle');
			// then wait for all other files to be uploaded
			await waitFor(() => expect(screen.getAllByTestId('icon: CheckmarkCircle2')).toHaveLength(3));
			expect(screen.getByTestId('icon: AlertCircle')).toBeVisible();
			expect(screen.queryByText(/queued/i)).not.toBeInTheDocument();
			expect(screen.getAllByTestId('icon: CheckmarkCircle2')).toHaveLength(3);
			expect(screen.queryByTestId('icon: AnimatedLoader')).not.toBeInTheDocument();
		});

		// FIXME: this test run by itself but fails when run with all other tests
		test.skip('when an uploading item is aborted, the next in the queue is uploaded', async () => {
			const localRoot = populateLocalRoot();
			const uploadedFiles = populateNodes(4, 'File') as FilesFile[];
			const files: File[] = [];
			forEach(uploadedFiles, (file) => {
				file.parent = localRoot;
				const f = new File(['😂😂😂😂'], file.name, { type: file.mime_type });
				files.push(f);
			});
			let reqIndex = 0;

			server.use(
				graphql.query<GetChildQuery, GetChildQueryVariables>('getChild', (req, res, ctx) => {
					const { node_id: id } = req.variables;
					const result = (reqIndex < uploadedFiles.length && uploadedFiles[reqIndex]) || null;
					if (result) {
						result.id = id;
					}
					reqIndex += 1;
					return res(ctx.data({ getNode: result }));
				}),
				rest.post<UploadRequestBody, UploadRequestParams, UploadResponse>(
					`${REST_ENDPOINT}${UPLOAD_PATH}`,
					(req, res, ctx) => {
						const fileName =
							req.headers.get('filename') && window.atob(req.headers.get('filename') as string);
						if (fileName === uploadedFiles[0].name) {
							return res(ctx.delay(1000), ctx.status(0));
						}
						return res(ctx.delay(1000), ctx.json({ nodeId: faker.datatype.uuid() }));
					}
				)
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

			const snackbar = await screen.findByText(/Upload occurred in Files' Home/i);
			await screen.findAllByTestId('node-item-', { exact: false });
			await waitForElementToBeRemoved(snackbar);
			expect(screen.getAllByTestId('node-item-', { exact: false })).toHaveLength(
				uploadedFiles.length
			);
			expect(screen.getAllByTestId('icon: AnimatedLoader')).toHaveLength(uploadedFiles.length);
			expect(screen.getByText(/queued/i)).toBeVisible();
			const firstFileItem = screen.getAllByTestId('node-item-', { exact: false })[0];
			expect(screen.getByText(uploadedFiles[0].name)).toBeVisible();
			const cancelAction = within(firstFileItem).getByTestId('icon: CloseCircleOutline');
			userEvent.click(cancelAction);
			await screen.findByText(/cancel/i);
			// then wait for all other files to be uploaded
			await waitFor(() => expect(screen.getAllByTestId('icon: CheckmarkCircle2')).toHaveLength(3));
			expect(screen.getAllByTestId('node-item-', { exact: false })).toHaveLength(
				uploadedFiles.length - 1
			);
			expect(screen.queryByText(uploadedFiles[0].name)).not.toBeInTheDocument();
			expect(screen.queryByText(/queued/i)).not.toBeInTheDocument();
			expect(screen.getAllByTestId('icon: CheckmarkCircle2')).toHaveLength(3);
			expect(screen.queryByTestId('icon: AnimatedLoader')).not.toBeInTheDocument();
		});

		// FIXME: this test run by itself but fails when run with all other tests
		test.skip('the queue use FIFO strategy', async () => {
			const localRoot = populateLocalRoot();
			const uploadedFiles = populateNodes(UPLOAD_QUEUE_LIMIT * 3, 'File') as FilesFile[];
			const uploadedFilesMap = keyBy(uploadedFiles, 'id');
			const files: File[] = [];
			forEach(uploadedFiles, (file) => {
				file.parent = localRoot;
				const f = new File(['😂😂😂😂'], file.name, { type: file.mime_type });
				files.push(f);
			});

			server.use(
				graphql.query<GetChildQuery, GetChildQueryVariables>('getChild', (req, res, ctx) => {
					const { node_id: id } = req.variables;
					const result = uploadedFilesMap[id];
					if (result) {
						result.id = id;
					}
					return res(ctx.data({ getNode: result }));
				}),
				rest.post<UploadRequestBody, UploadRequestParams, UploadResponse>(
					`${REST_ENDPOINT}${UPLOAD_PATH}`,
					(req, res, ctx) => {
						const fileName =
							req.headers.get('filename') && window.atob(req.headers.get('filename') as string);
						const result =
							find(uploadedFiles, (uploadedFile) => uploadedFile.name === fileName)?.id ||
							faker.datatype.uuid();
						return res(ctx.delay(500), ctx.json({ nodeId: result }));
					}
				)
			);

			const dataTransferObj1 = {
				types: ['Files'],
				files: files.slice(0, 4)
			};

			const dataTransferObj2 = {
				types: ['Files'],
				files: files.slice(4)
			};

			const mocks = [mockGetBaseNode({ node_id: localRoot.id }, localRoot)];

			render(<UploadList />, { mocks });

			await screen.findByText(/nothing here/i);

			// drag and drop first 4 files
			fireEvent.dragEnter(screen.getByText(/nothing here/i), {
				dataTransfer: dataTransferObj1
			});

			await screen.findByTestId('dropzone-overlay');
			expect(
				screen.getByText(/Drop here your attachments to quick-add them to your Home/m)
			).toBeVisible();

			fireEvent.drop(screen.getByText(/nothing here/i), {
				dataTransfer: dataTransferObj1
			});

			// immediately drag and drop the last two files
			fireEvent.dragEnter(screen.getByText(uploadedFiles[0].name), {
				dataTransfer: dataTransferObj2
			});

			await screen.findByTestId('dropzone-overlay');

			fireEvent.drop(screen.getByText(uploadedFiles[0].name), {
				dataTransfer: dataTransferObj2
			});

			// const snackbar = await screen.findByText(/Upload occurred in Files' Home/i);
			await screen.findAllByTestId('node-item-', { exact: false });
			// await waitForElementToBeRemoved(snackbar);
			expect(screen.getAllByTestId('node-item-', { exact: false })).toHaveLength(
				uploadedFiles.length
			);
			expect(screen.getAllByTestId('icon: AnimatedLoader')).toHaveLength(uploadedFiles.length);
			// last files are queued
			expect(screen.getAllByText(/queued/i)).toHaveLength(
				uploadedFiles.length - UPLOAD_QUEUE_LIMIT
			);
			const nodeItems = screen.getAllByTestId('node-item-', { exact: false });
			forEach(nodeItems, (nodeItem, index) => {
				if (index < UPLOAD_QUEUE_LIMIT) {
					expect(within(nodeItem).getByText(/\d+%/)).toBeVisible();
					expect(within(nodeItem).queryByText(/queued/i)).not.toBeInTheDocument();
				} else {
					expect(within(nodeItem).getByText(/queued/i)).toBeVisible();
					expect(within(nodeItem).queryByText(/\d+%/)).not.toBeInTheDocument();
				}
			});
			await waitFor(() =>
				expect(screen.getAllByTestId('icon: CheckmarkCircle2')).toHaveLength(UPLOAD_QUEUE_LIMIT)
			);
			expect(
				within(nodeItems[UPLOAD_QUEUE_LIMIT - 1]).queryByText(/queued/i)
			).not.toBeInTheDocument();
			expect(
				within(nodeItems[UPLOAD_QUEUE_LIMIT - 1]).getByTestId('icon: CheckmarkCircle2')
			).toBeVisible();
			expect(within(nodeItems[UPLOAD_QUEUE_LIMIT]).queryByText(/queued/i)).not.toBeInTheDocument();
			expect(within(nodeItems[UPLOAD_QUEUE_LIMIT]).getByText(/\d+%/i)).toBeVisible();
			expect(within(nodeItems[UPLOAD_QUEUE_LIMIT * 2]).getByText(/queued/i)).toBeVisible();
			expect(within(nodeItems[uploadedFiles.length - 1]).getByText(/queued/i)).toBeVisible();
			await waitFor(() =>
				expect(screen.getAllByTestId('icon: CheckmarkCircle2')).toHaveLength(UPLOAD_QUEUE_LIMIT * 2)
			);
			expect(within(nodeItems[UPLOAD_QUEUE_LIMIT * 2]).getByText(/\d+%/i)).toBeVisible();
			expect(
				within(nodeItems[UPLOAD_QUEUE_LIMIT * 2]).queryByText(/queued/i)
			).not.toBeInTheDocument();
			expect(
				within(nodeItems[uploadedFiles.length - 1]).queryByText(/queued/i)
			).not.toBeInTheDocument();
			expect(within(nodeItems[uploadedFiles.length - 1]).getByText(/\d+%/)).toBeVisible();
			await waitFor(() =>
				expect(screen.getAllByTestId('icon: CheckmarkCircle2')).toHaveLength(uploadedFiles.length)
			);
			expect(screen.queryByText(/queued/i)).not.toBeInTheDocument();
		});
	});
});
