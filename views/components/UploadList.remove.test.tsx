/*
 * SPDX-FileCopyrightText: 2022 Zextras <https://www.zextras.com>
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */
import React from 'react';

import { faker } from '@faker-js/faker';
import {
	fireEvent,
	screen,
	waitFor,
	waitForElementToBeRemoved,
	within
} from '@testing-library/react';
import { EventEmitter } from 'events';
import filter from 'lodash/filter';
import map from 'lodash/map';
import size from 'lodash/size';
import {
	AsyncResponseResolverReturnType,
	graphql,
	MockedRequest,
	MockedResponse,
	ResponseComposition,
	ResponseResolver,
	ResponseResolverReturnType,
	rest,
	RestContext,
	RestRequest
} from 'msw';

import server from '../../../mocks/server';
import { UploadRecord, uploadVar } from '../../apollo/uploadVar';
import { REST_ENDPOINT, ROOTS, UPLOAD_PATH } from '../../constants';
import {
	UploadRequestBody,
	UploadRequestParams,
	UploadResponse
} from '../../mocks/handleUploadFileRequest';
import { populateFile, populateFolder } from '../../mocks/mockUtils';
import { UploadStatus } from '../../types/common';
import {
	Folder,
	GetChildQuery,
	GetChildQueryVariables,
	GetChildrenQuery,
	GetChildrenQueryVariables
} from '../../types/graphql/types';
import { getChildrenVariables, mockGetBaseNode, mockGetChildren } from '../../utils/mockUtils';
import { createDataTransfer, delayUntil, selectNodes, setup } from '../../utils/testUtils';
import { UploadList } from './UploadList';

