/*
 * SPDX-FileCopyrightText: 2022 Zextras <https://www.zextras.com>
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */
import React from 'react';

import { ApolloError } from '@apollo/client';
import { fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import forEach from 'lodash/forEach';
import map from 'lodash/map';

import { populateFolder, populateNode, sortNodes } from '../../mocks/mockUtils';
import { Node } from '../../types/common';
import { NodeSort } from '../../types/graphql/types';
import { mockUpdateNodeError } from '../../utils/mockUtils';
import {
	actionRegexp,
	generateError,
	renameNode,
	render,
	selectNodes
} from '../../utils/testUtils';
import { List } from './List';

describe('Rename', () => {
	describe('Selection mode', () => {
		test('Rename is disabled when multiple files are selected', async () => {
			const children: Array<Node> = [];
			// enable permission to rename
			for (let i = 0; i < 2; i += 1) {
				const node = populateNode();
				node.permissions.can_write_file = true;
				node.permissions.can_write_folder = true;
				children.push(node);
			}

			render(<List nodes={children} mainList emptyListMessage={'hint'} />);

			// activate selection mode by selecting items
			selectNodes(map(children, (node) => (node as Node).id));
			// check that all wanted items are selected
			expect(screen.getAllByTestId('checkedAvatar')).toHaveLength(children.length);
			expect(screen.getByTestId('icon: MoreVertical')).toBeVisible();
			userEvent.click(screen.getByTestId('icon: MoreVertical'));
			// check that the rename action becomes visible but disabled
			const renameAction = await screen.findByText(actionRegexp.rename);
			expect(renameAction).toBeVisible();
			expect(renameAction).toHaveAttribute('disabled', '');
		});

		test('Rename is disabled if node does not have permissions', async () => {
			const children: Array<Node> = [];
			// disable permission to rename
			const node = populateNode();
			node.permissions.can_write_file = false;
			node.permissions.can_write_folder = false;
			children.push(node);

			render(<List nodes={children} mainList emptyListMessage={'hint'} />);

			// activate selection mode by selecting items
			selectNodes([node.id]);
			// check that all wanted items are selected
			expect(screen.getAllByTestId('checkedAvatar')).toHaveLength(children.length);
			expect(screen.getByTestId('icon: MoreVertical')).toBeVisible();
			userEvent.click(screen.getByTestId('icon: MoreVertical'));
			const renameAction = await screen.findByText(actionRegexp.rename);
			expect(renameAction).toBeVisible();
			expect(renameAction).toHaveAttribute('disabled', '');
		});

		test('Rename operation fail shows an error in the modal and does not close it', async () => {
			const currentFolder = populateFolder(2);
			// enable permission to rename
			forEach(currentFolder.children, (mockedNode) => {
				(mockedNode as Node).permissions.can_write_file = true;
				(mockedNode as Node).permissions.can_write_folder = true;
			});
			const sort = NodeSort.NameAsc; // sort only by name
			sortNodes(currentFolder.children, sort);

			// rename first element with name of the second one
			const element = currentFolder.children[0] as Node;
			const newName = (currentFolder.children[1] as Node).name;

			const mocks = [
				mockUpdateNodeError(
					{
						node_id: element.id,
						name: newName
					},
					new ApolloError({ graphQLErrors: [generateError('Error! Name already assigned')] })
				)
			];

			render(
				<List nodes={currentFolder.children as Array<Node>} mainList emptyListMessage={'hint'} />,
				{ mocks }
			);

			// activate selection mode by selecting items
			selectNodes([element.id]);
			// check that all wanted items are selected
			expect(screen.getByTestId('checkedAvatar')).toBeInTheDocument();
			expect(screen.getByTestId('icon: MoreVertical')).toBeVisible();
			userEvent.click(screen.getByTestId('icon: MoreVertical'));
			// check that the rename action becomes visible
			await renameNode(newName);
			const error = await screen.findByText(/Error! Name already assigned/);
			const inputFieldDiv = screen.getByTestId('input-name');
			const inputField = within(inputFieldDiv).getByRole('textbox');
			expect(error).toBeVisible();
			expect(inputField).toBeVisible();
			expect(inputField).toHaveValue(newName);
		});
	});

	describe('Contextual menu actions', () => {
		test('Rename is disabled if node does not have permissions', async () => {
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
			const renameAction = await screen.findByText(actionRegexp.rename);
			expect(renameAction).toBeVisible();
			expect(renameAction).toHaveAttribute('disabled', '');
		});

		test('Rename is disabled if select more than 1 node in selection mode', async () => {
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
				<List nodes={currentFolder.children as Array<Node>} mainList emptyListMessage={'hint'} />
			);

			selectNodes([element0.id, element1.id]);

			// right click to open contextual menu
			const nodeItem = screen.getByTestId(`node-item-${element0.id}`);
			fireEvent.contextMenu(nodeItem);
			let renameAction = await screen.findByText(actionRegexp.rename);
			expect(renameAction).toBeVisible();
			expect(renameAction).toHaveAttribute('disabled', '');
			selectNodes([element1.id]);
			fireEvent.contextMenu(nodeItem);
			renameAction = await screen.findByText(actionRegexp.rename);
			expect(renameAction).toBeVisible();
			expect(renameAction).not.toHaveAttribute('disabled', '');
		});
	});
});
