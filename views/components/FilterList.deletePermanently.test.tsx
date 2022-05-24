/*
 * SPDX-FileCopyrightText: 2022 Zextras <https://www.zextras.com>
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */
import React from 'react';

import { fireEvent, screen, waitForElementToBeRemoved, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import forEach from 'lodash/forEach';
import last from 'lodash/last';
import map from 'lodash/map';

import { NODES_LOAD_LIMIT, ROOTS } from '../../constants';
import { populateFile, populateNodes } from '../../mocks/mockUtils';
import { Node } from '../../types/common';
import { getFindNodesVariables, mockDeletePermanently, mockFindNodes } from '../../utils/mockUtils';
import { actionRegexp, render, selectNodes } from '../../utils/testUtils';
import FilterList from './FilterList';

describe('Filter List', () => {
	describe('Delete Permanently', () => {
		describe('Selection Mode', () => {
			test('Delete Permanently remove selected items from the filter list', async () => {
				const currentFilter = populateNodes(3);
				forEach(currentFilter, (mockedNode) => {
					mockedNode.rootId = ROOTS.TRASH;
				});

				currentFilter[0].permissions.can_write_folder = true;
				currentFilter[0].permissions.can_write_file = true;
				currentFilter[0].permissions.can_delete = true;

				const nodesIdsToDeletePermanently = [currentFilter[0].id];

				const mocks = [
					mockFindNodes(
						getFindNodesVariables({ folder_id: ROOTS.TRASH, cascade: false }),
						currentFilter
					),
					mockDeletePermanently(
						{
							node_ids: nodesIdsToDeletePermanently
						},
						nodesIdsToDeletePermanently
					)
				];

				render(<FilterList trashed cascade={false} />, { mocks });

				// wait for the load to be completed
				await waitForElementToBeRemoved(screen.queryByTestId('icon: Refresh'));
				// activate selection mode by selecting items
				selectNodes(nodesIdsToDeletePermanently);
				// check that all wanted items are selected
				expect(screen.getByTestId('checkedAvatar')).toBeInTheDocument();
				expect(screen.getByTestId('icon: MoreVertical')).toBeVisible();

				const element = await screen.findByText(currentFilter[0].name);

				const selectionModeActiveListHeader = screen.getByTestId('list-header-selectionModeActive');

				const deletePermanentlyIcon = within(selectionModeActiveListHeader).getByTestId(
					'icon: DeletePermanentlyOutline'
				);
				expect(deletePermanentlyIcon).toBeInTheDocument();
				expect(deletePermanentlyIcon).toBeVisible();
				expect(deletePermanentlyIcon).not.toHaveAttribute('disabled', '');

				userEvent.click(deletePermanentlyIcon);

				const confirmButton = await screen.findByRole('button', { name: /delete permanently/i });
				userEvent.click(confirmButton);
				const snackbar = await screen.findByText(/^success$/i);
				await waitForElementToBeRemoved(snackbar);
				expect(confirmButton).not.toBeInTheDocument();

				expect(element).not.toBeInTheDocument();
				expect(screen.queryByTestId('checkedAvatar')).not.toBeInTheDocument();
				expect(screen.queryAllByTestId(`file-icon-preview`).length).toEqual(2);

				expect.assertions(9);
			});

			test('Delete Permanently is hidden if not all nodes are trashed', async () => {
				const currentFilter = populateNodes(3);
				forEach(currentFilter, (mockedNode) => {
					mockedNode.flagged = true;
				});

				currentFilter[0].permissions.can_write_folder = true;
				currentFilter[0].permissions.can_write_file = true;
				currentFilter[0].rootId = ROOTS.LOCAL_ROOT;

				currentFilter[1].permissions.can_write_folder = true;
				currentFilter[1].permissions.can_write_file = true;
				currentFilter[1].rootId = ROOTS.TRASH;

				const nodesIdsToDeletePermanently = [currentFilter[0].id, currentFilter[1].id];

				const mocks = [mockFindNodes(getFindNodesVariables({ flagged: true }), currentFilter)];

				render(<FilterList flagged />, { mocks });

				// wait for the load to be completed
				await waitForElementToBeRemoved(screen.queryByTestId('icon: Refresh'));
				// activate selection mode by selecting items
				selectNodes(nodesIdsToDeletePermanently);
				// check that all wanted items are selected
				expect(screen.getAllByTestId('checkedAvatar')).toHaveLength(2);
				expect(screen.getByTestId('icon: MoreVertical')).toBeVisible();

				const selectionModeActiveListHeader = screen.getByTestId('list-header-selectionModeActive');

				const restoreIcon = within(selectionModeActiveListHeader).queryByTestId(
					'icon: RestoreOutline'
				);
				expect(restoreIcon).not.toBeInTheDocument();

				const trashIcon = within(selectionModeActiveListHeader).queryByTestId(
					'icon: Trash2Outline'
				);
				expect(trashIcon).not.toBeInTheDocument();

				const deletePermanentlyIcon = within(selectionModeActiveListHeader).queryByTestId(
					'icon: DeletePermanentlyOutline'
				);
				expect(deletePermanentlyIcon).not.toBeInTheDocument();

				const moreIcon = within(selectionModeActiveListHeader).getByTestId('icon: MoreVertical');
				expect(moreIcon).toBeInTheDocument();

				expect.assertions(6);
			});
		});

		describe('Contextual Menu', () => {
			test('Delete Permanently is hidden if the node is not trashed', async () => {
				const node = populateFile();
				node.permissions.can_write_file = true;
				node.rootId = ROOTS.LOCAL_ROOT;

				const mocks = [mockFindNodes(getFindNodesVariables({ flagged: true }), [node])];

				render(<FilterList flagged />, { mocks });

				// wait for the load to be completed
				await waitForElementToBeRemoved(screen.queryByTestId('icon: Refresh'));

				// right click to open contextual menu
				const nodeItem = screen.getByTestId(`node-item-${node.id}`);
				fireEvent.contextMenu(nodeItem);
				const renameAction = await screen.findByText(actionRegexp.rename);
				expect(renameAction).toBeVisible();
				const moveToTrashAction = await screen.findByText(actionRegexp.moveToTrash);
				expect(moveToTrashAction).toBeVisible();
				const deletePermanentlyAction = screen.queryByText(actionRegexp.deletePermanently);
				expect(deletePermanentlyAction).not.toBeInTheDocument();
			});
		});

		test('refetch trash filter if not all pages are loaded and all nodes are deleted permanently', async () => {
			const firstPage = populateNodes(NODES_LOAD_LIMIT);
			forEach(firstPage, (mockedNode) => {
				mockedNode.rootId = ROOTS.TRASH;
				mockedNode.permissions.can_delete = true;
			});
			const secondPage = populateNodes(NODES_LOAD_LIMIT);
			forEach(secondPage, (mockedNode) => {
				mockedNode.rootId = ROOTS.TRASH;
				mockedNode.permissions.can_delete = true;
			});
			const nodesToDelete = map(firstPage, (node) => node.id);

			const mocks = [
				mockFindNodes(getFindNodesVariables({ folder_id: ROOTS.TRASH, cascade: false }), firstPage),
				mockDeletePermanently({ node_ids: nodesToDelete }, nodesToDelete),
				mockFindNodes(getFindNodesVariables({ folder_id: ROOTS.TRASH, cascade: false }), secondPage)
			];

			render(<FilterList trashed cascade={false} />, { mocks });

			await screen.findByText(firstPage[0].name);
			expect(screen.getByText(firstPage[0].name)).toBeVisible();
			expect(screen.getByText((last(firstPage) as Node).name)).toBeVisible();
			expect(screen.queryByText(secondPage[0].name)).not.toBeInTheDocument();

			// select all loaded nodes
			selectNodes(nodesToDelete);
			// check that all wanted items are selected
			expect(screen.getAllByTestId('checkedAvatar')).toHaveLength(firstPage.length);
			expect(screen.getByTestId('icon: MoreVertical')).toBeVisible();
			userEvent.click(screen.getByTestId('icon: MoreVertical'));
			const deletePermanentlyAction = await screen.findByTestId('icon: DeletePermanentlyOutline');
			expect(deletePermanentlyAction).toBeVisible();
			expect(deletePermanentlyAction.parentNode).not.toHaveAttribute('disabled', '');
			userEvent.click(deletePermanentlyAction);
			const confirmDeleteButton = await screen.findByRole('button', {
				name: actionRegexp.deletePermanently
			});
			userEvent.click(confirmDeleteButton);
			await waitForElementToBeRemoved(screen.queryByText(firstPage[0].name));
			const snackbar = await screen.findByText(/^success$/i);
			await waitForElementToBeRemoved(snackbar);
			await screen.findByText(secondPage[0].name);
			expect(screen.getByText(secondPage[0].name)).toBeVisible();
			expect(screen.queryByText(firstPage[0].name)).not.toBeInTheDocument();
			expect(screen.queryByText((last(firstPage) as Node).name)).not.toBeInTheDocument();
		}, 60000);
	});
});
