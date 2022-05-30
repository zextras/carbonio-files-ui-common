/*
 * SPDX-FileCopyrightText: 2022 Zextras <https://www.zextras.com>
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */
import React from 'react';

import { ApolloError } from '@apollo/client';
import {
	act,
	fireEvent,
	screen,
	waitFor,
	waitForElementToBeRemoved,
	within
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import find from 'lodash/find';
import forEach from 'lodash/forEach';
import map from 'lodash/map';

import { NODES_LOAD_LIMIT, NODES_SORT_DEFAULT } from '../../constants';
import GET_CHILDREN from '../../graphql/queries/getChildren.graphql';
import { populateFile, populateFolder, populateNodes, sortNodes } from '../../mocks/mockUtils';
import { Node } from '../../types/common';
import { Folder, GetChildrenQuery, GetChildrenQueryVariables } from '../../types/graphql/types';
import {
	getChildrenVariables,
	getFindNodesVariables,
	mockFindNodes,
	mockUpdateNode,
	mockUpdateNodeError
} from '../../utils/mockUtils';
import {
	actionRegexp,
	generateError,
	renameNode,
	render,
	selectNodes
} from '../../utils/testUtils';
import { addNodeInSortedList } from '../../utils/utils';
import FilterList from './FilterList';

describe('Filter List', () => {
	describe('Rename', () => {
		describe('Selection Mode', () => {
			test('Rename is disabled when multiple files are selected', async () => {
				const nodes = [];
				// enable permission to rename
				for (let i = 0; i < 2; i += 1) {
					const node = populateFile();
					node.permissions.can_write_file = true;
					nodes.push(node);
				}

				const mocks = [mockFindNodes(getFindNodesVariables({ flagged: true }), nodes)];

				render(<FilterList flagged />, { mocks });

				// wait for the load to be completed
				await waitForElementToBeRemoved(screen.queryByTestId('icon: Refresh'));

				// activate selection mode by selecting items
				selectNodes(map(nodes, (node) => node.id));
				// check that all wanted items are selected
				expect(screen.getAllByTestId('checkedAvatar')).toHaveLength(nodes.length);
				expect(screen.getByTestId('icon: MoreVertical')).toBeVisible();
				userEvent.click(screen.getByTestId('icon: MoreVertical'));
				const renameAction = await screen.findByText(actionRegexp.rename);
				expect(renameAction).toBeVisible();
				expect(renameAction).toHaveAttribute('disabled', '');
			});

			test('Rename is disabled if node does not have permissions', async () => {
				// disable permission to rename
				const node = populateFile();
				node.permissions.can_write_file = false;

				const mocks = [mockFindNodes(getFindNodesVariables({ flagged: true }), [node])];

				render(<FilterList flagged />, { mocks });

				// wait for the load to be completed
				await waitForElementToBeRemoved(screen.queryByTestId('icon: Refresh'));

				// activate selection mode by selecting items
				selectNodes([node.id]);
				// check that all wanted items are selected
				expect(screen.getByTestId('checkedAvatar')).toBeInTheDocument();
				expect(screen.getByTestId('icon: MoreVertical')).toBeVisible();
				userEvent.click(screen.getByTestId('icon: MoreVertical'));
				const renameAction = await screen.findByText(actionRegexp.rename);
				expect(renameAction).toBeVisible();
				expect(renameAction).toHaveAttribute('disabled', '');
			});

			test('Rename operation fail shows an error in the modal and does not close it', async () => {
				const nodes = populateNodes(3, 'Folder');
				// enable permission to rename
				forEach(nodes, (mockedNode) => {
					mockedNode.permissions.can_write_folder = true;
					mockedNode.flagged = true;
				});
				sortNodes(nodes, NODES_SORT_DEFAULT);

				// rename first element with name of the second one
				const element = nodes[0];
				const newName = nodes[1].name;

				const mocks = [
					mockFindNodes(getFindNodesVariables({ flagged: true }), nodes),
					mockUpdateNodeError(
						{
							node_id: element.id,
							name: newName
						},
						new ApolloError({ graphQLErrors: [generateError('Error! Name already assigned')] })
					)
				];

				render(<FilterList flagged />, { mocks });

				// wait for the load to be completed
				await waitForElementToBeRemoved(screen.queryByTestId('icon: Refresh'));

				// activate selection mode by selecting items
				selectNodes([element.id]);
				// check that all wanted items are selected
				expect(screen.getByTestId('checkedAvatar')).toBeInTheDocument();
				expect(screen.getByTestId('icon: MoreVertical')).toBeVisible();
				userEvent.click(screen.getByTestId('icon: MoreVertical'));
				await renameNode(newName);
				// following text is in the modal and in snackbar
				await waitFor(() =>
					expect(screen.getAllByText(/Error! Name already assigned/)).toHaveLength(2)
				);
				await waitFor(() =>
					// eslint-disable-next-line jest-dom/prefer-in-document
					expect(screen.getAllByText(/Error! Name already assigned/)).toHaveLength(1)
				);
				// when find only 1 occurrence means that snackbar is hidden
				const error = screen.getByText(/Error! Name already assigned/);
				expect(error).toBeVisible();
				const inputFieldDiv = screen.getByTestId('input-name');
				const inputField = within(inputFieldDiv).getByRole('textbox');
				expect(inputField).toBeVisible();
				expect(inputField).toHaveValue(newName);
			});

			test('Rename change node name and leave node at same position in the list', async () => {
				const nodes = populateNodes(5, 'Folder');
				// enable permission to rename
				forEach(nodes, (mockedNode) => {
					mockedNode.permissions.can_write_folder = true;
					mockedNode.flagged = true;
				});
				sortNodes(nodes, NODES_SORT_DEFAULT);

				// the element to rename is the first of the list
				const element = nodes[0];
				const lastElementName = nodes[nodes.length - 1].name;
				const newName = lastElementName.substring(0, lastElementName.length - 1);

				const mocks = [
					mockFindNodes(getFindNodesVariables({ flagged: true }), nodes),
					mockUpdateNode(
						{
							node_id: element.id,
							name: newName
						},
						{
							...element,
							name: newName
						}
					)
				];

				render(<FilterList flagged />, { mocks });

				// wait for the load to be completed
				await waitForElementToBeRemoved(screen.queryByTestId('icon: Refresh'));

				// activate selection mode by selecting items
				selectNodes([element.id]);
				// check that all wanted items are selected
				expect(screen.getByTestId('checkedAvatar')).toBeInTheDocument();
				expect(screen.getByTestId('icon: MoreVertical')).toBeVisible();
				userEvent.click(screen.getByTestId('icon: MoreVertical'));
				await renameNode(newName);
				// wait for the modal to be closed
				const inputFieldDiv = await screen.findByTestId('input-name');
				await waitForElementToBeRemoved(inputFieldDiv);
				// check the node. It should have the new name and be at same position
				const nodeItem = screen.getByTestId(`node-item-${element.id}`);
				expect(nodeItem).toBeVisible();
				expect(within(nodeItem).getByText(newName)).toBeVisible();
				const nodeItems = screen.getAllByTestId('node-item', { exact: false });
				expect(nodeItems).toHaveLength(nodes.length);
				expect(nodeItems[0]).toBe(nodeItem);
				// selection mode is de-activate
				expect(screen.queryByTestId('checkedAvatar')).not.toBeInTheDocument();
				expect(screen.queryByTestId('icon: MoreVertical')).not.toBeInTheDocument();
			});
		});

		describe('Contextual Menu', () => {
			test('right click on node open the contextual menu for the node, closing a previously opened one. Left click close it', async () => {
				const nodes = populateNodes(2);
				// set the node not flagged so that we can findNodes by flag action in the contextual menu of first node
				nodes[0].flagged = true;
				// set the second node flagged so that we can findNodes by unflag action in the contextual menu of second node
				nodes[1].flagged = true;

				const mocks = [mockFindNodes(getFindNodesVariables({ flagged: true }), nodes)];

				render(<FilterList flagged />, { mocks });

				// wait for the load to be completed
				await waitForElementToBeRemoved(screen.queryByTestId('icon: Refresh'));

				// right click to open contextual menu
				const node1Item = screen.getByTestId(`node-item-${nodes[0].id}`);
				const node2Item = screen.getByTestId(`node-item-${nodes[1].id}`);
				fireEvent.contextMenu(node1Item);
				// check that the flag action becomes visible (contextual menu of first node)
				const unflagAction1 = await screen.findByText(actionRegexp.unflag);
				expect(unflagAction1).toBeVisible();
				// right click on second node
				fireEvent.contextMenu(node2Item);
				// check that the unflag action becomes visible (contextual menu of second node)
				const unflagAction2 = await screen.findByText(actionRegexp.unflag);
				expect(unflagAction2).toBeVisible();
				// check that the flag action becomes invisible (contextual menu of first node is closed)
				expect(unflagAction1).not.toBeInTheDocument();
				// left click close all the contextual menu
				act(() => {
					userEvent.click(node2Item);
				});
				expect(unflagAction2).not.toBeInTheDocument();
				expect(unflagAction1).not.toBeInTheDocument();
			});

			test('Rename is disabled if node does not have permissions', async () => {
				const node = populateFile();
				node.permissions.can_write_file = false;

				const mocks = [mockFindNodes(getFindNodesVariables({ flagged: true }), [node])];

				render(<FilterList flagged />, { mocks });

				// wait for the load to be completed
				await waitForElementToBeRemoved(screen.queryByTestId('icon: Refresh'));

				// right click to open contextual menu
				const nodeItem = screen.getByTestId(`node-item-${node.id}`);
				fireEvent.contextMenu(nodeItem);
				const renameAction = await screen.findByText(actionRegexp.rename);
				expect(renameAction).toBeVisible();
				expect(renameAction).toHaveAttribute('disabled', '');
			});

			test('Rename change node name and leave node at same position in the list', async () => {
				const nodes = populateNodes(5, 'File');
				// enable permission to rename
				forEach(nodes, (mockedNode) => {
					mockedNode.permissions.can_write_file = true;
					mockedNode.flagged = true;
				});
				sortNodes(nodes, NODES_SORT_DEFAULT);

				// the element to rename is the second of the list
				const element = nodes[1];
				const lastElementName = nodes[nodes.length - 1].name;
				const newName = lastElementName.substring(0, lastElementName.length - 1);

				const mocks = [
					mockFindNodes(getFindNodesVariables({ flagged: true }), nodes),
					mockUpdateNode(
						{
							node_id: element.id,
							name: newName
						},
						{
							...element,
							name: newName
						}
					)
				];

				render(<FilterList flagged />, { mocks });

				// wait for the load to be completed
				await waitForElementToBeRemoved(screen.queryByTestId('icon: Refresh'));

				// right click to open contextual menu
				const nodeItem = screen.getByTestId(`node-item-${element.id}`);
				// open context menu
				fireEvent.contextMenu(nodeItem);
				await renameNode(newName);
				const inputFieldDiv = await screen.findByTestId('input-name');
				// wait that the modal close
				await waitForElementToBeRemoved(inputFieldDiv);
				// check the new item. It has the new name and its located at same position
				const updatedNodeItem = screen.getByTestId(`node-item-${element.id}`);
				expect(updatedNodeItem).toBeVisible();
				expect(within(updatedNodeItem).getByText(newName)).toBeVisible();
				const nodeItems = screen.getAllByTestId('node-item', { exact: false });
				expect(nodeItems).toHaveLength(nodes.length);
				// element should be the second last in the list
				expect(nodeItems[1]).toBe(updatedNodeItem);
				// contextual menu is closed
				expect(screen.queryByText(actionRegexp.rename)).not.toBeInTheDocument();
			});

			test('Rename a node already loaded in a folder change position of the node in the folder from ordered to unordered', async () => {
				// nodes shown in the filter, only one page
				const currentFilter = populateNodes(NODES_LOAD_LIMIT - 1, 'Folder');
				// the element to rename is the first of the list
				// its new position is going to be the same for the filter view,
				// while in the parent folder it will be positioned in the unordered elements at the end of the list
				const timestamp = Date.now();
				const element = currentFilter[0];
				const newName = `${element.name}-${timestamp}`;
				// nodes of the folder already cached from a previous navigation (1 page of n)
				const parentFolder = populateFolder(NODES_LOAD_LIMIT - 1);
				// put element as first node of the folder
				parentFolder.children.unshift(element);
				// enable permission to rename
				parentFolder.permissions.can_write_folder = true;
				element.permissions.can_write_folder = true;

				// prepare the cache with the parent folder as if already loaded
				global.apolloClient.cache.writeQuery<GetChildrenQuery, GetChildrenQueryVariables>({
					query: GET_CHILDREN,
					variables: getChildrenVariables(parentFolder.id),
					data: {
						getNode: parentFolder
					}
				});

				const newPosition = addNodeInSortedList(
					parentFolder.children,
					{ ...element, name: newName },
					NODES_SORT_DEFAULT
				);

				const mocks = [
					mockFindNodes(getFindNodesVariables({ flagged: true }), currentFilter),
					mockUpdateNode(
						{
							node_id: element.id,
							name: newName
						},
						{
							...element,
							name: newName,
							// update mutation return also the parent
							parent: parentFolder
						}
					)
				];

				render(<FilterList flagged />, { mocks });

				// wait for the load to be completed
				await waitForElementToBeRemoved(screen.queryByTestId('icon: Refresh'));

				// check the position of the node to update in the cached parent folder
				// load two pages even if only one should be written in cache
				let parentFolderData = global.apolloClient.cache.readQuery<
					GetChildrenQuery,
					GetChildrenQueryVariables
				>({
					query: GET_CHILDREN,
					variables: getChildrenVariables(parentFolder.id, NODES_LOAD_LIMIT * 2)
				});
				expect(parentFolderData?.getNode).toBeDefined();
				expect(parentFolderData?.getNode).not.toBeNull();
				expect((parentFolderData?.getNode as Folder).children).toHaveLength(NODES_LOAD_LIMIT);
				expect(((parentFolderData?.getNode as Folder).children[0] as Node).id).toBe(element.id);
				// right click to open contextual menu
				const nodeItem = screen.getByTestId(`node-item-${element.id}`);
				// open context menu
				fireEvent.contextMenu(nodeItem);
				await renameNode(newName);
				// wait that the modal close
				const inputFieldDiv = await screen.findByTestId('input-name');
				await waitForElementToBeRemoved(inputFieldDiv);
				// check the new item. It has the new name and it is at same position in the filter list
				const updatedNodeItem = screen.getByTestId(`node-item-${element.id}`);
				expect(updatedNodeItem).toBeVisible();
				expect(within(updatedNodeItem).getByText(newName)).toBeVisible();
				const nodes = screen.getAllByTestId('node-item', { exact: false });
				expect(nodes).toHaveLength(currentFilter.length);
				expect(nodes[0]).toBe(updatedNodeItem);
				// check that in the parent folder the node has changed its position to last position
				parentFolderData = global.apolloClient.cache.readQuery<
					GetChildrenQuery,
					GetChildrenQueryVariables
				>({
					query: GET_CHILDREN,
					variables: getChildrenVariables(parentFolder.id, NODES_LOAD_LIMIT * 2)
				});
				expect((parentFolderData?.getNode as Folder).children).toHaveLength(
					parentFolder.children.length
				);
				// element is moved at its new position ( -1 because it is also remove from its previous position)
				expect(((parentFolderData?.getNode as Folder).children[newPosition - 1] as Node).id).toBe(
					element.id
				);
				expect(((parentFolderData?.getNode as Folder).children[newPosition - 1] as Node).name).toBe(
					newName
				);
			});

			test('Rename a node with a parent folder already partially loaded, where node is not loaded yet, add node in cached children of the parent folder', async () => {
				// nodes shown in the filter, only one page
				const currentFilter = populateNodes(NODES_LOAD_LIMIT - 1, 'Folder');
				// the element to rename is the last of the filter list
				// its new position is going to be the same for the filter view,
				// while in the parent folder it will be positioned as first element of the ordered list
				const element = currentFilter[currentFilter.length - 1];
				// nodes of the folder already cached from a previous navigation (1 page of n)
				// node is not present in the cached children of the folder
				const parentFolder = populateFolder(NODES_LOAD_LIMIT);
				// enable permission to rename
				parentFolder.permissions.can_write_folder = true;
				element.permissions.can_write_folder = true;
				// new name set to put element as first element in folder
				const newName = (parentFolder.children[0] as Node).name.substring(
					0,
					(parentFolder.children[0] as Node).name.length - 1
				);

				// prepare the cache with the parent folder as if already loaded
				global.apolloClient.cache.writeQuery<GetChildrenQuery, GetChildrenQueryVariables>({
					query: GET_CHILDREN,
					variables: getChildrenVariables(parentFolder.id),
					data: {
						getNode: parentFolder
					}
				});

				const mocks = [
					mockFindNodes(getFindNodesVariables({ flagged: true }), currentFilter),
					mockUpdateNode(
						{
							node_id: element.id,
							name: newName
						},
						{
							...element,
							name: newName,
							// update mutation return also the parent
							parent: parentFolder
						}
					)
				];

				render(<FilterList flagged />, { mocks });

				// wait for the load to be completed
				await waitForElementToBeRemoved(screen.queryByTestId('icon: Refresh'));

				// check the position of the node to update in the cached parent folder
				// load two pages even if only one should be written in cache
				let parentFolderData = global.apolloClient.cache.readQuery<
					GetChildrenQuery,
					GetChildrenQueryVariables
				>({
					query: GET_CHILDREN,
					variables: getChildrenVariables(parentFolder.id, NODES_LOAD_LIMIT * 2)
				});
				expect(parentFolderData?.getNode).toBeDefined();
				expect(parentFolderData?.getNode).not.toBeNull();
				expect((parentFolderData?.getNode as Folder).children).toHaveLength(NODES_LOAD_LIMIT);
				// element is not present in the cache
				expect(
					find(
						(parentFolderData?.getNode as Folder).children,
						(child) => (child as Node).id === element.id
					)
				).toBe(undefined);
				// right click to open contextual menu
				const nodeItem = screen.getByTestId(`node-item-${element.id}`);
				// open context menu
				fireEvent.contextMenu(nodeItem);
				await renameNode(newName);
				// wait that the modal close
				const inputFieldDiv = await screen.findByTestId('input-name');
				await waitForElementToBeRemoved(inputFieldDiv);
				// check the new item. It has the new name and its located at same position
				const updatedNodeItem = screen.getByTestId(`node-item-${element.id}`);
				expect(updatedNodeItem).toBeVisible();
				expect(within(updatedNodeItem).getByText(newName)).toBeVisible();
				const nodes = screen.getAllByTestId('node-item', { exact: false });
				expect(nodes).toHaveLength(currentFilter.length);
				expect(nodes[nodes.length - 1]).toBe(updatedNodeItem);
				// check that in the parent folder the node has changed its position to first position
				parentFolderData = global.apolloClient.cache.readQuery<
					GetChildrenQuery,
					GetChildrenQueryVariables
				>({
					query: GET_CHILDREN,
					variables: getChildrenVariables(parentFolder.id, NODES_LOAD_LIMIT * 2)
				});
				// cached folder has 1 element more than the initial children list
				expect((parentFolderData?.getNode as Folder).children).toHaveLength(
					parentFolder.children.length + 1
				);
				expect(((parentFolderData?.getNode as Folder).children[0] as Node).id).toBe(element.id);
				expect(((parentFolderData?.getNode as Folder).children[0] as Node).name).toBe(newName);
			});
		});
	});
});
