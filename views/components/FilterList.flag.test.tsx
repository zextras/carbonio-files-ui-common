/*
 * SPDX-FileCopyrightText: 2022 Zextras <https://www.zextras.com>
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */
import React from 'react';

import { fireEvent, screen, waitForElementToBeRemoved } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import forEach from 'lodash/forEach';
import last from 'lodash/last';
import map from 'lodash/map';
import { Route } from 'react-router-dom';

import { NODES_LOAD_LIMIT, ROOTS } from '../../constants';
import { populateNodes } from '../../mocks/mockUtils';
import { Node } from '../../types/common';
import { getFindNodesVariables, mockFindNodes, mockFlagNodes } from '../../utils/mockUtils';
import { actionRegexp, iconRegexp, render, selectNodes } from '../../utils/testUtils';
import FilterList from './FilterList';

describe('Filter List', () => {
	describe('Flag', () => {
		describe('Selection mode', () => {
			test('Unflag action show a success snackbar and remove unflagged nodes form the list', async () => {
				const currentFilter = populateNodes(8);
				forEach(currentFilter, (mockedNode) => {
					mockedNode.flagged = true;
				});

				const nodesIdsToUnflag = map(
					currentFilter.slice(0, currentFilter.length / 2),
					(item) => item.id
				);

				const mocks = [
					mockFindNodes(
						getFindNodesVariables({ flagged: true, folder_id: ROOTS.LOCAL_ROOT, cascade: true }),
						currentFilter
					),
					mockFlagNodes(
						{
							node_ids: nodesIdsToUnflag,
							flag: false
						},
						nodesIdsToUnflag
					)
				];

				// Warning: Failed prop type: Invalid prop `target` of type `Window` supplied to `ForwardRef(SnackbarFn)`, expected instance of `Window`
				// This warning is printed in the console for this render. This happens because window element is a jsdom representation of the window
				// and it's an object instead of a Window class instance, so the check on the prop type fail for the target prop
				render(
					<Route path="/filter/:filter?">
						<FilterList flagged trashed={false} cascade />
					</Route>,
					{ initialRouterEntries: ['/filter/flagged'], mocks }
				);

				// wait for the load to be completed
				await waitForElementToBeRemoved(screen.queryByTestId('icon: Refresh'));
				expect(screen.queryAllByTestId('icon: Flag')).toHaveLength(currentFilter.length);

				// activate selection mode by selecting items
				selectNodes(nodesIdsToUnflag);

				// check that all wanted items are selected
				expect(screen.getAllByTestId('checkedAvatar')).toHaveLength(nodesIdsToUnflag.length);

				const unflagIcon = await screen.findByTestId(iconRegexp.unflag);
				// click on unflag action on header bar
				userEvent.click(unflagIcon);
				// await waitForElementToBeRemoved(screen.queryAllByTestId('checkedAvatar'));
				// wait the snackbar with successful state to appear
				const snackbar = await screen.findByText(/Item unflagged successfully/i);
				await waitForElementToBeRemoved(snackbar);
				expect(screen.getAllByTestId('icon: Flag')).toHaveLength(
					currentFilter.length - nodesIdsToUnflag.length
				);
				// unflagged elements are not in the list anymore
				forEach(nodesIdsToUnflag, (nodeId) => {
					expect(screen.queryByTestId(`node-item-${nodeId}`)).not.toBeInTheDocument();
				});
			});
		});

		describe('Contextual Menu', () => {
			test('Unflag action show a success snackbar and remove unflagged nodes form the list', async () => {
				const nodes = populateNodes(2);
				forEach(nodes, (mockedNode) => {
					mockedNode.flagged = true;
				});

				const mocks = [
					mockFindNodes(
						getFindNodesVariables({ flagged: true, folder_id: ROOTS.LOCAL_ROOT, cascade: true }),
						nodes
					),
					mockFlagNodes(
						{
							node_ids: [nodes[0].id],
							flag: false
						},
						[nodes[0].id]
					)
				];

				// Warning: Failed prop type: Invalid prop `target` of type `Window` supplied to `ForwardRef(SnackbarFn)`, expected instance of `Window`
				// This warning is printed in the console for this render. This happens because window element is a jsdom representation of the window
				// and it's an object instead of a Window class instance, so the check on the prop type fail for the target prop
				render(
					<Route path="/filter/:filter?">
						<FilterList flagged trashed={false} cascade />
					</Route>,
					{ initialRouterEntries: ['/filter/flagged'], mocks }
				);

				// wait for the load to be completed
				await waitForElementToBeRemoved(screen.queryByTestId('icon: Refresh'));
				expect(screen.queryAllByTestId('icon: Flag')).toHaveLength(nodes.length);

				// right click to open contextual menu on first node
				const nodeItem = screen.getByTestId(`node-item-${nodes[0].id}`);
				// open context menu and click on unflag action
				fireEvent.contextMenu(nodeItem);
				const unflagAction = await screen.findByText(actionRegexp.unflag);
				expect(unflagAction).toBeVisible();
				userEvent.click(unflagAction);
				// wait the snackbar with successful state to appear
				expect(unflagAction).not.toBeInTheDocument();
				await screen.findByText(/Item unflagged successfully/i);
				expect(screen.getAllByTestId('icon: Flag')).toHaveLength(nodes.length - 1);
				// unflagged element is not in the list anymore
				expect(screen.queryByTestId(`node-item-${nodes[0].id}`)).not.toBeInTheDocument();
				// wait for the snackbar to be removed
				await waitForElementToBeRemoved(screen.queryByText(/Item unflagged successfully/i));
			});
		});

		test('refetch filter if not all pages are loaded and all nodes are unflagged', async () => {
			const firstPage = populateNodes(NODES_LOAD_LIMIT);
			forEach(firstPage, (node) => {
				node.flagged = true;
			});
			const secondPage = populateNodes(NODES_LOAD_LIMIT);
			forEach(secondPage, (node) => {
				node.flagged = true;
			});
			const nodesToUnflag = map(firstPage, (node) => node.id);

			const mocks = [
				mockFindNodes(
					getFindNodesVariables({ flagged: true, folder_id: ROOTS.LOCAL_ROOT, cascade: true }),
					firstPage
				),
				mockFlagNodes({ node_ids: nodesToUnflag, flag: false }, nodesToUnflag),
				mockFindNodes(
					getFindNodesVariables({ flagged: true, folder_id: ROOTS.LOCAL_ROOT, cascade: true }),
					secondPage
				)
			];

			render(<FilterList flagged trashed={false} cascade />, { mocks });

			await screen.findByText(firstPage[0].name);
			expect(screen.getByText(firstPage[0].name)).toBeVisible();
			expect(screen.getByText((last(firstPage) as Node).name)).toBeVisible();
			expect(screen.queryByText(secondPage[0].name)).not.toBeInTheDocument();

			// select all loaded nodes
			selectNodes(nodesToUnflag);
			// check that all wanted items are selected
			expect(screen.getAllByTestId('checkedAvatar')).toHaveLength(firstPage.length);

			const unflagAction = await screen.findByTestId(iconRegexp.unflag);
			userEvent.click(unflagAction);
			await waitForElementToBeRemoved(screen.queryByText(firstPage[0].name));
			const snackbar = await screen.findByText(/item unflagged successfully/i);
			await screen.findByText(secondPage[0].name);
			await waitForElementToBeRemoved(snackbar);
			expect(screen.getByText(secondPage[0].name)).toBeVisible();
			expect(screen.queryByText(firstPage[0].name)).not.toBeInTheDocument();
			expect(screen.queryByText((last(firstPage) as Node).name)).not.toBeInTheDocument();
		});
	});
});
