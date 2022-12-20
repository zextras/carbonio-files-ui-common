/*
 * SPDX-FileCopyrightText: 2022 Zextras <https://www.zextras.com>
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */
import React from 'react';

import { faker } from '@faker-js/faker';
import { act, screen, waitFor } from '@testing-library/react';
import { EventEmitter } from 'events';
import forEach from 'lodash/forEach';
import keyBy from 'lodash/keyBy';
import { graphql, ResponseResolver, rest, RestContext, RestRequest } from 'msw';

import server from '../../../mocks/server';
import { uploadVar } from '../../apollo/uploadVar';
import { REST_ENDPOINT, ROOTS, UPLOAD_PATH } from '../../constants';
import { ICON_REGEXP } from '../../constants/test';
import {
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
import {
	Folder,
	GetChildQuery,
	GetChildQueryVariables,
	GetChildrenQuery,
	GetChildrenQueryVariables
} from '../../types/graphql/types';
import { getChildrenVariables, mockGetBaseNode, mockGetChildren } from '../../utils/mockUtils';
import {
	createDataTransfer,
	delayUntil,
	selectNodes,
	setup,
	uploadWithDnD
} from '../../utils/testUtils';
import { UploadList } from './UploadList';

describe('Upload List', () => {
	describe('Remove', () => {
		describe('Selection Mode', () => {
			test('Action is visible even if selected items have all a different status', async () => {
				const uploadItems = populateUploadItems(Object.values(UploadStatus).length);
				forEach(Object.values(UploadStatus), (status, index) => {
					uploadItems[index].status = status;
					uploadItems[index].parentNodeId = ROOTS.LOCAL_ROOT;
				});
				const uploadMap = keyBy(uploadItems, 'id');

				uploadVar(uploadMap);

				const mocks = [mockGetBaseNode({ node_id: ROOTS.LOCAL_ROOT }, populateLocalRoot())];
				const { user, getByRoleWithIcon, queryByRoleWithIcon } = setup(<UploadList />, {
					mocks
				});

				expect(screen.getByText(uploadItems[0].name)).toBeVisible();
				expect(screen.getByTestId(ICON_REGEXP.uploadCompleted)).toBeVisible();
				expect(screen.getByTestId(ICON_REGEXP.uploadFailed)).toBeVisible();
				expect(screen.getAllByTestId(ICON_REGEXP.uploadLoading)).toHaveLength(2);
				await selectNodes(Object.keys(uploadMap), user);
				expect(screen.getByText(/deselect all/i)).toBeVisible();
				expect(
					queryByRoleWithIcon('button', { icon: ICON_REGEXP.moreVertical })
				).not.toBeInTheDocument();
				expect(getByRoleWithIcon('button', { icon: ICON_REGEXP.removeUpload })).toBeVisible();
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

				const filesToUpload = populateNodes(6, 'File');

				forEach(filesToUpload, (file) => {
					file.parent = localRoot;
				});

				const dataTransferObj = createDataTransfer(filesToUpload);

				const emitter = new EventEmitter();

				const EMITTER_CODES = {
					success: 'done-success',
					fail: 'done-fail',
					never: 'never'
				};

				const handleUploadFileRequest: ResponseResolver<
					RestRequest<UploadRequestBody, UploadRequestParams>,
					RestContext,
					UploadResponse
				> = async (req, res, ctx) => {
					const fileName =
						req.headers.get('filename') && window.atob(req.headers.get('filename') as string);
					if (fileName === filesToUpload[0].name) {
						await delayUntil(emitter, EMITTER_CODES.fail);
						return res(ctx.status(500));
					}
					if (fileName === filesToUpload[1].name) {
						await delayUntil(emitter, EMITTER_CODES.success);
						return res(ctx.json({ nodeId: filesToUpload[1].id }));
					}
					await delayUntil(emitter, EMITTER_CODES.never);
					return res(ctx.json({ nodeId: faker.datatype.uuid() }));
				};

				const uploadFileHandler = jest.fn(handleUploadFileRequest);
				server.use(
					rest.post(`${REST_ENDPOINT}${UPLOAD_PATH}`, uploadFileHandler),
					graphql.query<GetChildQuery, GetChildQueryVariables>('getChild', (req, res, ctx) =>
						res(ctx.data({ getNode: filesToUpload[1] }))
					)
				);
				const mocks = [mockGetBaseNode({ node_id: localRoot.id }, localRoot)];

				const { user, getByRoleWithIcon } = setup(<UploadList />, { mocks });

				const dropzone = await screen.findByText(/nothing here/i);

				await uploadWithDnD(dropzone, dataTransferObj);

				await screen.findByText(filesToUpload[0].name);
				await waitFor(() => expect(uploadFileHandler).toHaveBeenCalledTimes(3));

				expect(screen.getAllByTestId(ICON_REGEXP.uploadLoading)).toHaveLength(6);

				emitter.emit(EMITTER_CODES.fail);

				await waitFor(() => expect(uploadFileHandler).toHaveBeenCalledTimes(4));

				expect(screen.getAllByTestId(ICON_REGEXP.uploadLoading)).toHaveLength(5);
				expect(screen.getByTestId(ICON_REGEXP.uploadFailed)).toBeInTheDocument();

				emitter.emit(EMITTER_CODES.success);

				await waitFor(() => expect(uploadFileHandler).toHaveBeenCalledTimes(5));

				expect(screen.getAllByTestId(ICON_REGEXP.uploadLoading)).toHaveLength(4);
				expect(screen.getByTestId(ICON_REGEXP.uploadFailed)).toBeInTheDocument();
				expect(screen.getByTestId('icon: CheckmarkCircle2')).toBeInTheDocument();

				await selectNodes(Object.keys(uploadVar()), user);
				expect(screen.getByText(/deselect all/i)).toBeVisible();
				const removeAction = getByRoleWithIcon('button', { icon: ICON_REGEXP.removeUpload });
				expect(removeAction).toBeVisible();

				await user.click(removeAction);
				expect(screen.queryByText(filesToUpload[0].name)).not.toBeInTheDocument();
				expect(screen.queryByText(filesToUpload[1].name)).not.toBeInTheDocument();
				expect(screen.queryByText(filesToUpload[2].name)).not.toBeInTheDocument();
				expect(screen.queryByText(filesToUpload[3].name)).not.toBeInTheDocument();
				expect(screen.queryByText(filesToUpload[4].name)).not.toBeInTheDocument();
				expect(screen.queryByText(filesToUpload[5].name)).not.toBeInTheDocument();

				expect(screen.getByText(/nothing here/i)).toBeVisible();

				const localRootCachedData = global.apolloClient.readQuery<
					GetChildrenQuery,
					GetChildrenQueryVariables
				>(getChildrenMockedQuery.request);

				expect((localRootCachedData?.getNode as Folder).children?.nodes).toHaveLength(1);
				expect((localRootCachedData?.getNode as Folder).children?.nodes[0]?.name).toBe(
					filesToUpload[1].name
				);

				act(() => {
					emitter.emit(EMITTER_CODES.never);
				});
			});
		});
	});
});
