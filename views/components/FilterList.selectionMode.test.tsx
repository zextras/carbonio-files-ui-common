/*
 * SPDX-FileCopyrightText: 2022 Zextras <https://www.zextras.com>
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */
import React from 'react';

import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route } from 'react-router-dom';

import { ROOTS } from '../../constants';
import { populateNodes } from '../../mocks/mockUtils';
import { getFindNodesVariables, mockFindNodes } from '../../utils/mockUtils';
import { actionRegexp, render, selectNodes } from '../../utils/testUtils';
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
					<FilterList flagged cascade trashed={false} />
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
			expect(screen.getByTestId('icon: Trash2Outline')).toBeVisible();
			expect(screen.getByTestId('icon: Trash2Outline').parentNode).toHaveAttribute('disabled', '');
			expect(screen.getByTestId('icon: MoreVertical')).toBeVisible();
			userEvent.click(screen.getByTestId('icon: MoreVertical'));
			await screen.findByText(actionRegexp.rename);
			expect(screen.getByText(actionRegexp.rename)).toBeVisible();
			expect(screen.getByText(actionRegexp.rename)).toHaveAttribute('disabled', '');
			expect(screen.getByText(actionRegexp.copy)).toBeVisible();
			expect(screen.getByText(actionRegexp.copy)).toHaveAttribute('disabled', '');
			expect(screen.getByText(actionRegexp.move)).toBeVisible();
			expect(screen.getByText(actionRegexp.move)).toHaveAttribute('disabled', '');
			expect(screen.getByText(actionRegexp.flag)).toBeVisible();
			expect(screen.getByText(actionRegexp.flag)).toHaveAttribute('disabled', '');
			expect(screen.getByText(actionRegexp.unflag)).toBeVisible();
			expect(screen.getByText(actionRegexp.unflag)).toHaveAttribute('disabled', '');
			expect(screen.getByText(actionRegexp.download)).toBeVisible();
			expect(screen.getByText(actionRegexp.download)).toHaveAttribute('disabled', '');
			expect(screen.getByText(actionRegexp.openDocument)).toBeVisible();
			expect(screen.getByText(actionRegexp.openDocument)).toHaveAttribute('disabled', '');
			expect(screen.queryByTestId('icon: RestoreOutline')).not.toBeInTheDocument();
			expect(screen.queryByTestId('icon: DeletePermanentlyOutline')).not.toBeInTheDocument();
			expect(screen.getByTestId('icon: ArrowBackOutline')).toBeVisible();
			userEvent.click(screen.getByTestId('icon: ArrowBackOutline'));
			expect(screen.queryByTestId('icon: Trash2Outline')).not.toBeInTheDocument();
			expect(screen.queryByTestId('unCheckedAvatar')).not.toBeInTheDocument();
			expect(screen.queryByTestId('checkedAvatar')).not.toBeInTheDocument();
			expect(screen.queryByText(/select all/i)).not.toBeInTheDocument();
		});
	});
});
