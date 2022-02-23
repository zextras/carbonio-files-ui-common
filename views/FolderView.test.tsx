/*
 * SPDX-FileCopyrightText: 2022 Zextras <https://www.zextras.com>
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import React from 'react';

import { fireEvent, screen, waitForElementToBeRemoved, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import map from 'lodash/map';

import { CreateOptionsContent } from '../../hooks/useCreateOptions';
import GET_CHILDREN from '../graphql/queries/getChildren.graphql';
import GET_NODE from '../graphql/queries/getNode.graphql';
import GET_PATH from '../graphql/queries/getPath.graphql';
import GET_PERMISSIONS from '../graphql/queries/getPermissions.graphql';
import { populateFolder, populateNode, populateParents } from '../mocks/mockUtils';
import { Node } from '../types/common';
import {
	GetChildrenQuery,
	GetChildrenQueryVariables,
	GetNodeQuery,
	GetNodeQueryVariables,
	GetParentQuery,
	GetParentQueryVariables,
	GetPathQuery,
	GetPathQueryVariables,
	GetPermissionsQuery,
	GetPermissionsQueryVariables
} from '../types/graphql/types';
import {
	getChildrenVariables,
	getNodeVariables,
	mockGetChildren,
	mockGetParent
} from '../utils/mockUtils';
import { buildBreadCrumbRegExp, moveNode, render } from '../utils/testUtils';
import FolderView from './FolderView';

let mockedCreateOptions: CreateOptionsContent['createOptions'];

beforeEach(() => {
	mockedCreateOptions = [];
});

jest.mock('../../hooks/useCreateOptions', () => ({
	useCreateOptions: (): CreateOptionsContent => ({
		setCreateOptions: jest
			.fn()
			.mockImplementation((...options: Parameters<CreateOptionsContent['setCreateOptions']>[0]) => {
				mockedCreateOptions = options;
			})
	})
}));

describe('Folder View', () => {
	describe('Create Folder', () => {
		test('Create folder option is disabled if current folder has not can_write_folder permission', async () => {
			const currentFolder = populateFolder();
			currentFolder.permissions.can_write_folder = false;
			// prepare cache so that apollo client read data from the cache
			const getChildrenMockedQuery = mockGetChildren(
				getChildrenVariables(currentFolder.id),
				currentFolder
			);
			global.apolloClient.writeQuery<GetChildrenQuery, GetChildrenQueryVariables>({
				...getChildrenMockedQuery.request,
				data: {
					getNode: currentFolder
				}
			});
			const getParentMockedQuery = mockGetParent({ node_id: currentFolder.id }, currentFolder);
			global.apolloClient.writeQuery<GetParentQuery, GetParentQueryVariables>({
				...getParentMockedQuery.request,
				data: {
					getNode: currentFolder
				}
			});
			global.apolloClient.writeQuery<GetPermissionsQuery, GetPermissionsQueryVariables>({
				query: GET_PERMISSIONS,
				variables: { node_id: currentFolder.id },
				data: {
					getNode: currentFolder
				}
			});
			render(<FolderView />, { initialRouterEntries: [`/?folder=${currentFolder.id}`] });
			await screen.findByText(/nothing here/gi);
			expect(map(mockedCreateOptions, (createOption) => createOption.action({}))).toEqual(
				expect.arrayContaining([expect.objectContaining({ id: 'create-folder', disabled: true })])
			);
			expect.assertions(1);
		});

		test('Create folder option is active if current folder has can_write_folder permission', async () => {
			const currentFolder = populateFolder();
			currentFolder.permissions.can_write_folder = true;
			const getChildrenMockedQuery = mockGetChildren(
				getChildrenVariables(currentFolder.id),
				currentFolder
			);
			global.apolloClient.writeQuery<GetChildrenQuery, GetChildrenQueryVariables>({
				...getChildrenMockedQuery.request,
				data: {
					getNode: currentFolder
				}
			});
			const getParentMockedQuery = mockGetParent({ node_id: currentFolder.id }, currentFolder);
			global.apolloClient.writeQuery<GetParentQuery, GetParentQueryVariables>({
				...getParentMockedQuery.request,
				data: {
					getNode: currentFolder
				}
			});
			// prepare cache so that apollo client read data from the cache
			global.apolloClient.writeQuery<GetPermissionsQuery, GetPermissionsQueryVariables>({
				query: GET_PERMISSIONS,
				variables: { node_id: currentFolder.id },
				data: {
					getNode: currentFolder
				}
			});
			render(<FolderView />, { initialRouterEntries: [`/?folder=${currentFolder.id}`] });
			await screen.findByText(/nothing here/gi);
			expect(map(mockedCreateOptions, (createOption) => createOption.action({}))).toEqual(
				expect.arrayContaining([expect.objectContaining({ id: 'create-folder', disabled: false })])
			);
		});
		expect.assertions(1);
	});

	describe('Displayer', () => {
		test('Single click on a node opens the details tab on displayer', async () => {
			const currentFolder = populateFolder(2);
			// prepare cache so that apollo client read data from the cache
			global.apolloClient.writeQuery<GetChildrenQuery, GetChildrenQueryVariables>({
				query: GET_CHILDREN,
				variables: getChildrenVariables(currentFolder.id),
				data: {
					getNode: currentFolder
				}
			});
			global.apolloClient.writeQuery<GetNodeQuery, GetNodeQueryVariables>({
				query: GET_NODE,
				variables: getNodeVariables((currentFolder.children[0] as Node).id),
				data: {
					getNode: currentFolder.children[0] as Node
				}
			});
			const { getByTextWithMarkup } = render(<FolderView />, {
				initialRouterEntries: [`/?folder=${currentFolder.id}`]
			});
			const nodeItem = screen.getByText((currentFolder.children[0] as Node).name);
			expect(nodeItem).toBeVisible();
			const displayer = screen.getByTestId('displayer');
			expect(within(displayer).queryByText(/details/i)).not.toBeInTheDocument();
			userEvent.click(nodeItem);
			await screen.findByText(/details/i);
			expect(within(displayer).getAllByText((currentFolder.children[0] as Node).name)).toHaveLength(
				2
			);
			expect(
				getByTextWithMarkup(buildBreadCrumbRegExp((currentFolder.children[0] as Node).name))
			).toBeVisible();
			expect.assertions(4);
		});

		test('Move action close the displayer if node is removed from the main list', async () => {
			const currentFolder = populateFolder();
			currentFolder.permissions.can_write_folder = true;
			currentFolder.permissions.can_write_file = true;
			const destinationFolder = populateFolder();
			destinationFolder.permissions.can_write_folder = true;
			destinationFolder.permissions.can_write_file = true;
			currentFolder.children.push(destinationFolder);
			const { path: parentPath } = populateParents(currentFolder);
			const node = populateNode();
			node.parent = currentFolder;
			node.permissions.can_write_folder = true;
			node.permissions.can_write_file = true;
			currentFolder.children.push(node);
			const path = [...parentPath, node];

			// prepare cache so that apollo client read data from the cache
			global.apolloClient.writeQuery<GetChildrenQuery, GetChildrenQueryVariables>({
				query: GET_CHILDREN,
				variables: getChildrenVariables(currentFolder.id),
				data: {
					getNode: currentFolder
				}
			});
			global.apolloClient.writeQuery<GetNodeQuery, GetNodeQueryVariables>({
				query: GET_NODE,
				variables: getNodeVariables(node.id),
				data: {
					getNode: node
				}
			});
			global.apolloClient.writeQuery<GetPathQuery, GetPathQueryVariables>({
				query: GET_PATH,
				variables: { node_id: node.id },
				data: {
					getPath: path
				}
			});
			const getNodeParentMockedQuery = mockGetParent({ node_id: node.id }, node);
			global.apolloClient.writeQuery<GetParentQuery, GetParentQueryVariables>({
				...getNodeParentMockedQuery.request,
				data: {
					getNode: node
				}
			});
			const getCurrentFolderParentMockedQuery = mockGetParent(
				{ node_id: currentFolder.id },
				currentFolder
			);
			global.apolloClient.writeQuery<GetParentQuery, GetParentQueryVariables>({
				...getCurrentFolderParentMockedQuery.request,
				data: {
					getNode: currentFolder
				}
			});
			const { getByTextWithMarkup, findByTextWithMarkup } = render(<FolderView />, {
				initialRouterEntries: [`/?folder=${currentFolder.id}&node=${node.id}`]
			});
			const displayer = await screen.findByTestId('displayer');
			expect(within(displayer).getAllByText(node.name)).toHaveLength(2);
			expect(getByTextWithMarkup(buildBreadCrumbRegExp(node.name))).toBeVisible();
			const showPathButton = screen.getByRole('button', { name: /show path/i });
			expect(showPathButton).toBeVisible();
			userEvent.click(showPathButton);
			const breadcrumbItem = await findByTextWithMarkup(
				buildBreadCrumbRegExp(...map(path, (parent) => parent.name))
			);
			expect(breadcrumbItem).toBeVisible();
			// right click to open contextual menu
			const nodeToMoveItem = within(screen.getByTestId(`list-${currentFolder.id}`)).getByText(
				node.name
			);
			fireEvent.contextMenu(nodeToMoveItem);
			await moveNode(destinationFolder);
			const snackbar = await screen.findByText(/item moved/i);
			await waitForElementToBeRemoved(snackbar);
			await screen.findByText(/view files and folders/i);
			expect(screen.queryByTestId(`node-item-${node.id}`)).not.toBeInTheDocument();
			expect(screen.queryAllByTestId('node-item-', { exact: false })).toHaveLength(
				currentFolder.children.length - 1
			);
			expect(screen.queryByText(/details/i)).not.toBeInTheDocument();
			expect(within(displayer).queryByText(node.name)).not.toBeInTheDocument();
			expect(
				screen.getByText(/View files and folders, share them with your contacts/i)
			).toBeVisible();
			expect.assertions(13);
		});
	});

	describe('Create docs files', () => {
		test('Create file options are disabled if current folder has not can_write_file permission', async () => {
			const currentFolder = populateFolder();
			currentFolder.permissions.can_write_file = false;
			// prepare cache so that apollo client read data from the cache
			global.apolloClient.writeQuery<GetPermissionsQuery, GetPermissionsQueryVariables>({
				query: GET_PERMISSIONS,
				variables: { node_id: currentFolder.id },
				data: {
					getNode: currentFolder
				}
			});
			// prepare cache so that apollo client read data from the cache
			const mockedGetChildrenQuery = mockGetChildren(
				getChildrenVariables(currentFolder.id),
				currentFolder
			);
			global.apolloClient.writeQuery<GetChildrenQuery, GetChildrenQueryVariables>({
				...mockedGetChildrenQuery.request,
				data: {
					getNode: currentFolder
				}
			});
			const mockedGetParentQuery = mockGetParent({ node_id: currentFolder.id }, currentFolder);
			global.apolloClient.writeQuery<GetParentQuery, GetParentQueryVariables>({
				...mockedGetParentQuery.request,
				data: {
					getNode: currentFolder
				}
			});

			render(<FolderView />, { initialRouterEntries: [`/?folder=${currentFolder.id}`] });

			await screen.findByText(/nothing here/i);
			expect(map(mockedCreateOptions, (createOption) => createOption.action({}))).toEqual(
				expect.arrayContaining([
					expect.objectContaining({ id: 'create-docs-document', disabled: true }),
					expect.objectContaining({ id: 'create-docs-spreadsheet', disabled: true }),
					expect.objectContaining({ id: 'create-docs-presentation', disabled: true })
				])
			);
			expect.assertions(1);
		});

		test('Create docs files options are active if current folder has can_write_file permission', async () => {
			const currentFolder = populateFolder();
			currentFolder.permissions.can_write_file = true;
			// prepare cache so that apollo client read data from the cache
			global.apolloClient.writeQuery<GetPermissionsQuery, GetPermissionsQueryVariables>({
				query: GET_PERMISSIONS,
				variables: { node_id: currentFolder.id },
				data: {
					getNode: currentFolder
				}
			});
			const mockedGetChildrenQuery = mockGetChildren(
				getChildrenVariables(currentFolder.id),
				currentFolder
			);
			global.apolloClient.writeQuery<GetChildrenQuery, GetChildrenQueryVariables>({
				...mockedGetChildrenQuery.request,
				data: {
					getNode: currentFolder
				}
			});
			const mockedGetParentQuery = mockGetParent({ node_id: currentFolder.id }, currentFolder);
			global.apolloClient.writeQuery<GetParentQuery, GetParentQueryVariables>({
				...mockedGetParentQuery.request,
				data: {
					getNode: currentFolder
				}
			});
			render(<FolderView />, { initialRouterEntries: [`/?folder=${currentFolder.id}`] });
			await screen.findByText(/nothing here/i);
			expect(map(mockedCreateOptions, (createOption) => createOption.action({}))).toEqual(
				expect.arrayContaining([
					expect.objectContaining({ id: 'create-docs-document', disabled: false }),
					expect.objectContaining({ id: 'create-docs-spreadsheet', disabled: false }),
					expect.objectContaining({ id: 'create-docs-presentation', disabled: false })
				])
			);
		});
		expect.assertions(1);
	});
});
