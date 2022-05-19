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
import forEach from 'lodash/forEach';
import includes from 'lodash/includes';
import map from 'lodash/map';

import { NODES_LOAD_LIMIT } from '../../constants';
import GET_CHILDREN from '../../graphql/queries/getChildren.graphql';
import { populateFile, populateFolder, populateNode, populateNodes } from '../../mocks/mockUtils';
import { Node } from '../../types/common';
import {
	Folder,
	GetChildrenQuery,
	GetChildrenQueryVariables,
	NodeSort
} from '../../types/graphql/types';
import {
	getChildrenVariables,
	mockFlagNodes,
	mockGetChildren,
	mockGetChildrenError,
	mockGetParent
} from '../../utils/mockUtils';
import {
	actionRegexp,
	generateError,
	render,
	selectNodes,
	triggerLoadMore,
	waitForNetworkResponse
} from '../../utils/testUtils';
import { EmptySpaceFiller } from './EmptySpaceFiller';
import FolderList from './FolderList';

describe('Folder List', () => {
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
