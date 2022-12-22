/*
 * SPDX-FileCopyrightText: 2022 Zextras <https://www.zextras.com>
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */
import React from 'react';

import { screen } from '@testing-library/react';
import keyBy from 'lodash/keyBy';

import { uploadVar } from '../../apollo/uploadVar';
import { ICON_REGEXP } from '../../constants/test';
import { populateFolder, populateLocalRoot, populateUploadItems } from '../../mocks/mockUtils';
import { UploadStatus } from '../../types/common';
import { mockGetBaseNode } from '../../utils/mockUtils';
import { selectNodes, setup } from '../../utils/testUtils';
import { UploadList } from './UploadList';

describe('Upload List', () => {
	describe('Go To Folder', () => {
		describe('Selection Mode', () => {
			test('Action is visible if selected items have all the same parent, independently from the status', async () => {
				const localRoot = populateLocalRoot();
				const statuses = Object.values(UploadStatus);
				const uploadItems = populateUploadItems(statuses.length);
				statuses.forEach((status, index) => {
					uploadItems[index].status = status;
					uploadItems[index].parentNodeId = localRoot.id;
				});

				const uploadMap = keyBy(uploadItems, (item) => item.id);

				uploadVar(uploadMap);

				const mocks = [mockGetBaseNode({ node_id: localRoot.id }, localRoot)];

				const { user, getByRoleWithIcon } = setup(<UploadList />, { mocks });

				await screen.findByText(uploadItems[0].name);

				await selectNodes(Object.keys(uploadMap), user);

				await screen.findByText(/deselect all/i);
				expect(getByRoleWithIcon('button', { icon: ICON_REGEXP.goToFolder })).toBeVisible();
				expect(getByRoleWithIcon('button', { icon: ICON_REGEXP.goToFolder })).toBeEnabled();
			});

			test('Action is hidden if selected at least one of the selected items has a different parent', async () => {
				const localRoot = populateLocalRoot();
				const statuses = Object.values(UploadStatus);
				const uploadItems = populateUploadItems(statuses.length);
				statuses.forEach((status, index) => {
					uploadItems[index].status = status;
					uploadItems[index].parentNodeId = localRoot.id;
				});
				const differentParent = populateFolder();
				uploadItems[uploadItems.length - 1].parentNodeId = differentParent.id;

				const uploadMap = keyBy(uploadItems, (item) => item.id);

				uploadVar(uploadMap);

				const mocks = [
					mockGetBaseNode({ node_id: localRoot.id }, localRoot),
					mockGetBaseNode({ node_id: differentParent.id }, differentParent)
				];

				const { user, queryByRoleWithIcon } = setup(<UploadList />, { mocks });

				await screen.findByText(uploadItems[0].name);

				await selectNodes(Object.keys(uploadMap), user);

				await screen.findByText(/deselect all/i);
				expect(
					queryByRoleWithIcon('button', { icon: ICON_REGEXP.goToFolder })
				).not.toBeInTheDocument();
			});
		});
	});
});
