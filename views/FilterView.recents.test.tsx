/*
 * SPDX-FileCopyrightText: 2022 Zextras <https://www.zextras.com>
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */
import React from 'react';

import { screen } from '@testing-library/react';
import { graphql } from 'msw';
import { Route } from 'react-router-dom';

import { CreateOptionsContent } from '../../hooks/useCreateOptions';
import server from '../../mocks/server';
import { FILTER_PARAMS, FILTER_TYPE, INTERNAL_PATH, ROOTS } from '../constants';
import handleFindNodesRequest from '../mocks/handleFindNodesRequest';
import { populateNodes } from '../mocks/mockUtils';
import { FindNodesQuery, FindNodesQueryVariables, NodeSort } from '../types/graphql/types';
import { getFindNodesVariables, mockFindNodes } from '../utils/mockUtils';
import { setup } from '../utils/testUtils';
import FilterView from './FilterView';

const mockedRequestHandler = jest.fn();

beforeEach(() => {
	mockedRequestHandler.mockImplementation(handleFindNodesRequest);
	server.use(
		graphql.query<FindNodesQuery, FindNodesQueryVariables>('findNodes', mockedRequestHandler)
	);
});

jest.mock('../../hooks/useCreateOptions', () => ({
	useCreateOptions: (): CreateOptionsContent => ({
		setCreateOptions: jest.fn(),
		removeCreateOptions: jest.fn()
	})
}));

describe('Filter View', () => {
	describe('Recents filter', () => {
		test('Sorting component is hidden', async () => {
			const nodes = populateNodes(10);
			const mocks = [
				mockFindNodes(
					getFindNodesVariables({
						...FILTER_PARAMS.recents,
						sort: NodeSort.UpdatedAtDesc
					}),
					nodes
				),
				mockFindNodes(
					getFindNodesVariables({
						folder_id: ROOTS.LOCAL_ROOT,
						cascade: true,
						sort: NodeSort.UpdatedAtDesc
					}),
					nodes
				)
			];

			setup(<Route path={`${INTERNAL_PATH.FILTER}/:filter?`} component={FilterView} />, {
				initialRouterEntries: [`${INTERNAL_PATH.FILTER}${FILTER_TYPE.recents}`],
				mocks
			});

			await screen.findByText(nodes[0].name);
			expect(screen.queryByTestId('icon: AzListOutline')).not.toBeInTheDocument();
			expect(screen.queryByTestId('icon: ZaListOutline')).not.toBeInTheDocument();
		});
	});
});
