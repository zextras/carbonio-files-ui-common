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
import { getFindNodesVariables, mockFindNodes, mockTrashNodes } from '../../utils/mockUtils';
import { actionRegexp, render, selectNodes } from '../../utils/testUtils';
import FilterList from './FilterList';

describe('Filter List', () => {
	describe('Mark for deletion', () => {
		describe('Selection mode', () => {
			test('Mark for deletion remove selected items from the filter list', async () => {
				const currentFilter = populateNodes(3);
				forEach(currentFilter, (mockedNode) => {
					mockedNode.flagged = true;
				});

				currentFilter[0].permissions.can_write_folder = true;
				currentFilter[0].permissions.can_write_file = true;

				const nodesIdsToMFD = [currentFilter[0].id];

				const mocks = [
					mockFindNodes(
						getFindNodesVariables({ flagged: true, folder_id: ROOTS.LOCAL_ROOT, cascade: true }),
						currentFilter
					),
					mockTrashNodes(
						{
							node_ids: nodesIdsToMFD
						},
						nodesIdsToMFD
					)
				];

				render(<FilterList flagged folderId={ROOTS.LOCAL_ROOT} cascade />, { mocks });

				// wait for the load to be completed
				await waitForElementToBeRemoved(screen.queryByTestId('icon: Refresh'));
				// activate selection mode by selecting items
				selectNodes(nodesIdsToMFD);
				// check that all wanted items are selected
				expect(screen.getByTestId('checkedAvatar')).toBeInTheDocument();
				expect(screen.getByTestId('icon: MoreVertical')).toBeVisible();
				userEvent.click(screen.getByTestId('icon: MoreVertical'));

				const trashIcon = await screen.findByText(actionRegexp.moveToTrash);
				expect(trashIcon).toBeInTheDocument();
				expect(trashIcon).toBeVisible();
				expect(trashIcon).not.toHaveAttribute('disabled', '');

				userEvent.click(trashIcon);

				// wait for the snackbar to appear and disappear
				const snackbar = await screen.findByText(/item moved to trash/i);
				await waitForElementToBeRemoved(snackbar);
				expect(screen.queryByTestId('checkedAvatar')).not.toBeInTheDocument();

				expect(screen.queryAllByTestId(`file-icon-preview`).length).toEqual(2);

				expect.assertions(7);
			});

			test('Mark for deletion is hidden if not all nodes are not trashed', async () => {
				const currentFilter = populateNodes(3);
				forEach(currentFilter, (mockedNode) => {
					mockedNode.flagged = true;
				});

				currentFilter[0].permissions.can_write_folder = true;
				currentFilter[0].permissions.can_write_file = true;

				currentFilter[1].permissions.can_write_folder = true;
				currentFilter[1].permissions.can_write_file = true;
				currentFilter[1].rootId = ROOTS.TRASH;

				const nodesIdsToMFD = [currentFilter[0].id, currentFilter[1].id];

				const mocks = [mockFindNodes(getFindNodesVariables({ flagged: true }), currentFilter)];

				render(<FilterList flagged />, { mocks });

				// wait for the load to be completed
				await waitForElementToBeRemoved(screen.queryByTestId('icon: Refresh'));
				// activate selection mode by selecting items
				selectNodes(nodesIdsToMFD);
				// check that all wanted items are selected
				expect(screen.getAllByTestId('checkedAvatar')).toHaveLength(2);

				const selectionModeActiveListHeader = screen.getByTestId('list-header-selectionModeActive');

				const trashIcon = within(selectionModeActiveListHeader).queryByTestId(
					'icon: Trash2Outline'
				);
				expect(trashIcon).not.toBeInTheDocument();
				expect.assertions(2);
			});
		});

		describe('Contextual Menu', () => {
			test('Mark for deletion is hidden if the node is trashed', async () => {
				const node = populateFile();
				node.permissions.can_write_file = true;
				node.rootId = ROOTS.TRASH;

				const mocks = [mockFindNodes(getFindNodesVariables({ flagged: true }), [node])];

				render(<FilterList flagged />, { mocks });

				// wait for the load to be completed
				await waitForElementToBeRemoved(screen.queryByTestId('icon: Refresh'));

				// right click to open contextual menu
				const nodeItem = screen.getByTestId(`node-item-${node.id}`);
				fireEvent.contextMenu(nodeItem);
				const restoreAction = await screen.findByText(actionRegexp.restore);
				expect(restoreAction).toBeVisible();
				const moveToTrashAction = screen.queryByText(actionRegexp.moveToTrash);
				expect(moveToTrashAction).not.toBeInTheDocument();
			});
		});

		test('refetch filter if not all pages are loaded and all nodes are trashed', async () => {
			const firstPage = populateNodes(NODES_LOAD_LIMIT);
			forEach(firstPage, (node) => {
				// eslint-disable-next-line no-param-reassign
				node.permissions.can_write_file = true;
				// eslint-disable-next-line no-param-reassign
				node.permissions.can_write_folder = true;
			});
			const secondPage = populateNodes(NODES_LOAD_LIMIT);
			forEach(secondPage, (node) => {
				// eslint-disable-next-line no-param-reassign
				node.permissions.can_write_file = true;
				// eslint-disable-next-line no-param-reassign
				node.permissions.can_write_folder = true;
			});
			const nodesToTrash = map(firstPage, (node) => node.id);

			const mocks = [
				mockFindNodes(
					getFindNodesVariables({ flagged: true, folder_id: ROOTS.LOCAL_ROOT, cascade: true }),
					firstPage
				),
				mockTrashNodes({ node_ids: nodesToTrash }, nodesToTrash),
				mockFindNodes(
					getFindNodesVariables({ flagged: true, folder_id: ROOTS.LOCAL_ROOT, cascade: true }),
					secondPage
				)
			];

			render(<FilterList flagged folderId={ROOTS.LOCAL_ROOT} cascade />, { mocks });

			await screen.findByText(firstPage[0].name);
			expect(screen.getByText(firstPage[0].name)).toBeVisible();
			expect(screen.getByText((last(firstPage) as Node).name)).toBeVisible();
			expect(screen.queryByText(secondPage[0].name)).not.toBeInTheDocument();

			// select all loaded nodes
			selectNodes(nodesToTrash);
			// check that all wanted items are selected
			expect(screen.getAllByTestId('checkedAvatar')).toHaveLength(firstPage.length);
			expect(screen.getByTestId('icon: MoreVertical')).toBeVisible();
			userEvent.click(screen.getByTestId('icon: MoreVertical'));
			const trashAction = await screen.findByText(actionRegexp.moveToTrash);
			expect(trashAction).toBeVisible();
			expect(trashAction.parentNode).not.toHaveAttribute('disabled', '');
			userEvent.click(trashAction);
			await waitForElementToBeRemoved(screen.queryByText(firstPage[0].name));
			const snackbar = await screen.findByText(/item moved to trash/i);
			await waitForElementToBeRemoved(snackbar);
			await screen.findByText(secondPage[0].name);
			expect(screen.getByText(secondPage[0].name)).toBeVisible();
			expect(screen.queryByText(firstPage[0].name)).not.toBeInTheDocument();
			expect(screen.queryByText((last(firstPage) as Node).name)).not.toBeInTheDocument();
		}, 60000);
	});
});
