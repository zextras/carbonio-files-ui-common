/*
 * SPDX-FileCopyrightText: 2022 Zextras <https://www.zextras.com>
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */
import React from 'react';

import { fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { populateFile, populateFolder, populateNode } from '../../mocks/mockUtils';
import { Node } from '../../types/common';
import { actionRegexp, iconRegexp, render, selectNodes } from '../../utils/testUtils';
import { List } from './List';

describe('Move', () => {
	describe('Selection mode', () => {
		test('Move is disabled if node has not permissions', async () => {
			const currentFolder = populateFolder();
			currentFolder.permissions.can_write_file = true;
			currentFolder.permissions.can_write_folder = true;
			const file = populateFile();
			file.permissions.can_write_file = false;
			file.parent = currentFolder;
			const folder = populateFolder();
			folder.permissions.can_write_folder = false;
			folder.parent = currentFolder;
			const node = populateNode();
			node.permissions.can_write_folder = true;
			node.permissions.can_write_file = true;
			node.parent = currentFolder;
			currentFolder.children.push(file, folder, node);

			render(
				<List nodes={currentFolder.children as Array<Node>} mainList emptyListMessage={'hint'} />
			);

			await screen.findByText(file.name);
			// select file without can_write_file permission
			selectNodes([file.id]);
			// check that all wanted items are selected
			expect(screen.getByTestId('checkedAvatar')).toBeInTheDocument();
			expect(screen.getByTestId('icon: MoreVertical')).toBeVisible();
			userEvent.click(screen.getByTestId('icon: MoreVertical'));

			// wait copy to be sure that popper is open
			await screen.findByText(actionRegexp.copy);
			let moveAction = screen.queryByText(actionRegexp.move);
			expect(moveAction).not.toBeInTheDocument();
			// deselect file and select folder without can_write_folder permission
			selectNodes([file.id, folder.id]);
			// check that all wanted items are selected
			expect(screen.getByTestId('checkedAvatar')).toBeInTheDocument();
			expect(screen.queryByTestId(iconRegexp.moreVertical)).not.toBeInTheDocument();
			expect(screen.queryByTestId(iconRegexp.move)).not.toBeInTheDocument();
			// deselect folder and select node with right permission
			selectNodes([folder.id, node.id]);
			// check that all wanted items are selected
			expect(screen.getByTestId('checkedAvatar')).toBeInTheDocument();
			expect(screen.getByTestId('icon: MoreVertical')).toBeVisible();
			userEvent.click(screen.getByTestId('icon: MoreVertical'));
			moveAction = await screen.findByText(actionRegexp.move);
			expect(moveAction).toBeVisible();
			expect(moveAction.parentElement).not.toHaveAttribute('disabled', '');
		});

		test('Move is enabled when multiple files are selected', async () => {
			const currentFolder = populateFolder();
			currentFolder.permissions.can_write_file = true;
			currentFolder.permissions.can_write_folder = true;
			const file = populateFile();
			file.permissions.can_write_file = true;
			file.parent = currentFolder;
			const folder = populateFolder();
			folder.permissions.can_write_folder = true;
			folder.parent = currentFolder;
			currentFolder.children.push(file, folder);

			render(
				<List
					nodes={currentFolder.children as Array<Node>}
					mainList
					emptyListMessage={'hint'}
					folderId={currentFolder.id}
				/>
			);

			await screen.findByText(file.name);
			selectNodes([file.id, folder.id]);

			// check that all wanted items are selected
			expect(screen.getAllByTestId('checkedAvatar')).toHaveLength(2);
			expect(screen.getByTestId('icon: MoreVertical')).toBeVisible();
			userEvent.click(screen.getByTestId('icon: MoreVertical'));
			expect(screen.getAllByTestId('checkedAvatar')).toHaveLength(2);

			const moveIcon = await screen.findByTestId(iconRegexp.move);
			expect(moveIcon).toBeVisible();
			expect(moveIcon.parentElement).not.toHaveAttribute('disabled', '');
		});
	});

	describe('Contextual menu actions', () => {
		test('Move is disabled if node has not permissions', async () => {
			const currentFolder = populateFolder();
			currentFolder.permissions.can_write_file = true;
			currentFolder.permissions.can_write_folder = true;
			const file = populateFile();
			file.permissions.can_write_file = false;
			file.parent = currentFolder;
			const folder = populateFolder();
			folder.permissions.can_write_folder = false;
			folder.parent = currentFolder;
			const node = populateNode();
			node.permissions.can_write_folder = true;
			node.permissions.can_write_file = true;
			node.parent = currentFolder;
			currentFolder.children.push(file, folder, node);

			render(
				<List nodes={currentFolder.children as Array<Node>} mainList emptyListMessage={'hint'} />
			);

			// right click to open contextual menu on file without permission
			const fileItem = await screen.findByText(file.name);
			fireEvent.contextMenu(fileItem);
			await screen.findByText(actionRegexp.copy);
			expect(screen.queryByText(actionRegexp.move)).not.toBeInTheDocument();
			// right click to open contextual menu on folder without permission
			const folderItem = await screen.findByText(folder.name);
			fireEvent.contextMenu(folderItem);
			await screen.findByText(actionRegexp.copy);
			expect(screen.queryByText(actionRegexp.move)).not.toBeInTheDocument();
			// right click to open contextual menu on node with permission
			const nodeItem = await screen.findByText(node.name);
			fireEvent.contextMenu(nodeItem);
			expect(await screen.findByText(actionRegexp.move)).toBeInTheDocument();
		});
	});
});
