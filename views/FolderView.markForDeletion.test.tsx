/*
 * SPDX-FileCopyrightText: 2022 Zextras <https://www.zextras.com>
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import React from 'react';

import { fireEvent, screen, waitForElementToBeRemoved } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import forEach from 'lodash/forEach';
import map from 'lodash/map';

import { CreateOptionsContent } from '../../hooks/useCreateOptions';
import { NODES_LOAD_LIMIT } from '../constants';
import { populateFile, populateFolder, sortNodes } from '../mocks/mockUtils';
import { Node } from '../types/common';
import { Folder, NodeSort } from '../types/graphql/types';
import {
	getChildrenVariables,
	mockGetChildren,
	mockGetParent,
	mockGetPermissions,
	mockTrashNodes
} from '../utils/mockUtils';
import { actionRegexp, render, selectNodes, triggerLoadMore } from '../utils/testUtils';
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

describe('Mark for deletion - trash', () => {
	describe('Selection mode', () => {
		test('Mark for deletion remove selected items from the list', async () => {
			const currentFolder = populateFolder(0);
			const fileId1 = 'fileId1';
			const filename1 = 'fileName1';
			const file = populateFile(fileId1, filename1);
			file.permissions.can_write_file = false;
			file.parent = populateFolder(0, currentFolder.id, currentFolder.name);
			currentFolder.children.push(file);

			const folderId1 = 'folderId1';
			const folderName1 = 'folderName1';
			const folder = populateFolder(0, folderId1, folderName1);
			folder.permissions.can_write_folder = true;
			folder.parent = populateFolder(0, currentFolder.id, currentFolder.name);
			currentFolder.children.push(folder);

			const mocks = [
				mockGetChildren(getChildrenVariables(currentFolder.id), currentFolder),
				mockGetPermissions({ node_id: currentFolder.id }, currentFolder),
				mockTrashNodes(
					{
						node_ids: [folderId1]
					},
					[folderId1]
				)
			];

			render(<FolderView />, { initialRouterEntries: [`/?folder=${currentFolder.id}`], mocks });

			await screen.findByText(filename1);
			await screen.findByText(folderName1);

			// activate selection mode by selecting items
			selectNodes([folderId1]);
			// check that all wanted items are selected
			expect(screen.getByTestId('checkedAvatar')).toBeInTheDocument();
			expect(screen.getByTestId('icon: MoreVertical')).toBeVisible();

			userEvent.click(screen.getByTestId('icon: MoreVertical'));

			const trashAction = await screen.findByText(actionRegexp.moveToTrash);
			expect(trashAction.parentNode).not.toHaveAttribute('disabled');
			userEvent.click(trashAction);

			const snackbar = await screen.findByText(/item moved to trash/i);
			await waitForElementToBeRemoved(snackbar);
			expect(trashAction).not.toBeInTheDocument();
			expect(screen.queryByTestId('checkedAvatar')).not.toBeInTheDocument();

			expect(screen.queryAllByTestId(`file-icon-preview`).length).toEqual(1);

			// activate selection mode by selecting items
			selectNodes([fileId1]);
			// check that all wanted items are selected
			expect(screen.getByTestId('checkedAvatar')).toBeInTheDocument();
			expect(screen.getByTestId('icon: MoreVertical')).toBeVisible();

			userEvent.click(screen.getByTestId('icon: MoreVertical'));

			// wait for copy action to check that popper is open
			const copyAction = await screen.findByText(actionRegexp.copy);
			expect(copyAction.parentNode).not.toHaveAttribute('disabled');

			expect(screen.queryByText(actionRegexp.moveToTrash)).not.toBeInTheDocument();
			expect.assertions(10);
		});

		test('Mark for deletion of all loaded nodes trigger refetch of first page', async () => {
			const currentFolder = populateFolder(NODES_LOAD_LIMIT * 2);
			forEach(currentFolder.children, (mockedNode) => {
				(mockedNode as Node).permissions.can_write_file = true;
				(mockedNode as Node).permissions.can_write_folder = true;
			});
			const firstPage = currentFolder.children.slice(0, NODES_LOAD_LIMIT);
			const secondPage = currentFolder.children.slice(NODES_LOAD_LIMIT);
			const nodesToTrash = map(firstPage, (node) => (node as Node).id);

			const mocks = [
				mockGetChildren(getChildrenVariables(currentFolder.id), {
					...currentFolder,
					children: firstPage
				} as Folder),
				mockGetPermissions({ node_id: currentFolder.id }, currentFolder),
				mockGetParent({ node_id: currentFolder.id }, currentFolder),
				mockTrashNodes({ node_ids: nodesToTrash }, nodesToTrash),
				mockGetChildren(getChildrenVariables(currentFolder.id), {
					...currentFolder,
					children: secondPage
				} as Folder)
			];

			render(<FolderView />, { initialRouterEntries: [`/?folder=${currentFolder.id}`], mocks });

			await screen.findByText((firstPage[0] as Node).name);
			expect(screen.getByText((firstPage[0] as Node).name)).toBeVisible();
			expect(screen.getByText((firstPage[NODES_LOAD_LIMIT - 1] as Node).name)).toBeVisible();
			expect(screen.queryByText((secondPage[0] as Node).name)).not.toBeInTheDocument();
			selectNodes(nodesToTrash);
			// check that all wanted items are selected
			expect(screen.getAllByTestId('checkedAvatar')).toHaveLength(firstPage.length);
			expect(screen.getByTestId('icon: MoreVertical')).toBeVisible();

			userEvent.click(screen.getByTestId('icon: MoreVertical'));

			const trashAction = await screen.findByText(actionRegexp.moveToTrash);
			expect(trashAction).toBeVisible();
			userEvent.click(trashAction);

			const snackbar = await screen.findByText(/Item moved to trash/i);
			await waitForElementToBeRemoved(snackbar);
			expect(screen.queryByText((firstPage[0] as Node).name)).not.toBeInTheDocument();
			expect(
				screen.queryByText((firstPage[NODES_LOAD_LIMIT - 1] as Node).name)
			).not.toBeInTheDocument();
			await screen.findByText((secondPage[0] as Node).name);
			expect(screen.queryByText((firstPage[0] as Node).name)).not.toBeInTheDocument();
			expect(
				screen.queryByText((firstPage[NODES_LOAD_LIMIT - 1] as Node).name)
			).not.toBeInTheDocument();
		}, 60000);
	});

	describe('Contextual menu actions', () => {
		test('Mark for deletion from context menu', async () => {
			const currentFolder = populateFolder(5);
			// enable permission to MfD
			forEach(currentFolder.children, (mockedNode) => {
				(mockedNode as Node).permissions.can_write_file = true;
				(mockedNode as Node).permissions.can_write_folder = true;
				(mockedNode as Node).parent = populateFolder(0, currentFolder.id, currentFolder.name);
			});
			const sort = NodeSort.NameAsc; // sort only by name
			sortNodes(currentFolder.children, sort);

			const element = currentFolder.children[0] as Node;

			const mocks = [
				mockGetChildren(getChildrenVariables(currentFolder.id), currentFolder),
				mockGetPermissions({ node_id: currentFolder.id }, currentFolder),
				mockTrashNodes(
					{
						node_ids: [element.id]
					},
					[element.id]
				)
			];

			render(<FolderView />, { initialRouterEntries: [`/?folder=${currentFolder.id}`], mocks });

			// wait for the load to be completed
			await waitForElementToBeRemoved(screen.queryByTestId('icon: Refresh'));

			expect(screen.queryAllByTestId(`file-icon-preview`).length).toEqual(5);

			// right click to open contextual menu
			const nodeItem = screen.getByTestId(`node-item-${element.id}`);
			// open context menu
			fireEvent.contextMenu(nodeItem);

			await screen.findByText(actionRegexp.moveToTrash);
			userEvent.click(screen.getByText(actionRegexp.moveToTrash));

			const snackbar = await screen.findByText(/Item moved to trash/i);
			await waitForElementToBeRemoved(snackbar);

			// contextual menu is closed
			expect(screen.queryByText(actionRegexp.moveToTrash)).not.toBeInTheDocument();

			expect(screen.queryAllByTestId(`file-icon-preview`).length).toEqual(4);
			expect.assertions(3);
		});

		test('Mark for deletion from context menu on selected nodes', async () => {
			const currentFolder = populateFolder(5);
			// enable permission to Mfd
			forEach(currentFolder.children, (mockedNode) => {
				(mockedNode as Node).permissions.can_write_file = true;
				(mockedNode as Node).permissions.can_write_folder = true;
				(mockedNode as Node).parent = populateFolder(0, currentFolder.id, currentFolder.name);
			});
			const sort = NodeSort.NameAsc; // sort only by name
			sortNodes(currentFolder.children, sort);

			const element0 = currentFolder.children[0] as Node;
			const element1 = currentFolder.children[1] as Node;

			const mocks = [
				mockGetChildren(getChildrenVariables(currentFolder.id), currentFolder),
				mockGetPermissions({ node_id: currentFolder.id }, currentFolder),
				mockTrashNodes(
					{
						node_ids: [element0.id, element1.id]
					},
					[element0.id, element1.id]
				)
			];

			render(<FolderView />, { initialRouterEntries: [`/?folder=${currentFolder.id}`], mocks });

			// wait for the load to be completed
			await waitForElementToBeRemoved(screen.queryByTestId('icon: Refresh'));

			expect(screen.queryAllByTestId(`file-icon-preview`).length).toEqual(5);

			selectNodes([element0.id, element1.id]);

			// right click to open contextual menu
			const nodeItem = screen.getByTestId(`node-item-${element0.id}`);
			// open context menu
			fireEvent.contextMenu(nodeItem);

			await screen.findByText(actionRegexp.moveToTrash);
			userEvent.click(screen.getByText(actionRegexp.moveToTrash));
			const snackbar = await screen.findByText(/Item moved to trash/i);
			await waitForElementToBeRemoved(snackbar);

			// contextual menu is closed
			expect(screen.queryByText(actionRegexp.moveToTrash)).not.toBeInTheDocument();

			expect(screen.queryAllByTestId(`file-icon-preview`).length).toEqual(3);
			expect.assertions(3);
		});

		test('Mark for deletion of last ordered node update cursor to be last ordered node and trigger load of the new page with the new cursor', async () => {
			const currentFolder = populateFolder(NODES_LOAD_LIMIT * 2);
			currentFolder.permissions.can_write_folder = true;
			currentFolder.permissions.can_write_file = true;
			forEach(currentFolder.children, (mockedNode) => {
				(mockedNode as Node).permissions.can_write_file = true;
				(mockedNode as Node).permissions.can_write_folder = true;
				(mockedNode as Node).parent = currentFolder;
			});
			const firstPage = currentFolder.children.slice(0, NODES_LOAD_LIMIT) as Node[];
			const secondPage = currentFolder.children.slice(NODES_LOAD_LIMIT) as Node[];

			const mocks = [
				mockGetChildren(getChildrenVariables(currentFolder.id), {
					...currentFolder,
					children: firstPage
				} as Folder),
				mockGetPermissions({ node_id: currentFolder.id }, currentFolder),
				mockGetParent({ node_id: currentFolder.id }, currentFolder),
				mockTrashNodes({ node_ids: [firstPage[NODES_LOAD_LIMIT - 1].id] }, [
					firstPage[NODES_LOAD_LIMIT - 1].id
				]),
				mockGetChildren(
					{
						...getChildrenVariables(currentFolder.id),
						cursor: firstPage[NODES_LOAD_LIMIT - 2].id
					},
					{ ...currentFolder, children: secondPage } as Folder
				)
			];

			render(<FolderView />, { initialRouterEntries: [`/?folder=${currentFolder.id}`], mocks });

			await screen.findByText(firstPage[0].name);
			expect(screen.getByText(firstPage[0].name)).toBeVisible();
			expect(screen.getByText(firstPage[NODES_LOAD_LIMIT - 1].name)).toBeVisible();
			fireEvent.contextMenu(screen.getByText(firstPage[NODES_LOAD_LIMIT - 1].name));
			const moveToTrashAction = await screen.findByText(actionRegexp.moveToTrash);
			expect(moveToTrashAction).toBeVisible();
			expect(moveToTrashAction.parentNode).not.toHaveAttribute('disabled', '');
			userEvent.click(moveToTrashAction);
			const snackbar = await screen.findByText(/Item moved to trash/i);
			await waitForElementToBeRemoved(snackbar);
			expect(screen.queryByText(secondPage[0].name)).not.toBeInTheDocument();
			await triggerLoadMore();
			await screen.findByText(secondPage[0].name);
			expect(screen.getByText(secondPage[0].name)).toBeVisible();
			expect(screen.getByText(secondPage[NODES_LOAD_LIMIT - 1].name)).toBeVisible();
			expect(screen.getByText(firstPage[0].name)).toBeVisible();
			expect(screen.queryByText(firstPage[NODES_LOAD_LIMIT - 1].name)).not.toBeInTheDocument();
		});
	});
});
