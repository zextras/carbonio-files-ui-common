/*
 * SPDX-FileCopyrightText: 2022 Zextras <https://www.zextras.com>
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import React from 'react';

import { ApolloError } from '@apollo/client';
import { faker } from '@faker-js/faker';
import { screen, waitFor } from '@testing-library/react';
import { EventEmitter } from 'events';
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
	populateFolder,
	populateLocalRoot,
	populateNodes,
	populateUploadItems
} from '../../mocks/mockUtils';
import { UploadStatus } from '../../types/common';
import { GetChildQuery, GetChildQueryVariables } from '../../types/graphql/types';
import { mockCreateFolder, mockCreateFolderError, mockGetBaseNode } from '../../utils/mockUtils';
import {
	createDataTransfer,
	delayUntil,
	generateError,
	selectNodes,
	setup,
	uploadWithDnD
} from '../../utils/testUtils';
import { UploadList } from './UploadList';

describe('Upload List', () => {
	describe('Retry', () => {
		describe('Selection Mode', () => {
			test('Action is visible if all selected items are failed', async () => {
				const uploadItems = populateUploadItems(3);
				forEach(uploadItems, (item) => {
					item.status = UploadStatus.FAILED;
					item.parentNodeId = ROOTS.LOCAL_ROOT;
				});
				const uploadMap = keyBy(uploadItems, 'id');

				uploadVar(uploadMap);

				const mocks = [mockGetBaseNode({ node_id: ROOTS.LOCAL_ROOT }, populateLocalRoot())];
				const { user, getByRoleWithIcon, queryByRoleWithIcon } = setup(<UploadList />, {
					mocks
				});

				expect(screen.getByText(uploadItems[0].name)).toBeVisible();
				expect(screen.getAllByTestId(ICON_REGEXP.uploadFailed)).toHaveLength(uploadItems.length);
				await selectNodes(Object.keys(uploadMap), user);
				expect(screen.getByText(/deselect all/i)).toBeVisible();
				expect(
					queryByRoleWithIcon('button', { icon: ICON_REGEXP.moreVertical })
				).not.toBeInTheDocument();
				expect(getByRoleWithIcon('button', { icon: ICON_REGEXP.retryUpload })).toBeVisible();
			});

			test('Action is hidden if at least one selected item is not failed', async () => {
				const uploadItems = populateUploadItems(3);
				forEach(uploadItems, (item) => {
					item.status = UploadStatus.FAILED;
					item.parentNodeId = ROOTS.LOCAL_ROOT;
				});
				uploadItems[0].status = UploadStatus.COMPLETED;
				const uploadMap = keyBy(uploadItems, 'id');

				uploadVar(uploadMap);

				const mocks = [mockGetBaseNode({ node_id: ROOTS.LOCAL_ROOT }, populateLocalRoot())];
				const { user, getByRoleWithIcon, queryByRoleWithIcon } = setup(<UploadList />, { mocks });

				expect(screen.getByText(uploadItems[0].name)).toBeVisible();
				expect(screen.getAllByTestId(ICON_REGEXP.uploadFailed)).toHaveLength(
					uploadItems.length - 1
				);
				await selectNodes(Object.keys(uploadMap), user);
				expect(screen.getByText(/deselect all/i)).toBeVisible();
				expect(
					queryByRoleWithIcon('button', { icon: ICON_REGEXP.moreVertical })
				).not.toBeInTheDocument();
				expect(getByRoleWithIcon('button', { icon: ICON_REGEXP.goToFolder })).toBeVisible();
				expect(
					queryByRoleWithIcon('button', { icon: ICON_REGEXP.retryUpload })
				).not.toBeInTheDocument();
			});

			test('Action on multiple selection reset all selected item status from failed to loading and restart upload', async () => {
				const uploadedFiles = populateNodes(3, 'File');
				const localRoot = populateLocalRoot();
				forEach(uploadedFiles, (item) => {
					item.parent = localRoot;
				});

				const uploadFailedHandler = jest.fn();
				const uploadSuccessHandler = jest.fn();
				const emitter = new EventEmitter();
				const EMITTER_CODE = {
					fail: 'done-fail',
					success: 'done-success'
				};

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
						async (req, res, ctx) => {
							const response = await Promise.any([
								delayUntil(emitter, EMITTER_CODE.fail).then(() => {
									uploadFailedHandler();
									return res(ctx.status(500));
								}),
								delayUntil(emitter, EMITTER_CODE.success).then(() => {
									uploadSuccessHandler();
									return res(
										ctx.json({
											nodeId: faker.datatype.uuid()
										})
									);
								})
							]);
							return response;
						}
					)
				);

				const mocks = [mockGetBaseNode({ node_id: ROOTS.LOCAL_ROOT }, localRoot)];

				const dataTransferObj = createDataTransfer(uploadedFiles);

				const { user, getByRoleWithIcon } = setup(<UploadList />, {
					mocks
				});

				const dropzoneArea = await screen.findByText(/nothing here/i);

				await uploadWithDnD(dropzoneArea, dataTransferObj);

				expect(screen.getAllByTestId('node-item', { exact: false })).toHaveLength(
					uploadedFiles.length
				);
				expect(screen.queryByText(/Drop here your attachments/m)).not.toBeInTheDocument();

				emitter.emit(EMITTER_CODE.fail);

				await screen.findAllByTestId(ICON_REGEXP.uploadFailed);
				expect(screen.getAllByTestId(ICON_REGEXP.uploadFailed)).toHaveLength(uploadedFiles.length);
				const uploadItems = Object.keys(uploadVar());
				await selectNodes(uploadItems, user);
				const retryAllAction = getByRoleWithIcon('button', { icon: ICON_REGEXP.retryUpload });
				expect(retryAllAction).toBeVisible();
				await user.click(retryAllAction);
				await screen.findAllByTestId(ICON_REGEXP.uploadLoading);
				expect(screen.getAllByTestId(ICON_REGEXP.uploadLoading)).toHaveLength(uploadedFiles.length);
				emitter.emit(EMITTER_CODE.success);
				await waitFor(() =>
					expect(screen.getAllByTestId(ICON_REGEXP.uploadCompleted)).toHaveLength(
						uploadedFiles.length
					)
				);
				expect(screen.queryByTestId(ICON_REGEXP.uploadFailed)).not.toBeInTheDocument();
			});
		});

		describe('On a folder', () => {
			test('If the folder is not created, retry the creation of the folder and then starts the upload of the children', async () => {
				const localRoot = populateLocalRoot();
				const folder = populateFolder();
				folder.parent = localRoot;
				const children = populateNodes(2, 'File');
				folder.children.nodes = children;
				forEach(children, (child) => {
					child.parent = folder;
				});

				const dataTransferObj = createDataTransfer([folder]);

				const uploadHandler = jest.fn(handleUploadFileRequest);

				server.use(
					graphql.mutation('createFolder', (req, res, ctx) =>
						res(
							ctx.errors([
								new ApolloError({ graphQLErrors: [generateError('create folder msw error')] })
							])
						)
					),
					rest.post(`${REST_ENDPOINT}${UPLOAD_PATH}`, uploadHandler)
				);

				const mocks = [
					mockGetBaseNode({ node_id: localRoot.id }, localRoot),
					mockCreateFolderError(
						{ name: folder.name, destination_id: localRoot.id },
						new ApolloError({ graphQLErrors: [generateError('Create folder error')] })
					),
					mockCreateFolder({ name: folder.name, destination_id: localRoot.id }, folder)
				];

				const { user } = setup(<UploadList />, { mocks });

				const dropzone = await screen.findByText(/nothing here/i);
				await uploadWithDnD(dropzone, dataTransferObj);
				await screen.findByText(folder.name);
				expect(screen.getByText(folder.name)).toBeVisible();
				await screen.findByTestId(ICON_REGEXP.uploadFailed);
				await user.hover(screen.getByText(folder.name));
				expect(screen.getByTestId(ICON_REGEXP.retryUpload)).toBeInTheDocument();
				expect(uploadHandler).not.toHaveBeenCalled();
				await user.click(screen.getByTestId(ICON_REGEXP.retryUpload));
				await screen.findByTestId(ICON_REGEXP.uploadCompleted);
				expect(uploadHandler).toHaveBeenCalledTimes(children.length);
			});

			test('If the folder is already created, does not create the folder again and retries the upload of the children', async () => {});
		});
	});
});
