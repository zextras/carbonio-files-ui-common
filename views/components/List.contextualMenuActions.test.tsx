/*
 * SPDX-FileCopyrightText: 2022 Zextras <https://www.zextras.com>
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */
import React from 'react';

import { act, fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import forEach from 'lodash/forEach';
import includes from 'lodash/includes';

import { populateFolder, populateNode } from '../../mocks/mockUtils';
import { Node } from '../../types/common';
import { actionRegexp, render, selectNodes } from '../../utils/testUtils';
import { EmptySpaceFiller } from './EmptySpaceFiller';
import { List } from './List';

describe('Contextual menu actions', () => {
	describe('Contextual menu on empty space', () => {
		describe('Contextual menu on empty space in a folder with few nodes', () => {
			test('when isCanCreateFolder and isCanCreateFolder are true', async () => {
				const currentFolder = populateFolder();
				const node1 = populateNode();
				const node2 = populateNode();
				const node3 = populateNode();

				currentFolder.children.push(node1, node2, node3);

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

				render(
					<List
						folderId={currentFolder.id}
						fillerWithActions={<EmptySpaceFiller actions={actions} />}
						nodes={currentFolder.children as Array<Node>}
						mainList
						emptyListMessage={'hint'}
					/>
				);

				const fillerContainer = await screen.findByTestId(`fillerContainer`);

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
					includes((newDocumentActionItem.parentElement as Element).getAttributeNames(), 'disabled')
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

				render(
					<List
						folderId={currentFolder.id}
						fillerWithActions={<EmptySpaceFiller actions={actions} />}
						nodes={currentFolder.children as Array<Node>}
						mainList
						emptyListMessage={'hint'}
					/>
				);

				const fillerContainer = await screen.findByTestId(`fillerContainer`);

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
					includes((newDocumentActionItem.parentElement as Element).getAttributeNames(), 'disabled')
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

				render(
					<List
						folderId={currentFolder.id}
						fillerWithActions={<EmptySpaceFiller actions={actions} />}
						nodes={currentFolder.children as Array<Node>}
						mainList
						emptyListMessage={'hint'}
					/>
				);

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
					includes((newDocumentActionItem.parentElement as Element).getAttributeNames(), 'disabled')
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

				render(
					<List
						folderId={currentFolder.id}
						fillerWithActions={<EmptySpaceFiller actions={actions} />}
						nodes={currentFolder.children as Array<Node>}
						mainList
						emptyListMessage={'hint'}
					/>
				);

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
					includes((newDocumentActionItem.parentElement as Element).getAttributeNames(), 'disabled')
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

			render(
				<List
					folderId={currentFolder.id}
					fillerWithActions={<EmptySpaceFiller actions={[]} />}
					nodes={currentFolder.children as Array<Node>}
					mainList
					emptyListMessage={'hint'}
				/>
			);

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

			render(
				<List
					folderId={currentFolder.id}
					fillerWithActions={<EmptySpaceFiller actions={[]} />}
					nodes={currentFolder.children as Array<Node>}
					mainList
					emptyListMessage={'hint'}
				/>
			);

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

		render(
			<List
				folderId={currentFolder.id}
				fillerWithActions={<EmptySpaceFiller actions={[]} />}
				nodes={currentFolder.children as Array<Node>}
				mainList
				emptyListMessage={'hint'}
			/>
		);

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
});