describe('Upload List', () => {
	describe('Remove', () => {
		describe('Selection Mode', () => {
			test('Action is visible even if selected items have all a different status', async () => {
				const localRoot = populateFolder(0, ROOTS.LOCAL_ROOT);
				const fileToUpload1 = populateFile();
				const fileToUpload2 = populateFile();
				const fileToUpload3 = populateFile();
				const fileToUpload4 = populateFile();
				const fileToUpload5 = populateFile();
				const fileToUpload6 = populateFile();

				fileToUpload1.parent = localRoot;
				fileToUpload2.parent = localRoot;
				fileToUpload3.parent = localRoot;
				fileToUpload4.parent = localRoot;
				fileToUpload5.parent = localRoot;
				fileToUpload6.parent = localRoot;

				const dataTransferObj = createDataTransfer([
					fileToUpload1,
					fileToUpload2,
					fileToUpload3,
					fileToUpload4,
					fileToUpload5,
					fileToUpload6
				]);

				const emitter = new EventEmitter();

				const handleUploadFileRequest: ResponseResolver<
					RestRequest<UploadRequestBody, UploadRequestParams>,
					RestContext,
					UploadResponse
				> = async (req, res, ctx) => {
					const fileName =
						req.headers.get('filename') && window.atob(req.headers.get('filename') as string);
					if (fileName === fileToUpload1.name) {
						await delayUntil(emitter, 'done-fail');
						return res(ctx.status(500));
					}
					if (fileName === fileToUpload2.name) {
						await delayUntil(emitter, 'done-success');
						return res(ctx.json({ nodeId: faker.datatype.uuid() }));
					}
					await delayUntil(emitter, 'never');
					return res(ctx.json({ nodeId: faker.datatype.uuid() }));
				};

				const uploadFileHandler = jest.fn(handleUploadFileRequest);
				server.use(rest.post(`${REST_ENDPOINT}${UPLOAD_PATH}`, uploadFileHandler));
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

				await screen.findByText(fileToUpload1.name);
				await screen.findByText(fileToUpload2.name);
				await screen.findByText(fileToUpload3.name);
				await screen.findByText(fileToUpload4.name);
				await screen.findByText(fileToUpload5.name);
				await screen.findByText(fileToUpload6.name);

				await screen.findByText(/upload occurred in Files' home/i);

				expect(screen.queryByText(/Drop here your attachments/m)).not.toBeInTheDocument();

				await waitFor(() => expect(uploadFileHandler).toHaveBeenCalledTimes(3));

				expect(screen.getAllByTestId('icon: AnimatedLoader')).toHaveLength(6);

				let uploadItems: UploadRecord = uploadVar();
				expect(filter(uploadItems, (item) => item.status === UploadStatus.LOADING)).toHaveLength(3);
				expect(filter(uploadItems, (item) => item.status === UploadStatus.QUEUED)).toHaveLength(3);

				emitter.emit('done-fail');

				await waitFor(() => expect(uploadFileHandler).toHaveBeenCalledTimes(4));

				expect(screen.getAllByTestId('icon: AnimatedLoader')).toHaveLength(5);
				expect(screen.getByTestId('icon: AlertCircle')).toBeInTheDocument();

				uploadItems = uploadVar();
				expect(filter(uploadItems, (item) => item.status === UploadStatus.LOADING)).toHaveLength(3);
				expect(filter(uploadItems, (item) => item.status === UploadStatus.QUEUED)).toHaveLength(2);
				expect(filter(uploadItems, (item) => item.status === UploadStatus.FAILED)).toHaveLength(1);

				emitter.emit('done-success');

				await waitFor(() => expect(uploadFileHandler).toHaveBeenCalledTimes(5));

				expect(screen.getAllByTestId('icon: AnimatedLoader')).toHaveLength(4);
				expect(screen.getByTestId('icon: AlertCircle')).toBeInTheDocument();
				expect(screen.getByTestId('icon: CheckmarkCircle2')).toBeInTheDocument();

				uploadItems = uploadVar();
				expect(filter(uploadItems, (item) => item.status === UploadStatus.LOADING)).toHaveLength(3);
				expect(filter(uploadItems, (item) => item.status === UploadStatus.QUEUED)).toHaveLength(1);
				expect(filter(uploadItems, (item) => item.status === UploadStatus.FAILED)).toHaveLength(1);
				expect(filter(uploadItems, (item) => item.status === UploadStatus.COMPLETED)).toHaveLength(
					1
				);

				await selectNodes(
					map(uploadItems, (item) => item.id),
					user
				);
				const listHeader = await screen.findByTestId('list-header-selectionModeActive');
				expect(within(listHeader).getByTestId('icon: CloseCircleOutline')).toBeInTheDocument();
			});

			test('Action remove all items from the list and stop the upload of the items which are not completed', async () => {
				const localRoot = populateFolder(0, ROOTS.LOCAL_ROOT);

				// write local root data in cache as if it was already loaded
				const getChildrenMockedQuery = mockGetChildren(
					getChildrenVariables(localRoot.id),
					localRoot
				);
				global.apolloClient.cache.writeQuery<GetChildrenQuery, GetChildrenQueryVariables>({
					...getChildrenMockedQuery.request,
					data: {
						getNode: localRoot
					}
				});

				const fileToUpload1 = populateFile();
				const fileToUpload2 = populateFile();
				const fileToUpload3 = populateFile();
				const fileToUpload4 = populateFile();
				const fileToUpload5 = populateFile();
				const fileToUpload6 = populateFile();

				fileToUpload1.parent = localRoot;
				fileToUpload2.parent = localRoot;
				fileToUpload3.parent = localRoot;
				fileToUpload4.parent = localRoot;
				fileToUpload5.parent = localRoot;
				fileToUpload6.parent = localRoot;

				const dataTransferObj = createDataTransfer([
					fileToUpload1,
					fileToUpload2,
					fileToUpload3,
					fileToUpload4,
					fileToUpload5,
					fileToUpload6
				]);

				const emitter = new EventEmitter();

				const handleUploadFileRequest: ResponseResolver<
					RestRequest<UploadRequestBody, UploadRequestParams>,
					RestContext,
					UploadResponse
				> = async (req, res, ctx) => {
					const fileName =
						req.headers.get('filename') && window.atob(req.headers.get('filename') as string);
					if (fileName === fileToUpload1.name) {
						await delayUntil(emitter, 'done-fail');
						return res(ctx.status(500));
					}
					if (fileName === fileToUpload2.name) {
						await delayUntil(emitter, 'done-success');
						return res(ctx.json({ nodeId: fileToUpload2.id }));
					}
					await delayUntil(emitter, 'never');
					return res(ctx.json({ nodeId: faker.datatype.uuid() }));
				};

				const uploadFileHandler = jest.fn(handleUploadFileRequest);
				server.use(
					rest.post(`${REST_ENDPOINT}${UPLOAD_PATH}`, uploadFileHandler),
					graphql.query<GetChildQuery, GetChildQueryVariables>('getChild', (req, res, ctx) =>
						res(ctx.data({ getNode: fileToUpload2 }))
					)
				);
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

				const file1Name = await screen.findByText(fileToUpload1.name);
				const file2Name = await screen.findByText(fileToUpload2.name);
				const file3Name = await screen.findByText(fileToUpload3.name);
				const file4Name = await screen.findByText(fileToUpload4.name);
				const file5Name = await screen.findByText(fileToUpload5.name);
				const file6Name = await screen.findByText(fileToUpload6.name);

				await screen.findByText(/upload occurred in Files' home/i);

				expect(screen.queryByText(/Drop here your attachments/m)).not.toBeInTheDocument();

				await waitFor(() => expect(uploadFileHandler).toHaveBeenCalledTimes(3));

				expect(screen.getAllByTestId('icon: AnimatedLoader')).toHaveLength(6);

				let uploadItems: UploadRecord = uploadVar();
				expect(filter(uploadItems, (item) => item.status === UploadStatus.LOADING)).toHaveLength(3);
				expect(filter(uploadItems, (item) => item.status === UploadStatus.QUEUED)).toHaveLength(3);

				emitter.emit('done-fail');

				await waitFor(() => expect(uploadFileHandler).toHaveBeenCalledTimes(4));

				expect(screen.getAllByTestId('icon: AnimatedLoader')).toHaveLength(5);
				expect(screen.getByTestId('icon: AlertCircle')).toBeInTheDocument();

				uploadItems = uploadVar();
				expect(filter(uploadItems, (item) => item.status === UploadStatus.LOADING)).toHaveLength(3);
				expect(filter(uploadItems, (item) => item.status === UploadStatus.QUEUED)).toHaveLength(2);
				expect(filter(uploadItems, (item) => item.status === UploadStatus.FAILED)).toHaveLength(1);

				emitter.emit('done-success');

				await waitFor(() => expect(uploadFileHandler).toHaveBeenCalledTimes(5));

				expect(screen.getAllByTestId('icon: AnimatedLoader')).toHaveLength(4);
				expect(screen.getByTestId('icon: AlertCircle')).toBeInTheDocument();
				expect(screen.getByTestId('icon: CheckmarkCircle2')).toBeInTheDocument();

				uploadItems = uploadVar();
				expect(filter(uploadItems, (item) => item.status === UploadStatus.LOADING)).toHaveLength(3);
				expect(filter(uploadItems, (item) => item.status === UploadStatus.QUEUED)).toHaveLength(1);
				expect(filter(uploadItems, (item) => item.status === UploadStatus.FAILED)).toHaveLength(1);
				expect(filter(uploadItems, (item) => item.status === UploadStatus.COMPLETED)).toHaveLength(
					1
				);

				await selectNodes(
					map(uploadItems, (item) => item.id),
					user
				);
				const listHeader = await screen.findByTestId('list-header-selectionModeActive');
				const removeIcon = within(listHeader).getByTestId('icon: CloseCircleOutline');
				expect(removeIcon).toBeInTheDocument();

				user.click(removeIcon);
				await waitForElementToBeRemoved(file1Name);
				expect(file1Name).not.toBeInTheDocument();
				expect(file2Name).not.toBeInTheDocument();
				expect(file3Name).not.toBeInTheDocument();
				expect(file4Name).not.toBeInTheDocument();
				expect(file5Name).not.toBeInTheDocument();
				expect(file6Name).not.toBeInTheDocument();

				uploadItems = uploadVar();
				expect(size(uploadItems)).toBe(0);

				const localRootCachedData = global.apolloClient.readQuery<
					GetChildrenQuery,
					GetChildrenQueryVariables
				>(getChildrenMockedQuery.request);

				expect((localRootCachedData?.getNode as Folder).children?.nodes).toHaveLength(1);
				expect((localRootCachedData?.getNode as Folder).children?.nodes[0]?.name).toBe(
					fileToUpload2.name
				);
			});
		});

		describe('Contextual Menu', () => {
			test('Action is visible if item is failed', async () => {
				const localRoot = populateFolder(0, ROOTS.LOCAL_ROOT);
				const fileToUpload = populateFile();
				fileToUpload.parent = localRoot;

				const dataTransferObj = createDataTransfer([fileToUpload]);

				const handleUploadFileRequest: ResponseResolver<
					RestRequest<UploadRequestBody, UploadRequestParams>,
					RestContext,
					UploadResponse
				> = (req, res, ctx) => res(ctx.status(500));

				const uploadFileHandler = jest.fn(handleUploadFileRequest);
				server.use(rest.post(`${REST_ENDPOINT}${UPLOAD_PATH}`, uploadFileHandler));
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

				await screen.findByText(fileToUpload.name);
				await screen.findByText(/upload occurred in Files' home/i);

				expect(screen.getByTestId('icon: AnimatedLoader')).toBeVisible();
				const nodeItem = screen.getByTestId('node-item', { exact: false });
				expect(nodeItem).toBeInTheDocument();
				expect(screen.queryByText(/Drop here your attachments/m)).not.toBeInTheDocument();

				await waitFor(() => expect(uploadFileHandler).toHaveBeenCalledTimes(1));

				await screen.findByTestId('icon: AlertCircle');

				expect(screen.getByTestId('icon: AlertCircle')).toBeVisible();

				fireEvent.contextMenu(nodeItem);
				const dropdown = await screen.findByTestId('dropdown-popper-list');
				expect(within(dropdown).getByText('Remove upload')).toBeVisible();
			});

			test('Action is visible if item is loading', async () => {
				const localRoot = populateFolder(0, ROOTS.LOCAL_ROOT);
				const fileToUpload = populateFile();
				fileToUpload.parent = localRoot;

				const dataTransferObj = createDataTransfer([fileToUpload]);

				const emitter = new EventEmitter();

				const handleUploadFileRequest: ResponseResolver<
					RestRequest<UploadRequestBody, UploadRequestParams>,
					RestContext,
					UploadResponse
				> = async (req, res, ctx) => {
					await delayUntil(emitter, 'done');
					return res(ctx.json({ nodeId: faker.datatype.uuid() }));
				};

				const uploadFileHandler = jest.fn(handleUploadFileRequest);
				server.use(rest.post(`${REST_ENDPOINT}${UPLOAD_PATH}`, uploadFileHandler));
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

				await screen.findByText(fileToUpload.name);
				await screen.findByText(/upload occurred in Files' home/i);

				expect(screen.getByTestId('icon: AnimatedLoader')).toBeVisible();
				const nodeItem = screen.getByTestId('node-item', { exact: false });
				expect(nodeItem).toBeInTheDocument();
				expect(screen.queryByText(/Drop here your attachments/m)).not.toBeInTheDocument();

				await waitFor(() => expect(uploadFileHandler).toHaveBeenCalledTimes(1));

				expect(screen.getByTestId('icon: AnimatedLoader')).toBeVisible();

				fireEvent.contextMenu(nodeItem);
				const dropdown = await screen.findByTestId('dropdown-popper-list');
				expect(within(dropdown).getByText('Remove upload')).toBeVisible();
			});

			test('Action is visible if item is queued', async () => {
				const localRoot = populateFolder(0, ROOTS.LOCAL_ROOT);
				const fileToUpload1 = populateFile();
				const fileToUpload2 = populateFile();
				const fileToUpload3 = populateFile();
				const fileToUpload4 = populateFile();

				fileToUpload1.parent = localRoot;
				fileToUpload2.parent = localRoot;
				fileToUpload3.parent = localRoot;
				fileToUpload4.parent = localRoot;

				const dataTransferObj = createDataTransfer([
					fileToUpload1,
					fileToUpload2,
					fileToUpload3,
					fileToUpload4
				]);

				const emitter = new EventEmitter();

				const handleUploadFileRequest: ResponseResolver<
					RestRequest<UploadRequestBody, UploadRequestParams>,
					RestContext,
					UploadResponse
				> = async (req, res, ctx) => {
					await delayUntil(emitter, 'done');
					return res(ctx.json({ nodeId: faker.datatype.uuid() }));
				};

				const uploadFileHandler = jest.fn(handleUploadFileRequest);
				server.use(rest.post(`${REST_ENDPOINT}${UPLOAD_PATH}`, uploadFileHandler));
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

				await screen.findByText(fileToUpload1.name);
				await screen.findByText(fileToUpload2.name);
				await screen.findByText(fileToUpload3.name);
				await screen.findByText(fileToUpload4.name);

				await screen.findByText(/upload occurred in Files' home/i);

				expect(screen.getAllByTestId('icon: AnimatedLoader')).toHaveLength(4);

				const uploadItems: UploadRecord = uploadVar();
				expect(filter(uploadItems, (item) => item.status === UploadStatus.LOADING)).toHaveLength(3);
				const queuedItem = filter(uploadItems, (item) => item.status === UploadStatus.QUEUED);
				expect(queuedItem).toHaveLength(1);
				const queuedHtmlItem = screen.getByTestId(`node-item-${queuedItem[0].id}`);

				expect(queuedHtmlItem).toBeVisible();
				expect(screen.queryByText(/Drop here your attachments/m)).not.toBeInTheDocument();

				await waitFor(() => expect(uploadFileHandler).toHaveBeenCalledTimes(3));

				fireEvent.contextMenu(queuedHtmlItem);
				const dropdown = await screen.findByTestId('dropdown-popper-list');
				expect(within(dropdown).getByText('Remove upload')).toBeVisible();
			});

			test('Action is visible if item is completed', async () => {
				const localRoot = populateFolder(0, ROOTS.LOCAL_ROOT);
				const fileToUpload = populateFile();
				fileToUpload.parent = localRoot;

				const dataTransferObj = createDataTransfer([fileToUpload]);

				const handleUploadFileRequest: ResponseResolver<
					RestRequest<UploadRequestBody, UploadRequestParams>,
					RestContext,
					UploadResponse
				> = (req, res, ctx) => res(ctx.json({ nodeId: faker.datatype.uuid() }));

				const uploadFileHandler = jest.fn(handleUploadFileRequest);
				server.use(rest.post(`${REST_ENDPOINT}${UPLOAD_PATH}`, uploadFileHandler));
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

				await screen.findByText(fileToUpload.name);
				await screen.findByText(/upload occurred in Files' home/i);

				expect(screen.getByTestId('icon: AnimatedLoader')).toBeVisible();
				const nodeItem = screen.getByTestId('node-item', { exact: false });
				expect(nodeItem).toBeInTheDocument();
				expect(screen.queryByText(/Drop here your attachments/m)).not.toBeInTheDocument();

				await waitFor(() => expect(uploadFileHandler).toHaveBeenCalledTimes(1));

				await screen.findByTestId('icon: CheckmarkCircle2');

				expect(screen.getByTestId('icon: CheckmarkCircle2')).toBeVisible();

				fireEvent.contextMenu(nodeItem);
				const dropdown = await screen.findByTestId('dropdown-popper-list');
				expect(within(dropdown).getByText('Remove upload')).toBeVisible();
			});
		});

		describe('Hover bar', () => {
			test('Action is visible if item is failed', async () => {
				const localRoot = populateFolder(0, ROOTS.LOCAL_ROOT);
				const fileToUpload = populateFile();
				fileToUpload.parent = localRoot;

				const dataTransferObj = createDataTransfer([fileToUpload]);

				const handleUploadFileRequest: ResponseResolver<
					RestRequest<UploadRequestBody, UploadRequestParams>,
					RestContext,
					UploadResponse
				> = (req, res, ctx) => res(ctx.status(500));

				const uploadFileHandler = jest.fn(handleUploadFileRequest);
				server.use(rest.post(`${REST_ENDPOINT}${UPLOAD_PATH}`, uploadFileHandler));
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

				await screen.findByText(fileToUpload.name);
				await screen.findByText(/upload occurred in Files' home/i);

				expect(screen.getByTestId('icon: AnimatedLoader')).toBeVisible();
				const nodeItem = screen.getByTestId('node-item', { exact: false });
				expect(nodeItem).toBeInTheDocument();
				expect(screen.queryByText(/Drop here your attachments/m)).not.toBeInTheDocument();

				await waitFor(() => expect(uploadFileHandler).toHaveBeenCalledTimes(1));

				await screen.findByTestId('icon: AlertCircle');

				expect(screen.getByTestId('icon: AlertCircle')).toBeVisible();

				await user.hover(nodeItem);
				expect(within(nodeItem).getByTestId('icon: CloseCircleOutline')).toBeInTheDocument();
			});

			test('Action is visible if item is loading', async () => {
				const localRoot = populateFolder(0, ROOTS.LOCAL_ROOT);
				const fileToUpload = populateFile();
				fileToUpload.parent = localRoot;

				const dataTransferObj = createDataTransfer([fileToUpload]);

				const emitter = new EventEmitter();

				const handleUploadFileRequest: ResponseResolver<
					RestRequest<UploadRequestBody, UploadRequestParams>,
					RestContext,
					UploadResponse
				> = async (req, res, ctx) => {
					await delayUntil(emitter, 'done');
					return res(ctx.json({ nodeId: faker.datatype.uuid() }));
				};

				const uploadFileHandler = jest.fn(handleUploadFileRequest);
				server.use(rest.post(`${REST_ENDPOINT}${UPLOAD_PATH}`, uploadFileHandler));
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

				await screen.findByText(fileToUpload.name);
				await screen.findByText(/upload occurred in Files' home/i);

				expect(screen.getByTestId('icon: AnimatedLoader')).toBeVisible();
				const nodeItem = screen.getByTestId('node-item', { exact: false });
				expect(nodeItem).toBeInTheDocument();
				expect(screen.queryByText(/Drop here your attachments/m)).not.toBeInTheDocument();

				await waitFor(() => expect(uploadFileHandler).toHaveBeenCalledTimes(1));

				expect(screen.getByTestId('icon: AnimatedLoader')).toBeVisible();

				await user.hover(nodeItem);
				expect(within(nodeItem).getByTestId('icon: CloseCircleOutline')).toBeInTheDocument();
			});

			test('Action is visible if item is queued', async () => {
				const localRoot = populateFolder(0, ROOTS.LOCAL_ROOT);
				const fileToUpload1 = populateFile();
				const fileToUpload2 = populateFile();
				const fileToUpload3 = populateFile();
				const fileToUpload4 = populateFile();

				fileToUpload1.parent = localRoot;
				fileToUpload2.parent = localRoot;
				fileToUpload3.parent = localRoot;
				fileToUpload4.parent = localRoot;

				const dataTransferObj = createDataTransfer([
					fileToUpload1,
					fileToUpload2,
					fileToUpload3,
					fileToUpload4
				]);

				const emitter = new EventEmitter();

				const handleUploadFileRequest: ResponseResolver<
					RestRequest<UploadRequestBody, UploadRequestParams>,
					RestContext,
					UploadResponse
				> = async (req, res, ctx) => {
					await delayUntil(emitter, 'done');
					return res(ctx.json({ nodeId: faker.datatype.uuid() }));
				};

				const uploadFileHandler = jest.fn(handleUploadFileRequest);
				server.use(rest.post(`${REST_ENDPOINT}${UPLOAD_PATH}`, uploadFileHandler));
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

				await screen.findByText(fileToUpload1.name);
				await screen.findByText(fileToUpload2.name);
				await screen.findByText(fileToUpload3.name);
				await screen.findByText(fileToUpload4.name);

				await screen.findByText(/upload occurred in Files' home/i);

				expect(screen.getAllByTestId('icon: AnimatedLoader')).toHaveLength(4);

				const uploadItems: UploadRecord = uploadVar();
				expect(filter(uploadItems, (item) => item.status === UploadStatus.LOADING)).toHaveLength(3);
				const queuedItem = filter(uploadItems, (item) => item.status === UploadStatus.QUEUED);
				expect(queuedItem).toHaveLength(1);
				const queuedHtmlItem = screen.getByTestId(`node-item-${queuedItem[0].id}`);

				expect(queuedHtmlItem).toBeVisible();
				expect(screen.queryByText(/Drop here your attachments/m)).not.toBeInTheDocument();

				await waitFor(() => expect(uploadFileHandler).toHaveBeenCalledTimes(3));

				await user.hover(queuedHtmlItem);
				expect(within(queuedHtmlItem).getByTestId('icon: CloseCircleOutline')).toBeInTheDocument();
			});

			test('Action is visible if item is completed', async () => {
				const localRoot = populateFolder(0, ROOTS.LOCAL_ROOT);
				const fileToUpload = populateFile();
				fileToUpload.parent = localRoot;

				const dataTransferObj = createDataTransfer([fileToUpload]);

				const handleUploadFileRequest: ResponseResolver<
					RestRequest<UploadRequestBody, UploadRequestParams>,
					RestContext,
					UploadResponse
				> = (req, res, ctx) => res(ctx.json({ nodeId: faker.datatype.uuid() }));

				const uploadFileHandler = jest.fn(handleUploadFileRequest);
				server.use(rest.post(`${REST_ENDPOINT}${UPLOAD_PATH}`, uploadFileHandler));
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

				await screen.findByText(fileToUpload.name);
				await screen.findByText(/upload occurred in Files' home/i);

				expect(screen.getByTestId('icon: AnimatedLoader')).toBeVisible();
				const nodeItem = screen.getByTestId('node-item', { exact: false });
				expect(nodeItem).toBeInTheDocument();
				expect(screen.queryByText(/Drop here your attachments/m)).not.toBeInTheDocument();

				await waitFor(() => expect(uploadFileHandler).toHaveBeenCalledTimes(1));

				await screen.findByTestId('icon: CheckmarkCircle2');

				expect(screen.getByTestId('icon: CheckmarkCircle2')).toBeVisible();

				await user.hover(nodeItem);
				expect(within(nodeItem).getByTestId('icon: CloseCircleOutline')).toBeInTheDocument();
			});
		});
	});
});
