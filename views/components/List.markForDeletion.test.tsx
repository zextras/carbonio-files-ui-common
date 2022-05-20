/*
 * SPDX-FileCopyrightText: 2022 Zextras <https://www.zextras.com>
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */
import React from 'react';

import { fireEvent, screen, within } from '@testing-library/react';
import map from 'lodash/map';

import { populateFile, populateFolder, populateNode } from '../../mocks/mockUtils';
import { Node } from '../../types/common';
import { actionRegexp, render, selectNodes } from '../../utils/testUtils';
import { List } from './List';

describe('Mark for deletion - trash', () => {
	describe('Selection mode', () => {
		test('Mark for deletion is visible and not disabled when more than one file is selected', async () => {
			// remember that all nodes inside folder are not trashed
			const currentFolder = populateFolder(0);
			// enable permission to rename
			for (let i = 0; i < 2; i += 1) {
				const node = populateNode();
				node.permissions.can_write_file = true;
				node.permissions.can_write_folder = true;
				node.flagged = false;
				currentFolder.children.push(node);
			}

			render(
				<List nodes={currentFolder.children as Array<Node>} mainList emptyListMessage={'hint'} />
			);

			// activate selection mode by selecting items
			selectNodes(map(currentFolder.children, (node) => (node as Node).id));
			// check that all wanted items are selected
			expect(screen.getAllByTestId('checkedAvatar')).toHaveLength(currentFolder.children.length);
			expect(screen.getByTestId('icon: MoreVertical')).toBeVisible();

			const selectionModeActiveListHeader = screen.getByTestId('list-header-selectionModeActive');

			const trashIcon = within(selectionModeActiveListHeader).getByTestId('icon: Trash2Outline');

			expect(trashIcon).toBeVisible();
			expect(trashIcon.parentElement).not.toHaveAttribute('disable');

			selectNodes(map(currentFolder.children, (node) => (node as Node).id));

			expect(screen.queryByTestId('checkedAvatar')).not.toBeInTheDocument();
			expect.assertions(5);
		});

		test('Mark for deletion is visible but disabled in selection when one file do not have permission', async () => {
			const currentFolder = populateFolder(0);
			const fileId1 = 'test-fileId1';
			const filename1 = 'test-fileName1';
			const file = populateFile(fileId1, filename1);
			file.permissions.can_write_file = false;
			currentFolder.children.push(file);

			const folder = populateFolder();
			folder.permissions.can_write_folder = true;
			currentFolder.children.push(folder);

			render(
				<List nodes={currentFolder.children as Array<Node>} mainList emptyListMessage={'hint'} />
			);

			await screen.findByText(filename1);

			// activate selection mode by selecting items
			selectNodes(map(currentFolder.children, (node) => (node as Node).id));
			// check that all wanted items are selected
			expect(screen.getAllByTestId('checkedAvatar')).toHaveLength(currentFolder.children.length);
			expect(screen.getByTestId('icon: MoreVertical')).toBeVisible();

			const selectionModeActiveListHeader = screen.getByTestId('list-header-selectionModeActive');

			const trashIcon = within(selectionModeActiveListHeader).getByTestId('icon: Trash2Outline');

			expect(trashIcon).toBeInTheDocument();
			expect(trashIcon).toBeVisible();
			expect(trashIcon.parentElement).toHaveAttribute('disabled', '');

			selectNodes(map(currentFolder.children, (node) => (node as Node).id));

			expect(screen.queryByTestId('checkedAvatar')).not.toBeInTheDocument();
			expect.assertions(6);
		});
	});

	describe('Contextual menu actions', () => {
		test('Mark for deletion is disabled if node does not have permissions', async () => {
			const currentFolder = populateFolder();
			const node = populateNode();
			node.permissions.can_write_file = false;
			node.permissions.can_write_folder = false;
			currentFolder.children.push(node);

			render(
				<List nodes={currentFolder.children as Array<Node>} mainList emptyListMessage={'hint'} />
			);

			// right click to open contextual menu
			const nodeItem = screen.getByTestId(`node-item-${node.id}`);
			fireEvent.contextMenu(nodeItem);
			const moveToTrashAction = await screen.findByText(actionRegexp.moveToTrash);
			expect(moveToTrashAction).toBeVisible();
			expect(moveToTrashAction.parentElement).toHaveAttribute('disabled', '');
			expect.assertions(2);
		});
	});
});
