/*
 * SPDX-FileCopyrightText: 2022 Zextras <https://www.zextras.com>
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import React from 'react';

import { ApolloError, gql } from '@apollo/client';
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
import forEach from 'lodash/forEach';
import includes from 'lodash/includes';
import map from 'lodash/map';
import { graphql, rest } from 'msw';

import server from '../../../mocks/server';
import { nodeListCursorVar } from '../../apollo/nodeListCursorVar';
import {
	DOCS_ENDPOINT,
	CREATE_FILE_PATH,
	NODES_LOAD_LIMIT,
	NODES_SORT_DEFAULT
} from '../../constants';
import GET_CHILDREN from '../../graphql/queries/getChildren.graphql';
import {
	CreateDocsFileRequestBody,
	CreateDocsFileResponse
} from '../../mocks/handleCreateDocsFileRequest';
import {
	populateFile,
	populateFolder,
	populateNode,
	populateNodes,
	populateParents,
	populateUser,
	sortNodes
} from '../../mocks/mockUtils';
import { DocsType, Node } from '../../types/common';
import {
	File as FilesFile,
	Folder,
	GetChildQuery,
	GetChildQueryVariables,
	GetChildrenQuery,
	GetChildrenQueryVariables,
	GetNodeQuery,
	GetNodeQueryVariables,
	NodeSort
} from '../../types/graphql/types';
import {
	getChildrenVariables,
	mockCopyNodes,
	mockCreateFolder,
	mockCreateFolderError,
	mockFlagNodes,
	mockGetChildren,
	mockGetChildrenError,
	mockGetParent,
	mockGetPath,
	mockMoveNodes
} from '../../utils/mockUtils';
import {
	actionRegexp,
	generateError,
	render,
	selectNodes,
	triggerLoadMore,
	waitForNetworkResponse
} from '../../utils/testUtils';
import { addNodeInSortedList } from '../../utils/utils';
import { EmptySpaceFiller } from './EmptySpaceFiller';
import FolderList from './FolderList';

describe('Folder List', () => {
	async function createNode(newNode: { name: string }): Promise<void> {
		// wait for the creation modal to be opened
		const inputFieldDiv = await screen.findByTestId('input-name');
		const inputField = within(inputFieldDiv).getByRole('textbox');
		expect(inputField).toHaveValue('');
		userEvent.type(inputField, newNode.name);
		expect(inputField).toHaveValue(newNode.name);
		const button = screen.getByRole('button', { name: /create/i });
		userEvent.click(button);
	}

	function getCachedCursor(folder: { id: string }): string | null | undefined {
		const cursor = nodeListCursorVar()[folder.id];
		if (cursor) {
			return cursor.__ref.split(':')[1];
		}
		return cursor;
	}

	test('access to a folder with network error response show an error page', async () => {
		const currentFolder = populateFolder();
		const mocks = [
			mockGetChildrenError(
				getChildrenVariables(currentFolder.id),
				new ApolloError({ graphQLErrors: [generateError('An error occurred')] })
			)
		];

		const setNewFolderMock = jest.fn();
		const setNewFileMock = jest.fn();

		render(
			<FolderList
				folderId={currentFolder.id}
				setNewFolder={setNewFolderMock}
				setNewFile={setNewFileMock}
				canUploadFile={false}
			/>,
			{ mocks }
		);

		await waitForElementToBeRemoved(screen.queryByTestId('icon: Refresh'));

		const snackbar = await screen.findByText(/An error occurred/i);
		await waitForElementToBeRemoved(snackbar);
	});

	test('first access to a folder show loading state and than show children', async () => {
		const currentFolder = populateFolder();

		const setNewFolderMock = jest.fn();
		const setNewFileMock = jest.fn();

		render(
			<FolderList
				folderId={currentFolder.id}
				setNewFolder={setNewFolderMock}
				setNewFile={setNewFileMock}
				canUploadFile={false}
			/>
		);
		expect(screen.getByTestId('icon: Refresh')).toBeVisible();
		await waitForElementToBeRemoved(
			within(screen.getByTestId('list-header')).queryByTestId('icon: Refresh')
		);
		expect(screen.getByTestId(`list-${currentFolder.id}`)).not.toBeEmptyDOMElement();
		const queryResult = global.apolloClient.readQuery<GetChildrenQuery, GetChildrenQueryVariables>({
			query: GET_CHILDREN,
			variables: getChildrenVariables(currentFolder.id)
		});
		forEach((queryResult?.getNode as Folder).children, (child) => {
			const $child = child as Node;
			expect(screen.getByTestId(`node-item-${$child.id}`)).toBeInTheDocument();
			expect(screen.getByTestId(`node-item-${$child.id}`)).toHaveTextContent($child.name);
		});
	});

	test('intersectionObserver trigger the fetchMore function to load more elements when observed element is intersected', async () => {
		const currentFolder = populateFolder(NODES_LOAD_LIMIT + Math.floor(NODES_LOAD_LIMIT / 2));

		const setNewFolderMock = jest.fn();
		const setNewFileMock = jest.fn();

		const mocks = [
			mockGetParent(
				{
					node_id: currentFolder.id
				},
				currentFolder
			),
			mockGetChildren(getChildrenVariables(currentFolder.id), {
				...currentFolder,
				children: currentFolder.children.slice(0, NODES_LOAD_LIMIT)
			} as Folder),
			mockGetChildren(
				{
					...getChildrenVariables(currentFolder.id),
					cursor: (currentFolder.children[NODES_LOAD_LIMIT - 1] as Node).id
				},
				{
					...currentFolder,
					children: currentFolder.children.slice(NODES_LOAD_LIMIT)
				} as Folder
			)
		];

		render(
			<FolderList
				folderId={currentFolder.id}
				setNewFolder={setNewFolderMock}
				setNewFile={setNewFileMock}
				canUploadFile={false}
			/>,
			{ mocks }
		);

		// this is the loading refresh icon
		expect(screen.getByTestId('list-header')).toContainElement(screen.getByTestId('icon: Refresh'));
		expect(within(screen.getByTestId('list-header')).getByTestId('icon: Refresh')).toBeVisible();
		await waitForElementToBeRemoved(
			within(screen.getByTestId('list-header')).queryByTestId('icon: Refresh')
		);
		// wait the rendering of the first item
		await screen.findByTestId(`node-item-${(currentFolder.children[0] as Node).id}`);
		expect(
			screen.getByTestId(`node-item-${(currentFolder.children[NODES_LOAD_LIMIT - 1] as Node).id}`)
		).toBeVisible();
		// the loading icon should be still visible at the bottom of the list because we have load the max limit of items per page
		expect(screen.getByTestId('icon: Refresh')).toBeVisible();

		// elements after the limit should not be rendered
		expect(
			screen.queryByTestId(`node-item-${(currentFolder.children[NODES_LOAD_LIMIT] as Node).id}`)
		).not.toBeInTheDocument();

		await triggerLoadMore();

		// wait for the response
		await screen.findByTestId(`node-item-${(currentFolder.children[NODES_LOAD_LIMIT] as Node).id}`);

		// now all elements are loaded so last children should be visible and no loading icon should be rendered
		expect(
			screen.getByTestId(
				`node-item-${(currentFolder.children[currentFolder.children.length - 1] as Node).id}`
			)
		).toBeVisible();
		expect(screen.queryByTestId('Icon: Refresh')).not.toBeInTheDocument();
	});

	describe('Create folder', () => {
		test('Create folder operation fail shows an error in the modal and does not close it', async () => {
			const currentFolder = populateFolder();
			currentFolder.permissions.can_write_folder = true;
			const node1 = populateFolder(0, 'n1', 'first');
			const node2 = populateFolder(0, 'n2', 'second');
			const node3 = populateFolder(0, 'n3', 'third');
			currentFolder.children.push(node1, node2, node3);

			const newName = node2.name;

			const mocks = [
				mockGetChildren(getChildrenVariables(currentFolder.id), currentFolder),
				mockCreateFolderError(
					{
						destination_id: currentFolder.id,
						name: newName
					},
					new ApolloError({ graphQLErrors: [generateError('Error! Name already assigned')] })
				)
			];

			const setNewFolderMock = jest.fn();
			const setNewFileMock = jest.fn();

			// simulate the creation of a new folder
			const { rerender } = render(
				<FolderList
					folderId={currentFolder.id}
					setNewFolder={setNewFolderMock}
					setNewFile={setNewFileMock}
					canUploadFile={false}
				/>,
				{
					mocks
				}
			);

			// wait for the load to be completed
			await waitForElementToBeRemoved(screen.queryByTestId('icon: Refresh'));
			expect(screen.getAllByTestId('node-item', { exact: false })).toHaveLength(
				currentFolder.children.length
			);
			rerender(
				<FolderList
					folderId={currentFolder.id}
					newFolder
					setNewFolder={setNewFolderMock}
					setNewFile={setNewFileMock}
					canUploadFile={false}
				/>
			);
			await createNode(node2);
			await waitFor(() =>
				expect(screen.getAllByText(/Error! Name already assigned/)).toHaveLength(2)
			);
			await waitFor(() =>
				// eslint-disable-next-line jest-dom/prefer-in-document
				expect(screen.getAllByText(/Error! Name already assigned/)).toHaveLength(1)
			);
			const error = screen.getByText(/Error! Name already assigned/);
			expect(error).toBeVisible();
			const inputFieldDiv = screen.getByTestId('input-name');
			const inputField = within(inputFieldDiv).getByRole('textbox');
			expect(inputField).toBeVisible();
			expect(inputField).toHaveValue(newName);
			expect(screen.getAllByTestId('node-item', { exact: false })).toHaveLength(
				currentFolder.children.length
			);
		});

		test('Create folder add folder node at folder content, showing the element in the ordered list if neighbor is already loaded and ordered', async () => {
			const currentFolder = populateFolder();
			currentFolder.permissions.can_write_folder = true;
			const node1 = populateFolder(0, 'n1', 'first');
			const node2 = populateFolder(0, 'n2', 'second');
			const node3 = populateFolder(0, 'n3', 'third');
			// add node 1 and 3 as children, node 2 is the new folder
			currentFolder.children.push(node1, node3);

			const setNewFolderMock = jest.fn();
			const setNewFileMock = jest.fn();

			const mocks = [
				mockGetParent({ node_id: currentFolder.id }, currentFolder),
				mockGetChildren(getChildrenVariables(currentFolder.id), currentFolder),
				mockCreateFolder(
					{
						destination_id: currentFolder.id,
						name: node2.name
					},
					node2
				)
			];

			// simulate the creation of a new folder
			const { rerender } = render(
				<FolderList
					folderId={currentFolder.id}
					setNewFolder={setNewFolderMock}
					setNewFile={setNewFileMock}
					canUploadFile={false}
				/>,
				{ mocks }
			);

			// wait for the load to be completed
			await waitForElementToBeRemoved(screen.queryByTestId('icon: Refresh'));
			expect(screen.getAllByTestId('node-item', { exact: false })).toHaveLength(
				currentFolder.children.length
			);
			rerender(
				<FolderList
					folderId={currentFolder.id}
					newFolder
					setNewFolder={setNewFolderMock}
					setNewFile={setNewFileMock}
					canUploadFile={false}
				/>
			);
			// create action
			await createNode(node2);
			await screen.findByTestId(`node-item-${node2.id}`);
			// trigger rerender without newFolder param
			rerender(
				<FolderList
					folderId={currentFolder.id}
					newFolder={false}
					setNewFolder={setNewFolderMock}
					setNewFile={setNewFileMock}
					canUploadFile={false}
				/>
			);
			const nodeItem = await screen.findByTestId(`node-item-${node2.id}`);
			expect(screen.queryByTestId('input-name')).not.toBeInTheDocument();
			expect(nodeItem).toBeVisible();
			expect(within(nodeItem).getByText(node2.name)).toBeVisible();
			const nodes = screen.getAllByTestId('node-item', { exact: false });
			expect(nodes).toHaveLength(currentFolder.children.length + 1);
			expect(nodes[1]).toBe(nodeItem);
		});

		test('Create folder add folder node as last element of the list if neighbor is already loaded but unordered', async () => {
			const currentFolder = populateFolder();
			currentFolder.children = populateNodes(NODES_LOAD_LIMIT, 'Folder');
			sortNodes(currentFolder.children, NODES_SORT_DEFAULT);
			currentFolder.permissions.can_write_folder = true;
			const node1 = populateFolder(0, 'n1', `zzzz-new-folder-n1`);
			const node2 = populateFolder(0, 'n2', `zzzz-new-folder-n2`);
			const node3 = populateFolder(0, 'n3', `zzzz-new-folder-n3`);
			// 1) folder with more pages, just 1 loaded
			// 2) create node2 as unordered node3 (not loaded) as neighbor)
			// --> node2 should be last element of the list
			// 3) create node1 as unordered (node2 (loaded and unordered) as neighbor)
			// --> node1 should be put before node2 in the unordered
			// 4) trigger loadMore and load node1, node2, node3 with this order
			// --> list should be updated with the correct order

			const setNewFolderMock = jest.fn();
			const setNewFileMock = jest.fn();

			const mocks = [
				mockGetChildren(getChildrenVariables(currentFolder.id), currentFolder),
				mockCreateFolder(
					{
						destination_id: currentFolder.id,
						name: node2.name
					},
					node2
				),
				mockCreateFolder(
					{
						destination_id: currentFolder.id,
						name: node1.name
					},
					node1
				),
				// fetchMore request, cursor is still last ordered node (last child of initial folder)
				mockGetChildren(
					{
						...getChildrenVariables(currentFolder.id),
						cursor: (currentFolder.children[currentFolder.children.length - 1] as Node).id
					},
					{
						...currentFolder,
						// second page contains the new created nodes and node3, not loaded before
						children: [node1, node2, node3]
					} as Folder
				)
			];

			// simulate the creation of a new folder
			const { rerender } = render(
				<FolderList
					folderId={currentFolder.id}
					setNewFolder={setNewFolderMock}
					setNewFile={setNewFileMock}
					canUploadFile={false}
				/>,
				{ mocks }
			);

			// wait for the load to be completed
			await waitForElementToBeRemoved(screen.queryByTestId('icon: Refresh'));
			let nodes = screen.getAllByTestId('node-item', { exact: false });
			expect(nodes).toHaveLength(currentFolder.children.length);
			rerender(
				<FolderList
					folderId={currentFolder.id}
					newFolder
					setNewFolder={setNewFolderMock}
					setNewFile={setNewFileMock}
					canUploadFile={false}
				/>
			);
			// create action
			await createNode(node2);
			await screen.findByTestId(`node-item-${node2.id}`);
			expect(screen.getByText(node2.name)).toBeVisible();
			// trigger rerender without newFolder param
			rerender(
				<FolderList
					folderId={currentFolder.id}
					newFolder={false}
					setNewFolder={setNewFolderMock}
					setNewFile={setNewFileMock}
					canUploadFile={false}
				/>
			);
			const node2Item = screen.getByTestId(`node-item-${node2.id}`);
			expect(screen.queryByTestId('input-name')).not.toBeInTheDocument();
			expect(node2Item).toBeVisible();
			expect(within(node2Item).getByText(node2.name)).toBeVisible();
			nodes = screen.getAllByTestId('node-item', { exact: false });
			expect(nodes).toHaveLength(currentFolder.children.length + 1);
			// node2 is last element of the list
			expect(nodes[nodes.length - 1]).toBe(node2Item);
			// trigger rerender with newFolder param to create second node
			rerender(
				<FolderList
					folderId={currentFolder.id}
					newFolder
					setNewFolder={setNewFolderMock}
					setNewFile={setNewFileMock}
					canUploadFile={false}
				/>
			);
			// create action
			await createNode(node1);
			await screen.findByTestId(`node-item-${node1.id}`);
			expect(screen.getByText(node1.name)).toBeVisible();
			// trigger rerender without newFolder param
			rerender(
				<FolderList
					folderId={currentFolder.id}
					newFolder={false}
					setNewFolder={setNewFolderMock}
					setNewFile={setNewFileMock}
					canUploadFile={false}
				/>
			);
			expect(screen.queryByTestId('input-name')).not.toBeInTheDocument();
			const node1Item = screen.getByTestId(`node-item-${node1.id}`);
			expect(node1Item).toBeVisible();
			expect(within(node1Item).getByText(node1.name)).toBeVisible();
			nodes = screen.getAllByTestId('node-item', { exact: false });
			expect(nodes).toHaveLength(currentFolder.children.length + 2);
			// node1 is before node2 of the list
			expect(nodes[nodes.length - 2]).toBe(node1Item);
			// node2 is last element of the list
			expect(nodes[nodes.length - 1]).toBe(screen.getByTestId(`node-item-${node2.id}`));
			// trigger load more
			await triggerLoadMore();
			// wait for the load to be completed (node3 is now loaded)
			await screen.findByTestId(`node-item-${node3.id}`);
			nodes = screen.getAllByTestId('node-item', { exact: false });
			expect(nodes).toHaveLength(currentFolder.children.length + 3);
			// node1, node2 and node3 should have the correct order
			expect(screen.getByTestId(`node-item-${node1.id}`)).toBe(nodes[nodes.length - 3]);
			expect(screen.getByTestId(`node-item-${node2.id}`)).toBe(nodes[nodes.length - 2]);
			expect(screen.getByTestId(`node-item-${node3.id}`)).toBe(nodes[nodes.length - 1]);
		});

		test('Create folder that fill a page size does not trigger new page request', async () => {
			const currentFolder = populateFolder(NODES_LOAD_LIMIT - 1);
			currentFolder.permissions.can_write_folder = true;

			const newNode = populateFolder();

			let newPos = addNodeInSortedList(currentFolder.children, newNode, NODES_SORT_DEFAULT);
			newPos = newPos > -1 ? newPos : currentFolder.children.length;

			const setNewFolderMock = jest.fn();
			const setNewFileMock = jest.fn();

			const mocks = [
				mockGetParent({ node_id: currentFolder.id }, currentFolder),
				mockGetChildren(getChildrenVariables(currentFolder.id), currentFolder),
				mockCreateFolder(
					{
						destination_id: currentFolder.id,
						name: newNode.name
					},
					newNode
				)
			];

			// simulate the creation of a new folder
			const { rerender } = render(
				<FolderList
					folderId={currentFolder.id}
					setNewFolder={setNewFolderMock}
					setNewFile={setNewFileMock}
					canUploadFile={false}
				/>,
				{ mocks }
			);

			// wait for the load to be completed
			await waitForElementToBeRemoved(screen.queryByTestId('icon: Refresh'));
			expect(screen.getAllByTestId('node-item', { exact: false })).toHaveLength(
				currentFolder.children.length
			);
			// cursor is null
			expect(getCachedCursor(currentFolder)).toBe(null);
			rerender(
				<FolderList
					folderId={currentFolder.id}
					newFolder
					setNewFolder={setNewFolderMock}
					setNewFile={setNewFileMock}
					canUploadFile={false}
				/>
			);
			// create action
			await createNode(newNode);
			await screen.findByTestId(`node-item-${newNode.id}`);
			expect(screen.getByText(newNode.name)).toBeVisible();
			// trigger rerender without newFolder param
			rerender(
				<FolderList
					folderId={currentFolder.id}
					newFolder={false}
					setNewFolder={setNewFolderMock}
					setNewFile={setNewFileMock}
					canUploadFile={false}
				/>
			);
			const nodeItem = await screen.findByTestId(`node-item-${newNode.id}`);
			expect(screen.queryByTestId('input-name')).not.toBeInTheDocument();
			expect(nodeItem).toBeVisible();
			expect(within(nodeItem).getByText(newNode.name)).toBeVisible();
			const nodes = screen.getAllByTestId('node-item', { exact: false });
			expect(nodes).toHaveLength(NODES_LOAD_LIMIT);
			expect(nodes[newPos]).toBe(nodeItem);
			expect(getCachedCursor(currentFolder)).toBe(null);
			expect(screen.queryByTestId('icon: Refresh')).not.toBeInTheDocument();
		});
	});

	describe('Selection mode', () => {
		test('if there is no element selected, all actions are visible and disabled', async () => {
			const currentFolder = populateFolder(10);
			const mocks = [
				mockGetParent({ node_id: currentFolder.id }, currentFolder),
				mockGetChildren(getChildrenVariables(currentFolder.id), currentFolder)
			];
			const setNewFolderMock = jest.fn();
			const setNewFileMock = jest.fn();

			render(
				<FolderList
					folderId={currentFolder.id}
					setNewFolder={setNewFolderMock}
					setNewFile={setNewFileMock}
					canUploadFile={false}
				/>,
				{ mocks }
			);
			await screen.findByText((currentFolder.children[0] as Node).name);
			expect(screen.getByText((currentFolder.children[0] as Node).name)).toBeVisible();
			expect(screen.queryByTestId('checkedAvatar')).not.toBeInTheDocument();
			selectNodes([(currentFolder.children[0] as Node).id]);
			// check that all wanted items are selected
			expect(screen.getByTestId('checkedAvatar')).toBeInTheDocument();
			expect(screen.getByText(/select all/i)).toBeVisible();
			// deselect node. Selection mode remains active
			selectNodes([(currentFolder.children[0] as Node).id]);
			expect(screen.queryByTestId('checkedAvatar')).not.toBeInTheDocument();
			expect(screen.getAllByTestId('unCheckedAvatar')).toHaveLength(currentFolder.children.length);
			expect(screen.getByText(/select all/i)).toBeVisible();
			expect(screen.getByTestId('icon: Trash2Outline')).toBeVisible();
			expect(screen.getByTestId('icon: Trash2Outline').parentNode).toHaveAttribute('disabled', '');
			expect(screen.getByTestId('icon: MoreVertical')).toBeVisible();
			userEvent.click(screen.getByTestId('icon: MoreVertical'));
			await screen.findByText(actionRegexp.rename);
			expect(screen.getByText(actionRegexp.rename)).toBeVisible();
			expect(screen.getByText(actionRegexp.rename).parentNode).toHaveAttribute('disabled', '');
			expect(screen.getByText(actionRegexp.copy)).toBeVisible();
			expect(screen.getByText(actionRegexp.copy).parentNode).toHaveAttribute('disabled', '');
			expect(screen.getByText(actionRegexp.move)).toBeVisible();
			expect(screen.getByText(actionRegexp.move).parentNode).toHaveAttribute('disabled', '');
			expect(screen.getByText(actionRegexp.flag)).toBeVisible();
			expect(screen.getByText(actionRegexp.flag).parentNode).toHaveAttribute('disabled', '');
			expect(screen.getByText(actionRegexp.unflag)).toBeVisible();
			expect(screen.getByText(actionRegexp.unflag).parentNode).toHaveAttribute('disabled', '');
			expect(screen.getByText(actionRegexp.download)).toBeVisible();
			expect(screen.getByText(actionRegexp.download).parentNode).toHaveAttribute('disabled', '');
			expect(screen.getByText(actionRegexp.openDocument)).toBeVisible();
			expect(screen.getByText(actionRegexp.openDocument).parentNode).toHaveAttribute(
				'disabled',
				''
			);
			expect(screen.queryByTestId('icon: RestoreOutline')).not.toBeInTheDocument();
			expect(screen.queryByTestId('icon: DeletePermanentlyOutline')).not.toBeInTheDocument();
			expect(screen.getByTestId('icon: ArrowBackOutline')).toBeVisible();
			userEvent.click(screen.getByTestId('icon: ArrowBackOutline'));
			expect(screen.queryByTestId('icon: Trash2Outline')).not.toBeInTheDocument();
			expect(screen.queryByTestId('unCheckedAvatar')).not.toBeInTheDocument();
			expect(screen.queryByTestId('checkedAvatar')).not.toBeInTheDocument();
			expect(screen.queryByText(/select all/i)).not.toBeInTheDocument();
		});

		test('if all loaded nodes are selected, unselect all action is visible', async () => {
			const currentFolder = populateFolder(NODES_LOAD_LIMIT);
			const secondPage = populateNodes(10) as Node[];
			forEach(secondPage, (mockedNode) => {
				mockedNode.parent = currentFolder;
			});
			const setNewFolderMock = jest.fn();
			const setNewFileMock = jest.fn();
			const mocks = [
				mockGetParent({ node_id: currentFolder.id }, currentFolder),
				mockGetChildren(getChildrenVariables(currentFolder.id), currentFolder),
				mockGetChildren(
					{
						...getChildrenVariables(currentFolder.id),
						cursor: (currentFolder.children[NODES_LOAD_LIMIT - 1] as Node).id
					},
					{ ...currentFolder, children: secondPage } as Folder
				)
			];
			render(
				<FolderList
					folderId={currentFolder.id}
					setNewFolder={setNewFolderMock}
					setNewFile={setNewFileMock}
					canUploadFile={false}
				/>,
				{ mocks }
			);
			await screen.findByText((currentFolder.children[0] as Folder).name);
			expect(screen.queryByText(/select all/i)).not.toBeInTheDocument();
			selectNodes([(currentFolder.children[0] as Folder).id]);
			// check that all wanted items are selected
			expect(screen.getByTestId('checkedAvatar')).toBeInTheDocument();
			expect(screen.getByText(/\bselect all/i)).toBeVisible();
			userEvent.click(screen.getByText(/\bselect all/i));
			await screen.findByText(/deselect all/i);
			expect(screen.queryByTestId('unCheckedAvatar')).not.toBeInTheDocument();
			expect(screen.getAllByTestId('checkedAvatar')).toHaveLength(currentFolder.children.length);
			expect(screen.getByText(/deselect all/i)).toBeVisible();
			expect(screen.queryByText(/\bselect all/i)).not.toBeInTheDocument();
			await triggerLoadMore();
			await screen.findByText(secondPage[0].name);
			expect(screen.getAllByTestId('checkedAvatar')).toHaveLength(currentFolder.children.length);
			expect(screen.getAllByTestId('unCheckedAvatar')).toHaveLength(secondPage.length);
			expect(screen.queryByText(/deselect all/i)).not.toBeInTheDocument();
			expect(screen.getByText(/\bselect all/i)).toBeVisible();
			userEvent.click(screen.getByText(/\bselect all/i));
			await screen.findByText(/deselect all/i);
			expect(screen.getAllByTestId('checkedAvatar')).toHaveLength(
				currentFolder.children.length + secondPage.length
			);
			expect(screen.queryByTestId('unCheckedAvatar')).not.toBeInTheDocument();
			expect(screen.getByText(/deselect all/i)).toBeVisible();
			userEvent.click(screen.getByText(/deselect all/i));
			await screen.findByText(/\bselect all/i);
			expect(screen.getAllByTestId('unCheckedAvatar')).toHaveLength(
				currentFolder.children.length + secondPage.length
			);
			expect(screen.queryByTestId('checkedAvatar')).not.toBeInTheDocument();
		});

		test('Flag/Unflag action marks all and only selected items as flagged/unflagged', async () => {
			const currentFolder = populateFolder(4);
			forEach(currentFolder.children, (mockedNode) => {
				(mockedNode as Node).flagged = false;
			});

			const nodesIdsToFlag = map(
				currentFolder.children.slice(0, currentFolder.children.length / 2),
				(child) => (child as Node).id
			);

			const nodesIdsToUnflag = nodesIdsToFlag.slice(0, nodesIdsToFlag.length / 2);

			const mocks = [
				mockGetChildren(getChildrenVariables(currentFolder.id), {
					...currentFolder,
					children: currentFolder.children
				} as Folder),
				mockFlagNodes(
					{
						node_ids: nodesIdsToFlag,
						flag: true
					},
					nodesIdsToFlag
				),
				mockFlagNodes(
					{
						node_ids: nodesIdsToUnflag,
						flag: false
					},
					nodesIdsToUnflag
				)
			];

			const setNewFolderMock = jest.fn();
			const setNewFileMock = jest.fn();

			render(
				<FolderList
					folderId={currentFolder.id}
					setNewFolder={setNewFolderMock}
					setNewFile={setNewFileMock}
					canUploadFile={false}
				/>,
				{ mocks }
			);

			// wait for the load to be completed
			await waitForElementToBeRemoved(screen.queryByTestId('icon: Refresh'));
			expect(screen.queryByTestId('icon: Flag')).not.toBeInTheDocument();

			// activate selection mode by selecting items
			selectNodes(nodesIdsToFlag);

			// check that all wanted items are selected
			expect(screen.getAllByTestId('checkedAvatar')).toHaveLength(nodesIdsToFlag.length);
			expect(screen.getByTestId('icon: MoreVertical')).toBeVisible();
			userEvent.click(screen.getByTestId('icon: MoreVertical'));
			await screen.findByText(actionRegexp.flag);
			// click on flag action on header bar
			userEvent.click(screen.getByText(actionRegexp.flag));
			await waitForElementToBeRemoved(screen.queryAllByTestId('checkedAvatar'));
			await screen.findAllByTestId('icon: Flag');
			expect(screen.getAllByTestId('icon: Flag')).toHaveLength(nodesIdsToFlag.length);

			// activate selection mode by selecting items
			selectNodes(nodesIdsToUnflag);
			// check that all wanted items are selected
			expect(screen.getAllByTestId('checkedAvatar')).toHaveLength(nodesIdsToUnflag.length);
			expect(screen.getByTestId('icon: MoreVertical')).toBeVisible();
			userEvent.click(screen.getByTestId('icon: MoreVertical'));
			await screen.findByText(actionRegexp.unflag);
			// click on unflag action on header bar
			userEvent.click(screen.getByText(actionRegexp.unflag));
			await waitForElementToBeRemoved(screen.queryAllByTestId('checkedAvatar'));
			await screen.findAllByTestId('icon: Flag');
			expect(screen.getAllByTestId('icon: Flag')).toHaveLength(
				nodesIdsToFlag.length - nodesIdsToUnflag.length
			);
		});

		describe('Copy', () => {
			test('Copy is enabled when multiple files are selected', async () => {
				const currentFolder = populateFolder();
				currentFolder.permissions.can_write_file = true;
				currentFolder.permissions.can_write_folder = true;
				const file = populateFile();
				file.parent = currentFolder;
				const folder = populateFolder();
				folder.parent = currentFolder;
				currentFolder.children.push(file, folder);

				const mocks = [mockGetChildren(getChildrenVariables(currentFolder.id), currentFolder)];

				const setNewFolderMock = jest.fn();
				const setNewFileMock = jest.fn();

				render(
					<FolderList
						folderId={currentFolder.id}
						setNewFolder={setNewFolderMock}
						setNewFile={setNewFileMock}
						canUploadFile={false}
					/>,
					{ mocks }
				);

				await screen.findByText(file.name);
				selectNodes([file.id, folder.id]);

				// check that all wanted items are selected
				expect(screen.getAllByTestId('checkedAvatar')).toHaveLength(2);
				expect(screen.getByTestId('icon: MoreVertical')).toBeVisible();
				userEvent.click(screen.getByTestId('icon: MoreVertical'));
				const copyAction = await screen.findByText(actionRegexp.copy);
				expect(copyAction).toBeVisible();
				expect(copyAction.parentElement).not.toHaveAttribute('disabled', '');
			});

			test('Copy confirm action close the modal and clear cached data for destination folder if destination folder is not current folder', async () => {
				const currentFolder = populateFolder(5);
				const destinationFolder = populateFolder();
				destinationFolder.permissions.can_write_folder = true;
				destinationFolder.permissions.can_write_file = true;
				currentFolder.children.push(destinationFolder);
				const nodeToCopy = currentFolder.children[0] as Node;

				// write destination folder in cache as if it was already loaded
				global.apolloClient.writeQuery<GetChildrenQuery, GetChildrenQueryVariables>({
					query: GET_CHILDREN,
					variables: getChildrenVariables(destinationFolder.id),
					data: {
						getNode: destinationFolder
					}
				});
				const mocks = [
					mockGetPath({ node_id: currentFolder.id }, [currentFolder]),
					mockGetChildren(getChildrenVariables(currentFolder.id), currentFolder),
					mockCopyNodes(
						{
							node_ids: [nodeToCopy.id],
							destination_id: destinationFolder.id
						},
						[{ ...nodeToCopy, parent: destinationFolder }]
					)
				];

				const setNewFolderMock = jest.fn();
				const setNewFileMock = jest.fn();

				render(
					<FolderList
						folderId={currentFolder.id}
						setNewFolder={setNewFolderMock}
						setNewFile={setNewFileMock}
						canUploadFile={false}
					/>,
					{ mocks }
				);

				await screen.findByText(nodeToCopy.name);

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
				selectNodes([nodeToCopy.id]);
				// check that all wanted items are selected
				expect(screen.getByTestId('checkedAvatar')).toBeInTheDocument();
				expect(screen.getByTestId('icon: MoreVertical')).toBeVisible();
				userEvent.click(screen.getByTestId('icon: MoreVertical'));
				const CopyAction = await screen.findByText(actionRegexp.copy);
				expect(CopyAction).toBeVisible();
				userEvent.click(CopyAction);

				const modalList = await screen.findByTestId(`modal-list-${currentFolder.id}`);
				const destinationFolderItem = await within(modalList).findByText(destinationFolder.name);
				userEvent.click(destinationFolderItem);
				expect(screen.getByRole('button', { name: actionRegexp.copy })).not.toHaveAttribute(
					'disabled',
					''
				);
				userEvent.click(screen.getByRole('button', { name: actionRegexp.copy }));
				const snackbar = await screen.findByText(/Item copied/i);
				await waitForElementToBeRemoved(snackbar);
				expect(screen.queryByRole('button', { name: actionRegexp.copy })).not.toBeInTheDocument();
				expect(screen.queryByTestId('checkedAvatar')).not.toBeInTheDocument();

				destinationFolderCachedData = global.apolloClient.readQuery<
					GetChildrenQuery,
					GetChildrenQueryVariables
				>({
					query: GET_CHILDREN,
					variables: getChildrenVariables(destinationFolder.id)
				});

				expect(destinationFolderCachedData).toBeNull();
			});

			test(
				'Copy confirm action close the modal and add copied node in current folder list if it is the destination folder.' +
					'New nodes are ordered in the list',
				async () => {
					const currentFolder = populateFolder(5);
					currentFolder.permissions.can_write_folder = true;
					currentFolder.permissions.can_write_file = true;
					const nodesToCopy = [currentFolder.children[0], currentFolder.children[1]] as Node[];
					const copiedNodes = map(nodesToCopy, (node) => ({
						...node,
						id: faker.datatype.uuid(),
						name: `${node.name}-copied`
					}));

					const mocks = [
						mockGetPath({ node_id: currentFolder.id }, [currentFolder]),
						mockGetChildren(getChildrenVariables(currentFolder.id), currentFolder),
						mockCopyNodes(
							{
								node_ids: map(nodesToCopy, (node) => node.id),
								destination_id: currentFolder.id
							},
							copiedNodes
						)
					];

					const setNewFolderMock = jest.fn();
					const setNewFileMock = jest.fn();

					render(
						<FolderList
							folderId={currentFolder.id}
							setNewFolder={setNewFolderMock}
							setNewFile={setNewFileMock}
							canUploadFile={false}
						/>,
						{
							mocks,
							initialRouterEntries: [`/?folder=${currentFolder.id}`]
						}
					);

					await screen.findByText(nodesToCopy[0].name);

					expect(screen.getAllByTestId('node-item', { exact: false })).toHaveLength(
						currentFolder.children.length
					);
					// activate selection mode by selecting items
					selectNodes(map(nodesToCopy, (node) => node.id));
					// check that all wanted items are selected
					expect(screen.getAllByTestId('checkedAvatar')).toHaveLength(nodesToCopy.length);
					expect(screen.getByTestId('icon: MoreVertical')).toBeVisible();
					userEvent.click(screen.getByTestId('icon: MoreVertical'));
					const copyAction = await screen.findByText(actionRegexp.copy);
					expect(copyAction).toBeVisible();
					userEvent.click(copyAction);

					const modalList = await screen.findByTestId(`modal-list-${currentFolder.id}`);
					expect(within(modalList).getAllByTestId('node-item', { exact: false })).toHaveLength(
						currentFolder.children.length
					);
					expect(screen.getByRole('button', { name: actionRegexp.copy })).not.toHaveAttribute(
						'disabled',
						''
					);
					userEvent.click(screen.getByRole('button', { name: actionRegexp.copy }));
					const snackbar = await screen.findByText(/Item copied/i);
					await waitForElementToBeRemoved(snackbar);
					expect(screen.queryByRole('button', { name: actionRegexp.copy })).not.toBeInTheDocument();
					expect(screen.queryByTestId('checkedAvatar')).not.toBeInTheDocument();

					const nodeItems = screen.getAllByTestId('node-item', { exact: false });
					expect(screen.getByText(copiedNodes[0].name)).toBeVisible();
					expect(screen.getByText(copiedNodes[1].name)).toBeVisible();
					expect(nodeItems).toHaveLength(currentFolder.children.length + copiedNodes.length);
					// each node is positioned after its original
					expect(screen.getByTestId(`node-item-${copiedNodes[0].id}`)).toBe(nodeItems[1]);
					expect(screen.getByTestId(`node-item-${copiedNodes[1].id}`)).toBe(nodeItems[3]);
				}
			);
		});
	});

	describe('Contextual menu actions', () => {
		describe('Contextual menu on empty space', () => {
			describe('Contextual menu on empty space in a folder with few nodes', () => {
				test('when isCanCreateFolder and isCanCreateFolder are true', async () => {
					const currentFolder = populateFolder();
					const node1 = populateNode();
					const node2 = populateNode();
					const node3 = populateNode();

					currentFolder.children.push(node1, node2, node3);

					const mocks = [mockGetChildren(getChildrenVariables(currentFolder.id), currentFolder)];
					const createFolderAction = jest.fn();
					const createDocumentAction = jest.fn();
					const createSpreadsheetAction = jest.fn();
					const createPresentationAction = jest.fn();
					const isCanCreateFolder = true;
					const isCanCreateFile = true;

					const actions = [
						{
							id: 'create-folder',
							label: 'New Folder',
							icon: 'FolderOutline',
							click: createFolderAction,
							disabled: !isCanCreateFolder
						},
						{
							id: 'create-docs-document',
							label: 'New Document',
							icon: 'FileTextOutline',
							click: createDocumentAction,
							disabled: !isCanCreateFile
						},
						{
							id: 'create-docs-spreadsheet',
							label: 'New Spreadsheet',
							icon: 'FileCalcOutline',
							click: createSpreadsheetAction,
							disabled: !isCanCreateFile
						},
						{
							id: 'create-docs-presentation',
							label: 'New Presentation',
							icon: 'FilePresentationOutline',
							click: createPresentationAction,
							disabled: !isCanCreateFile
						}
					];

					const setNewFolderMock = jest.fn();
					const setNewFileMock = jest.fn();

					render(
						<FolderList
							folderId={currentFolder.id}
							fillerWithActions={<EmptySpaceFiller actions={actions} />}
							setNewFolder={setNewFolderMock}
							setNewFile={setNewFileMock}
							canUploadFile={false}
						/>,
						{ mocks }
					);

					// wait for the load to be completed
					await waitForElementToBeRemoved(screen.queryByTestId('icon: Refresh'));

					const fillerContainer = await screen.findByTestId(`fillerContainer`);
					// const emptySpaceFiller = await screen.findByTestId(`emptyFolder`);

					// open context menu and click on empty space
					fireEvent.contextMenu(fillerContainer);

					// new Folder
					const newFolderActionItem = await screen.findByText(/\bNew Folder\b/i);
					expect(newFolderActionItem).toBeVisible();
					expect(
						includes((newFolderActionItem.parentElement as Element).getAttributeNames(), 'disabled')
					).toBeFalsy();
					userEvent.click(newFolderActionItem);
					expect(createFolderAction).toBeCalledTimes(1);

					// open context menu and click on empty space
					fireEvent.contextMenu(fillerContainer);

					// new Document
					const newDocumentActionItem = await screen.findByText(/\bNew Document\b/i);
					expect(newDocumentActionItem).toBeVisible();
					expect(
						includes(
							(newDocumentActionItem.parentElement as Element).getAttributeNames(),
							'disabled'
						)
					).toBeFalsy();
					userEvent.click(newDocumentActionItem);
					expect(createDocumentAction).toBeCalledTimes(1);

					// open context menu and click on empty space
					fireEvent.contextMenu(fillerContainer);

					// New Spreadsheet
					const newSpreadsheetActionItem = await screen.findByText(/\bNew Spreadsheet\b/i);
					expect(newSpreadsheetActionItem).toBeVisible();
					expect(
						includes(
							(newSpreadsheetActionItem.parentElement as Element).getAttributeNames(),
							'disabled'
						)
					).toBeFalsy();
					userEvent.click(newSpreadsheetActionItem);
					expect(createSpreadsheetAction).toBeCalledTimes(1);

					// open context menu and click on empty space
					fireEvent.contextMenu(fillerContainer);

					// New Presentation
					const newPresentationActionItem = await screen.findByText(/\bNew Presentation\b/i);
					expect(newPresentationActionItem).toBeVisible();
					expect(
						includes(
							(newPresentationActionItem.parentElement as Element).getAttributeNames(),
							'disabled'
						)
					).toBeFalsy();
					userEvent.click(newPresentationActionItem);
					expect(createPresentationAction).toBeCalledTimes(1);

					expect.assertions(12);
				});
				test('when isCanCreateFolder and isCanCreateFolder are false', async () => {
					const currentFolder = populateFolder();
					const node1 = populateNode();
					const node2 = populateNode();
					const node3 = populateNode();

					currentFolder.children.push(node1, node2, node3);

					const mocks = [mockGetChildren(getChildrenVariables(currentFolder.id), currentFolder)];
					const createFolderAction = jest.fn();
					const createDocumentAction = jest.fn();
					const createSpreadsheetAction = jest.fn();
					const createPresentationAction = jest.fn();
					const isCanCreateFolder = false;
					const isCanCreateFile = false;

					const actions = [
						{
							id: 'create-folder',
							label: 'New Folder',
							icon: 'FolderOutline',
							click: createFolderAction,
							disabled: !isCanCreateFolder
						},
						{
							id: 'create-docs-document',
							label: 'New Document',
							icon: 'FileTextOutline',
							click: createDocumentAction,
							disabled: !isCanCreateFile
						},
						{
							id: 'create-docs-spreadsheet',
							label: 'New Spreadsheet',
							icon: 'FileCalcOutline',
							click: createSpreadsheetAction,
							disabled: !isCanCreateFile
						},
						{
							id: 'create-docs-presentation',
							label: 'New Presentation',
							icon: 'FilePresentationOutline',
							click: createPresentationAction,
							disabled: !isCanCreateFile
						}
					];

					const setNewFolderMock = jest.fn();
					const setNewFileMock = jest.fn();

					render(
						<FolderList
							folderId={currentFolder.id}
							fillerWithActions={<EmptySpaceFiller actions={actions} />}
							setNewFolder={setNewFolderMock}
							setNewFile={setNewFileMock}
							canUploadFile={false}
						/>,
						{ mocks }
					);

					// wait for the load to be completed
					await waitForElementToBeRemoved(screen.queryByTestId('icon: Refresh'));

					const fillerContainer = await screen.findByTestId(`fillerContainer`);
					// const emptySpaceFiller = await screen.findByTestId(`emptyFolder`);

					// open context menu and click on empty space
					fireEvent.contextMenu(fillerContainer);

					// new Folder
					const newFolderActionItem = await screen.findByText(/\bNew Folder\b/i);
					expect(newFolderActionItem).toBeVisible();
					expect(
						includes((newFolderActionItem.parentElement as Element).getAttributeNames(), 'disabled')
					).toBeTruthy();
					expect(newFolderActionItem.parentElement).toHaveAttribute('disabled', '');
					userEvent.click(newFolderActionItem);
					expect(createFolderAction).not.toBeCalled();

					// open context menu and click on empty space
					fireEvent.contextMenu(fillerContainer);

					// new Document
					const newDocumentActionItem = await screen.findByText(/\bNew Document\b/i);
					expect(newDocumentActionItem).toBeVisible();
					expect(
						includes(
							(newDocumentActionItem.parentElement as Element).getAttributeNames(),
							'disabled'
						)
					).toBeTruthy();
					expect(newDocumentActionItem.parentElement).toHaveAttribute('disabled', '');
					userEvent.click(newDocumentActionItem);
					expect(createDocumentAction).not.toBeCalled();

					// open context menu and click on empty space
					fireEvent.contextMenu(fillerContainer);

					// New Spreadsheet
					const newSpreadsheetActionItem = await screen.findByText(/\bNew Spreadsheet\b/i);
					expect(newSpreadsheetActionItem).toBeVisible();
					expect(
						includes(
							(newSpreadsheetActionItem.parentElement as Element).getAttributeNames(),
							'disabled'
						)
					).toBeTruthy();
					expect(newSpreadsheetActionItem.parentElement).toHaveAttribute('disabled', '');
					userEvent.click(newSpreadsheetActionItem);
					expect(createSpreadsheetAction).not.toBeCalled();

					// open context menu and click on empty space
					fireEvent.contextMenu(fillerContainer);

					// New Presentation
					const newPresentationActionItem = await screen.findByText(/\bNew Presentation\b/i);
					expect(newPresentationActionItem).toBeVisible();
					expect(
						includes(
							(newPresentationActionItem.parentElement as Element).getAttributeNames(),
							'disabled'
						)
					).toBeTruthy();
					expect(newPresentationActionItem.parentElement).toHaveAttribute('disabled', '');
					userEvent.click(newPresentationActionItem);
					expect(createPresentationAction).not.toBeCalled();

					expect.assertions(16);
				});
			});
			describe('Contextual menu on empty space in a folder with no nodes', () => {
				test('when isCanCreateFolder and isCanCreateFolder are true', async () => {
					const currentFolder = populateFolder();

					const mocks = [mockGetChildren(getChildrenVariables(currentFolder.id), currentFolder)];
					const createFolderAction = jest.fn();
					const createDocumentAction = jest.fn();
					const createSpreadsheetAction = jest.fn();
					const createPresentationAction = jest.fn();
					const isCanCreateFolder = true;
					const isCanCreateFile = true;

					const actions = [
						{
							id: 'create-folder',
							label: 'New Folder',
							icon: 'FolderOutline',
							click: createFolderAction,
							disabled: !isCanCreateFolder
						},
						{
							id: 'create-docs-document',
							label: 'New Document',
							icon: 'FileTextOutline',
							click: createDocumentAction,
							disabled: !isCanCreateFile
						},
						{
							id: 'create-docs-spreadsheet',
							label: 'New Spreadsheet',
							icon: 'FileCalcOutline',
							click: createSpreadsheetAction,
							disabled: !isCanCreateFile
						},
						{
							id: 'create-docs-presentation',
							label: 'New Presentation',
							icon: 'FilePresentationOutline',
							click: createPresentationAction,
							disabled: !isCanCreateFile
						}
					];

					const setNewFolderMock = jest.fn();
					const setNewFileMock = jest.fn();

					render(
						<FolderList
							folderId={currentFolder.id}
							fillerWithActions={<EmptySpaceFiller actions={actions} />}
							setNewFolder={setNewFolderMock}
							setNewFile={setNewFileMock}
							canUploadFile={false}
						/>,
						{ mocks }
					);

					// wait for the load to be completed
					await waitForElementToBeRemoved(screen.queryByTestId('icon: Refresh'));

					// const fillerContainer = await screen.findByTestId(`fillerContainer`);
					const emptySpaceFiller = await screen.findByTestId(`emptyFolder`);

					// open context menu and click on empty space
					fireEvent.contextMenu(emptySpaceFiller);

					// new Folder
					const newFolderActionItem = await screen.findByText(/\bNew Folder\b/i);
					expect(newFolderActionItem).toBeVisible();
					expect(
						includes((newFolderActionItem.parentElement as Element).getAttributeNames(), 'disabled')
					).toBeFalsy();
					userEvent.click(newFolderActionItem);
					expect(createFolderAction).toBeCalledTimes(1);

					// open context menu and click on empty space
					fireEvent.contextMenu(emptySpaceFiller);

					// new Document
					const newDocumentActionItem = await screen.findByText(/\bNew Document\b/i);
					expect(newDocumentActionItem).toBeVisible();
					expect(
						includes(
							(newDocumentActionItem.parentElement as Element).getAttributeNames(),
							'disabled'
						)
					).toBeFalsy();
					userEvent.click(newDocumentActionItem);
					expect(createDocumentAction).toBeCalledTimes(1);

					// open context menu and click on empty space
					fireEvent.contextMenu(emptySpaceFiller);

					// New Spreadsheet
					const newSpreadsheetActionItem = await screen.findByText(/\bNew Spreadsheet\b/i);
					expect(newSpreadsheetActionItem).toBeVisible();
					expect(
						includes(
							(newSpreadsheetActionItem.parentElement as Element).getAttributeNames(),
							'disabled'
						)
					).toBeFalsy();
					userEvent.click(newSpreadsheetActionItem);
					expect(createSpreadsheetAction).toBeCalledTimes(1);

					// open context menu and click on empty space
					fireEvent.contextMenu(emptySpaceFiller);

					// New Presentation
					const newPresentationActionItem = await screen.findByText(/\bNew Presentation\b/i);
					expect(newPresentationActionItem).toBeVisible();
					expect(
						includes(
							(newPresentationActionItem.parentElement as Element).getAttributeNames(),
							'disabled'
						)
					).toBeFalsy();
					userEvent.click(newPresentationActionItem);
					expect(createPresentationAction).toBeCalledTimes(1);

					expect.assertions(12);
				});
				test('when isCanCreateFolder and isCanCreateFolder are false', async () => {
					const currentFolder = populateFolder();

					const mocks = [mockGetChildren(getChildrenVariables(currentFolder.id), currentFolder)];
					const createFolderAction = jest.fn();
					const createDocumentAction = jest.fn();
					const createSpreadsheetAction = jest.fn();
					const createPresentationAction = jest.fn();
					const isCanCreateFolder = false;
					const isCanCreateFile = false;

					const actions = [
						{
							id: 'create-folder',
							label: 'New Folder',
							icon: 'FolderOutline',
							click: createFolderAction,
							disabled: !isCanCreateFolder
						},
						{
							id: 'create-docs-document',
							label: 'New Document',
							icon: 'FileTextOutline',
							click: createDocumentAction,
							disabled: !isCanCreateFile
						},
						{
							id: 'create-docs-spreadsheet',
							label: 'New Spreadsheet',
							icon: 'FileCalcOutline',
							click: createSpreadsheetAction,
							disabled: !isCanCreateFile
						},
						{
							id: 'create-docs-presentation',
							label: 'New Presentation',
							icon: 'FilePresentationOutline',
							click: createPresentationAction,
							disabled: !isCanCreateFile
						}
					];

					const setNewFolderMock = jest.fn();
					const setNewFileMock = jest.fn();

					render(
						<FolderList
							folderId={currentFolder.id}
							fillerWithActions={<EmptySpaceFiller actions={actions} />}
							setNewFolder={setNewFolderMock}
							setNewFile={setNewFileMock}
							canUploadFile={false}
						/>,
						{ mocks }
					);

					// wait for the load to be completed
					await waitForElementToBeRemoved(screen.queryByTestId('icon: Refresh'));

					// const fillerContainer = await screen.findByTestId(`fillerContainer`);
					const emptySpaceFiller = await screen.findByTestId(`emptyFolder`);

					// open context menu and click on empty space
					fireEvent.contextMenu(emptySpaceFiller);

					// new Folder
					const newFolderActionItem = await screen.findByText(/\bNew Folder\b/i);
					expect(newFolderActionItem).toBeVisible();
					expect(
						includes((newFolderActionItem.parentElement as Element).getAttributeNames(), 'disabled')
					).toBeTruthy();
					expect(newFolderActionItem.parentElement).toHaveAttribute('disabled', '');
					userEvent.click(newFolderActionItem);
					expect(createFolderAction).not.toBeCalled();

					// open context menu and click on empty space
					fireEvent.contextMenu(emptySpaceFiller);

					// new Document
					const newDocumentActionItem = await screen.findByText(/\bNew Document\b/i);
					expect(newDocumentActionItem).toBeVisible();
					expect(
						includes(
							(newDocumentActionItem.parentElement as Element).getAttributeNames(),
							'disabled'
						)
					).toBeTruthy();
					expect(newDocumentActionItem.parentElement).toHaveAttribute('disabled', '');
					userEvent.click(newDocumentActionItem);
					expect(createDocumentAction).not.toBeCalled();

					// open context menu and click on empty space
					fireEvent.contextMenu(emptySpaceFiller);

					// New Spreadsheet
					const newSpreadsheetActionItem = await screen.findByText(/\bNew Spreadsheet\b/i);
					expect(newSpreadsheetActionItem).toBeVisible();
					expect(
						includes(
							(newSpreadsheetActionItem.parentElement as Element).getAttributeNames(),
							'disabled'
						)
					).toBeTruthy();
					expect(newSpreadsheetActionItem.parentElement).toHaveAttribute('disabled', '');
					userEvent.click(newSpreadsheetActionItem);
					expect(createSpreadsheetAction).not.toBeCalled();

					// open context menu and click on empty space
					fireEvent.contextMenu(emptySpaceFiller);

					// New Presentation
					const newPresentationActionItem = await screen.findByText(/\bNew Presentation\b/i);
					expect(newPresentationActionItem).toBeVisible();
					expect(
						includes(
							(newPresentationActionItem.parentElement as Element).getAttributeNames(),
							'disabled'
						)
					).toBeTruthy();
					expect(newPresentationActionItem.parentElement).toHaveAttribute('disabled', '');
					userEvent.click(newPresentationActionItem);
					expect(createPresentationAction).not.toBeCalled();

					expect.assertions(16);
				});
			});
		});

		describe('Contextual menu actions with selection active', () => {
			test('Contextual menu shown actions', async () => {
				const currentFolder = populateFolder(5);
				// enable permission to Mfd
				forEach(currentFolder.children, (mockedNode) => {
					(mockedNode as Node).permissions.can_write_file = true;
					(mockedNode as Node).permissions.can_write_folder = true;
					(mockedNode as Node).parent = populateFolder(0, currentFolder.id, currentFolder.name);
				});
				const element0 = currentFolder.children[0] as Node;
				const element1 = currentFolder.children[1] as Node;

				const mocks = [mockGetChildren(getChildrenVariables(currentFolder.id), currentFolder)];

				const setNewFolderMock = jest.fn();
				const setNewFileMock = jest.fn();

				render(
					<FolderList
						folderId={currentFolder.id}
						setNewFolder={setNewFolderMock}
						setNewFile={setNewFileMock}
						canUploadFile={false}
					/>,
					{ mocks }
				);

				// wait for the load to be completed
				await waitForElementToBeRemoved(screen.queryByTestId('icon: Refresh'));
				selectNodes([element0.id, element1.id]);

				// right click to open contextual menu
				const nodeItem = screen.getByTestId(`node-item-${element0.id}`);
				fireEvent.contextMenu(nodeItem);

				const moveToTrashAction = await screen.findByText(actionRegexp.moveToTrash);
				expect(moveToTrashAction).toBeVisible();

				const openWithDocsAction = await screen.findByText(actionRegexp.openDocument);
				expect(openWithDocsAction).toBeVisible();

				const renameAction = await screen.findByText(actionRegexp.rename);
				expect(renameAction).toBeVisible();
				expect(renameAction.parentElement).toHaveAttribute('disabled', '');

				const copyAction = await screen.findByText(actionRegexp.copy);
				expect(copyAction).toBeVisible();

				const moveAction = await screen.findByText(actionRegexp.move);
				expect(moveAction).toBeVisible();

				const flagAction = await screen.findByText(actionRegexp.flag);
				expect(flagAction).toBeVisible();

				const unflagAction = await screen.findByText(actionRegexp.unflag);
				expect(unflagAction).toBeVisible();

				const downloadAction = await screen.findByText(actionRegexp.download);
				expect(downloadAction).toBeVisible();
			});
			test('Contextual menu works only on selected nodes', async () => {
				const currentFolder = populateFolder(5);
				// enable permission to Mfd
				forEach(currentFolder.children, (mockedNode) => {
					(mockedNode as Node).permissions.can_write_file = true;
					(mockedNode as Node).permissions.can_write_folder = true;
					(mockedNode as Node).parent = populateFolder(0, currentFolder.id, currentFolder.name);
				});
				const element0 = currentFolder.children[0] as Node;
				const element1 = currentFolder.children[1] as Node;
				const element2 = currentFolder.children[2] as Node;

				const mocks = [mockGetChildren(getChildrenVariables(currentFolder.id), currentFolder)];

				const setNewFolderMock = jest.fn();
				const setNewFileMock = jest.fn();

				render(
					<FolderList
						folderId={currentFolder.id}
						setNewFolder={setNewFolderMock}
						setNewFile={setNewFileMock}
						canUploadFile={false}
					/>,
					{ mocks }
				);

				// wait for the load to be completed
				await waitForElementToBeRemoved(screen.queryByTestId('icon: Refresh'));
				selectNodes([element0.id, element1.id]);

				// right click to open contextual menu
				const nodeItem = screen.getByTestId(`node-item-${element0.id}`);
				fireEvent.contextMenu(nodeItem);

				const moveToTrashAction = await screen.findByText(actionRegexp.moveToTrash);
				expect(moveToTrashAction).toBeVisible();

				const openWithDocsAction = await screen.findByText(actionRegexp.openDocument);
				expect(openWithDocsAction).toBeVisible();

				const renameAction = await screen.findByText(actionRegexp.rename);
				expect(renameAction).toBeVisible();
				expect(renameAction.parentElement).toHaveAttribute('disabled', '');

				const copyAction = await screen.findByText(actionRegexp.copy);
				expect(copyAction).toBeVisible();

				const moveAction = await screen.findByText(actionRegexp.move);
				expect(moveAction).toBeVisible();

				const flagAction = await screen.findByText(actionRegexp.flag);
				expect(flagAction).toBeVisible();

				const unflagAction = await screen.findByText(actionRegexp.unflag);
				expect(unflagAction).toBeVisible();

				const downloadAction = await screen.findByText(actionRegexp.download);
				expect(downloadAction).toBeVisible();

				// right click on unSelected node close open contextual menu
				const nodeItem2 = screen.getByTestId(`node-item-${element2.id}`);
				fireEvent.contextMenu(nodeItem2);

				expect(moveToTrashAction).not.toBeVisible();
				expect(openWithDocsAction).not.toBeVisible();
				expect(renameAction).not.toBeVisible();
				expect(copyAction).not.toBeVisible();
				expect(moveAction).not.toBeVisible();
				expect(flagAction).not.toBeVisible();
				expect(unflagAction).not.toBeVisible();
				expect(downloadAction).not.toBeVisible();
			});
		});

		test('right click on node open the contextual menu for the node, closing a previously opened one. Left click close it', async () => {
			const currentFolder = populateFolder();
			const node1 = populateNode();
			// set the node not flagged so that we can search by flag action in the contextual menu of first node
			node1.flagged = false;
			currentFolder.children.push(node1);
			const node2 = populateNode();
			// set the second node flagged so that we can search by unflag action in the contextual menu of second node
			node2.flagged = true;
			currentFolder.children.push(node2);

			const mocks = [mockGetChildren(getChildrenVariables(currentFolder.id), currentFolder)];

			const setNewFolderMock = jest.fn();
			const setNewFileMock = jest.fn();

			render(
				<FolderList
					folderId={currentFolder.id}
					setNewFolder={setNewFolderMock}
					setNewFile={setNewFileMock}
					canUploadFile={false}
				/>,
				{ mocks }
			);

			// wait for the load to be completed
			await waitForElementToBeRemoved(screen.queryByTestId('icon: Refresh'));

			// right click to open contextual menu
			const node1Item = screen.getByTestId(`node-item-${node1.id}`);
			const node2Item = screen.getByTestId(`node-item-${node2.id}`);
			fireEvent.contextMenu(node1Item);
			// check that the flag action becomes visible (contextual menu of first node)
			const flagAction = await screen.findByText(actionRegexp.flag);
			expect(flagAction).toBeVisible();
			// right click on second node
			fireEvent.contextMenu(node2Item);
			// check that the unflag action becomes visible (contextual menu of second node)
			const unflagAction = await screen.findByText(actionRegexp.unflag);
			expect(unflagAction).toBeVisible();
			// check that the flag action becomes invisible (contextual menu of first node is closed)
			expect(flagAction).not.toBeInTheDocument();
			// left click close all the contextual menu
			act(() => {
				userEvent.click(node2Item);
			});
			expect(unflagAction).not.toBeInTheDocument();
			expect(flagAction).not.toBeInTheDocument();
		});

		test('click on flag action changes flag icon visibility', async () => {
			const currentFolder = populateFolder();
			const node = populateNode();
			// set the node not flagged so that we can search by flag action in the contextual menu of first node
			node.flagged = false;
			currentFolder.children.push(node);

			const mocks = [
				mockGetChildren(getChildrenVariables(currentFolder.id), currentFolder),
				mockFlagNodes(
					{
						node_ids: [node.id],
						flag: true
					},
					[node.id]
				),
				mockFlagNodes(
					{
						node_ids: [node.id],
						flag: false
					},
					[node.id]
				)
			];

			const setNewFolderMock = jest.fn();
			const setNewFileMock = jest.fn();

			render(
				<FolderList
					folderId={currentFolder.id}
					setNewFolder={setNewFolderMock}
					setNewFile={setNewFileMock}
					canUploadFile={false}
				/>,
				{ mocks }
			);

			// wait for the load to be completed
			await waitForElementToBeRemoved(screen.queryByTestId('icon: Refresh'));

			// right click to open contextual menu
			const nodeItem = screen.getByTestId(`node-item-${node.id}`);
			// open context menu and click on flag action
			fireEvent.contextMenu(nodeItem);
			const flagAction = await screen.findByText(actionRegexp.flag);
			expect(flagAction).toBeVisible();
			userEvent.click(flagAction);
			await waitForNetworkResponse();
			await within(nodeItem).findByTestId('icon: Flag');
			expect(flagAction).not.toBeInTheDocument();
			expect(within(nodeItem).getByTestId('icon: Flag')).toBeVisible();
			// open context menu and click on unflag action
			fireEvent.contextMenu(nodeItem);
			const unflagAction = await screen.findByText(actionRegexp.unflag);
			expect(unflagAction).toBeVisible();
			userEvent.click(unflagAction);
			await waitForNetworkResponse();
			expect(unflagAction).not.toBeInTheDocument();
			expect(within(nodeItem).queryByTestId('icon: Flag')).not.toBeInTheDocument();
		});

		describe('Copy', () => {
			test('Copy confirm action close the modal and clear cached data for destination folder', async () => {
				const currentFolder = populateFolder(5);
				const destinationFolder = populateFolder();
				destinationFolder.permissions.can_write_folder = true;
				destinationFolder.permissions.can_write_file = true;
				currentFolder.children.push(destinationFolder);
				const nodeToCopy = currentFolder.children[0] as Node;

				// write destination folder in cache as if it was already loaded
				global.apolloClient.writeQuery<GetChildrenQuery, GetChildrenQueryVariables>({
					query: GET_CHILDREN,
					variables: getChildrenVariables(destinationFolder.id),
					data: {
						getNode: destinationFolder
					}
				});

				const mocks = [
					mockGetPath({ node_id: currentFolder.id }, [currentFolder]),
					mockGetChildren(getChildrenVariables(currentFolder.id), currentFolder),
					mockCopyNodes(
						{
							node_ids: [nodeToCopy.id],
							destination_id: destinationFolder.id
						},
						[{ ...nodeToCopy, parent: destinationFolder }]
					)
				];

				const setNewFolderMock = jest.fn();
				const setNewFileMock = jest.fn();

				render(
					<FolderList
						folderId={currentFolder.id}
						setNewFolder={setNewFolderMock}
						setNewFile={setNewFileMock}
						canUploadFile={false}
					/>,
					{ mocks }
				);

				await screen.findByText(nodeToCopy.name);

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
				const nodeToCopyItem = await screen.findByText(nodeToCopy.name);
				fireEvent.contextMenu(nodeToCopyItem);
				const copyAction = await screen.findByText(actionRegexp.copy);
				expect(copyAction).toBeVisible();
				userEvent.click(copyAction);

				const modalList = await screen.findByTestId(`modal-list-${currentFolder.id}`);
				const destinationFolderItem = await within(modalList).findByText(destinationFolder.name);
				userEvent.click(destinationFolderItem);
				expect(screen.getByRole('button', { name: actionRegexp.copy })).not.toHaveAttribute(
					'disabled',
					''
				);
				userEvent.click(screen.getByRole('button', { name: actionRegexp.copy }));
				const snackbar = await screen.findByText(/Item copied/i);
				await waitForElementToBeRemoved(snackbar);
				expect(screen.queryByRole('button', { name: actionRegexp.copy })).not.toBeInTheDocument();
				// context menu is closed
				expect(screen.queryByText(actionRegexp.copy)).not.toBeInTheDocument();

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

	describe('Create docs files', () => {
		test('Create docs file operation fail shows an error in the modal and does not close it', async () => {
			const currentFolder = populateFolder();
			currentFolder.permissions.can_write_file = true;
			const node1 = populateFile('n1', 'first');
			const node2 = populateFile('n2', 'second');
			const node3 = populateFile('n3', 'third');
			currentFolder.children.push(node1, node2, node3);

			const newName = node2.name;

			const mocks = [
				mockGetParent({ node_id: currentFolder.id }, currentFolder),
				mockGetChildren(getChildrenVariables(currentFolder.id), currentFolder)
			];

			server.use(
				rest.post(`${DOCS_ENDPOINT}${CREATE_FILE_PATH}`, (req, res, ctx) =>
					res(ctx.status(500, 'Error! Name already assigned'))
				),
				graphql.query<GetNodeQuery, GetNodeQueryVariables>('getNode', (req, res, ctx) =>
					res(ctx.data({ getNode: node2 }))
				)
			);

			const setNewFolderMock = jest.fn();
			const setNewFileMock = jest.fn();

			// simulate the creation of a new folder
			const { rerender } = render(
				<FolderList
					folderId={currentFolder.id}
					setNewFile={setNewFileMock}
					setNewFolder={setNewFolderMock}
					canUploadFile={false}
				/>,
				{
					mocks
				}
			);

			// wait for the load to be completed
			await waitForElementToBeRemoved(screen.queryByTestId('icon: Refresh'));
			expect(screen.getAllByTestId('node-item', { exact: false })).toHaveLength(
				currentFolder.children.length
			);
			rerender(
				<FolderList
					folderId={currentFolder.id}
					newFile={DocsType.DOCUMENT}
					setNewFile={setNewFileMock}
					setNewFolder={setNewFileMock}
					canUploadFile={false}
				/>
			);
			await createNode(node2);
			const error = await screen.findByText(/Error! Name already assigned/);
			expect(error).toBeVisible();
			const inputFieldDiv = screen.getByTestId('input-name');
			const inputField = within(inputFieldDiv).getByRole('textbox');
			expect(inputField).toBeVisible();
			expect(inputField).toHaveValue(newName);
			expect(screen.getAllByTestId('node-item', { exact: false })).toHaveLength(
				currentFolder.children.length
			);
		});

		test('Create docs add file node at folder content, showing the element in the ordered list if neighbor is already loaded and ordered', async () => {
			const currentFolder = populateFolder();
			currentFolder.permissions.can_write_file = true;
			const node1 = populateFile('n1', 'first');
			const node2 = populateFile('n2', 'second');
			node2.parent = currentFolder;
			const node3 = populateFile('n3', 'third');
			// add node 1 and 3 as children, node 2 is the new file
			currentFolder.children.push(node1, node3);

			const setNewFolderMock = jest.fn();
			const setNewFileMock = jest.fn();

			const mocks = [
				mockGetParent({ node_id: currentFolder.id }, currentFolder),
				mockGetChildren(getChildrenVariables(currentFolder.id), currentFolder)
			];

			server.use(
				rest.post(DOCS_ENDPOINT + CREATE_FILE_PATH, (req, res, ctx) =>
					res(
						ctx.json({
							nodeId: node2.id
						})
					)
				),
				graphql.query<GetNodeQuery, GetNodeQueryVariables>('getNode', (req, res, ctx) =>
					res(ctx.data({ getNode: node2 }))
				)
			);

			// simulate the creation of a new folder
			const { rerender } = render(
				<FolderList
					folderId={currentFolder.id}
					setNewFile={setNewFileMock}
					setNewFolder={setNewFolderMock}
					canUploadFile={false}
				/>,
				{ mocks }
			);

			// wait for the load to be completed
			await waitForElementToBeRemoved(screen.queryByTestId('icon: Refresh'));
			expect(screen.getAllByTestId('node-item', { exact: false })).toHaveLength(
				currentFolder.children.length
			);
			rerender(
				<FolderList
					folderId={currentFolder.id}
					newFile={DocsType.DOCUMENT}
					setNewFile={setNewFileMock}
					setNewFolder={setNewFolderMock}
					canUploadFile={false}
				/>
			);
			// create action
			await createNode(node2);
			await screen.findByTestId(`node-item-${node2.id}`);
			// trigger rerender without newFolder param
			rerender(
				<FolderList
					folderId={currentFolder.id}
					newFile={undefined}
					setNewFile={setNewFileMock}
					setNewFolder={setNewFolderMock}
					canUploadFile={false}
				/>
			);
			const nodeItem = await screen.findByTestId(`node-item-${node2.id}`);
			expect(screen.queryByTestId('input-name')).not.toBeInTheDocument();
			expect(nodeItem).toBeVisible();
			expect(within(nodeItem).getByText(node2.name)).toBeVisible();
			const nodes = screen.getAllByTestId('node-item', { exact: false });
			expect(nodes).toHaveLength(currentFolder.children.length + 1);
			expect(nodes[1]).toBe(nodeItem);
		});

		test('Create docs file add file node as right sorted position of the list if neighbor is already loaded but unordered', async () => {
			const currentFolder = populateFolder();
			currentFolder.children = populateNodes(NODES_LOAD_LIMIT, 'Folder');
			sortNodes(currentFolder.children, NODES_SORT_DEFAULT);
			currentFolder.permissions.can_write_folder = true;
			const node1 = populateFile('n1', `zzzz-new-file-n1`);
			node1.parent = currentFolder;
			const node2 = populateFile('n2', `zzzz-new-file-n2`);
			node2.parent = currentFolder;
			const node3 = populateFile('n3', `zzzz-new-file-n3`);
			node3.parent = currentFolder;
			// 1) folder with more pages, just 1 loaded
			// 2) create node2 as unordered node3 (not loaded) as neighbor)
			// --> node2 should be last element of the list
			// 3) create node1 as unordered (node2 (loaded and unordered) as neighbor)
			// --> node1 should be put before node2 in the unordered
			// 4) trigger loadMore and load node1, node2, node3 with this order
			// --> list should be updated with the correct order

			const setNewFolderMock = jest.fn();
			const setNewFileMock = jest.fn();

			const mocks = [
				mockGetChildren(getChildrenVariables(currentFolder.id), currentFolder),
				// fetchMore request, cursor is still last ordered node (last child of initial folder)
				mockGetChildren(
					{
						...getChildrenVariables(currentFolder.id),
						cursor: (currentFolder.children[currentFolder.children.length - 1] as Node).id
					},
					{
						...currentFolder,
						// second page contains the new created nodes and node3, not loaded before
						children: [node1, node2, node3]
					} as Folder
				)
			];

			server.use(
				rest.post<CreateDocsFileRequestBody, never, CreateDocsFileResponse>(
					`${DOCS_ENDPOINT}${CREATE_FILE_PATH}`,
					(req, res, ctx) =>
						res(
							ctx.json({
								nodeId:
									(req.body.filename === node2.name && node2.id) ||
									(req.body.filename === node1.name && node1.id) ||
									null
							})
						)
				),
				graphql.query<GetNodeQuery, GetNodeQueryVariables>('getNode', (req, res, ctx) => {
					const { node_id: id } = req.variables;
					let result = null;
					if (id === node1.id) {
						result = node1;
					} else if (id === node2.id) {
						result = node2;
					}
					return res(ctx.data({ getNode: result }));
				})
			);

			// simulate the creation of a new folder
			const { rerender } = render(
				<FolderList
					folderId={currentFolder.id}
					setNewFile={setNewFileMock}
					setNewFolder={setNewFolderMock}
					canUploadFile={false}
				/>,
				{ mocks }
			);

			// wait for the load to be completed
			await waitForElementToBeRemoved(screen.queryByTestId('icon: Refresh'));
			let nodes = screen.getAllByTestId('node-item', { exact: false });
			expect(nodes).toHaveLength(currentFolder.children.length);
			rerender(
				<FolderList
					folderId={currentFolder.id}
					newFile={DocsType.DOCUMENT}
					setNewFile={setNewFileMock}
					setNewFolder={setNewFolderMock}
					canUploadFile={false}
				/>
			);
			// create action
			await createNode(node2);
			await screen.findByTestId(`node-item-${node2.id}`);
			expect(screen.getByText(node2.name)).toBeVisible();
			// trigger rerender without newFolder param
			rerender(
				<FolderList
					folderId={currentFolder.id}
					newFile={undefined}
					setNewFile={setNewFileMock}
					setNewFolder={setNewFolderMock}
					canUploadFile={false}
				/>
			);
			const node2Item = screen.getByTestId(`node-item-${node2.id}`);
			expect(screen.queryByTestId('input-name')).not.toBeInTheDocument();
			expect(node2Item).toBeVisible();
			expect(within(node2Item).getByText(node2.name)).toBeVisible();
			nodes = screen.getAllByTestId('node-item', { exact: false });
			expect(nodes).toHaveLength(currentFolder.children.length + 1);
			// node2 is last element of the list
			expect(nodes[nodes.length - 1]).toBe(node2Item);
			// trigger rerender with newFolder param to create second node
			rerender(
				<FolderList
					folderId={currentFolder.id}
					newFile={DocsType.DOCUMENT}
					setNewFile={setNewFileMock}
					setNewFolder={setNewFolderMock}
					canUploadFile={false}
				/>
			);
			// create action
			await createNode(node1);
			await screen.findByTestId(`node-item-${node1.id}`);
			expect(screen.getByText(node1.name)).toBeVisible();
			// trigger rerender without newFolder param
			rerender(
				<FolderList
					folderId={currentFolder.id}
					newFolder={false}
					setNewFolder={setNewFileMock}
					setNewFile={setNewFileMock}
					canUploadFile={false}
				/>
			);
			expect(screen.queryByTestId('input-name')).not.toBeInTheDocument();
			const node1Item = screen.getByTestId(`node-item-${node1.id}`);
			expect(node1Item).toBeVisible();
			expect(within(node1Item).getByText(node1.name)).toBeVisible();
			nodes = screen.getAllByTestId('node-item', { exact: false });
			expect(nodes).toHaveLength(currentFolder.children.length + 2);
			// node1 is before node2 of the list
			expect(nodes[nodes.length - 2]).toBe(node1Item);
			// node2 is last element of the list
			expect(nodes[nodes.length - 1]).toBe(screen.getByTestId(`node-item-${node2.id}`));
			// trigger load more
			await triggerLoadMore();
			// wait for the load to be completed (node3 is now loaded)
			await screen.findByTestId(`node-item-${node3.id}`);
			nodes = screen.getAllByTestId('node-item', { exact: false });
			expect(nodes).toHaveLength(currentFolder.children.length + 3);
			// node1, node2 and node3 should have the correct order
			expect(screen.getByTestId(`node-item-${node1.id}`)).toBe(nodes[nodes.length - 3]);
			expect(screen.getByTestId(`node-item-${node2.id}`)).toBe(nodes[nodes.length - 2]);
			expect(screen.getByTestId(`node-item-${node3.id}`)).toBe(nodes[nodes.length - 1]);
		});
	});

	describe('Drag and drop', () => {
		test('Drag of files in a folder with right permissions shows upload dropzone with dropzone message. Drop triggers upload in current folder', async () => {
			const currentFolder = populateFolder();
			currentFolder.permissions.can_write_file = true;
			const uploadedFiles = populateNodes(2, 'File') as FilesFile[];
			const files: File[] = [];
			forEach(uploadedFiles, (file) => {
				// eslint-disable-next-line no-param-reassign
				file.parent = currentFolder;
				files.push(new File(['(⌐□_□)'], file.name, { type: file.mime_type }));
			});
			let reqIndex = 0;

			server.use(
				graphql.query<GetChildQuery, GetChildQueryVariables>('getChild', (req, res, ctx) => {
					const { node_id: id } = req.variables;
					const result = (reqIndex < uploadedFiles.length && uploadedFiles[reqIndex]) || null;
					if (result) {
						result.id = id;
						reqIndex += 1;
					}
					return res(ctx.data({ getNode: result }));
				})
			);
			const mocks = [mockGetChildren(getChildrenVariables(currentFolder.id), currentFolder)];

			const dataTransferObj = {
				types: ['Files'],
				files
			};

			const setNewFolderMock = jest.fn();
			const setNewFileMock = jest.fn();

			render(
				<FolderList
					folderId={currentFolder.id}
					canUploadFile
					setNewFolder={setNewFolderMock}
					setNewFile={setNewFileMock}
				/>,
				{ mocks }
			);
			await screen.findByText(/nothing here/i);

			fireEvent.dragEnter(screen.getByText(/nothing here/i), {
				dataTransfer: dataTransferObj
			});

			await screen.findByTestId('dropzone-overlay');
			expect(
				screen.getByText(/Drop here your attachments to quick-add them to this folder/m)
			).toBeVisible();

			fireEvent.drop(screen.getByText(/nothing here/i), {
				dataTransfer: dataTransferObj
			});

			await screen.findByText(uploadedFiles[0].name);
			await screen.findByText(uploadedFiles[1].name);
			expect(screen.getByText(uploadedFiles[0].name)).toBeVisible();
			expect(screen.getByText(uploadedFiles[1].name)).toBeVisible();
			expect(screen.getAllByTestId('node-item', { exact: false })).toHaveLength(
				currentFolder.children.length + uploadedFiles.length
			);
			expect(
				screen.queryByText(/Drop here your attachments to quick-add them to this folder/m)
			).not.toBeInTheDocument();
		});

		test('Drag of files in a folder without right permissions shows upload dropzone "not allowed" message. Drop does nothing', async () => {
			const currentFolder = populateFolder();
			currentFolder.permissions.can_write_file = false;
			const uploadedFiles = populateNodes(2, 'File') as FilesFile[];
			const files: File[] = [];
			forEach(uploadedFiles, (file) => {
				// eslint-disable-next-line no-param-reassign
				file.parent = currentFolder;
				files.push(new File(['(⌐□_□)'], file.name, { type: file.mime_type }));
			});
			let reqIndex = 0;

			server.use(
				graphql.query<GetChildQuery, GetChildQueryVariables>('getChild', (req, res, ctx) => {
					const { node_id: id } = req.variables;
					const result = (reqIndex < uploadedFiles.length && uploadedFiles[reqIndex]) || null;
					if (result) {
						result.id = id;
						reqIndex += 1;
					}
					return res(ctx.data({ getNode: result }));
				})
			);
			const mocks = [mockGetChildren(getChildrenVariables(currentFolder.id), currentFolder)];

			const dataTransferObj = {
				types: ['Files'],
				files
			};

			const setNewFolderMock = jest.fn();
			const setNewFileMock = jest.fn();

			render(
				<FolderList
					folderId={currentFolder.id}
					canUploadFile={false}
					setNewFolder={setNewFolderMock}
					setNewFile={setNewFileMock}
				/>,
				{ mocks }
			);
			await screen.findByText(/nothing here/i);

			fireEvent.dragEnter(screen.getByText(/nothing here/i), {
				dataTransfer: dataTransferObj
			});

			await screen.findByTestId('dropzone-overlay');
			expect(screen.getByText(/You cannot drop an attachment in this area/m)).toBeVisible();

			fireEvent.drop(screen.getByText(/nothing here/i), {
				dataTransfer: dataTransferObj
			});

			expect(screen.queryByText(uploadedFiles[0].name)).not.toBeInTheDocument();
			expect(screen.queryByText(uploadedFiles[1].name)).not.toBeInTheDocument();
			expect(screen.queryByTestId('node-item', { exact: false })).not.toBeInTheDocument();
			expect(
				screen.queryByText(/You cannot drop an attachment in this area/m)
			).not.toBeInTheDocument();
		});

		test('Drag of files in a folder node with right permissions inside a list shows upload dropzone of the list item. Drop triggers upload in list item folder', async () => {
			const currentFolder = populateFolder(2);
			currentFolder.permissions.can_write_file = true;
			const destinationFolder = populateFolder();
			destinationFolder.permissions.can_write_file = true;
			destinationFolder.parent = { ...currentFolder, children: [] } as Folder;
			currentFolder.children.push(destinationFolder);
			const uploadedFiles = populateNodes(2, 'File') as FilesFile[];
			const files: File[] = [];
			forEach(uploadedFiles, (file) => {
				// eslint-disable-next-line no-param-reassign
				file.parent = destinationFolder;
				files.push(new File(['(⌐□_□)'], file.name, { type: file.mime_type }));
			});
			let reqIndex = 0;

			server.use(
				graphql.query<GetChildQuery, GetChildQueryVariables>('getChild', (req, res, ctx) => {
					const { node_id: id } = req.variables;
					const result = (reqIndex < uploadedFiles.length && uploadedFiles[reqIndex]) || null;
					if (result) {
						result.id = id;
						reqIndex += 1;
					}
					return res(ctx.data({ getNode: result }));
				})
			);
			const mocks = [mockGetChildren(getChildrenVariables(currentFolder.id), currentFolder)];

			const dataTransferObj = {
				types: ['Files'],
				files
			};

			const setNewFolderMock = jest.fn();
			const setNewFileMock = jest.fn();

			render(
				<FolderList
					folderId={currentFolder.id}
					canUploadFile
					setNewFolder={setNewFolderMock}
					setNewFile={setNewFileMock}
				/>,
				{ mocks }
			);

			await screen.findByText(destinationFolder.name);

			fireEvent.dragEnter(screen.getByText(destinationFolder.name), {
				dataTransfer: dataTransferObj
			});

			await screen.findByTestId('dropzone-overlay');
			expect(
				screen.queryByText(/Drop here your attachments to quick-add them to this folder/m)
			).not.toBeInTheDocument();

			fireEvent.drop(screen.getByText(destinationFolder.name), {
				dataTransfer: dataTransferObj
			});

			const snackbar = await screen.findByText(
				new RegExp(`Upload occurred in ${destinationFolder.name}`, 'i')
			);
			await waitForElementToBeRemoved(snackbar);
			expect(screen.getAllByTestId('node-item', { exact: false })).toHaveLength(
				currentFolder.children.length
			);
			expect(screen.queryByTestId('dropzone-overlay')).not.toBeInTheDocument();
		});

		test('Drag of files in a folder node without right permissions inside a list shows upload dropzone of the list item. Drop does nothing', async () => {
			const currentFolder = populateFolder(2);
			currentFolder.permissions.can_write_file = true;
			const destinationFolder = populateFolder();
			destinationFolder.permissions.can_write_file = false;
			destinationFolder.parent = { ...currentFolder, children: [] } as Folder;
			currentFolder.children.push(destinationFolder);
			const uploadedFiles = populateNodes(2, 'File') as FilesFile[];
			const files: File[] = [];
			forEach(uploadedFiles, (file) => {
				// eslint-disable-next-line no-param-reassign
				file.parent = destinationFolder;
				files.push(new File(['(⌐□_□)'], file.name, { type: file.mime_type }));
			});
			let reqIndex = 0;

			server.use(
				graphql.query<GetChildQuery, GetChildQueryVariables>('getChild', (req, res, ctx) => {
					const { node_id: id } = req.variables;
					const result = (reqIndex < uploadedFiles.length && uploadedFiles[reqIndex]) || null;
					if (result) {
						result.id = id;
						reqIndex += 1;
					}
					return res(ctx.data({ getNode: result }));
				})
			);
			const mocks = [mockGetChildren(getChildrenVariables(currentFolder.id), currentFolder)];

			const dataTransferObj = {
				types: ['Files'],
				files
			};

			const setNewFolderMock = jest.fn();
			const setNewFileMock = jest.fn();

			render(
				<FolderList
					folderId={currentFolder.id}
					canUploadFile
					setNewFolder={setNewFolderMock}
					setNewFile={setNewFileMock}
				/>,
				{ mocks }
			);

			await screen.findByText(destinationFolder.name);

			fireEvent.dragEnter(screen.getByText(destinationFolder.name), {
				dataTransfer: dataTransferObj
			});

			await screen.findByTestId('dropzone-overlay');
			expect(
				screen.queryByText(/Drop here your attachments to quick-add them to this folder/m)
			).not.toBeInTheDocument();

			fireEvent.drop(screen.getByText(destinationFolder.name), {
				dataTransfer: dataTransferObj
			});

			expect(screen.queryByTestId('dropzone-overlay')).not.toBeInTheDocument();
			expect(screen.queryByText(/Upload occurred/i)).not.toBeInTheDocument();
			expect(screen.getAllByTestId('node-item', { exact: false })).toHaveLength(
				currentFolder.children.length
			);
			expect(reqIndex).toBe(0);
		});

		test('Drag of files in a file node inside a list with right permissions shows upload dropzone of the list. Drop trigger upload in the current folder', async () => {
			const currentFolder = populateFolder(2);
			currentFolder.permissions.can_write_file = true;
			const destinationFile = populateFile();
			destinationFile.permissions.can_write_file = true;
			destinationFile.parent = { ...currentFolder, children: [] } as Folder;
			currentFolder.children.push(destinationFile);
			const uploadedFiles = populateNodes(2, 'File') as FilesFile[];
			const files: File[] = [];
			forEach(uploadedFiles, (file) => {
				// eslint-disable-next-line no-param-reassign
				file.parent = currentFolder;
				files.push(new File(['(⌐□_□)'], file.name, { type: file.mime_type }));
			});
			let reqIndex = 0;

			server.use(
				graphql.query<GetChildQuery, GetChildQueryVariables>('getChild', (req, res, ctx) => {
					const { node_id: id } = req.variables;
					const result = (reqIndex < uploadedFiles.length && uploadedFiles[reqIndex]) || null;
					if (result) {
						result.id = id;
						reqIndex += 1;
					}
					return res(ctx.data({ getNode: result }));
				})
			);
			const mocks = [mockGetChildren(getChildrenVariables(currentFolder.id), currentFolder)];

			const dataTransferObj = {
				types: ['Files'],
				files
			};

			const setNewFolderMock = jest.fn();
			const setNewFileMock = jest.fn();

			render(
				<FolderList
					folderId={currentFolder.id}
					canUploadFile
					setNewFolder={setNewFolderMock}
					setNewFile={setNewFileMock}
				/>,
				{ mocks }
			);

			await screen.findByText(destinationFile.name);

			fireEvent.dragEnter(screen.getByText(destinationFile.name), {
				dataTransfer: dataTransferObj
			});

			await screen.findByTestId('dropzone-overlay');
			expect(
				screen.queryByText(/Drop here your attachments to quick-add them to this folder/m)
			).toBeVisible();

			fireEvent.drop(screen.getByText(destinationFile.name), {
				dataTransfer: dataTransferObj
			});

			await screen.findByText(uploadedFiles[0].name);
			await screen.findByText(uploadedFiles[1].name);
			expect(screen.getByText(uploadedFiles[0].name)).toBeVisible();
			expect(screen.getByText(uploadedFiles[1].name)).toBeVisible();
			expect(screen.getAllByTestId('node-item', { exact: false })).toHaveLength(
				currentFolder.children.length + uploadedFiles.length
			);
			expect(
				screen.queryByText(/Drop here your attachments to quick-add them to this folder/m)
			).not.toBeInTheDocument();
		});

		test('Drag of a node shows move dropzone in other nodes. Dragged node is disabled. Drop triggers move only on folders with right permissions.	Dragged node is removed from current folder list', async () => {
			const currentFolder = populateFolder(5);
			currentFolder.permissions.can_write_file = true;
			currentFolder.permissions.can_write_folder = true;
			const nodesToDrag = [currentFolder.children[0]] as Node[];
			forEach(nodesToDrag, (mockedNode) => {
				mockedNode.permissions.can_write_file = true;
				mockedNode.permissions.can_write_folder = true;
			});
			const destinationFolder = populateFolder();
			destinationFolder.permissions.can_write_folder = true;
			destinationFolder.permissions.can_write_file = true;
			destinationFolder.parent = currentFolder;
			currentFolder.children.push(destinationFolder);
			const folderWithoutPermission = populateFolder();
			folderWithoutPermission.permissions.can_write_folder = false;
			folderWithoutPermission.permissions.can_write_file = false;
			folderWithoutPermission.parent = currentFolder;
			currentFolder.children.push(folderWithoutPermission);

			const mocks = [
				mockGetChildren(getChildrenVariables(currentFolder.id), currentFolder),
				mockMoveNodes(
					{
						node_ids: map(nodesToDrag, (node) => node.id),
						destination_id: destinationFolder.id
					},
					map(nodesToDrag, (node) => ({ ...node, parent: destinationFolder }))
				)
			];

			let dataTransferData: Record<string, string> = {};
			let dataTransferTypes: string[] = [];
			const dataTransfer = (): Partial<DataTransfer> => ({
				setDragImage: jest.fn(),
				setData: jest.fn().mockImplementation((type, data) => {
					dataTransferData[type] = data;
					dataTransferTypes.includes(type) || dataTransferTypes.push(type);
				}),
				getData: jest.fn().mockImplementation((type) => dataTransferData[type]),
				types: dataTransferTypes,
				clearData: jest.fn().mockImplementation(() => {
					dataTransferTypes = [];
					dataTransferData = {};
				})
			});

			const setNewFolderMock = jest.fn();
			const setNewFileMock = jest.fn();

			render(
				<FolderList
					folderId={currentFolder.id}
					canUploadFile
					setNewFolder={setNewFolderMock}
					setNewFile={setNewFileMock}
				/>,
				{ mocks }
			);

			const itemToDrag = await screen.findByText(nodesToDrag[0].name);
			fireEvent.dragStart(itemToDrag, { dataTransfer: dataTransfer() });
			fireEvent.dragEnter(itemToDrag, { dataTransfer: dataTransfer() });
			await waitFor(
				() =>
					new Promise((resolve) => {
						setTimeout(resolve, 100);
					})
			);
			// two items are visible for the node, the one in the list is disabled, the other one is the one dragged and is not disabled
			const draggedNodeItems = screen.getAllByText(nodesToDrag[0].name);
			expect(draggedNodeItems).toHaveLength(2);
			expect(draggedNodeItems[0]).toHaveAttribute('disabled', '');
			expect(draggedNodeItems[1]).not.toHaveAttribute('disabled', '');
			expect(screen.queryByTestId('dropzone-overlay')).not.toBeInTheDocument();
			fireEvent.dragLeave(itemToDrag, { dataTransfer: dataTransfer() });

			// drag and drop on folder without permissions
			const folderWithoutPermissionsItem = screen.getByText(folderWithoutPermission.name);
			fireEvent.dragEnter(folderWithoutPermissionsItem, { dataTransfer: dataTransfer() });
			await screen.findByTestId('dropzone-overlay');
			expect(screen.getByTestId('dropzone-overlay')).toBeVisible();
			expect(screen.queryByText('Drag&Drop Mode')).not.toBeInTheDocument();
			fireEvent.drop(folderWithoutPermissionsItem, { dataTransfer: dataTransfer() });
			fireEvent.dragEnd(itemToDrag, { dataTransfer: dataTransfer() });
			await waitFor(
				() =>
					new Promise((resolve) => {
						setTimeout(resolve, 100);
					})
			);
			expect(screen.queryByTestId('dropzone-overlay')).not.toBeInTheDocument();
			expect(itemToDrag).toBeVisible();
			expect(itemToDrag).not.toHaveAttribute('disabled', '');

			// drag and drop on folder with permissions
			const destinationItem = screen.getByText(destinationFolder.name);
			fireEvent.dragStart(itemToDrag, { dataTransfer: dataTransfer() });
			fireEvent.dragEnter(destinationItem, { dataTransfer: dataTransfer() });
			await screen.findByTestId('dropzone-overlay');
			expect(screen.getByTestId('dropzone-overlay')).toBeVisible();
			expect(screen.queryByText('Drag&Drop Mode')).not.toBeInTheDocument();
			fireEvent.drop(destinationItem, { dataTransfer: dataTransfer() });
			fireEvent.dragEnd(itemToDrag, { dataTransfer: dataTransfer() });
			expect(screen.queryByTestId('dropzone-overlay')).not.toBeInTheDocument();
			await waitForElementToBeRemoved(itemToDrag);
			expect(screen.queryByText(nodesToDrag[0].name)).not.toBeInTheDocument();
			const snackbar = await screen.findByText(/Item moved/i);
			await waitForElementToBeRemoved(snackbar);
		});

		test('Drag of a node without move permissions cause no dropzone to be shown', async () => {
			const currentFolder = populateFolder(5);
			currentFolder.permissions.can_write_file = true;
			currentFolder.permissions.can_write_folder = true;
			const nodesToDrag = [currentFolder.children[0]] as Node[];
			forEach(nodesToDrag, (mockedNode) => {
				mockedNode.permissions.can_write_file = false;
				mockedNode.permissions.can_write_folder = false;
			});
			const destinationFolder = populateFolder();
			destinationFolder.permissions.can_write_folder = true;
			destinationFolder.permissions.can_write_file = true;
			destinationFolder.parent = currentFolder;
			currentFolder.children.push(destinationFolder);
			const folderWithoutPermission = populateFolder();
			folderWithoutPermission.permissions.can_write_folder = false;
			folderWithoutPermission.permissions.can_write_file = false;
			folderWithoutPermission.parent = currentFolder;
			currentFolder.children.push(folderWithoutPermission);

			const mocks = [mockGetChildren(getChildrenVariables(currentFolder.id), currentFolder)];

			let dataTransferData: Record<string, string> = {};
			let dataTransferTypes: string[] = [];
			const dataTransfer = (): Partial<DataTransfer> => ({
				setDragImage: jest.fn(),
				setData: jest.fn().mockImplementation((type, data) => {
					dataTransferData[type] = data;
					dataTransferTypes.includes(type) || dataTransferTypes.push(type);
				}),
				getData: jest.fn().mockImplementation((type) => dataTransferData[type]),
				types: dataTransferTypes,
				clearData: jest.fn().mockImplementation(() => {
					dataTransferTypes = [];
					dataTransferData = {};
				})
			});

			const setNewFolderMock = jest.fn();
			const setNewFileMock = jest.fn();

			render(
				<FolderList
					folderId={currentFolder.id}
					canUploadFile
					setNewFolder={setNewFolderMock}
					setNewFile={setNewFileMock}
				/>,
				{ mocks }
			);

			const itemToDrag = await screen.findByText(nodesToDrag[0].name);
			fireEvent.dragStart(itemToDrag, { dataTransfer: dataTransfer() });
			fireEvent.dragEnter(itemToDrag, { dataTransfer: dataTransfer() });
			await waitFor(
				() =>
					new Promise((resolve) => {
						setTimeout(resolve, 100);
					})
			);
			// two items are visible for the node, the one in the list is disabled, the other one is the one dragged and is not disabled
			const draggedNodeItems = screen.getAllByText(nodesToDrag[0].name);
			expect(draggedNodeItems).toHaveLength(2);
			expect(draggedNodeItems[0]).toHaveAttribute('disabled', '');
			expect(draggedNodeItems[1]).not.toHaveAttribute('disabled', '');
			expect(screen.queryByTestId('dropzone-overlay')).not.toBeInTheDocument();
			fireEvent.dragLeave(itemToDrag, { dataTransfer: dataTransfer() });

			// drag and drop on folder without permissions. Overlay is not shown.
			const folderWithoutPermissionsItem = screen.getByText(folderWithoutPermission.name);
			fireEvent.dragEnter(folderWithoutPermissionsItem, { dataTransfer: dataTransfer() });
			await waitFor(
				() =>
					new Promise((resolve) => {
						setTimeout(resolve, 100);
					})
			);
			expect(screen.queryByTestId('dropzone-overlay')).not.toBeInTheDocument();
			fireEvent.drop(folderWithoutPermissionsItem, { dataTransfer: dataTransfer() });
			fireEvent.dragEnd(itemToDrag, { dataTransfer: dataTransfer() });
			expect(itemToDrag).toBeVisible();
			expect(itemToDrag).not.toHaveAttribute('disabled', '');

			// drag and drop on folder with permissions. Overlay is not shown.
			const destinationItem = screen.getByText(destinationFolder.name);
			fireEvent.dragStart(itemToDrag, { dataTransfer: dataTransfer() });
			fireEvent.dragEnter(destinationItem, { dataTransfer: dataTransfer() });
			await waitFor(
				() =>
					new Promise((resolve) => {
						setTimeout(resolve, 100);
					})
			);
			expect(screen.queryByTestId('dropzone-overlay')).not.toBeInTheDocument();
			fireEvent.drop(destinationItem, { dataTransfer: dataTransfer() });
			fireEvent.dragEnd(itemToDrag, { dataTransfer: dataTransfer() });
			expect(itemToDrag).toBeVisible();
			expect(itemToDrag).not.toHaveAttribute('disabled', '');
		});

		test('Drag of multiple nodes create a list of dragged nodes images', async () => {
			const currentFolder = populateFolder(5);
			currentFolder.permissions.can_write_file = true;
			currentFolder.permissions.can_write_folder = true;
			const nodesToDrag = [...currentFolder.children] as Node[];
			forEach(nodesToDrag, (mockedNode) => {
				mockedNode.permissions.can_write_file = true;
				mockedNode.permissions.can_write_folder = true;
			});
			const destinationFolder = populateFolder();
			destinationFolder.permissions.can_write_folder = true;
			destinationFolder.permissions.can_write_file = true;
			destinationFolder.parent = currentFolder;
			currentFolder.children.push(destinationFolder);

			const mocks = [
				mockGetChildren(getChildrenVariables(currentFolder.id), currentFolder),
				mockMoveNodes(
					{
						node_ids: map(nodesToDrag, (node) => node.id),
						destination_id: destinationFolder.id
					},
					map(nodesToDrag, (node) => ({ ...node, parent: destinationFolder }))
				)
			];

			let dataTransferData: Record<string, string> = {};
			let dataTransferTypes: string[] = [];
			const dataTransfer = (): Partial<DataTransfer> => ({
				setDragImage: jest.fn(),
				setData: jest.fn().mockImplementation((type, data) => {
					dataTransferData[type] = data;
					dataTransferTypes.includes(type) || dataTransferTypes.push(type);
				}),
				getData: jest.fn().mockImplementation((type) => dataTransferData[type]),
				types: dataTransferTypes,
				clearData: jest.fn().mockImplementation(() => {
					dataTransferTypes = [];
					dataTransferData = {};
				})
			});

			const setNewFolderMock = jest.fn();
			const setNewFileMock = jest.fn();

			render(
				<FolderList
					folderId={currentFolder.id}
					canUploadFile
					setNewFolder={setNewFolderMock}
					setNewFile={setNewFileMock}
				/>,
				{ mocks }
			);

			const itemToDrag = await screen.findByText(nodesToDrag[0].name);
			await selectNodes(map(nodesToDrag, (node) => node.id));
			// check that all wanted items are selected
			expect(screen.getAllByTestId('checkedAvatar')).toHaveLength(nodesToDrag.length);

			fireEvent.dragStart(itemToDrag, { dataTransfer: dataTransfer() });
			forEach(nodesToDrag, (node) => {
				const draggedImage = screen.getAllByText(node.name);
				expect(draggedImage).toHaveLength(2);
				expect(draggedImage[0]).toHaveAttribute('disabled', '');
				expect(draggedImage[1]).not.toHaveAttribute('disabled', '');
			});

			const destinationItem = screen.getByText(destinationFolder.name);
			fireEvent.dragEnter(destinationItem, { dataTransfer: dataTransfer() });
			await screen.findByTestId('dropzone-overlay');
			expect(screen.getByTestId('dropzone-overlay')).toBeVisible();
			expect(screen.queryByText('Drag&Drop Mode')).not.toBeInTheDocument();
			fireEvent.drop(destinationItem, { dataTransfer: dataTransfer() });
			fireEvent.dragEnd(itemToDrag, { dataTransfer: dataTransfer() });
			expect(screen.queryByTestId('dropzone-overlay')).not.toBeInTheDocument();
			const snackbar = await screen.findByText(/Item moved/i);
			await waitForElementToBeRemoved(snackbar);
			forEach(nodesToDrag, (node) => {
				const draggedImage = screen.queryByText(node.name);
				expect(draggedImage).not.toBeInTheDocument();
			});

			expect(screen.queryByTestId('checkedAvatar')).not.toBeInTheDocument();
		});

		test('Drag of a node shows move dropzone in breadcrumbs. Drop triggers move only on crumbs with right permissions. Dragged node is removed from current folder list', async () => {
			const owner = populateUser();
			const currentFolder = populateFolder(5);
			currentFolder.permissions.can_write_file = true;
			currentFolder.permissions.can_write_folder = true;
			currentFolder.owner = owner;
			const { path } = populateParents(currentFolder, 4);
			path[0].permissions.can_write_folder = true;
			path[0].permissions.can_write_file = true;
			path[0].owner = owner;
			path[1].permissions.can_write_folder = false;
			path[1].permissions.can_write_file = false;
			path[1].owner = owner;

			const nodesToDrag = [currentFolder.children[0]] as Node[];
			forEach(nodesToDrag, (mockedNode) => {
				mockedNode.permissions.can_write_file = true;
				mockedNode.permissions.can_write_folder = true;
				mockedNode.owner = owner;
			});

			const mocks = [
				mockGetChildren(getChildrenVariables(currentFolder.id), currentFolder),
				mockGetParent({ node_id: currentFolder.id }, currentFolder),
				mockGetPath({ node_id: currentFolder.id }, path),
				mockMoveNodes(
					{
						node_ids: map(nodesToDrag, (node) => node.id),
						destination_id: path[0].id
					},
					map(nodesToDrag, (node) => ({ ...node, parent: path[0] }))
				)
			];

			let dataTransferData: Record<string, string> = {};
			let dataTransferTypes: string[] = [];
			const dataTransfer = (): Partial<DataTransfer> => ({
				setDragImage: jest.fn(),
				setData: jest.fn().mockImplementation((type, data) => {
					dataTransferData[type] = data;
					dataTransferTypes.includes(type) || dataTransferTypes.push(type);
				}),
				getData: jest.fn().mockImplementation((type) => dataTransferData[type]),
				types: dataTransferTypes,
				clearData: jest.fn().mockImplementation(() => {
					dataTransferTypes = [];
					dataTransferData = {};
				})
			});

			const setNewFolderMock = jest.fn();
			const setNewFileMock = jest.fn();

			render(
				<FolderList
					folderId={currentFolder.id}
					canUploadFile
					setNewFolder={setNewFolderMock}
					setNewFile={setNewFileMock}
				/>,
				{ mocks }
			);

			const itemToDrag = await screen.findByText(nodesToDrag[0].name);

			// load full path
			await screen.findByText((currentFolder.parent as Folder).name);
			act(() => {
				userEvent.click(screen.getByTestId('icon: ChevronRight'));
			});
			await screen.findByText(path[0].name);
			// TODO: move fragment to graphql file and add type
			// add missing data in cache
			global.apolloClient.writeFragment({
				fragment: gql`
					fragment NodeOwner on Node {
						owner {
							id
							email
							full_name
						}
					}
				`,
				id: global.apolloClient.cache.identify(path[0]),
				data: {
					owner
				}
			});
			// TODO: move fragment to graphql file and add type
			// add missing data in cache
			global.apolloClient.writeFragment({
				fragment: gql`
					fragment NodeOwner on Node {
						owner {
							id
							email
							full_name
						}
					}
				`,
				id: global.apolloClient.cache.identify(path[1]),
				data: {
					owner
				}
			});

			// start to drag an item of the list
			fireEvent.dragStart(itemToDrag, { dataTransfer: dataTransfer() });

			// drag and drop on crumb without permissions
			const folderWithoutPermissionsItem = screen.getByText(path[1].name);
			fireEvent.dragEnter(folderWithoutPermissionsItem, { dataTransfer: dataTransfer() });
			fireEvent.dragOver(folderWithoutPermissionsItem, { dataTransfer: dataTransfer() });
			expect(folderWithoutPermissionsItem.parentElement).toHaveStyle({
				'background-color': 'rgba(130, 130, 130, 0.4)'
			});
			fireEvent.drop(folderWithoutPermissionsItem, { dataTransfer: dataTransfer() });
			fireEvent.dragEnd(itemToDrag, { dataTransfer: dataTransfer() });
			expect(itemToDrag).toBeVisible();
			expect(itemToDrag).not.toHaveAttribute('disabled', '');
			expect(folderWithoutPermissionsItem).toHaveStyle({
				'background-color': ''
			});

			// drag and drop on crumb with permissions
			const destinationItem = screen.getByText(path[0].name);
			fireEvent.dragStart(itemToDrag, { dataTransfer: dataTransfer() });
			fireEvent.dragEnter(destinationItem, { dataTransfer: dataTransfer() });
			fireEvent.dragOver(destinationItem, { dataTransfer: dataTransfer() });
			expect(destinationItem.parentElement).toHaveStyle({
				'background-color': 'rgba(43, 115, 210, 0.4)'
			});
			fireEvent.drop(destinationItem, { dataTransfer: dataTransfer() });
			fireEvent.dragEnd(itemToDrag, { dataTransfer: dataTransfer() });
			expect(destinationItem).toHaveStyle({
				'background-color': ''
			});
			await waitForElementToBeRemoved(itemToDrag);
			const snackbar = await screen.findByText(/Item moved/i);
			await waitForElementToBeRemoved(snackbar);
			expect(screen.queryByText(nodesToDrag[0].name)).not.toBeInTheDocument();
		});
	});

	describe('Sorting', () => {
		test('Switch from name ascending to name descending order', async () => {
			const currentFolder = populateFolder(0, 'currentFolderId');
			const currentFolder2 = populateFolder(0, 'currentFolderId');

			const fileId1 = 'fileId1';
			const filename1 = 'a';
			const file1 = populateFile(fileId1, filename1);
			file1.permissions.can_write_file = false;
			currentFolder.children.push(file1);

			const fileId2 = 'fileId2';
			const filename2 = 'b';
			const file2 = populateFile(fileId2, filename2);
			file2.permissions.can_write_file = false;
			currentFolder.children.push(file2);

			currentFolder2.children.push(file2);
			currentFolder2.children.push(file1);

			const mocks = [
				mockGetChildren(getChildrenVariables(currentFolder.id), currentFolder),
				mockGetChildren(
					getChildrenVariables(currentFolder2.id, undefined, NodeSort.NameDesc),
					currentFolder2
				)
			];

			const setNewFolderMock = jest.fn();
			const setNewFileMock = jest.fn();

			render(
				<FolderList
					folderId={currentFolder.id}
					setNewFolder={setNewFolderMock}
					setNewFile={setNewFileMock}
					canUploadFile={false}
				/>,
				{ mocks }
			);
			await screen.findByText(filename1);

			const items = screen.getAllByTestId('node-item-', { exact: false });
			expect(within(items[0]).getByText('a')).toBeVisible();
			expect(within(items[1]).getByText('b')).toBeVisible();

			const sortIcon = screen.getByTestId('icon: ZaListOutline');
			expect(sortIcon).toBeInTheDocument();
			expect(sortIcon).toBeVisible();
			expect(sortIcon.parentElement).not.toHaveAttribute('disabled', '');
			act(() => {
				userEvent.click(sortIcon);
			});
			const descendingOrderOption = await screen.findByText('Descending Order');
			userEvent.click(descendingOrderOption);
			await waitFor(() =>
				expect(screen.getAllByTestId('node-item-', { exact: false })[0]).toHaveTextContent('b')
			);
			const descItems = screen.getAllByTestId('node-item-', { exact: false });
			expect(within(descItems[0]).getByText('b')).toBeVisible();
			expect(within(descItems[1]).getByText('a')).toBeVisible();
		});
	});
});
