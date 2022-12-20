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
import { EventEmitter } from 'events';
import find from 'lodash/find';
import forEach from 'lodash/forEach';
import keyBy from 'lodash/keyBy';
import { graphql, rest } from 'msw';

import server from '../../../mocks/server';
import { uploadVar } from '../../apollo/uploadVar';
import { REST_ENDPOINT, ROOTS, UPLOAD_PATH } from '../../constants';
import { ICON_REGEXP } from '../../constants/test';
import handleUploadFileRequest, {
	UploadRequestBody,
	UploadRequestParams,
	UploadResponse
} from '../../mocks/handleUploadFileRequest';
import {
	populateFile,
	populateFolder,
	populateLocalRoot,
	populateNodes
} from '../../mocks/mockUtils';
import { Node, UploadItem, UploadStatus } from '../../types/common';
import {
	File as FilesFile,
	Folder,
	GetChildQuery,
	GetChildQueryVariables,
	GetChildrenQuery,
	GetChildrenQueryVariables,
	Maybe
} from '../../types/graphql/types';
import {
	getChildrenVariables,
	mockCreateFolder,
	mockGetBaseNode,
	mockGetChildren
} from '../../utils/mockUtils';
import { createDataTransfer, delayUntil, setup, uploadWithDnD } from '../../utils/testUtils';
import { UploadQueue } from '../../utils/uploadUtils';
import { UploadList } from './UploadList';

