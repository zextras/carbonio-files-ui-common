/*
 * SPDX-FileCopyrightText: 2022 Zextras <https://www.zextras.com>
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */
import React from 'react';

import { act, screen, waitForElementToBeRemoved, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import find from 'lodash/find';
import { Route } from 'react-router-dom';

import { CreateOptionsContent } from '../../hooks/useCreateOptions';
import { ROOTS } from '../constants';
import { populateNode, populateNodes, populateShares } from '../mocks/mockUtils';
import { SharedTarget } from '../types/graphql/types';
import {
	getFindNodesVariables,
	getNodeVariables,
	getSharesVariables,
	mockDeleteShare,
	mockFindNodes,
	mockGetNode,
	mockGetNodeLinks,
	mockGetShares
} from '../utils/mockUtils';
import { render } from '../utils/testUtils';
import { getChipLabel } from '../utils/utils';
import FilterView from './FilterView';

jest.mock('../../hooks/useCreateOptions', () => ({
	useCreateOptions: (): CreateOptionsContent => ({
		setCreateOptions: jest.fn(),
		removeCreateOptions: jest.fn()
	})
}));

describe('Filter view', () => {
	describe('Shared By Me filter', () => {
		test('Deletion of all collaborators remove node from list. Displayer is closed', async () => {
			const nodes = populateNodes(2);
			const nodeWithShares = populateNode();
			const shares = populateShares(nodeWithShares, 2);
			nodeWithShares.shares = shares;
			nodeWithShares.permissions.can_share = true;
			nodes.push(nodeWithShares);
			const mocks = [
				mockFindNodes(
					getFindNodesVariables({
						shared_by_me: true,
						folder_id: ROOTS.LOCAL_ROOT,
						cascade: true,
						direct_share: true
					}),
					nodes
				),
				mockGetNode(getNodeVariables(nodeWithShares.id), nodeWithShares),
				mockGetShares(getSharesVariables(nodeWithShares.id), nodeWithShares),
				mockGetNodeLinks({ node_id: nodeWithShares.id }, nodeWithShares),
				mockDeleteShare(
					{
						node_id: nodeWithShares.id,
						share_target_id: (shares[0].share_target as SharedTarget).id
					},
					true
				),
				mockDeleteShare(
					{
						node_id: nodeWithShares.id,
						share_target_id: (shares[1].share_target as SharedTarget).id
					},
					true
				),
				// findNodes is called 2 times?
				mockFindNodes(
					getFindNodesVariables({
						shared_by_me: true,
						folder_id: ROOTS.LOCAL_ROOT,
						cascade: true,
						direct_share: true
					}),
					nodes
				)
			];
			render(
				<Route path="/filter/:filter">
					<FilterView />
				</Route>,
				{
					initialRouterEntries: [`/filter/sharedByMe/?node=${nodeWithShares.id}&tab=sharing`],
					mocks
				}
			);
			// render of the list
			await screen.findByText(nodes[0].name);
			// render of the displayer
			await screen.findByText(/sharing/i);
			// render of the sharing tab
			await screen.findByText(/collaborators/i);
			// render of the collaborators
			await screen.findByText(getChipLabel(shares[0].share_target));
			// there should be 2 chips for collaborators
			const chipItems = screen.getAllByTestId('chip-with-popover');
			expect(chipItems).toHaveLength(2);
			const share1Item = find(
				chipItems,
				(chipItem) => within(chipItem).queryByText(getChipLabel(shares[0].share_target)) !== null
			);
			const share2Item = find(
				chipItems,
				(chipItem) => within(chipItem).queryByText(getChipLabel(shares[1].share_target)) !== null
			);
			const nodeItem = screen.getByTestId(`node-item-${nodeWithShares.id}`);
			expect(nodeItem).toBeVisible();
			expect(share1Item).toBeDefined();
			expect(share2Item).toBeDefined();
			expect(share1Item).toBeVisible();
			expect(share2Item).toBeVisible();
			// delete first share
			act(() => {
				userEvent.click(within(share1Item as HTMLElement).getByTestId('icon: Close'));
			});
			await screen.findByRole('button', { name: /remove/i });
			userEvent.click(screen.getByRole('button', { name: /remove/i }));
			await waitForElementToBeRemoved(screen.queryByText(getChipLabel(shares[0].share_target)));
			const snackbar = await screen.findByText(/success/i);
			await waitForElementToBeRemoved(snackbar);
			expect(share2Item).toBeVisible();
			expect(nodeItem).toBeVisible();
			// delete second share
			act(() => {
				userEvent.click(within(share2Item as HTMLElement).getByTestId('icon: Close'));
			});
			await screen.findByRole('button', { name: /remove/i });
			userEvent.click(screen.getByRole('button', { name: /remove/i }));
			await waitForElementToBeRemoved(screen.queryByText(getChipLabel(shares[1].share_target)));
			const snackbar2 = await screen.findByText(/success/i);
			await waitForElementToBeRemoved(snackbar2);
			// node is removed from main list
			expect(nodeItem).not.toBeInTheDocument();
			// displayer is closed
			await screen.findByText(/view files and folders/i);
			expect(screen.queryByText(nodeWithShares.name)).not.toBeInTheDocument();
			expect(screen.queryByText(/sharing/i)).not.toBeInTheDocument();
		});
	});
});
