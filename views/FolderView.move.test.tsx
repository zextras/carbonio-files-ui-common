/*
 * SPDX-FileCopyrightText: 2022 Zextras <https://www.zextras.com>
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import React from 'react';

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
import map from 'lodash/map';

import { CreateOptionsContent } from '../../hooks/useCreateOptions';
import { NODES_LOAD_LIMIT } from '../constants';
import GET_CHILDREN from '../graphql/queries/getChildren.graphql';
import { populateFolder } from '../mocks/mockUtils';
import { Node } from '../types/common';
import { Folder, GetChildrenQuery, GetChildrenQueryVariables } from '../types/graphql/types';
import {
	getChildrenVariables,
	mockGetChildren,
	mockGetParent,
	mockGetPath,
	mockGetPermissions,
	mockMoveNodes
} from '../utils/mockUtils';
import {
	actionRegexp,
	buildBreadCrumbRegExp,
	iconRegexp,
	moveNode,
	render,
	selectNodes,
	triggerLoadMore
} from '../utils/testUtils';
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

describe('Move', () => {
	describe('Selection mode', () => {
		test('Move for single node confirm action close the modal, remove items to move from children and clear cached data for destination folder', async () => {
			const currentFolder = populateFolder(5);
			currentFolder.permissions.can_write_folder = true;
			currentFolder.permissions.can_write_file = true;
			const destinationFolder = populateFolder();
			destinationFolder.permissions.can_write_folder = true;
			destinationFolder.permissions.can_write_file = true;
			currentFolder.children.push(destinationFolder);
			const nodeToMove = currentFolder.children[0] as Node;
			nodeToMove.permissions.can_write_folder = true;
			nodeToMove.permissions.can_write_file = true;

			// write destination folder in cache as if it was already loaded
			global.apolloClient.writeQuery<GetChildrenQuery, GetChildrenQueryVariables>({
				query: GET_CHILDREN,
				variables: getChildrenVariables(destinationFolder.id),
				data: {
					getNode: destinationFolder
				}
			});
			const mocks = [
				mockGetChildren(getChildrenVariables(currentFolder.id), currentFolder),
				mockGetPath({ node_id: currentFolder.id }, [currentFolder]),
				mockGetPermissions({ node_id: currentFolder.id }, currentFolder),
				mockMoveNodes(
					{
						node_ids: [nodeToMove.id],
						destination_id: destinationFolder.id
					},
					[{ ...nodeToMove, parent: destinationFolder }]
				)
			];

			render(<FolderView />, { initialRouterEntries: [`/?folder=${currentFolder.id}`], mocks });

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
			await moveNode(destinationFolder);
			const snackbar = await screen.findByText(/Item moved/i);
			await waitForElementToBeRemoved(snackbar);
			expect(screen.queryByTestId('checkedAvatar')).not.toBeInTheDocument();

			expect(screen.queryAllByTestId('node-item', { exact: false })).toHaveLength(
				currentFolder.children.length - 1
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

		test('Move for multiple nodes confirm action close the modal, remove items to move from children and clear cached data for destination folder', async () => {
			const currentFolder = populateFolder(5);
			currentFolder.permissions.can_write_folder = true;
			currentFolder.permissions.can_write_file = true;
			const destinationFolder = populateFolder();
			destinationFolder.permissions.can_write_folder = true;
			destinationFolder.permissions.can_write_file = true;
			currentFolder.children.push(destinationFolder);
			const nodesToMove = [currentFolder.children[0], currentFolder.children[1]] as Node[];
			forEach(nodesToMove, (mockedNode) => {
				(mockedNode as Node).permissions.can_write_folder = true;
				(mockedNode as Node).permissions.can_write_file = true;
			});

			// write destination folder in cache as if it was already loaded
			global.apolloClient.writeQuery<GetChildrenQuery, GetChildrenQueryVariables>({
				query: GET_CHILDREN,
				variables: getChildrenVariables(destinationFolder.id),
				data: {
					getNode: destinationFolder
				}
			});
			const mocks = [
				mockGetChildren(getChildrenVariables(currentFolder.id), currentFolder),
				mockGetPermissions({ node_id: currentFolder.id }, currentFolder),
				mockGetPath({ node_id: currentFolder.id }, [currentFolder]),
				mockMoveNodes(
					{
						node_ids: map(nodesToMove, (nodeToMove) => nodeToMove.id),
						destination_id: destinationFolder.id
					},
					map(nodesToMove, (nodeToMove) => ({ ...nodeToMove, parent: destinationFolder }))
				)
			];

			render(<FolderView />, { initialRouterEntries: [`/?folder=${currentFolder.id}`], mocks });

			await screen.findByText(nodesToMove[0].name);

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
			selectNodes(map(nodesToMove, (nodeToMove) => nodeToMove.id));
			// check that all wanted items are selected
			expect(screen.getAllByTestId('checkedAvatar')).toHaveLength(nodesToMove.length);
			let moveAction = screen.queryByTestId(iconRegexp.move);
			if (!moveAction) {
				expect(screen.getByTestId('icon: MoreVertical')).toBeVisible();
				userEvent.click(screen.getByTestId('icon: MoreVertical'));
				moveAction = await screen.findByText('Move');
			}
			expect(moveAction).toBeVisible();
			userEvent.click(moveAction);
			const modalList = await screen.findByTestId('modal-list-', { exact: false });
			const destinationFolderItem = await within(modalList).findByText(destinationFolder.name);
			userEvent.click(destinationFolderItem);
			await waitFor(() =>
				expect(screen.getByRole('button', { name: /move/i })).not.toHaveAttribute('disabled', '')
			);
			act(() => {
				userEvent.click(screen.getByRole('button', { name: /move/i }));
			});
			await waitForElementToBeRemoved(screen.queryByRole('button', { name: /move/i }));
			expect(screen.queryByRole('button', { name: /move/i })).not.toBeInTheDocument();
			expect(screen.queryByText('Move')).not.toBeInTheDocument();
			const snackbar = await screen.findByText(/Item moved/i);
			await waitForElementToBeRemoved(snackbar);
			expect(screen.queryByTestId('checkedAvatar')).not.toBeInTheDocument();

			expect(screen.queryAllByTestId('node-item', { exact: false })).toHaveLength(
				currentFolder.children.length - nodesToMove.length
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

		test('Move of all loaded nodes trigger refetch of first page', async () => {
			const commonParent = populateFolder();
			commonParent.permissions.can_write_file = true;
			commonParent.permissions.can_write_folder = true;
			const currentFolder = populateFolder(NODES_LOAD_LIMIT * 2);
			currentFolder.parent = commonParent;
			currentFolder.permissions.can_write_folder = true;
			currentFolder.permissions.can_write_file = true;
			const destinationFolder = populateFolder();
			destinationFolder.parent = commonParent;
			destinationFolder.permissions.can_write_folder = true;
			destinationFolder.permissions.can_write_file = true;
			commonParent.children.push(currentFolder, destinationFolder);
			forEach(currentFolder.children, (mockedNode) => {
				(mockedNode as Node).permissions.can_write_file = true;
				(mockedNode as Node).permissions.can_write_folder = true;
				(mockedNode as Node).parent = currentFolder;
			});
			const firstPage = currentFolder.children.slice(0, NODES_LOAD_LIMIT) as Node[];
			const secondPage = currentFolder.children.slice(NODES_LOAD_LIMIT) as Node[];
			const nodesToMove = [...firstPage];

			const mocks = [
				mockGetChildren(getChildrenVariables(currentFolder.id), {
					...currentFolder,
					children: firstPage
				} as Folder),
				mockGetPermissions({ node_id: currentFolder.id }, currentFolder),
				mockGetParent({ node_id: currentFolder.id }, currentFolder),
				mockGetPath({ node_id: currentFolder.id }, [commonParent, currentFolder]),
				mockGetChildren(getChildrenVariables(commonParent.id), commonParent),
				mockGetPath({ node_id: commonParent.id }, [commonParent]),
				mockMoveNodes(
					{
						node_ids: map(nodesToMove, (node) => (node as Node).id),
						destination_id: destinationFolder.id
					},
					map(nodesToMove, (node) => ({ ...node, parent: destinationFolder }))
				),
				mockGetChildren(getChildrenVariables(currentFolder.id), {
					...currentFolder,
					children: secondPage
				} as Folder)
			];

			const { findByTextWithMarkup } = render(<FolderView />, {
				initialRouterEntries: [`/?folder=${currentFolder.id}`],
				mocks
			});

			await screen.findByText(firstPage[0].name);
			expect(screen.getByText(firstPage[0].name)).toBeVisible();
			expect(screen.getByText(firstPage[NODES_LOAD_LIMIT - 1].name)).toBeVisible();
			expect(screen.queryByText(secondPage[0].name)).not.toBeInTheDocument();
			selectNodes(map(nodesToMove, (node) => node.id));
			// check that all wanted items are selected
			expect(screen.getAllByTestId('checkedAvatar')).toHaveLength(firstPage.length);
			expect(screen.getByTestId('icon: MoreVertical')).toBeVisible();
			userEvent.click(screen.getByTestId('icon: MoreVertical'));
			const moveAction = await screen.findByText(actionRegexp.move);
			expect(moveAction).toBeVisible();
			expect(moveAction).not.toHaveAttribute('disabled', '');
			userEvent.click(moveAction);
			await findByTextWithMarkup(buildBreadCrumbRegExp(commonParent.name, currentFolder.name));
			const modalList = screen.getByTestId('modal-list', { exact: false });
			await within(modalList).findByText((currentFolder.children[0] as Node).name);
			const moveModalButton = await screen.findByRole('button', { name: actionRegexp.move });
			expect(moveModalButton).toHaveAttribute('disabled', '');
			userEvent.click(screen.getByText(commonParent.name));
			await findByTextWithMarkup(buildBreadCrumbRegExp(commonParent.name));
			await screen.findByText(destinationFolder.name);
			expect(screen.getByText(destinationFolder.name)).toBeVisible();
			expect(screen.getByText(currentFolder.name)).toBeVisible();
			userEvent.click(screen.getByText(destinationFolder.name));
			await waitFor(() => expect(moveModalButton).not.toHaveAttribute('disabled', ''));
			act(() => {
				userEvent.click(moveModalButton);
			});
			const snackbar = await screen.findByText(/Item moved/i);
			await waitForElementToBeRemoved(snackbar);
			await screen.findByText(secondPage[0].name);
			expect(screen.queryByText(firstPage[0].name)).not.toBeInTheDocument();
			expect(screen.queryByText(firstPage[NODES_LOAD_LIMIT - 1].name)).not.toBeInTheDocument();
			expect(screen.getByText(secondPage[0].name)).toBeVisible();
			expect(screen.getByText(secondPage[NODES_LOAD_LIMIT - 1].name)).toBeVisible();
		}, 60000);
	});

	describe('Contextual menu actions', () => {
		test('Move confirm action close the modal, remove items to move from children and clear cached data for destination folder', async () => {
			const currentFolder = populateFolder(5);
			currentFolder.permissions.can_write_folder = true;
			currentFolder.permissions.can_write_file = true;
			const destinationFolder = populateFolder();
			destinationFolder.permissions.can_write_folder = true;
			destinationFolder.permissions.can_write_file = true;
			currentFolder.children.push(destinationFolder);
			const nodeToMove = currentFolder.children[0] as Node;
			nodeToMove.permissions.can_write_folder = true;
			nodeToMove.permissions.can_write_file = true;

			// write destination folder in cache as if it was already loaded
			global.apolloClient.writeQuery<GetChildrenQuery, GetChildrenQueryVariables>({
				query: GET_CHILDREN,
				variables: getChildrenVariables(destinationFolder.id),
				data: {
					getNode: destinationFolder
				}
			});

			const mocks = [
				mockGetChildren(getChildrenVariables(currentFolder.id), currentFolder),
				mockGetPermissions({ node_id: currentFolder.id }, currentFolder),
				mockGetPath({ node_id: currentFolder.id }, [currentFolder]),
				mockMoveNodes(
					{
						node_ids: [nodeToMove.id],
						destination_id: destinationFolder.id
					},
					[{ ...nodeToMove, parent: destinationFolder }]
				)
			];

			render(<FolderView />, { initialRouterEntries: [`/?folder=${currentFolder.id}`], mocks });

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

			await moveNode(destinationFolder);
			const snackbar = await screen.findByText(/Item moved/i);
			await waitForElementToBeRemoved(snackbar);

			expect(screen.queryAllByTestId('node-item', { exact: false })).toHaveLength(
				currentFolder.children.length - 1
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

		test('Move of last ordered node update cursor to be last ordered node and trigger load of the next page with the new cursor', async () => {
			const currentFolder = populateFolder(NODES_LOAD_LIMIT * 2 - 1);
			const destinationFolder = populateFolder();
			currentFolder.children.unshift(destinationFolder);
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
				mockGetPath({ node_id: currentFolder.id }, [currentFolder]),
				mockMoveNodes(
					{
						node_ids: [firstPage[NODES_LOAD_LIMIT - 1].id],
						destination_id: destinationFolder.id
					},
					[{ ...firstPage[NODES_LOAD_LIMIT - 1], parent: destinationFolder }]
				),
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
			expect(screen.queryByText(secondPage[0].name)).not.toBeInTheDocument();
			fireEvent.contextMenu(screen.getByText(firstPage[NODES_LOAD_LIMIT - 1].name));
			await moveNode(destinationFolder);
			const snackbar = await screen.findByText(/Item moved/i);
			await waitForElementToBeRemoved(snackbar);
			expect(screen.queryByText(firstPage[NODES_LOAD_LIMIT - 1].name)).not.toBeInTheDocument();
			expect(screen.queryByText(secondPage[0].name)).not.toBeInTheDocument();
			expect(screen.getByText(firstPage[0].name)).toBeVisible();
			expect(screen.getAllByTestId('node-item', { exact: false })).toHaveLength(
				firstPage.length - 1
			);
			expect(screen.getByTestId('icon: Refresh')).toBeVisible();
			await triggerLoadMore();
			await screen.findByText(secondPage[0].name);
			expect(screen.getByText(secondPage[0].name)).toBeVisible();
			expect(screen.getByText(secondPage[NODES_LOAD_LIMIT - 1].name)).toBeVisible();
			expect(screen.getByText(firstPage[0].name)).toBeVisible();
			expect(screen.queryByText(firstPage[NODES_LOAD_LIMIT - 1].name)).not.toBeInTheDocument();
		});
	});
});
