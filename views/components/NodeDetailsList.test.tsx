/*
 * SPDX-FileCopyrightText: 2022 Zextras <https://www.zextras.com>
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import React from 'react';

import { screen } from '@testing-library/react';

import { NODES_LOAD_LIMIT } from '../../constants';
import { populateNodes } from '../../mocks/mockUtils';
import { setup, triggerLoadMore } from '../../utils/testUtils';
import { NodeDetailsList } from './NodeDetailsList';

describe('Node details list', () => {
	test('intersectionObserver trigger the fetchMore function to load more elements when observed element is intersected', async () => {
		const nodes = populateNodes(NODES_LOAD_LIMIT);

		const loadMoreMock = jest.fn();

		setup(<NodeDetailsList nodes={nodes} loading={false} loadMore={loadMoreMock} hasMore />, {
			mocks: []
		});

		// wait the rendering of the first item
		const firstElement = await screen.findByText(nodes[0].name);
		expect(firstElement).toBeVisible();
		// the loading icon should be still visible at the bottom of the list because we have load the max limit of items per page
		expect(screen.getByTestId('icon: Refresh')).toBeVisible();

		// elements after the limit should not be rendered
		expect(screen.queryAllByTestId(`details-node-item-`, { exact: false })).toHaveLength(
			nodes.length
		);

		await triggerLoadMore();

		expect(loadMoreMock).toHaveBeenCalled();
	});
});
