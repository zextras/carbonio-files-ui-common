/*
 * SPDX-FileCopyrightText: 2022 Zextras <https://www.zextras.com>
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */
import React from 'react';

import { act, fireEvent, screen, waitForElementToBeRemoved, within } from '@testing-library/react';
import forEach from 'lodash/forEach';
import last from 'lodash/last';
import map from 'lodash/map';

import { NODES_LOAD_LIMIT, NODES_SORT_DEFAULT, ROOTS } from '../../constants';
import { populateFile, populateNodes } from '../../mocks/mockUtils';
import { Node } from '../../types/common';
import { getFindNodesVariables, mockDeletePermanently, mockFindNodes } from '../../utils/mockUtils';
import { actionRegexp, setup, selectNodes } from '../../utils/testUtils';
import { FilterList } from './FilterList';

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

				const { user } = setup(
					<FilterList
						folderId={ROOTS.TRASH}
						cascade={false}
						crumbs={[]}
						sort={NODES_SORT_DEFAULT}
						emptyListMessage="It looks like there's nothing here."
					/>,
					{ mocks }
				);

				// wait for the load to be completed
				await waitForElementToBeRemoved(screen.queryByTestId('icon: Refresh'));
				// activate selection mode by selecting items
				await selectNodes(nodesIdsToDeletePermanently, user);
				// check that all wanted items are selected
				expect(screen.getByTestId('checkedAvatar')).toBeInTheDocument();

				const element = await screen.findByText(currentFilter[0].name);

				const selectionModeActiveListHeader = screen.getByTestId('list-header-selectionModeActive');

				const deletePermanentlyIcon = within(selectionModeActiveListHeader).getByTestId(
					'icon: DeletePermanentlyOutline'
				);
				expect(deletePermanentlyIcon).toBeInTheDocument();
				expect(deletePermanentlyIcon).toBeVisible();
				expect(deletePermanentlyIcon).not.toHaveAttribute('disabled', '');

				await user.click(deletePermanentlyIcon);

				const confirmButton = await screen.findByRole('button', { name: /delete permanently/i });
				act(() => {
					// run timers of modal
					jest.advanceTimersToNextTimer();
				});
				await user.click(confirmButton);
				await screen.findByText(/^success$/i);
				expect(confirmButton).not.toBeInTheDocument();

				expect(element).not.toBeInTheDocument();
				expect(screen.queryByTestId('checkedAvatar')).not.toBeInTheDocument();
				expect(screen.queryAllByTestId(`file-icon-preview`).length).toEqual(2);

				expect.assertions(8);
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

				const { user } = setup(
					<FilterList
						flagged
						crumbs={[]}
						sort={NODES_SORT_DEFAULT}
						emptyListMessage="It looks like there's nothing here."
					/>,
					{ mocks }
				);

				// wait for the load to be completed
				await waitForElementToBeRemoved(screen.queryByTestId('icon: Refresh'));
				// activate selection mode by selecting items
				await selectNodes(nodesIdsToDeletePermanently, user);
				// check that all wanted items are selected
				expect(screen.getAllByTestId('checkedAvatar')).toHaveLength(2);

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

				const moreIcon = within(selectionModeActiveListHeader).queryByTestId('icon: MoreVertical');
				expect(moreIcon).not.toBeInTheDocument();

				expect.assertions(5);
			});
		});

		describe('Contextual Menu', () => {
			test('Delete Permanently is hidden if the node is not trashed', async () => {
				const node = populateFile();
				node.permissions.can_write_file = true;
				node.rootId = ROOTS.LOCAL_ROOT;

				const mocks = [mockFindNodes(getFindNodesVariables({ flagged: true }), [node])];

				setup(
					<FilterList
						flagged
						crumbs={[]}
						sort={NODES_SORT_DEFAULT}
						emptyListMessage="It looks like there's nothing here."
					/>,
					{ mocks }
				);

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

			const { user } = setup(
				<FilterList
					folderId={ROOTS.TRASH}
					cascade={false}
					crumbs={[]}
					sort={NODES_SORT_DEFAULT}
					emptyListMessage="It looks like there's nothing here."
				/>,
				{ mocks }
			);

			await screen.findByText(firstPage[0].name);
			expect(screen.getByText(firstPage[0].name)).toBeVisible();
			expect(screen.getByText((last(firstPage) as Node).name)).toBeVisible();
			expect(screen.queryByText(secondPage[0].name)).not.toBeInTheDocument();

			// select all loaded nodes
			await selectNodes(nodesToDelete, user);
			// check that all wanted items are selected
			expect(screen.getAllByTestId('checkedAvatar')).toHaveLength(firstPage.length);

			const deletePermanentlyAction = await screen.findByTestId('icon: DeletePermanentlyOutline');
			expect(deletePermanentlyAction).toBeVisible();
			expect(deletePermanentlyAction.parentNode).not.toHaveAttribute('disabled', '');
			await user.click(deletePermanentlyAction);
			const confirmDeleteButton = await screen.findByRole('button', {
				name: actionRegexp.deletePermanently
			});
			await user.click(confirmDeleteButton);
			await waitForElementToBeRemoved(screen.queryByText(firstPage[0].name));
			await screen.findByText(/^success$/i);
			await screen.findByText(secondPage[0].name);
			expect(screen.getByText(secondPage[0].name)).toBeVisible();
			expect(screen.queryByText(firstPage[0].name)).not.toBeInTheDocument();
			expect(screen.queryByText((last(firstPage) as Node).name)).not.toBeInTheDocument();
		});
	});
});