describe('Upload list', () => {
	describe('Drag and drop', () => {
		test('Drag of files in the upload list shows upload dropzone with dropzone message. Drop triggers upload in local root', async () => {
			const localRoot = populateFolder(0, ROOTS.LOCAL_ROOT);
			const uploadedFiles = populateNodes(2, 'File') as FilesFile[];
			forEach(uploadedFiles, (file) => {
				file.parent = localRoot;
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

			const dataTransferObj = createDataTransfer(uploadedFiles);

			const mocks = [mockGetBaseNode({ node_id: localRoot.id }, localRoot)];

			setup(<UploadList />, { mocks });

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
			await screen.findByText(/upload occurred in Files' home/i);

			expect(screen.getAllByTestId('node-item', { exact: false })).toHaveLength(
				uploadedFiles.length
			);
			expect(screen.queryByText(/Drop here your attachments/m)).not.toBeInTheDocument();

			await screen.findAllByTestId('icon: CheckmarkCircle2');

			expect(screen.getAllByTestId('icon: CheckmarkCircle2')).toHaveLength(uploadedFiles.length);

			const localRootCachedData = global.apolloClient.readQuery<
				GetChildrenQuery,
				GetChildrenQueryVariables
			>(getChildrenMockedQuery.request);

			expect(
				(localRootCachedData?.getNode as Maybe<Folder> | undefined)?.children.nodes || []
			).toHaveLength(uploadedFiles.length);
		});

		test('Drag of a node is not permitted and does nothing', async () => {
			const localRoot = populateFolder(0, ROOTS.LOCAL_ROOT);
			const uploadedFiles = populateNodes(2, 'File') as FilesFile[];
			const files: File[] = [];
			forEach(uploadedFiles, (file) => {
				file.parent = localRoot;
				files.push(new File(['(⌐□_□)'], file.name, { type: file.mime_type }));
			});

			const uploadMap: { [id: string]: UploadItem } = {};
			forEach(uploadedFiles, (file, index) => {
				uploadMap[file.id] = {
					file: files[index],
					parentNodeId: localRoot.id,
					nodeId: file.id,
					status: UploadStatus.COMPLETED,
					progress: 100,
					id: file.id,
					name: files[index].name,
					fullPath: files[index].webkitRelativePath,
					parentId: null
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

			setup(<UploadList />, { mocks });

			const itemToDrag = await screen.findByText(nodesToDrag[0].name);
			fireEvent.dragStart(itemToDrag, { dataTransfer: dataTransfer() });
			fireEvent.dragEnter(itemToDrag, { dataTransfer: dataTransfer() });
			// drag image item is not shown
			const draggedNodeItem = screen.getByText(nodesToDrag[0].name);
			expect(draggedNodeItem).toBeInTheDocument();
			expect(draggedNodeItem).not.toHaveAttribute('disabled', '');
			expect(screen.queryByTestId('dropzone-overlay')).not.toBeInTheDocument();
		});

		test('Drop of mixed files and folder in the upload list create folder and upload file', async () => {
			const localRoot = populateFolder(0, ROOTS.LOCAL_ROOT);
			const uploadedFiles = [populateFolder(), populateFile()];
			// folder
			uploadedFiles[0].parent = localRoot;
			// file
			uploadedFiles[1].parent = localRoot;

			// folder does not query getChild
			let reqIndex = 1;

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

			const dataTransferObj = createDataTransfer(uploadedFiles);

			const mocks = [
				mockGetBaseNode({ node_id: localRoot.id }, localRoot),
				mockCreateFolder(
					{ name: uploadedFiles[0].name, destination_id: uploadedFiles[0].parent.id },
					uploadedFiles[0]
				)
			];

			setup(<UploadList />, { mocks });

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
			await screen.findByText(/upload occurred in files' home/i);
			expect(screen.queryByText(/some items have not been uploaded/i)).not.toBeInTheDocument();
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

			expect(screen.getByText(uploadedFiles[0].name)).toBeVisible();
			expect(screen.getAllByTestId(ICON_REGEXP.uploadLoading)).toHaveLength(2);
			expect(screen.getByText(uploadedFiles[1].name)).toBeVisible();
			await waitFor(() => expect(screen.getAllByTestId('icon: CheckmarkCircle2')).toHaveLength(2));
			expect(screen.getByText(/1\/1/)).toBeVisible();
		});

		test('upload more then 3 files in the upload list queues excess elements', async () => {
			const localRoot = populateFolder(0, ROOTS.LOCAL_ROOT);
			const uploadedFiles = populateNodes(4, 'File') as FilesFile[];
			forEach(uploadedFiles, (file) => {
				file.parent = localRoot;
			});

			const emitter = new EventEmitter();

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
					async (req, res, ctx) => {
						await delayUntil(emitter, 'resolve');
						return res(
							ctx.json({
								nodeId: faker.datatype.uuid()
							})
						);
					}
				)
			);

			const dataTransferObj = createDataTransfer(uploadedFiles);

			const mocks = [mockGetBaseNode({ node_id: localRoot.id }, localRoot)];

			setup(<UploadList />, { mocks });

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

			const loadingIcons = await screen.findAllByTestId(ICON_REGEXP.uploadLoading);
			expect(loadingIcons).toHaveLength(4);

			await screen.findAllByText(/\d+%/);

			expect(screen.getByText(/queued/i)).toBeInTheDocument();
			expect(screen.getAllByText(/\d+%/i)).toHaveLength(3);

			const queuedItem = find(
				screen.getAllByTestId('node-item', { exact: false }),
				(item) => within(item).queryByText(/queued/i) !== null
			);
			expect(queuedItem).toBeDefined();
			if (!queuedItem) {
				// this should never run, but it is useful to avoid the cast in the next lines
				fail(new Error('queued item not found'));
			}
			expect(within(queuedItem).getByText(/queued/i)).toBeVisible();
			const queuedIconLoader = within(queuedItem).getByTestId(ICON_REGEXP.uploadLoading);
			expect(queuedIconLoader).toBeInTheDocument();

			const loadingItems = await screen.findAllByText('0%');
			expect(loadingItems).toHaveLength(3);

			expect(screen.getAllByTestId('node-item', { exact: false })).toHaveLength(
				uploadedFiles.length
			);
			expect(screen.queryByText(/Drop here your attachments/m)).not.toBeInTheDocument();

			emitter.emit('resolve');
			await screen.findAllByText('100%');
			expect(screen.queryByText(/queued/i)).not.toBeInTheDocument();
			expect(screen.getAllByTestId('icon: CheckmarkCircle2')).toHaveLength(3);
			expect(screen.getByTestId(ICON_REGEXP.uploadLoading)).toBeVisible();
			emitter.emit('resolve');
			await waitForElementToBeRemoved(screen.queryByTestId(ICON_REGEXP.uploadLoading));
			expect(screen.getAllByTestId('icon: CheckmarkCircle2')).toHaveLength(4);
			expect(screen.queryByTestId(ICON_REGEXP.uploadLoading)).not.toBeInTheDocument();

			const localRootCachedData = global.apolloClient.readQuery<
				GetChildrenQuery,
				GetChildrenQueryVariables
			>(getChildrenMockedQuery.request);
			expect(
				(localRootCachedData?.getNode as Maybe<Folder> | undefined)?.children.nodes || []
			).toHaveLength(uploadedFiles.length);
		});

		test('when an uploading item fails, the next in the queue is uploaded', async () => {
			const localRoot = populateLocalRoot();
			const uploadedFiles = populateNodes(4, 'File') as FilesFile[];
			forEach(uploadedFiles, (file) => {
				file.parent = localRoot;
			});

			const emitter = new EventEmitter();

			// first item fails
			let reqIndex = 1;

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
					async (req, res, ctx) => {
						const fileName =
							req.headers.get('filename') && window.atob(req.headers.get('filename') as string);
						if (fileName === uploadedFiles[0].name) {
							await delayUntil(emitter, 'done-fail');
							return res(ctx.status(500));
						}
						await delayUntil(emitter, 'done-success');
						return res(ctx.json({ nodeId: faker.datatype.uuid() }));
					}
				)
			);

			const dataTransferObj = createDataTransfer(uploadedFiles);

			const mocks = [mockGetBaseNode({ node_id: localRoot.id }, localRoot)];

			setup(<UploadList />, { mocks });

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

			await screen.findByText(/Upload occurred in Files' Home/i);
			await screen.findAllByTestId('node-item-', { exact: false });

			expect(screen.getAllByTestId('node-item-', { exact: false })).toHaveLength(
				uploadedFiles.length
			);
			expect(screen.getAllByTestId(ICON_REGEXP.uploadLoading)).toHaveLength(uploadedFiles.length);
			expect(screen.getByText(/queued/i)).toBeVisible();
			emitter.emit('done-fail');
			// wait for the first request to fail
			await screen.findByTestId(ICON_REGEXP.uploadFailed);
			// last item is removed from the queue and starts the upload
			expect(screen.queryByText(/queued/i)).not.toBeInTheDocument();
			emitter.emit('done-success');
			// then wait for all other files to be uploaded
			await waitFor(() => expect(screen.getAllByTestId('icon: CheckmarkCircle2')).toHaveLength(3));
			expect(screen.getByTestId(ICON_REGEXP.uploadFailed)).toBeVisible();
			expect(screen.queryByText(/queued/i)).not.toBeInTheDocument();
			expect(screen.getAllByTestId('icon: CheckmarkCircle2')).toHaveLength(3);
			expect(screen.queryByTestId(ICON_REGEXP.uploadLoading)).not.toBeInTheDocument();
		});

		test('when an uploading item is aborted, the next in the queue is uploaded', async () => {
			const localRoot = populateLocalRoot();
			const uploadedFiles = populateNodes(4, 'File') as FilesFile[];
			forEach(uploadedFiles, (file) => {
				file.parent = localRoot;
			});

			const emitter = new EventEmitter();

			// first item is aborted
			let reqIndex = 1;

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
					async (req, res, ctx) => {
						const fileName =
							req.headers.get('filename') && window.atob(req.headers.get('filename') as string);
						if (fileName === uploadedFiles[0].name) {
							await delayUntil(emitter, 'abort');
							return res(ctx.status(0));
						}
						await delayUntil(emitter, 'done');
						return res(ctx.json({ nodeId: faker.datatype.uuid() }));
					}
				)
			);

			const dataTransferObj = createDataTransfer(uploadedFiles);

			const mocks = [mockGetBaseNode({ node_id: localRoot.id }, localRoot)];

			const { user } = setup(<UploadList />, { mocks });

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

			await screen.findByText(/Upload occurred in Files' Home/i);
			// close snackbar
			act(() => {
				// run timers of snackbar
				jest.runOnlyPendingTimers();
			});
			await waitFor(() =>
				expect(screen.queryByText(/Upload occurred in Files' Home/i)).not.toBeInTheDocument()
			);
			await screen.findAllByTestId('node-item-', { exact: false });
			expect(screen.getAllByTestId('node-item-', { exact: false })).toHaveLength(
				uploadedFiles.length
			);
			expect(screen.getAllByTestId(ICON_REGEXP.uploadLoading)).toHaveLength(uploadedFiles.length);
			expect(screen.getByText(/queued/i)).toBeVisible();
			const firstFileItem = screen.getAllByTestId('node-item-', { exact: false })[0];
			expect(screen.getByText(uploadedFiles[0].name)).toBeVisible();
			const cancelAction = within(firstFileItem).getByTestId(ICON_REGEXP.removeUpload);
			await user.click(cancelAction);
			// first upload is aborted, element is removed from the list
			expect(firstFileItem).not.toBeInTheDocument();
			// last item upload is started, element is removed from the queue
			expect(screen.queryByText(/queued/i)).not.toBeInTheDocument();
			// then wait for all other files to be uploaded
			emitter.emit('done');
			await waitForElementToBeRemoved(screen.queryAllByTestId(ICON_REGEXP.uploadLoading));
			expect(screen.getAllByTestId('icon: CheckmarkCircle2')).toHaveLength(3);
			expect(screen.getAllByTestId('node-item-', { exact: false })).toHaveLength(
				uploadedFiles.length - 1
			);
			expect(screen.queryByText(uploadedFiles[0].name)).not.toBeInTheDocument();
			expect(screen.queryByText(/queued/i)).not.toBeInTheDocument();
			expect(screen.getAllByTestId('icon: CheckmarkCircle2')).toHaveLength(3);
			expect(screen.queryByTestId(ICON_REGEXP.uploadLoading)).not.toBeInTheDocument();
		});

		test('the queue use FIFO strategy', async () => {
			const localRoot = populateLocalRoot();
			const uploadedFiles = populateNodes(UploadQueue.LIMIT * 3, 'File') as FilesFile[];
			const uploadedFilesMap = keyBy(uploadedFiles, 'id');
			forEach(uploadedFiles, (file) => {
				file.parent = localRoot;
			});

			const emitter = new EventEmitter();

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
					async (req, res, ctx) => {
						const fileName =
							req.headers.get('filename') && window.atob(req.headers.get('filename') as string);
						const result =
							find(uploadedFiles, (uploadedFile) => uploadedFile.name === fileName)?.id ||
							faker.datatype.uuid();
						await delayUntil(emitter, 'done');
						return res(ctx.json({ nodeId: result }));
					}
				)
			);

			const dataTransferObj1 = createDataTransfer(uploadedFiles.slice(0, 4));

			const dataTransferObj2 = createDataTransfer(uploadedFiles.slice(4));

			const mocks = [mockGetBaseNode({ node_id: localRoot.id }, localRoot)];

			setup(<UploadList />, { mocks });

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

			await screen.findByText(uploadedFiles[0].name);
			// immediately drag and drop the last two files
			fireEvent.dragEnter(screen.getByText(uploadedFiles[0].name), {
				dataTransfer: dataTransferObj2
			});

			await screen.findByTestId('dropzone-overlay');

			fireEvent.drop(screen.getByText(uploadedFiles[0].name), {
				dataTransfer: dataTransferObj2
			});

			await screen.findByText(uploadedFiles[4].name);
			expect(screen.getAllByTestId('node-item-', { exact: false })).toHaveLength(
				uploadedFiles.length
			);
			expect(screen.getAllByTestId(ICON_REGEXP.uploadLoading)).toHaveLength(uploadedFiles.length);
			// last files are queued
			expect(screen.getAllByText(/queued/i)).toHaveLength(uploadedFiles.length - UploadQueue.LIMIT);
			const nodeItems = screen.getAllByTestId('node-item-', { exact: false });
			forEach(nodeItems, (nodeItem, index) => {
				if (index < UploadQueue.LIMIT) {
					expect(within(nodeItem).getByText(/\d+%/)).toBeVisible();
					expect(within(nodeItem).queryByText(/queued/i)).not.toBeInTheDocument();
				} else {
					expect(within(nodeItem).getByText(/queued/i)).toBeVisible();
					expect(within(nodeItem).queryByText(/\d+%/)).not.toBeInTheDocument();
				}
			});
			emitter.emit('done');
			await waitFor(() =>
				expect(screen.getAllByTestId('icon: CheckmarkCircle2')).toHaveLength(UploadQueue.LIMIT)
			);
			expect(
				within(nodeItems[UploadQueue.LIMIT - 1]).queryByText(/queued/i)
			).not.toBeInTheDocument();
			expect(
				within(nodeItems[UploadQueue.LIMIT - 1]).getByTestId('icon: CheckmarkCircle2')
			).toBeVisible();
			expect(within(nodeItems[UploadQueue.LIMIT]).queryByText(/queued/i)).not.toBeInTheDocument();
			expect(within(nodeItems[UploadQueue.LIMIT]).getByText(/\d+%/i)).toBeVisible();
			expect(within(nodeItems[UploadQueue.LIMIT * 2]).getByText(/queued/i)).toBeVisible();
			expect(within(nodeItems[uploadedFiles.length - 1]).getByText(/queued/i)).toBeVisible();
			emitter.emit('done');
			await waitFor(() =>
				expect(screen.getAllByTestId('icon: CheckmarkCircle2')).toHaveLength(UploadQueue.LIMIT * 2)
			);
			expect(within(nodeItems[UploadQueue.LIMIT * 2]).getByText(/\d+%/i)).toBeVisible();
			expect(
				within(nodeItems[UploadQueue.LIMIT * 2]).queryByText(/queued/i)
			).not.toBeInTheDocument();
			expect(
				within(nodeItems[uploadedFiles.length - 1]).queryByText(/queued/i)
			).not.toBeInTheDocument();
			expect(within(nodeItems[uploadedFiles.length - 1]).getByText(/\d+%/)).toBeVisible();
			emitter.emit('done');
			await waitFor(() =>
				expect(screen.getAllByTestId('icon: CheckmarkCircle2')).toHaveLength(uploadedFiles.length)
			);
			expect(screen.queryByText(/queued/i)).not.toBeInTheDocument();
		});

		test('Drop of a folder creates the folders and upload all the files of the tree hierarchy', async () => {
			const localRoot = populateFolder(0, ROOTS.LOCAL_ROOT);
			const folderToUpload = populateFolder();
			folderToUpload.parent = localRoot;
			const subFolder1 = populateFolder();
			const subFolder2 = populateFolder();
			folderToUpload.children.nodes.push(populateFile(), subFolder1);
			forEach(folderToUpload.children.nodes, (child) => {
				(child as Node).parent = folderToUpload;
			});
			subFolder1.children.nodes.push(...populateNodes(2, 'File'), subFolder2);
			forEach(subFolder1.children.nodes, (child) => {
				(child as Node).parent = subFolder1;
			});
			subFolder2.children.nodes.push(...populateNodes(3, 'File'));
			forEach(subFolder2.children.nodes, (child) => {
				(child as Node).parent = subFolder2;
			});
			const numberOfFiles = 6; // number of files to upload considering all the tree
			const numberOfFolders = 3;
			const numberOfNodes = numberOfFiles + numberOfFolders;

			const dataTransferObj = createDataTransfer([folderToUpload]);

			const uploadFileHandler = jest.fn(handleUploadFileRequest);

			server.use(
				rest.post<UploadRequestBody, UploadRequestParams, UploadResponse>(
					`${REST_ENDPOINT}${UPLOAD_PATH}`,
					uploadFileHandler
				)
			);

			const mocks = [
				mockGetBaseNode({ node_id: localRoot.id }, localRoot)
				// mockCreateFolder(
				// 	{ name: folderToUpload.name, destination_id: folderToUpload.parent.id },
				// 	folderToUpload
				// ),
				// mockCreateFolder(
				// 	{ name: subFolder1.name, destination_id: folderToUpload.parent.id },
				// 	subFolder1
				// ),
				// mockCreateFolder(
				// 	{ name: subFolder2.name, destination_id: (subFolder2.parent as Folder).id },
				// 	subFolder2
				// )
			];

			setup(<UploadList />, { mocks });

			const dropzone = await screen.findByText(/nothing here/i);

			await uploadWithDnD(dropzone, dataTransferObj);

			await screen.findByText(folderToUpload.name);

			expect(screen.getByTestId(ICON_REGEXP.uploadLoading)).toBeVisible();
			expect(screen.getByText(RegExp(`\\d/${numberOfNodes}`))).toBeVisible();
			expect(screen.getByTestId('node-item', { exact: false })).toBeInTheDocument();
			expect(screen.queryByText(/Drop here your attachments/m)).not.toBeInTheDocument();

			await waitFor(() => expect(uploadFileHandler).toHaveBeenCalledTimes(numberOfFiles));

			await screen.findByTestId('icon: CheckmarkCircle2');

			expect(screen.getByTestId('icon: CheckmarkCircle2')).toBeVisible();
			expect(screen.getByText(RegExp(`${numberOfNodes}/${numberOfNodes}`))).toBeVisible();
		});
	});
});
