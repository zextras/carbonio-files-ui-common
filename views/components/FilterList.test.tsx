/*
 * SPDX-FileCopyrightText: 2022 Zextras <https://www.zextras.com>
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import React from 'react';

import { screen, waitFor, waitForElementToBeRemoved, within } from '@testing-library/react';
import forEach from 'lodash/forEach';
import { Link, Route, Switch } from 'react-router-dom';

import { CreateOptionsContent } from '../../../hooks/useCreateOptions';
import { FILTER_TYPE, INTERNAL_PATH, NODES_LOAD_LIMIT, ROOTS } from '../../constants';
import FIND_NODES from '../../graphql/queries/findNodes.graphql';
import { populateFolder, populateNode, populateNodes } from '../../mocks/mockUtils';
import { Node } from '../../types/common';
import { FindNodesQuery, FindNodesQueryVariables } from '../../types/graphql/types';
import {
	getChildrenVariables,
	getFindNodesVariables,
	mockFindNodes,
	mockFlagNodes,
	mockGetChild,
	mockGetChildren,
	mockGetPermissions
} from '../../utils/mockUtils';
import {
	buildBreadCrumbRegExp,
	iconRegexp,
	setup,
	selectNodes,
	triggerLoadMore
} from '../../utils/testUtils';
import FolderView from '../FolderView';
import { DisplayerProps } from './Displayer';
import FilterList from './FilterList';

jest.mock('../../../hooks/useCreateOptions', () => ({
	useCreateOptions: (): CreateOptionsContent => ({
		setCreateOptions: jest.fn(),
		removeCreateOptions: jest.fn()
	})
}));

jest.mock('../components/Displayer', () => ({
	Displayer: (props: DisplayerProps): JSX.Element => (
		<div data-testid="displayer">
			{props.translationKey}:{props.icons}
		</div>
	)
}));

describe('Filter list', () => {
	describe('Generic filter', () => {
		test('first access to a filter show loading state and than show nodes', async () => {
			setup(<FilterList flagged />);

			const listHeader = screen.getByTestId('list-header');
			expect(within(listHeader).getByTestId('icon: Refresh')).toBeVisible();
			await waitFor(() => expect(screen.getByTestId(`list-`)).not.toBeEmptyDOMElement());
			expect(within(listHeader).queryByTestId('icon: Refresh')).not.toBeInTheDocument();
			const queryResult = global.apolloClient.readQuery<FindNodesQuery, FindNodesQueryVariables>({
				query: FIND_NODES,
				variables: getFindNodesVariables({ flagged: true })
			});
			expect(queryResult?.findNodes?.nodes || null).not.toBeNull();
			const nodes = queryResult?.findNodes?.nodes as Node[];
			forEach(nodes, (node) => {
				expect(screen.getByTestId(`node-item-${node.id}`)).toBeInTheDocument();
				expect(screen.getByTestId(`node-item-${node.id}`)).toHaveTextContent(node.name);
			});
		});

		test('intersectionObserver trigger the fetchMore function to load more elements when observed element is intersected', async () => {
			const currentFilter = populateNodes(NODES_LOAD_LIMIT + Math.floor(NODES_LOAD_LIMIT / 2));

			const mocks = [
				mockFindNodes(
					getFindNodesVariables({ flagged: true }),
					currentFilter.slice(0, NODES_LOAD_LIMIT)
				),
				mockFindNodes(
					getFindNodesVariables({ flagged: true }, true),
					currentFilter.slice(NODES_LOAD_LIMIT)
				)
			];

			setup(<FilterList flagged />, { mocks });

			// this is the loading refresh icon
			expect(screen.getByTestId('list-header')).toContainElement(
				screen.getByTestId('icon: Refresh')
			);
			expect(within(screen.getByTestId('list-header')).getByTestId('icon: Refresh')).toBeVisible();
			await waitForElementToBeRemoved(
				within(screen.getByTestId('list-header')).queryByTestId('icon: Refresh')
			);
			// wait the rendering of the first item
			await screen.findByTestId(`node-item-${currentFilter[0].id}`);
			expect(
				screen.getByTestId(`node-item-${currentFilter[NODES_LOAD_LIMIT - 1].id}`)
			).toBeVisible();
			// the loading icon should be still visible at the bottom of the list because we have load the max limit of items per page
			expect(screen.getByTestId('icon: Refresh')).toBeVisible();

			// elements after the limit should not be rendered
			expect(screen.queryByTestId(currentFilter[NODES_LOAD_LIMIT].id)).not.toBeInTheDocument();
			await triggerLoadMore();

			// wait for the response
			await screen.findByTestId(`node-item-${currentFilter[NODES_LOAD_LIMIT].id}`);

			// now all elements are loaded so last node and first node should be visible and no loading icon should be rendered
			expect(
				screen.getByTestId(`node-item-${currentFilter[currentFilter.length - 1].id}`)
			).toBeVisible();
			expect(screen.getByTestId(`node-item-${currentFilter[0].id}`)).toBeVisible();
			expect(screen.getAllByTestId('node-item', { exact: false })).toHaveLength(
				currentFilter.length
			);
			expect(screen.queryByTestId('Icon: Refresh')).not.toBeInTheDocument();
		});

		test('flagged filter call the findNodes with only flagged parameter set to true', async () => {
			const nodes = [];
			for (let i = 0; i < NODES_LOAD_LIMIT - 1; i += 1) {
				const node = populateNode();
				node.flagged = true;
				nodes.push(node);
			}
			const mocks = [mockFindNodes(getFindNodesVariables({ flagged: true }), nodes)];

			setup(<FilterList flagged />, { mocks });

			await waitForElementToBeRemoved(screen.queryByTestId('icon: Refresh'));

			expect(screen.getAllByTestId('icon: Flag')).toHaveLength(nodes.length);
		});

		test('breadcrumb show Flagged', async () => {
			const { getByTextWithMarkup } = setup(<FilterList flagged />);

			const breadcrumbRegExp = buildBreadCrumbRegExp('Flagged');
			expect(getByTextWithMarkup(breadcrumbRegExp)).toBeVisible();
		});

		test('filter are refetch on subsequent navigations', async () => {
			const nodes = populateNodes(1);
			const currentFolder = populateFolder();
			const node = populateNode();
			node.flagged = false;
			currentFolder.children.nodes.push(node);

			const mocks = [
				mockFindNodes(getFindNodesVariables({ flagged: true }), nodes),
				mockGetChildren(getChildrenVariables(currentFolder.id), currentFolder),
				mockGetChild({ node_id: currentFolder.id }, currentFolder),
				mockGetPermissions({ node_id: currentFolder.id }, currentFolder),
				mockFlagNodes(
					{
						node_ids: [node.id],
						flag: true
					},
					[node.id]
				),
				mockFindNodes(getFindNodesVariables({ flagged: true }), [...nodes, node])
			];

			const { user } = setup(
				<div>
					<Link
						to={{
							pathname: '/folder',
							search: `?folder=${currentFolder.id}`
						}}
					>
						Go to folder
					</Link>
					<Link to={INTERNAL_PATH.FILTER}>Go to filter</Link>
					<Switch>
						<Route path={INTERNAL_PATH.FILTER} exact>
							<FilterList flagged />
						</Route>
						<Route path="/folder">
							<FolderView />
						</Route>
					</Switch>
				</div>,
				{ initialRouterEntries: [INTERNAL_PATH.FILTER], mocks }
			);

			// filter list, first load to write data in cache
			await screen.findByTestId(`node-item-${nodes[0].id}`);
			// only 1 item load
			expect(screen.getByTestId('node-item', { exact: false })).toBeInTheDocument();
			// navigate to folder
			await user.click(screen.getByRole('link', { name: 'Go to folder' }));
			// folder list, first load
			await screen.findByTestId(`node-item-${node.id}`);
			expect(screen.getByTestId('node-item', { exact: false })).toBeInTheDocument();
			// flag the node through the hover bar
			await user.click(screen.getByTestId('icon: FlagOutline'));
			await screen.findByTestId('icon: Flag');
			// navigate to filter again
			await user.click(screen.getByRole('link', { name: 'Go to filter' }));
			// filter list, second load but with a new network request. Wait for loading icon to be removed
			await screen.findByText(node.name);
			const nodesItems = screen.getAllByTestId('node-item', { exact: false });
			expect(nodesItems).toHaveLength(2);
			expect(screen.getByTestId(`node-item-${node.id}`)).toBe(nodesItems[1]);
		});
	});

	describe('Trash filter', () => {
		describe('Selection mode', () => {
			test('if there is no element selected, trash actions are hidden', async () => {
				const nodes = populateNodes(10);
				forEach(nodes, (mockedNode) => {
					mockedNode.rootId = ROOTS.TRASH;
				});

				const mocks = [
					mockFindNodes(getFindNodesVariables({ folder_id: ROOTS.TRASH, cascade: false }), nodes)
				];
				const { user } = setup(
					<Route path={`${INTERNAL_PATH.FILTER}/:filter?`}>
						<FilterList folderId={ROOTS.TRASH} cascade={false} />
					</Route>,
					{ mocks, initialRouterEntries: [`${INTERNAL_PATH.FILTER}${FILTER_TYPE.myTrash}`] }
				);
				await screen.findByText(nodes[0].name);
				expect(screen.getByText(nodes[0].name)).toBeVisible();
				expect(screen.queryByTestId('checkedAvatar')).not.toBeInTheDocument();
				await selectNodes([nodes[0].id], user);
				// check that all wanted items are selected
				expect(screen.getByTestId('checkedAvatar')).toBeInTheDocument();
				expect(screen.getByText(/select all/i)).toBeVisible();
				// deselect node. Selection mode remains active
				await selectNodes([nodes[0].id], user);
				expect(screen.queryByTestId('checkedAvatar')).not.toBeInTheDocument();
				expect(screen.getAllByTestId('unCheckedAvatar')).toHaveLength(nodes.length);
				expect(screen.getByText(/select all/i)).toBeVisible();

				expect(screen.queryByTestId(iconRegexp.moreVertical)).not.toBeInTheDocument();
				expect(screen.queryByTestId(iconRegexp.restore)).not.toBeInTheDocument();
				expect(screen.queryByTestId(iconRegexp.deletePermanently)).not.toBeInTheDocument();
				expect(screen.queryByTestId(iconRegexp.moveToTrash)).not.toBeInTheDocument();

				expect(screen.getByTestId('icon: ArrowBackOutline')).toBeVisible();
				await user.click(screen.getByTestId('icon: ArrowBackOutline'));
				const listHeader = screen.getByTestId('list-header', { exact: false });
				expect(screen.queryByTestId('icon: ArrowBackOutline')).not.toBeInTheDocument();
				expect(within(listHeader).queryByTestId('icon: RestoreOutline')).not.toBeInTheDocument();
				expect(
					within(listHeader).queryByTestId('icon: DeletePermanentlyOutline')
				).not.toBeInTheDocument();
				expect(screen.queryByTestId('unCheckedAvatar')).not.toBeInTheDocument();
				expect(screen.queryByTestId('checkedAvatar')).not.toBeInTheDocument();
				expect(screen.queryByText(/select all/i)).not.toBeInTheDocument();
			});
		});
	});
});
