/*
 * SPDX-FileCopyrightText: 2022 Zextras <https://www.zextras.com>
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */
import React from 'react';

import { screen, waitForElementToBeRemoved } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route } from 'react-router-dom';

import { ROOTS } from '../../constants';
import { populateNodes } from '../../mocks/mockUtils';
import { getFindNodesVariables, mockFindNodes } from '../../utils/mockUtils';
import { iconRegexp, render, selectNodes } from '../../utils/testUtils';
import FilterList from './FilterList';

describe('Filter List', () => {
	describe('Selection Mode', () => {
		test('if there is no element selected, all actions are visible and disabled', async () => {
			const nodes = populateNodes(10);
			const mocks = [
				mockFindNodes(
					getFindNodesVariables({ flagged: true, folder_id: ROOTS.LOCAL_ROOT, cascade: true }),
					nodes
				)
			];
			render(
				<Route path="/filter/:filter">
					<FilterList flagged cascade folderId={ROOTS.LOCAL_ROOT} />
				</Route>,
				{ mocks, initialRouterEntries: ['/filter/flagged'] }
			);
			await screen.findByText(nodes[0].name);
			expect(screen.getByText(nodes[0].name)).toBeVisible();
			expect(screen.queryByTestId('checkedAvatar')).not.toBeInTheDocument();
			selectNodes([nodes[0].id]);
			// check that all wanted items are selected
			expect(screen.getByTestId('checkedAvatar')).toBeInTheDocument();
			expect(screen.getByText(/select all/i)).toBeVisible();
			// deselect node. Selection mode remains active
			selectNodes([nodes[0].id]);
			expect(screen.queryByTestId('checkedAvatar')).not.toBeInTheDocument();
			expect(screen.getAllByTestId('unCheckedAvatar')).toHaveLength(nodes.length);
			expect(screen.getByText(/select all/i)).toBeVisible();

			expect(screen.queryByTestId(iconRegexp.moveToTrash)).not.toBeInTheDocument();
			expect(screen.queryByTestId(iconRegexp.moreVertical)).not.toBeInTheDocument();
			expect(screen.queryByTestId(iconRegexp.rename)).not.toBeInTheDocument();
			expect(screen.queryByTestId(iconRegexp.copy)).not.toBeInTheDocument();
			expect(screen.queryByTestId(iconRegexp.move)).not.toBeInTheDocument();
			expect(screen.queryByTestId(iconRegexp.flag)).not.toBeInTheDocument();
			expect(screen.queryByTestId(iconRegexp.unflag)).not.toBeInTheDocument();
			expect(screen.queryByTestId(iconRegexp.download)).not.toBeInTheDocument();
			expect(screen.queryByTestId(iconRegexp.openDocument)).not.toBeInTheDocument();
			expect(screen.queryByTestId(iconRegexp.restore)).not.toBeInTheDocument();
			expect(screen.queryByTestId(iconRegexp.deletePermanently)).not.toBeInTheDocument();

			const arrowBack = screen.getByTestId('icon: ArrowBackOutline');
			expect(arrowBack).toBeVisible();
			userEvent.click(arrowBack);
			await waitForElementToBeRemoved(arrowBack);
			expect(screen.queryByTestId('unCheckedAvatar')).not.toBeInTheDocument();
			expect(screen.queryByTestId('checkedAvatar')).not.toBeInTheDocument();
			expect(screen.queryByText(/select all/i)).not.toBeInTheDocument();
		});
	});
});
