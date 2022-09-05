/*
 * SPDX-FileCopyrightText: 2022 Zextras <https://www.zextras.com>
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */
import React from 'react';

import { act, fireEvent, screen, waitForElementToBeRemoved, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import forEach from 'lodash/forEach';
import map from 'lodash/map';

import GET_CHILDREN from '../../graphql/queries/getChildren.graphql';
import {
	populateFile,
	populateFolder,
	populateNode,
	populateNodePage,
	populateNodes,
	populateParents
} from '../../mocks/mockUtils';
import { Folder, GetChildrenQuery, GetChildrenQueryVariables } from '../../types/graphql/types';
import {
	getChildrenVariables,
	getFindNodesVariables,
	mockFindNodes,
	mockGetChildren,
	mockGetPath,
	mockMoveNodes
} from '../../utils/mockUtils';
import {
	actionRegexp,
	buildBreadCrumbRegExp,
	iconRegexp,
	render,
	selectNodes
} from '../../utils/testUtils';
import FilterList from './FilterList';

describe('Filter List', () => {
	describe('Move', () => {
		describe('Selection Mode', () => {
			test('Move is disabled if node has not permissions', async () => {
				const currentFilter = [];
				const file = populateFile();
				file.permissions.can_write_file = false;
				file.parent = populateFolder();
				file.parent.permissions.can_write_file = true;
				const folder = populateFolder();
				folder.permissions.can_write_folder = false;
				folder.parent = populateFolder();
				folder.parent.permissions.can_write_folder = true;
				const node = populateNode();
				node.permissions.can_write_folder = true;
				node.permissions.can_write_file = true;
				node.parent = populateFolder();
				node.parent.permissions.can_write_folder = true;
				node.parent.permissions.can_write_file = true;
				currentFilter.push(file, folder, node);

				const mocks = [mockFindNodes(getFindNodesVariables({ flagged: true }), currentFilter)];

				render(<FilterList flagged />, { mocks });

				await screen.findByText(file.name);
				// activate selection mode by selecting items
				selectNodes([file.id]);
				// check that all wanted items are selected
				expect(screen.getByTestId('checkedAvatar')).toBeInTheDocument();
				expect(screen.getByTestId('icon: MoreVertical')).toBeVisible();
				userEvent.click(screen.getByTestId('icon: MoreVertical'));
				await screen.findByText(actionRegexp.copy);
				expect(screen.queryByText(actionRegexp.move)).not.toBeInTheDocument();
				// activate selection mode by selecting items
				selectNodes([file.id, folder.id]);
				// check that all wanted items are selected
				expect(screen.getByTestId('checkedAvatar')).toBeInTheDocument();
				expect(screen.queryByTestId('icon: MoreVertical')).not.toBeInTheDocument();
				expect(screen.queryByTestId(iconRegexp.move)).not.toBeInTheDocument();
				// activate selection mode by selecting items
				selectNodes([folder.id, node.id]);
				// check that all wanted items are selected
				expect(screen.getByTestId('checkedAvatar')).toBeInTheDocument();
				expect(screen.getByTestId('icon: MoreVertical')).toBeVisible();
				userEvent.click(screen.getByTestId('icon: MoreVertical'));
				expect(await screen.findByText(actionRegexp.move)).toBeInTheDocument();
			});

			test('Move is disabled when multiple files are selected', async () => {
				const currentFilter = [];
				const parent = populateFolder();
				const file = populateFile();
				file.permissions.can_write_file = true;
				file.parent = parent;
				const folder = populateFolder();
				folder.permissions.can_write_folder = true;
				folder.parent = parent;
				currentFilter.push(file, folder);

				const mocks = [mockFindNodes(getFindNodesVariables({ flagged: true }), currentFilter)];

				render(<FilterList flagged />, { mocks });

				await screen.findByText(file.name);
				selectNodes([file.id, folder.id]);

				// check that all wanted items are selected
				expect(screen.getAllByTestId('checkedAvatar')).toHaveLength(2);
				expect(screen.queryByText(iconRegexp.move)).not.toBeInTheDocument();
				// TODO improve when popper selector will be available
			});

			test('Move is disabled if node has no parent or parent has not right permissions', async () => {
				const currentFilter = [];
				const file = populateFile();
				file.permissions.can_write_file = true;
				file.parent = populateFolder();
				file.parent.permissions.can_write_file = false;
				const folder = populateFolder();
				folder.permissions.can_write_folder = true;
				folder.parent = populateFolder();
				folder.parent.permissions.can_write_folder = false;
				const node = populateNode();
				node.permissions.can_write_folder = true;
				node.permissions.can_write_file = true;
				node.parent = null;
				currentFilter.push(file, folder, node);

				const mocks = [mockFindNodes(getFindNodesVariables({ flagged: true }), currentFilter)];

				render(<FilterList flagged />, { mocks });

				await screen.findByText(file.name);
				// activate selection mode by selecting items
				selectNodes([file.id]);
				// check that all wanted items are selected
				expect(screen.getByTestId('checkedAvatar')).toBeInTheDocument();
				expect(screen.getByTestId('icon: MoreVertical')).toBeVisible();
				userEvent.click(screen.getByTestId('icon: MoreVertical'));

				await screen.findByText(actionRegexp.copy);

				expect(screen.queryByText(actionRegexp.move)).not.toBeInTheDocument();
				expect(screen.queryByTestId(iconRegexp.move)).not.toBeInTheDocument();
				// activate selection mode by selecting items
				selectNodes([file.id, folder.id]);
				// check that all wanted items are selected
				expect(screen.getByTestId('checkedAvatar')).toBeInTheDocument();
				expect(screen.getByTestId('icon: MoreVertical')).toBeVisible();
				userEvent.click(screen.getByTestId('icon: MoreVertical'));

				await screen.findByText(actionRegexp.moveToTrash);
				expect(screen.queryByText(actionRegexp.move)).not.toBeInTheDocument();
				expect(screen.queryByTestId(iconRegexp.move)).not.toBeInTheDocument();

				// activate selection mode by selecting items
				selectNodes([folder.id, node.id]);
				// check that all wanted items are selected
				expect(screen.getByTestId('checkedAvatar')).toBeInTheDocument();
				expect(screen.getByTestId('icon: MoreVertical')).toBeVisible();
				userEvent.click(screen.getByTestId('icon: MoreVertical'));
				await screen.findByText(actionRegexp.moveToTrash);
				expect(screen.queryByText(actionRegexp.move)).not.toBeInTheDocument();
				expect(screen.queryByTestId(iconRegexp.move)).not.toBeInTheDocument();
			});

			test('Move open modal showing parent folder content. Confirm action close the modal, leave moved items in filter list and clear cached data for destination folder', async () => {
				const currentFilter = populateNodes(5);
				const destinationFolder = populateFolder();
				destinationFolder.permissions.can_write_folder = true;
				destinationFolder.permissions.can_write_file = true;
				currentFilter.push(destinationFolder);
				const { node: nodeToMove, path } = populateParents(currentFilter[0], 2, true);
				forEach(path, (mockedNode) => {
					mockedNode.permissions.can_write_folder = true;
					mockedNode.permissions.can_write_file = true;
				});
				nodeToMove.permissions.can_write_folder = true;
				nodeToMove.permissions.can_write_file = true;
				const parentFolder = nodeToMove.parent as Folder;
				parentFolder.children = populateNodePage([nodeToMove, destinationFolder]);
				destinationFolder.parent = parentFolder;

				// write destination folder in cache as if it was already loaded
				global.apolloClient.writeQuery<GetChildrenQuery, GetChildrenQueryVariables>({
					query: GET_CHILDREN,
					variables: getChildrenVariables(destinationFolder.id),
					data: {
						getNode: destinationFolder
					}
				});
				const mocks = [
					mockFindNodes(getFindNodesVariables({ flagged: true }), currentFilter),
					mockGetPath({ node_id: parentFolder.id }, path.slice(0, path.length - 1)),
					mockGetChildren(getChildrenVariables(parentFolder.id), parentFolder),
					mockMoveNodes(
						{
							node_ids: [nodeToMove.id],
							destination_id: destinationFolder.id
						},
						[{ ...nodeToMove, parent: destinationFolder }]
					)
				];

				const { getByTextWithMarkup, findByTextWithMarkup } = render(<FilterList flagged />, {
					mocks
				});

				await screen.findByText(nodeToMove.name);

				let destinationFolderCachedData = global.apolloClient.readQuery<
					GetChildrenQuery,
					GetChildrenQueryVariables
				>({
					query: GET_CHILDREN,
					variables: getChildrenVariables(destinationFolder.id)
				});

				expect(destinationFolderCachedData?.getNode || null).not.toBeNull();
				expect((destinationFolderCachedData?.getNode as Folder).id).toBe(destinationFolder.id);

				// activate selection mode by selecting items
				selectNodes([nodeToMove.id]);
				// check that all wanted items are selected
				expect(screen.getByTestId('checkedAvatar')).toBeInTheDocument();
				expect(screen.getByTestId('icon: MoreVertical')).toBeVisible();
				userEvent.click(screen.getByTestId('icon: MoreVertical'));
				const moveAction = await screen.findByText(actionRegexp.move);
				expect(moveAction).toBeVisible();
				userEvent.click(moveAction);

				const modalList = await screen.findByTestId(`modal-list-${parentFolder.id}`);
				const destinationFolderItem = await within(modalList).findByText(destinationFolder.name);
				const breadcrumbRegexp = buildBreadCrumbRegExp(
					...map(path.slice(0, path.length - 1), (node) => node.name)
				);
				await findByTextWithMarkup(breadcrumbRegexp);
				expect(getByTextWithMarkup(breadcrumbRegexp)).toBeVisible();

				userEvent.click(destinationFolderItem);
				expect(screen.getByRole('button', { name: actionRegexp.move })).not.toHaveAttribute(
					'disabled',
					''
				);
				act(() => {
					userEvent.click(screen.getByRole('button', { name: actionRegexp.move }));
				});
				await waitForElementToBeRemoved(screen.queryByRole('button', { name: actionRegexp.move }));
				const snackbar = await screen.findByText(/item moved/i);
				await waitForElementToBeRemoved(snackbar);
				expect(screen.queryByRole('button', { name: actionRegexp.move })).not.toBeInTheDocument();
				// exit selection mode
				expect(screen.queryByTestId('checkedAvatar')).not.toBeInTheDocument();

				expect(screen.queryAllByTestId('node-item', { exact: false })).toHaveLength(
					currentFilter.length
				);

				destinationFolderCachedData = global.apolloClient.readQuery<
					GetChildrenQuery,
					GetChildrenQueryVariables
				>({
					query: GET_CHILDREN,
					variables: getChildrenVariables(destinationFolder.id)
				});

				expect(destinationFolderCachedData).toBeNull();
			});
		});

		describe('Contextual Menu', () => {
			test('Move is disabled if node has not permissions', async () => {
				const currentFilter = [];
				const file = populateFile();
				file.permissions.can_write_file = false;
				file.parent = populateFolder();
				file.parent.permissions.can_write_file = true;
				const folder = populateFolder();
				folder.permissions.can_write_folder = false;
				folder.parent = populateFolder();
				folder.parent.permissions.can_write_folder = true;
				const node = populateNode();
				node.permissions.can_write_folder = true;
				node.permissions.can_write_file = true;
				node.parent = populateFolder();
				node.parent.permissions.can_write_folder = true;
				node.parent.permissions.can_write_file = true;
				currentFilter.push(file, folder, node);

				const mocks = [mockFindNodes(getFindNodesVariables({ flagged: true }), currentFilter)];

				render(<FilterList flagged />, { mocks });

				// right click to open contextual menu on file without permission
				const fileItem = await screen.findByText(file.name);
				fireEvent.contextMenu(fileItem);
				await screen.findByText(actionRegexp.manageShares);

				expect(screen.queryByText(actionRegexp.move)).not.toBeInTheDocument();

				// right click to open contextual menu on folder without permission
				const folderItem = await screen.findByText(folder.name);
				fireEvent.contextMenu(folderItem);

				await screen.findByText(actionRegexp.manageShares);

				expect(screen.queryByText(actionRegexp.move)).not.toBeInTheDocument();

				// right click to open contextual menu on node with permission
				const nodeItem = await screen.findByText(node.name);
				fireEvent.contextMenu(nodeItem);
				const moveAction = await screen.findByText(actionRegexp.move);
				expect(moveAction).toBeVisible();
				expect(moveAction).not.toHaveAttribute('disabled', '');
			});

			test('Move open modal showing parent folder content. Confirm action close the modal, leave moved items in filter list and clear cached data for destination folder', async () => {
				const currentFilter = populateNodes(5);
				const destinationFolder = populateFolder();
				destinationFolder.permissions.can_write_folder = true;
				destinationFolder.permissions.can_write_file = true;
				currentFilter.push(destinationFolder);
				const { node: nodeToMove, path } = populateParents(currentFilter[0], 2, true);
				forEach(path, (mockedNode) => {
					mockedNode.permissions.can_write_file = true;
					mockedNode.permissions.can_write_folder = true;
				});
				nodeToMove.permissions.can_write_folder = true;
				nodeToMove.permissions.can_write_file = true;
				const parentFolder = nodeToMove.parent as Folder;
				parentFolder.children = populateNodePage([nodeToMove, destinationFolder]);

				// write destination folder in cache as if it was already loaded
				global.apolloClient.writeQuery<GetChildrenQuery, GetChildrenQueryVariables>({
					query: GET_CHILDREN,
					variables: getChildrenVariables(destinationFolder.id),
					data: {
						getNode: destinationFolder
					}
				});
				const mocks = [
					mockFindNodes(getFindNodesVariables({ flagged: true }), currentFilter),
					mockGetPath({ node_id: parentFolder.id }, path.slice(0, path.length - 1)),
					mockGetChildren(getChildrenVariables(parentFolder.id), parentFolder),
					mockMoveNodes(
						{
							node_ids: [nodeToMove.id],
							destination_id: destinationFolder.id
						},
						[{ ...nodeToMove, parent: destinationFolder }]
					)
				];

				const { getByTextWithMarkup, findByTextWithMarkup } = render(<FilterList flagged />, {
					mocks
				});

				await screen.findByText(nodeToMove.name);

				let destinationFolderCachedData = global.apolloClient.readQuery<
					GetChildrenQuery,
					GetChildrenQueryVariables
				>({
					query: GET_CHILDREN,
					variables: getChildrenVariables(destinationFolder.id)
				});

				expect(destinationFolderCachedData?.getNode || null).not.toBeNull();
				expect((destinationFolderCachedData?.getNode as Folder).id).toBe(destinationFolder.id);

				// right click to open contextual menu on folder
				const nodeToMoveItem = await screen.findByText(nodeToMove.name);
				fireEvent.contextMenu(nodeToMoveItem);
				const moveAction = await screen.findByText(actionRegexp.move);
				expect(moveAction).toBeVisible();
				userEvent.click(moveAction);

				const modalList = await screen.findByTestId(`modal-list-${parentFolder.id}`);
				const destinationFolderItem = await within(modalList).findByText(destinationFolder.name);
				const breadcrumbRegexp = buildBreadCrumbRegExp(
					...map(path.slice(0, path.length - 1), (node) => node.name)
				);
				await findByTextWithMarkup(breadcrumbRegexp);
				expect(getByTextWithMarkup(breadcrumbRegexp)).toBeVisible();

				userEvent.click(destinationFolderItem);
				expect(screen.getByRole('button', { name: actionRegexp.move })).not.toHaveAttribute(
					'disabled',
					''
				);
				act(() => {
					userEvent.click(screen.getByRole('button', { name: actionRegexp.move }));
				});
				await waitForElementToBeRemoved(screen.queryByRole('button', { name: actionRegexp.move }));
				const snackbar = await screen.findByText(/item moved/i);
				await waitForElementToBeRemoved(snackbar);
				expect(screen.queryByRole('button', { name: actionRegexp.move })).not.toBeInTheDocument();
				// context menu is closed
				expect(screen.queryByText(actionRegexp.move)).not.toBeInTheDocument();

				expect(screen.queryAllByTestId('node-item', { exact: false })).toHaveLength(
					currentFilter.length
				);

				destinationFolderCachedData = global.apolloClient.readQuery<
					GetChildrenQuery,
					GetChildrenQueryVariables
				>({
					query: GET_CHILDREN,
					variables: getChildrenVariables(destinationFolder.id)
				});

				expect(destinationFolderCachedData).toBeNull();
			});
		});
	});
});
