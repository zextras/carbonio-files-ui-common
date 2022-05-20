/*
 * SPDX-FileCopyrightText: 2022 Zextras <https://www.zextras.com>
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import React from 'react';

import { fireEvent, screen, waitForElementToBeRemoved, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import findIndex from 'lodash/findIndex';
import forEach from 'lodash/forEach';
import last from 'lodash/last';
import map from 'lodash/map';

import { CreateOptionsContent } from '../../hooks/useCreateOptions';
import { nodeListCursorVar } from '../apollo/nodeListCursorVar';
import { NODES_LOAD_LIMIT, NODES_SORT_DEFAULT } from '../constants';
import { populateFolder, populateNodes, sortNodes } from '../mocks/mockUtils';
import { Node } from '../types/common';
import { Folder } from '../types/graphql/types';
import {
	getChildrenVariables,
	mockGetChildren,
	mockGetParent,
	mockTrashNodes,
	mockUpdateNode
} from '../utils/mockUtils';
import { actionRegexp, renameNode, render, selectNodes, triggerLoadMore } from '../utils/testUtils';
import { DisplayerProps } from './components/Displayer';
import FolderView from './FolderView';

jest.mock('../../hooks/useCreateOptions', () => ({
	useCreateOptions: (): CreateOptionsContent => ({
		setCreateOptions: jest.fn(),
		removeCreateOptions: jest.fn()
	})
}));

jest.mock('./components/Displayer', () => ({
	Displayer: (props: DisplayerProps): JSX.Element => (
		<div data-testid="map">
			{props.translationKey}:{props.icons}
		</div>
	)
}));

describe('Rename', () => {
	function getCachedCursor(folder: { id: string }): string | null | undefined {
		const cursor = nodeListCursorVar()[folder.id];
		if (cursor) {
			return cursor.__ref.split(':')[1];
		}
		return cursor;
	}

	describe('Selection mode', () => {
		test('Rename change node name and update the content of the folder, showing the element at its new position', async () => {
			const currentFolder = populateFolder();
			currentFolder.children = populateNodes(5, 'Folder');
			sortNodes(currentFolder.children, NODES_SORT_DEFAULT);
			// enable permission to rename
			forEach(currentFolder.children, (mockedNode) => {
				(mockedNode as Node).permissions.can_write_file = true;
				(mockedNode as Node).permissions.can_write_folder = true;
				(mockedNode as Node).parent = currentFolder;
			});

			// the element to rename is the first of the list. To assure that it changes position,
			// the new name of the node is going to be the name of the last ordered element with the timestamp at the end
			const timestamp = Date.now();
			const element = currentFolder.children[0] as Node;
			const newName = `${
				(currentFolder.children[currentFolder.children.length - 1] as Node).name
			}-${timestamp}`;

			const newPos = currentFolder.children.length - 1;

			const mocks = [
				mockGetChildren(getChildrenVariables(currentFolder.id), currentFolder),
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

			render(<FolderView />, { initialRouterEntries: [`/?folder=${currentFolder.id}`], mocks });

			// wait for the load to be completed
			await waitForElementToBeRemoved(screen.queryByTestId('icon: Refresh'));

			// activate selection mode by selecting items
			selectNodes([element.id]);
			// check that all wanted items are selected
			expect(screen.getByTestId('checkedAvatar')).toBeInTheDocument();
			expect(screen.getByTestId('icon: MoreVertical')).toBeVisible();
			userEvent.click(screen.getByTestId('icon: MoreVertical'));
			// check that the rename action becomes visible
			await renameNode(newName);
			// wait for the modal to be closed
			await waitForElementToBeRemoved(screen.queryByTestId('input-name'));
			// check the node. It should have the new name and be at the end of the updated list
			const nodeItem = screen.getByTestId(`node-item-${element.id}`);
			expect(nodeItem).toBeVisible();
			expect(within(nodeItem).getByText(newName)).toBeVisible();
			const nodes = screen.getAllByTestId('node-item', { exact: false });
			expect(nodes).toHaveLength(currentFolder.children.length);
			expect(nodes[newPos]).toBe(screen.getByTestId(`node-item-${element.id}`));
			// selection mode is de-activate
			expect(screen.queryByTestId('checkedAvatar')).not.toBeInTheDocument();
			expect(screen.queryByTestId('icon: MoreVertical')).not.toBeInTheDocument();
			expect.assertions(9);
		});
	});

	describe('Contextual menu actions', () => {
		test('Rename change node name and update the content of the folder, showing the element at its new position', async () => {
			const currentFolder = populateFolder();
			currentFolder.children = populateNodes(5, 'Folder');
			// enable permission to rename
			forEach(currentFolder.children, (mockedNode) => {
				(mockedNode as Node).permissions.can_write_file = true;
				(mockedNode as Node).permissions.can_write_folder = true;
				(mockedNode as Node).parent = currentFolder;
			});
			sortNodes(currentFolder.children, NODES_SORT_DEFAULT);

			// the element to rename is the first of the list. To assure that it changes position,
			// the new name of the node is going to be the name of the last ordered element with the timestamp at the end
			const timestamp = Date.now();
			const element = currentFolder.children[0] as Node;
			const newName = `${
				(currentFolder.children[currentFolder.children.length - 1] as Node).name
			}-${timestamp}`;

			const mocks = [
				mockGetChildren(getChildrenVariables(currentFolder.id), currentFolder),
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

			render(<FolderView />, { initialRouterEntries: [`/?folder=${currentFolder.id}`], mocks });

			// wait for the load to be completed
			await waitForElementToBeRemoved(screen.queryByTestId('icon: Refresh'));

			// right click to open contextual menu
			const nodeItem = screen.getByTestId(`node-item-${element.id}`);
			// open context menu
			fireEvent.contextMenu(nodeItem);
			await renameNode(newName);
			// wait for the modal to be closed
			await waitForElementToBeRemoved(screen.queryByTestId('input-name'));
			// check the new item. It has the new name and its located as last element of the updated list
			const updatedNodeItem = screen.getByTestId(`node-item-${element.id}`);
			expect(updatedNodeItem).toBeVisible();
			expect(within(updatedNodeItem).getByText(newName)).toBeVisible();
			const nodes = screen.getAllByTestId('node-item', { exact: false });
			expect(nodes).toHaveLength(currentFolder.children.length);
			expect(nodes[nodes.length - 1]).toBe(updatedNodeItem);
			// contextual menu is closed
			expect(screen.queryByText(actionRegexp.rename)).not.toBeInTheDocument();
		});

		test('Rename a node to an unordered position does not change cursor for pagination', async () => {
			// folder with 3 pages
			const currentFolder = populateFolder();
			currentFolder.children = populateNodes(NODES_LOAD_LIMIT * 3, 'File');
			sortNodes(currentFolder.children, NODES_SORT_DEFAULT);
			// enable permission to rename
			currentFolder.permissions.can_write_folder = true;
			forEach(currentFolder.children, (mockedNode) => {
				(mockedNode as Node).permissions.can_write_file = true;
				(mockedNode as Node).permissions.can_write_folder = true;
				(mockedNode as Node).parent = { ...currentFolder, children: [] } as Folder;
			});

			// the element to rename is the first of the list. New position is third position of third page
			const timestamp = Date.now();
			const element = currentFolder.children[0] as Node;
			const newName = `${
				(currentFolder.children[NODES_LOAD_LIMIT * 2 + 2] as Node).name
			}-${timestamp}`;

			// the cursor is last element of first page and does not change after rename
			const firstCursor = currentFolder.children[NODES_LOAD_LIMIT - 1] as Node;

			// second page does not change after rename
			const secondPage = currentFolder.children.slice(
				NODES_LOAD_LIMIT,
				NODES_LOAD_LIMIT * 2
			) as Node[];

			const secondCursor = secondPage[secondPage.length - 1] as Node;

			// third page has also the renamed element
			let thirdPage = currentFolder.children.slice(NODES_LOAD_LIMIT * 2) as Node[];
			// add the renamed node at third position
			thirdPage.splice(2, 0, { ...element, name: newName });
			// then resize third page to contain only NODES_LOAD_LIMIT elements
			thirdPage = thirdPage.slice(0, NODES_LOAD_LIMIT);

			const thirdCursor = thirdPage[thirdPage.length - 1];

			const mocks = [
				mockGetChildren(getChildrenVariables(currentFolder.id), {
					...currentFolder,
					children: currentFolder.children.slice(0, NODES_LOAD_LIMIT)
				} as Folder),
				mockUpdateNode(
					{
						node_id: element.id,
						name: newName
					},
					{
						...element,
						name: newName
					}
				),
				// second page request
				mockGetChildren(
					{
						...getChildrenVariables(currentFolder.id),
						cursor: firstCursor.id
					},
					{
						...currentFolder,
						children: secondPage
					} as Folder
				),
				// third page request
				mockGetChildren(
					{
						...getChildrenVariables(currentFolder.id),
						cursor: secondCursor.id
					},
					{
						...currentFolder,
						children: thirdPage
					} as Folder
				),
				// last page request
				mockGetChildren(
					{
						...getChildrenVariables(currentFolder.id),
						cursor: thirdCursor.id
					},
					{
						...currentFolder,
						// remaining elements
						children: currentFolder.children.slice(
							findIndex(currentFolder.children, thirdCursor) + 1
						)
					} as Folder
				)
			];

			render(<FolderView />, { initialRouterEntries: [`/?folder=${currentFolder.id}`], mocks });

			// wait for the load to be completed
			await waitForElementToBeRemoved(screen.queryByTestId('icon: Refresh'));

			// check that cursor is last element
			expect(getCachedCursor(currentFolder)).toBe(firstCursor.id);
			let nodes = screen.getAllByTestId('node-item', { exact: false });
			expect(screen.getByTestId(`node-item-${firstCursor.id}`)).toBe(nodes[nodes.length - 1]);
			// right click to open contextual menu
			const nodeItem = screen.getByTestId(`node-item-${element.id}`);
			// open context menu
			fireEvent.contextMenu(nodeItem);
			await renameNode(newName);
			// wait that the modal close
			await waitForElementToBeRemoved(screen.queryByTestId('input-name'));
			// contextual menu is closed
			expect(screen.queryByText(actionRegexp.rename)).not.toBeInTheDocument();
			// check the new item. It has the new name and it's located as last element of the updated list
			let updatedNodeItem = screen.getByTestId(`node-item-${element.id}`);
			expect(updatedNodeItem).toBeVisible();
			expect(within(updatedNodeItem).getByText(newName)).toBeVisible();
			nodes = screen.getAllByTestId('node-item', { exact: false });
			expect(nodes).toHaveLength(NODES_LOAD_LIMIT);
			expect(nodes[nodes.length - 1]).toBe(updatedNodeItem);
			// cursor is not changed but it's now the second last element, before the renamed node
			expect(getCachedCursor(currentFolder)).toBe(firstCursor.id);
			expect(screen.getByTestId(`node-item-${firstCursor.id}`)).toBe(nodes[nodes.length - 2]);
			// trigger the load of a new page
			await triggerLoadMore();
			// wait for the load to complete (last element of second page is loaded)
			await screen.findByTestId(`node-item-${secondPage[secondPage.length - 1].id}`);
			// updated item is still last element
			nodes = screen.getAllByTestId('node-item', { exact: false });
			expect(nodes).toHaveLength(NODES_LOAD_LIMIT * 2);
			expect(nodes[nodes.length - 1]).toBe(updatedNodeItem);
			// cursor is the second last element shown, before the renamed node
			expect(getCachedCursor(currentFolder)).toBe(secondCursor.id);
			expect(screen.getByTestId(`node-item-${secondCursor.id}`)).toBe(nodes[nodes.length - 2]);
			// trigger the load of a new page
			await triggerLoadMore();
			// wait for the load to complete (last element of third page is loaded)
			await screen.findByTestId(`node-item-${(last(thirdPage) as Node).id}`);
			nodes = screen.getAllByTestId('node-item', { exact: false });
			// updated node is now at its ordered position (third position of third page, but considering that first page has 1 less element now)
			expect(nodes).toHaveLength(NODES_LOAD_LIMIT * 3 - 1);
			updatedNodeItem = screen.getByTestId(`node-item-${element.id}`);
			expect(findIndex(nodes, (node) => node === updatedNodeItem)).toBe(
				NODES_LOAD_LIMIT * 2 + 2 - 1
			);
			// cursor is changed and is last element of page 3
			expect(getCachedCursor(currentFolder)).toBe(thirdCursor.id);
			// last element is last node of third page
			expect(screen.getByTestId(`node-item-${thirdPage[thirdPage.length - 1].id}`)).toBe(
				nodes[nodes.length - 1]
			);
			// trigger the load of a new page
			await triggerLoadMore();
			// wait for the load to complete (last element of children is loaded)
			await screen.findByTestId(
				`node-item-${(currentFolder.children[currentFolder.children.length - 1] as Node).id}`
			);
			nodes = screen.getAllByTestId('node-item', { exact: false });
			// number of elements shown is the total number of children
			expect(nodes).toHaveLength(currentFolder.children.length);
			// load more icon is not visible
			expect(screen.queryByTestId('icon: Refresh')).not.toBeInTheDocument();
		});

		test('Rename of last ordered node to unordered update cursor to be last ordered node and trigger load of the next page with the new cursor', async () => {
			const currentFolder = populateFolder();
			currentFolder.children = sortNodes(
				populateNodes(NODES_LOAD_LIMIT * 2, 'File'),
				NODES_SORT_DEFAULT
			) as Node[];
			forEach(currentFolder.children, (mockedNode) => {
				(mockedNode as Node).permissions.can_write_file = true;
				(mockedNode as Node).permissions.can_write_folder = true;
				(mockedNode as Node).parent = currentFolder;
			});
			const firstPage = currentFolder.children.slice(0, NODES_LOAD_LIMIT) as Node[];
			const secondPage = currentFolder.children.slice(NODES_LOAD_LIMIT) as Node[];

			const nodeToRename = firstPage[firstPage.length - 1] as Node;
			const newName = `${(last(secondPage) as Node).name}-renamed`;

			const mocks = [
				mockGetChildren(getChildrenVariables(currentFolder.id), {
					...currentFolder,
					children: firstPage
				} as Folder),
				mockGetParent({ node_id: currentFolder.id }, currentFolder),
				mockUpdateNode(
					{ node_id: nodeToRename.id, name: newName },
					{ ...nodeToRename, name: newName }
				),
				mockGetChildren(
					{
						...getChildrenVariables(currentFolder.id),
						cursor: firstPage[firstPage.length - 2].id
					},
					{
						...currentFolder,
						children: secondPage
					} as Folder
				)
			];

			render(<FolderView />, { initialRouterEntries: [`/?folder=${currentFolder.id}`], mocks });

			await screen.findByText(firstPage[0].name);
			expect(screen.getByText(firstPage[0].name)).toBeVisible();
			expect(screen.getByText(nodeToRename.name)).toBeVisible();
			expect(screen.queryByText(secondPage[0].name)).not.toBeInTheDocument();
			// rename node to put it in the unordered list
			fireEvent.contextMenu(screen.getByText(nodeToRename.name));
			await renameNode(newName);
			await waitForElementToBeRemoved(screen.queryByRole('button', { name: actionRegexp.rename }));
			await screen.findByText(newName);
			expect(screen.queryByText(nodeToRename.name)).not.toBeInTheDocument();
			expect(screen.getByText(newName)).toBeVisible();
			expect(screen.queryByText(secondPage[0].name)).not.toBeInTheDocument();
			expect(screen.getByTestId('icon: Refresh')).toBeVisible();
			await triggerLoadMore();
			await screen.findByText(secondPage[0].name);
			expect(screen.getByText(secondPage[0].name)).toBeVisible();
			expect(screen.getByText(firstPage[0].name)).toBeVisible();
			expect(screen.getByText(newName)).toBeVisible();
			const nodeItems = screen.getAllByTestId('node-item-', { exact: false });
			expect(nodeItems).toHaveLength(currentFolder.children.length);
			expect(screen.getByTestId(`node-item-${nodeToRename.id}`)).toBe(last(nodeItems));
		});

		test('Rename of last ordered node to unordered and move to trash of all remaining ordered nodes refetch children from first page and add unOrdered to the list', async () => {
			const currentFolder = populateFolder();
			currentFolder.children = sortNodes(
				populateNodes(NODES_LOAD_LIMIT * 2, 'File'),
				NODES_SORT_DEFAULT
			) as Node[];
			forEach(currentFolder.children, (mockedNode) => {
				(mockedNode as Node).permissions.can_write_file = true;
				(mockedNode as Node).permissions.can_write_folder = true;
				(mockedNode as Node).parent = currentFolder;
			});
			const firstPage = currentFolder.children.slice(0, NODES_LOAD_LIMIT) as Node[];
			const secondPage = currentFolder.children.slice(NODES_LOAD_LIMIT) as Node[];

			const nodeToRename = firstPage[firstPage.length - 1] as Node;
			const newName = `${(last(secondPage) as Node).name}-renamed`;

			const nodesToTrash = map(firstPage.slice(0, firstPage.length - 1), (node) => node.id);

			const mocks = [
				mockGetChildren(getChildrenVariables(currentFolder.id), {
					...currentFolder,
					children: firstPage
				} as Folder),
				mockGetParent({ node_id: currentFolder.id }, currentFolder),
				mockUpdateNode(
					{ node_id: nodeToRename.id, name: newName },
					{ ...nodeToRename, name: newName }
				),
				mockTrashNodes({ node_ids: nodesToTrash }, nodesToTrash),
				mockGetChildren(getChildrenVariables(currentFolder.id), {
					...currentFolder,
					children: secondPage
				} as Folder)
			];

			render(<FolderView />, { initialRouterEntries: [`/?folder=${currentFolder.id}`], mocks });

			await screen.findByText(firstPage[0].name);
			expect(screen.getByText(firstPage[0].name)).toBeVisible();
			expect(screen.getByText(nodeToRename.name)).toBeVisible();
			expect(screen.queryByText(secondPage[0].name)).not.toBeInTheDocument();
			// rename node to put it in the unordered list
			fireEvent.contextMenu(screen.getByText(nodeToRename.name));
			await renameNode(newName);
			await screen.findByText(newName);
			expect(screen.getByText(newName)).toBeVisible();
			expect(screen.queryByText(secondPage[0].name)).not.toBeInTheDocument();
			// select all ordered items (all but the renamed node)
			selectNodes(nodesToTrash);
			// check that all wanted items are selected
			expect(screen.getAllByTestId('checkedAvatar')).toHaveLength(firstPage.length - 1);
			expect(screen.getByTestId('icon: MoreVertical')).toBeVisible();
			const trashAction = await screen.findByTestId('icon: Trash2Outline');
			expect(trashAction).toBeVisible();
			expect(trashAction.parentNode).not.toHaveAttribute('disabled', '');
			userEvent.click(trashAction);
			const snackbar = await screen.findByText(/Item moved to trash/i);
			await waitForElementToBeRemoved(snackbar);
			expect(screen.getByTestId('icon: Refresh')).toBeVisible();
			await screen.findByText(secondPage[0].name);
			expect(screen.getByText(secondPage[0].name)).toBeVisible();
			expect(screen.queryByText(firstPage[0].name)).not.toBeInTheDocument();
			expect(screen.getByText(newName)).toBeInTheDocument();
		}, 60000);
	});
});