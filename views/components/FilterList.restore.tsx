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
import {
	populateFile,
	populateLocalRoot,
	populateNode,
	populateNodes
} from '../../mocks/mockUtils';
import { Node } from '../../types/common';
import { getFindNodesVariables, mockFindNodes, mockRestoreNodes } from '../../utils/mockUtils';
import { actionRegexp, render, selectNodes } from '../../utils/testUtils';
import FilterList from './FilterList';

describe('Filter List', () => {
	describe('Restore', () => {
		describe('Selection Mode', () => {
			test('Restore remove selected items from the filter list', async () => {
				const currentFilter = populateNodes(3);
				forEach(currentFilter, (mockedNode) => {
					mockedNode.rootId = ROOTS.TRASH;
					mockedNode.parent = populateNode('Folder', ROOTS.TRASH, 'Trash');
				});

				currentFilter[0].permissions.can_write_folder = true;
				currentFilter[0].permissions.can_write_file = true;

				const nodesIdsToRestore = [currentFilter[0].id];

				const mocks = [
					mockFindNodes(
						getFindNodesVariables({ folder_id: ROOTS.TRASH, cascade: false }),
						currentFilter
					),
					mockRestoreNodes(
						{
							node_ids: nodesIdsToRestore
						},
						[{ ...currentFilter[0], rootId: ROOTS.LOCAL_ROOT, parent: populateLocalRoot() }]
					)
				];

				render(<FilterList trashed cascade={false} />, { mocks });

				// wait for the load to be completed
				await waitForElementToBeRemoved(screen.queryByTestId('icon: Refresh'));
				// activate selection mode by selecting items
				selectNodes(nodesIdsToRestore);
				// check that all wanted items are selected
				expect(screen.getByTestId('checkedAvatar')).toBeInTheDocument();
				expect(screen.getByTestId('icon: MoreVertical')).toBeVisible();

				const selectionModeActiveListHeader = screen.getByTestId('list-header-selectionModeActive');

				const restoreIcon = within(selectionModeActiveListHeader).getByTestId(
					'icon: RestoreOutline'
				);
				expect(restoreIcon).toBeInTheDocument();
				expect(restoreIcon).toBeVisible();
				expect(restoreIcon).not.toHaveAttribute('disabled', '');

				userEvent.click(restoreIcon);

				const snackbar = await screen.findByText(/^success$/i);
				await waitForElementToBeRemoved(snackbar);
				expect(screen.queryByTestId('checkedAvatar')).not.toBeInTheDocument();

				expect(screen.queryAllByTestId(`file-icon-preview`).length).toEqual(2);

				expect.assertions(7);
			});

			test('Restore do not remove selected items from the filter list if is a filter without trashed param', async () => {
				const currentFilter = populateNodes(3);
				forEach(currentFilter, (mockedNode) => {
					mockedNode.flagged = true;
					mockedNode.rootId = ROOTS.TRASH;
				});

				currentFilter[0].permissions.can_write_folder = true;
				currentFilter[0].permissions.can_write_file = true;

				const nodesIdsToRestore = [currentFilter[0].id];

				const mocks = [
					mockFindNodes(getFindNodesVariables({ flagged: true }), currentFilter),
					mockRestoreNodes(
						{
							node_ids: nodesIdsToRestore
						},
						[currentFilter[0]]
					)
				];

				render(<FilterList flagged />, { mocks });

				// wait for the load to be completed
				await waitForElementToBeRemoved(screen.queryByTestId('icon: Refresh'));
				// activate selection mode by selecting items
				selectNodes(nodesIdsToRestore);
				// check that all wanted items are selected
				expect(screen.getByTestId('checkedAvatar')).toBeInTheDocument();
				expect(screen.getByTestId('icon: MoreVertical')).toBeVisible();

				const selectionModeActiveListHeader = screen.getByTestId('list-header-selectionModeActive');

				const restoreIcon = within(selectionModeActiveListHeader).getByTestId(
					'icon: RestoreOutline'
				);
				expect(restoreIcon).toBeInTheDocument();
				expect(restoreIcon).toBeVisible();
				expect(restoreIcon).not.toHaveAttribute('disabled', '');

				const unselectAllIcon = screen.getByTestId('icon: ArrowBackOutline');
				expect(unselectAllIcon).toBeInTheDocument();
				expect(unselectAllIcon).toBeVisible();

				userEvent.click(restoreIcon);

				// await waitForElementToBeRemoved(unselectAllIcon);
				const snackbar = await screen.findByText(/^success$/i);
				await waitForElementToBeRemoved(snackbar);

				const elementsWithSelectionModeOff = await screen.findAllByTestId('file-icon-preview');
				const restoredItem = screen.queryByText(currentFilter[0].name);
				expect(restoredItem).toBeInTheDocument();
				expect(restoredItem).toBeVisible();

				expect(screen.queryAllByTestId('node-item', { exact: false })).toHaveLength(3);
				expect(elementsWithSelectionModeOff).toHaveLength(3);
				expect.assertions(11);
			});

			test('Restore is hidden if not all nodes are trashed', async () => {
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

				const nodesIdsToRestore = [currentFilter[0].id, currentFilter[1].id];

				const mocks = [mockFindNodes(getFindNodesVariables({ flagged: true }), currentFilter)];

				render(<FilterList flagged />, { mocks });

				// wait for the load to be completed
				await waitForElementToBeRemoved(screen.queryByTestId('icon: Refresh'));
				// activate selection mode by selecting items
				selectNodes(nodesIdsToRestore);
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

				const moreIcon = within(selectionModeActiveListHeader).getByTestId('icon: MoreVertical');
				expect(moreIcon).toBeInTheDocument();

				expect.assertions(5);
			});
		});

		describe('Contextual Menu', () => {
			test('Restore is hidden if the node is not trashed', async () => {
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
				const restoreAction = screen.queryByText(actionRegexp.restore);
				expect(restoreAction).not.toBeInTheDocument();
			});
		});

		test('refetch trash filter if not all pages are loaded and all nodes are restored', async () => {
			const firstPage = populateNodes(NODES_LOAD_LIMIT);
			forEach(firstPage, (node) => {
				// eslint-disable-next-line no-param-reassign
				node.rootId = ROOTS.TRASH;
				// eslint-disable-next-line no-param-reassign
				node.permissions.can_write_file = true;
				// eslint-disable-next-line no-param-reassign
				node.permissions.can_write_folder = true;
			});
			const secondPage = populateNodes(NODES_LOAD_LIMIT);
			forEach(secondPage, (node) => {
				// eslint-disable-next-line no-param-reassign
				node.rootId = ROOTS.TRASH;
				// eslint-disable-next-line no-param-reassign
				node.permissions.can_write_file = true;
				// eslint-disable-next-line no-param-reassign
				node.permissions.can_write_folder = true;
			});
			const nodesToRestore = map(firstPage, (node) => node.id);

			const mocks = [
				mockFindNodes(getFindNodesVariables({ folder_id: ROOTS.TRASH, cascade: false }), firstPage),
				mockRestoreNodes({ node_ids: nodesToRestore }, firstPage),
				mockFindNodes(getFindNodesVariables({ folder_id: ROOTS.TRASH, cascade: false }), secondPage)
			];

			render(<FilterList trashed cascade={false} />, { mocks });

			await screen.findByText(firstPage[0].name);
			expect(screen.getByText(firstPage[0].name)).toBeVisible();
			expect(screen.getByText((last(firstPage) as Node).name)).toBeVisible();
			expect(screen.queryByText(secondPage[0].name)).not.toBeInTheDocument();

			// select all loaded nodes
			selectNodes(nodesToRestore);
			// check that all wanted items are selected
			expect(screen.getAllByTestId('checkedAvatar')).toHaveLength(firstPage.length);
			expect(screen.getByTestId('icon: MoreVertical')).toBeVisible();
			userEvent.click(screen.getByTestId('icon: MoreVertical'));
			const restoreAction = await screen.findByTestId('icon: RestoreOutline');
			expect(restoreAction).toBeVisible();
			expect(restoreAction.parentNode).not.toHaveAttribute('disabled', '');
			userEvent.click(restoreAction);
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
