/*
 * SPDX-FileCopyrightText: 2022 Zextras <https://www.zextras.com>
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import React from 'react';

import { act, fireEvent, screen, waitForElementToBeRemoved, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import find from 'lodash/find';
import map from 'lodash/map';
import { graphql } from 'msw';
import { Route } from 'react-router-dom';

import { CreateOptionsContent } from '../../hooks/useCreateOptions';
import server from '../../mocks/server';
import { searchParamsVar } from '../apollo/searchVar';
import { NODES_LOAD_LIMIT, ROOTS } from '../constants';
import BASE_NODE from '../graphql/fragments/baseNode.graphql';
import {
	populateFolder,
	populateNodePage,
	populateNodes,
	populateParents,
	populatePermissions
} from '../mocks/mockUtils';
import { AdvancedFilters, Node } from '../types/common';
import {
	BaseNodeFragment,
	File,
	FindNodesQuery,
	FindNodesQueryVariables,
	Folder,
	GetChildrenQuery,
	GetChildrenQueryVariables,
	GetNodeQuery,
	GetNodeQueryVariables,
	GetPathQuery,
	GetPathQueryVariables,
	NodeType
} from '../types/graphql/types';
import {
	actionRegexp,
	buildBreadCrumbRegExp,
	buildChipsFromKeywords,
	moveNode,
	render,
	selectNodes,
	waitForNetworkResponse
} from '../utils/testUtils';
import { SearchView } from './SearchView';

jest.mock('../../hooks/useCreateOptions', () => ({
	useCreateOptions: (): CreateOptionsContent => ({
		setCreateOptions: jest.fn(),
		removeCreateOptions: jest.fn()
	})
}));

describe('Search view', () => {
	test.skip('all actions are available in the nodes', async () => {
		const keywords = ['keyword1', 'keyword2'];
		const searchParams: AdvancedFilters = { keywords: buildChipsFromKeywords(keywords) };
		searchParamsVar(searchParams);
		const nodes = populateNodes(2);
		nodes[0].permissions = populatePermissions(true);
		nodes[0].flagged = false;

		server.use(
			graphql.query<FindNodesQuery, FindNodesQueryVariables>('findNodes', (req, res, ctx) =>
				res(ctx.data({ findNodes: populateNodePage(nodes, NODES_LOAD_LIMIT) }))
			),
			graphql.query<GetNodeQuery, GetNodeQueryVariables>('getNode', (req, res, ctx) => {
				const { node_id: id } = req.variables;
				return res(
					ctx.data({ getNode: (find(nodes, (node) => node.id === id) as File | Folder) || null })
				);
			})
		);
		render(
			<Route path="/search">
				<SearchView />
			</Route>,
			{
				initialRouterEntries: ['/search']
			}
		);

		// right click to open contextual menu
		const nodeItems = await screen.findAllByTestId('node-item', { exact: false });
		fireEvent.contextMenu(nodeItems[0]);
		await screen.findByText(actionRegexp.moveToTrash);
		expect(screen.queryByText(actionRegexp.restore)).not.toBeInTheDocument();
		expect(screen.queryByText(actionRegexp.deletePermanently)).not.toBeInTheDocument();
		expect(screen.getByText(actionRegexp.moveToTrash)).toBeVisible();
		expect(screen.getByText(actionRegexp.rename)).toBeVisible();
		expect(screen.getByText(actionRegexp.flag)).toBeVisible();
		expect(screen.queryByText(actionRegexp.unflag)).not.toBeInTheDocument();
		expect(screen.getByText(actionRegexp.move)).toBeVisible();
		expect(screen.getByText(actionRegexp.download)).toBeVisible();
		expect(screen.getByText(actionRegexp.copy)).toBeVisible();

		// selection mode
		selectNodes([nodes[0].id]);
		await screen.findByText(/select all/i);
		expect(screen.getByTestId('checkedAvatar')).toBeInTheDocument();
		expect(screen.getByTestId('icon: MoreVertical')).toBeVisible();
		const moveToTrashActionSelection = await within(
			screen.getByTestId('list-header-selectionModeActive')
		).findByTestId('icon: Trash2Outline');
		expect(moveToTrashActionSelection).toBeVisible();
		const selectionModeHeader = screen.getByTestId('list-header-selectionModeActive');
		expect(
			within(selectionModeHeader).queryByTestId('icon: RestoreOutline')
		).not.toBeInTheDocument();
		expect(
			within(selectionModeHeader).queryByTestId('icon: DeletePermanentlyOutline')
		).not.toBeInTheDocument();
		act(() => {
			userEvent.click(screen.getByTestId('icon: MoreVertical'));
		});
		await screen.findByText(actionRegexp.rename);
		expect(screen.getByText(actionRegexp.rename)).toBeVisible();
		expect(screen.getByText(actionRegexp.flag)).toBeVisible();
		expect(screen.getByText(actionRegexp.unflag)).toBeVisible();
		expect(screen.getByText(actionRegexp.move)).toBeVisible();
		expect(screen.getByText(actionRegexp.download)).toBeVisible();
		expect(screen.getByText(actionRegexp.copy)).toBeVisible();
		// exit selection mode
		userEvent.click(screen.getByTestId('icon: ArrowBackOutline'));
		await screen.findByText(/advanced filter/i);
		expect(screen.queryByTestId('icon: MoreVertical')).not.toBeInTheDocument();
		expect(screen.queryByTestId('checkedAvatar')).not.toBeInTheDocument();

		// displayer
		userEvent.click(nodeItems[0]);
		await screen.findByText(/details/i);
		const displayer = screen.getByTestId('displayer');
		await within(displayer).findAllByText(nodes[0].name);
		expect(screen.getByTestId('icon: MoreVertical')).toBeVisible();
		expect(within(displayer).queryByTestId('icon: RestoreOutline')).not.toBeInTheDocument();
		expect(
			within(displayer).queryByTestId('icon: DeletePermanentlyOutline')
		).not.toBeInTheDocument();
		expect(within(displayer).queryByTestId('icon: Trash2Outline')).toBeVisible();
		userEvent.click(screen.getByTestId('icon: MoreVertical'));
		await screen.findByText(actionRegexp.rename);
		expect(screen.getByText(actionRegexp.rename)).toBeVisible();
		expect(screen.getByText(actionRegexp.flag)).toBeVisible();
		expect(screen.getByText(actionRegexp.unflag)).toBeVisible();
		expect(screen.getByText(actionRegexp.move)).toBeVisible();
		expect(screen.getByText(actionRegexp.download)).toBeVisible();
		expect(screen.getByText(actionRegexp.copy)).toBeVisible();

		act(() => {
			// run timers of displayer preview
			jest.runOnlyPendingTimers();
		});

		expect.assertions(32);
	});

	describe('Displayer', () => {
		test('Single click on a node opens the details tab on displayer. Close displayer action keeps search view visible', async () => {
			const keywords = ['keyword1', 'keyword2'];
			const searchParams: AdvancedFilters = { keywords: buildChipsFromKeywords(keywords) };
			searchParamsVar(searchParams);
			const currentSearch = populateNodes(2);
			// prepare cache so that apollo client read data from the cache

			server.use(
				graphql.query<FindNodesQuery, FindNodesQueryVariables>('findNodes', (req, res, ctx) =>
					res(
						ctx.data({
							findNodes: populateNodePage(currentSearch)
						})
					)
				),
				graphql.query<GetNodeQuery, GetNodeQueryVariables>('getNode', (req, res, ctx) =>
					res(ctx.data({ getNode: currentSearch[0] as Node }))
				)
			);

			const { getByTextWithMarkup } = render(
				<Route path="/search">
					<SearchView />
				</Route>,
				{ initialRouterEntries: ['/search'] }
			);
			expect(screen.queryByText('Previous view')).not.toBeInTheDocument();
			const nodeItem = await screen.findByText(currentSearch[0].name);
			expect(nodeItem).toBeVisible();
			const displayer = screen.getByTestId('displayer');
			expect(within(displayer).queryByText(/details/i)).not.toBeInTheDocument();
			userEvent.click(nodeItem);
			await screen.findByText(/details/i);
			expect(within(displayer).getAllByText(currentSearch[0].name)).toHaveLength(2);
			expect(getByTextWithMarkup(buildBreadCrumbRegExp(currentSearch[0].name))).toBeVisible();
			const closeDisplayerAction = within(screen.getByTestId('PreviewPanelHeader')).getByTestId(
				'icon: Close'
			);
			expect(closeDisplayerAction).toBeVisible();
			userEvent.click(closeDisplayerAction);
			expect(within(displayer).queryByText(/details/i)).not.toBeInTheDocument();
			expect(screen.getByText(currentSearch[0].name)).toBeVisible();
			expect.assertions(8);
		});

		test('Move action does not close the displayer if node is not removed from the main list', async () => {
			const keywords = ['keyword1', 'keyword2'];
			const searchParams: AdvancedFilters = { keywords: buildChipsFromKeywords(keywords) };
			searchParamsVar(searchParams);

			const nodes = populateNodes(2);
			const node = nodes[0];
			node.parent = populateFolder();
			const { path: parentPath } = populateParents(node.parent);
			const destinationFolder = populateFolder();
			destinationFolder.permissions.can_write_folder = true;
			destinationFolder.permissions.can_write_file = true;
			(node.parent as Folder).children.push(destinationFolder);
			(node.parent as Folder).permissions.can_write_folder = true;
			(node.parent as Folder).permissions.can_write_file = true;
			node.permissions.can_write_folder = true;
			node.permissions.can_write_file = true;
			node.flagged = true;
			const path = [...parentPath, node];
			const pathUpdated = [...parentPath, destinationFolder, node];
			const pathResponse = [path, pathUpdated];
			server.use(
				graphql.query<FindNodesQuery, FindNodesQueryVariables>('findNodes', (req, res, ctx) =>
					res(
						ctx.data({
							findNodes: populateNodePage(nodes)
						})
					)
				),
				graphql.query<GetNodeQuery, GetNodeQueryVariables>('getNode', (req, res, ctx) => {
					let result = null;
					const { node_id: id } = req.variables;
					switch (id) {
						case node.id:
							result = node;
							break;
						case (node.parent as Folder).id:
							result = node.parent;
							break;
						case destinationFolder.id:
							result = destinationFolder;
							break;
						default:
							break;
					}
					return res(ctx.data({ getNode: result as Node }));
				}),
				graphql.query<GetPathQuery, GetPathQueryVariables>('getPath', (req, res, ctx) => {
					let result = null;
					const { node_id: id } = req.variables;
					switch (id) {
						case node.id:
							result = pathResponse.shift() || [];
							break;
						case (node.parent as Folder).id:
							result = parentPath;
							break;
						case destinationFolder.id:
							result = [...parentPath, destinationFolder];
							break;
						default:
							break;
					}
					return res(ctx.data({ getPath: result || [] }));
				}),
				graphql.query<GetChildrenQuery, GetChildrenQueryVariables>('getChildren', (req, res, ctx) =>
					res(ctx.data({ getNode: node.parent }))
				)
			);

			const { getByTextWithMarkup, queryByTextWithMarkup, findByTextWithMarkup } = render(
				<Route path="/search">
					<SearchView />
				</Route>,
				{
					initialRouterEntries: ['/search']
				}
			);

			// wait the content to be rendered
			await screen.findAllByTestId('node-item', { exact: false });
			expect(nodes).not.toBeNull();
			expect(nodes.length).toBeGreaterThan(0);
			const nodeItem = screen.getByText(node.name);
			expect(nodeItem).toBeVisible();
			expect(screen.queryByText(/details/)).not.toBeInTheDocument();
			userEvent.click(nodeItem);
			await screen.findByText(/details/i);
			expect(screen.getByText(/details/i)).toBeVisible();
			const displayer = screen.getByTestId('displayer');
			expect(within(displayer).getAllByText(node.name)).toHaveLength(2);
			expect(getByTextWithMarkup(buildBreadCrumbRegExp(node.name))).toBeVisible();
			const showPathButton = screen.getByRole('button', { name: /show path/i });
			expect(showPathButton).toBeVisible();
			userEvent.click(showPathButton);
			const fullPathOrig = await findByTextWithMarkup(
				buildBreadCrumbRegExp(...map(path, (parent) => parent.name))
			);
			expect(fullPathOrig).toBeVisible();
			// right click to open contextual menu
			const nodeToMoveItem = screen.getByTestId(`node-item-${node.id}`);
			fireEvent.contextMenu(nodeToMoveItem);
			await moveNode(destinationFolder);
			const fullPath = await findByTextWithMarkup(
				buildBreadCrumbRegExp(...map(pathUpdated, (parent) => parent.name))
			);
			const snackbar = await screen.findByText(/item moved/i);
			await waitForElementToBeRemoved(snackbar);
			// old breadcrumb is not visible anymore
			expect(
				queryByTextWithMarkup(buildBreadCrumbRegExp(...map([...path], (parent) => parent.name)))
			).not.toBeInTheDocument();
			// updated breadcrumb is visible instead
			expect(fullPath).toBeVisible();
			expect(screen.getAllByTestId('node-item', { exact: false })).toHaveLength(nodes.length);
			expect(within(screen.getByTestId('list-')).getByText(node.name)).toBeVisible();
			expect(within(displayer).getAllByText(node.name)).toHaveLength(2);
		});

		test('Mark for deletion closes the displayer from searches without trashed nodes', async () => {
			const keywords = ['keyword1', 'keyword2'];
			const folder = populateFolder();
			const searchParams: AdvancedFilters = {
				keywords: buildChipsFromKeywords(keywords),
				folderId: { label: folder.name, value: folder.id },
				cascade: { value: true }
			};
			searchParamsVar(searchParams);

			const nodes = populateNodes(2);
			const node = nodes[0];
			node.parent = populateFolder();
			node.parent.permissions.can_write_folder = true;
			node.parent.permissions.can_write_file = true;
			node.permissions.can_write_folder = true;
			node.permissions.can_write_file = true;
			server.use(
				graphql.query<FindNodesQuery, FindNodesQueryVariables>('findNodes', (req, res, ctx) =>
					res(
						ctx.data({
							findNodes: populateNodePage(nodes)
						})
					)
				),
				graphql.query<GetNodeQuery, GetNodeQueryVariables>('getNode', (req, res, ctx) => {
					let result = null;
					const { node_id: id } = req.variables;
					switch (id) {
						case node.id:
							result = node;
							break;
						case (node.parent as Folder).id:
							result = node.parent;
							break;
						default:
							break;
					}
					return res(ctx.data({ getNode: result as Node }));
				})
			);

			render(
				<Route path="/search">
					<SearchView />
				</Route>,
				{
					initialRouterEntries: ['/search']
				}
			);

			// wait the content to be rendered
			await screen.findAllByTestId('node-item', { exact: false });
			expect(nodes).not.toBeNull();
			expect(nodes.length).toBeGreaterThan(0);
			const nodeItem = screen.getByText(node.name);
			expect(nodeItem).toBeVisible();
			expect(screen.queryByText(/details/)).not.toBeInTheDocument();
			userEvent.click(nodeItem);
			await screen.findByText(/details/i);
			expect(screen.getByText(/details/i)).toBeVisible();
			const displayer = screen.getByTestId('displayer');
			expect(within(displayer).getAllByText(node.name)).toHaveLength(2);
			// right click to open contextual menu
			const nodeToTrashItem = screen.getByTestId(`node-item-${node.id}`);
			fireEvent.contextMenu(nodeToTrashItem);
			const moveToTrashAction = await screen.findByText(actionRegexp.moveToTrash);
			expect(moveToTrashAction).toBeVisible();
			userEvent.click(moveToTrashAction);
			// await snackbar to be shown
			const snackbar = await screen.findByText(/item moved to trash/i);
			await waitForElementToBeRemoved(snackbar);
			await screen.findByText(/view files and folders/i);
			expect(screen.getAllByTestId('node-item', { exact: false })).toHaveLength(nodes.length - 1);
			expect(screen.queryByText(node.name)).not.toBeInTheDocument();
			expect(screen.queryByTestId(`node-item-${node.id}`)).not.toBeInTheDocument();
			expect(within(displayer).getByText(/view files and folders/i)).toBeVisible();
		});

		test('Mark for deletion does not close the displayer from searches with nodes both marked for deletion and not', async () => {
			const keywords = ['keyword1', 'keyword2'];
			const searchParams: AdvancedFilters = { keywords: buildChipsFromKeywords(keywords) };
			searchParamsVar(searchParams);

			const nodes = populateNodes(2);
			const node = nodes[0];
			node.parent = populateFolder();
			node.parent.permissions.can_write_folder = true;
			node.parent.permissions.can_write_file = true;
			node.permissions.can_write_folder = true;
			node.permissions.can_write_file = true;
			node.permissions.can_delete = true;
			server.use(
				graphql.query<FindNodesQuery, FindNodesQueryVariables>('findNodes', (req, res, ctx) =>
					res(
						ctx.data({
							findNodes: populateNodePage(nodes)
						})
					)
				),
				graphql.query<GetNodeQuery, GetNodeQueryVariables>('getNode', (req, res, ctx) => {
					let result = null;
					const { node_id: id } = req.variables;
					switch (id) {
						case node.id:
							result = node;
							break;
						case (node.parent as Folder).id:
							result = node.parent;
							break;
						default:
							break;
					}
					return res(ctx.data({ getNode: result as Node }));
				})
			);

			render(
				<Route path="/search">
					<SearchView />
				</Route>,
				{
					initialRouterEntries: ['/search']
				}
			);

			// wait the content to be rendered
			await screen.findAllByTestId('node-item', { exact: false });
			expect(nodes).not.toBeNull();
			expect(nodes.length).toBeGreaterThan(0);
			const nodeItem = screen.getByText(node.name);
			expect(nodeItem).toBeVisible();
			expect(screen.queryByText(/details/)).not.toBeInTheDocument();
			userEvent.click(nodeItem);
			await screen.findByText(/details/i);
			expect(screen.getByText(/details/i)).toBeVisible();
			const displayer = screen.getByTestId('displayer');
			expect(within(displayer).getAllByText(node.name)).toHaveLength(2);
			// right click to open contextual menu
			const nodeToTrashItem = screen.getByTestId(`node-item-${node.id}`);
			fireEvent.contextMenu(nodeToTrashItem);
			const moveToTrashAction = await screen.findByText(actionRegexp.moveToTrash);
			expect(moveToTrashAction).toBeVisible();
			userEvent.click(moveToTrashAction);
			// await snackbar to be shown
			const snackbar = await screen.findByText(/item moved to trash/i);
			await waitForElementToBeRemoved(snackbar);
			expect(screen.getAllByTestId('node-item', { exact: false })).toHaveLength(nodes.length);
			expect(within(screen.getByTestId('list-')).getByText(node.name)).toBeVisible();
			expect(within(displayer).getAllByText(node.name)).toHaveLength(2);
			const trashedNodeItem = screen.getByTestId(`node-item-${node.id}`);
			expect(trashedNodeItem).toBeVisible();
			fireEvent.contextMenu(trashedNodeItem);
			await screen.findByText(actionRegexp.restore);
			expect(screen.getByText(actionRegexp.restore)).toBeVisible();
			expect(screen.getByText(actionRegexp.deletePermanently)).toBeVisible();
			expect(screen.queryByText(actionRegexp.moveToTrash)).not.toBeInTheDocument();
		});

		test('Restore closes the displayer from searches with only trashed nodes', async () => {
			const keywords = ['keyword1', 'keyword2'];
			const searchParams: AdvancedFilters = {
				keywords: buildChipsFromKeywords(keywords),
				folderId: { label: 'Trash', value: ROOTS.TRASH }
			};
			searchParamsVar(searchParams);

			const nodes = populateNodes(2);
			const node = nodes[0];
			node.parent = populateFolder();
			node.parent.permissions.can_write_folder = true;
			node.parent.permissions.can_write_file = true;
			node.permissions.can_write_folder = true;
			node.permissions.can_write_file = true;
			node.rootId = ROOTS.TRASH;

			server.use(
				graphql.query<FindNodesQuery, FindNodesQueryVariables>('findNodes', (req, res, ctx) =>
					res(
						ctx.data({
							findNodes: populateNodePage(nodes)
						})
					)
				),
				graphql.query<GetNodeQuery, GetNodeQueryVariables>('getNode', (req, res, ctx) => {
					let result = null;
					const { node_id: id } = req.variables;
					switch (id) {
						case node.id:
							result = node;
							break;
						case (node.parent as Folder).id:
							result = node.parent;
							break;
						default:
							break;
					}
					return res(ctx.data({ getNode: result as Node }));
				})
			);

			render(
				<Route path="/search">
					<SearchView />
				</Route>,
				{
					initialRouterEntries: ['/search']
				}
			);

			// wait the content to be rendered
			await screen.findAllByTestId('node-item', { exact: false });
			expect(nodes).not.toBeNull();
			expect(nodes.length).toBeGreaterThan(0);
			const nodeItem = screen.getByText(node.name);
			expect(nodeItem).toBeVisible();
			expect(screen.queryByText(/details/)).not.toBeInTheDocument();
			userEvent.click(nodeItem);
			await screen.findByText(/details/i);
			expect(screen.getByText(/details/i)).toBeVisible();
			const displayer = screen.getByTestId('displayer');
			expect(within(displayer).getAllByText(node.name)).toHaveLength(2);
			// right click to open contextual menu
			const nodeToRestoreItem = screen.getByTestId(`node-item-${node.id}`);
			fireEvent.contextMenu(nodeToRestoreItem);
			const restoreAction = await screen.findByText(actionRegexp.restore);
			expect(restoreAction).toBeVisible();
			expect(restoreAction.parentNode).not.toHaveAttribute('disabled', '');
			userEvent.click(restoreAction);
			// await snackbar to be shown
			const snackbar = await screen.findByText(/^success$/i);
			await waitForElementToBeRemoved(snackbar);
			await screen.findByText(/view files and folders/i);
			expect(screen.getAllByTestId('node-item', { exact: false })).toHaveLength(nodes.length - 1);
			expect(screen.queryByText(node.name)).not.toBeInTheDocument();
			expect(screen.queryByTestId(`node-item-${node.id}`)).not.toBeInTheDocument();
			expect(within(displayer).getByText(/View files and folders/i)).toBeVisible();
		});

		test('Restore does not close the displayer from searches with nodes both marked for deletion and not', async () => {
			const keywords = ['keyword1', 'keyword2'];
			const searchParams: AdvancedFilters = { keywords: buildChipsFromKeywords(keywords) };
			searchParamsVar(searchParams);

			const nodes = populateNodes(2);
			const node = nodes[0];
			node.parent = populateFolder();
			node.parent.permissions.can_write_folder = true;
			node.parent.permissions.can_write_file = true;
			node.permissions.can_write_folder = true;
			node.permissions.can_write_file = true;
			node.rootId = ROOTS.TRASH;

			global.apolloClient.writeFragment<BaseNodeFragment>({
				fragment: BASE_NODE,
				fragmentName: 'BaseNode',
				data: {
					__typename: 'Folder',
					id: ROOTS.LOCAL_ROOT,
					name: ROOTS.LOCAL_ROOT,
					type: NodeType.Root,
					rootId: null,
					flagged: false,
					permissions: populatePermissions(true)
				}
			});

			server.use(
				graphql.query<FindNodesQuery, FindNodesQueryVariables>('findNodes', (req, res, ctx) =>
					res(
						ctx.data({
							findNodes: populateNodePage(nodes)
						})
					)
				),
				graphql.query<GetNodeQuery, GetNodeQueryVariables>('getNode', (req, res, ctx) => {
					let result = null;
					const { node_id: id } = req.variables;
					switch (id) {
						case node.id:
							result = node;
							break;
						case (node.parent as Folder).id:
							result = node.parent;
							break;
						default:
							break;
					}
					return res(ctx.data({ getNode: result as Node }));
				})
			);

			render(
				<Route path="/search">
					<SearchView />
				</Route>,
				{
					initialRouterEntries: ['/search']
				}
			);

			// wait the content to be rendered
			await screen.findAllByTestId('node-item', { exact: false });
			expect(nodes).not.toBeNull();
			expect(nodes.length).toBeGreaterThan(0);
			const nodeItem = screen.getByText(node.name);
			expect(nodeItem).toBeVisible();
			expect(screen.queryByText(/details/)).not.toBeInTheDocument();
			userEvent.click(nodeItem);
			await screen.findByText(/details/i);
			expect(screen.getByText(/details/i)).toBeVisible();
			const displayer = screen.getByTestId('displayer');
			expect(within(displayer).getAllByText(node.name)).toHaveLength(2);
			// right click to open contextual menu
			const nodeToRestoreItem = screen.getByTestId(`node-item-${node.id}`);
			fireEvent.contextMenu(nodeToRestoreItem);
			const restoreAction = await screen.findByText(actionRegexp.restore);
			expect(restoreAction).toBeVisible();
			expect(restoreAction.parentNode).not.toHaveAttribute('disabled', '');
			userEvent.click(restoreAction);
			await waitForNetworkResponse();
			// await snackbar to be shown
			const snackbar = await screen.findByText(/^success$/i);
			await waitForElementToBeRemoved(snackbar);
			expect(screen.getAllByTestId('node-item', { exact: false })).toHaveLength(nodes.length);
			expect(within(screen.getByTestId('list-')).getByText(node.name)).toBeVisible();
			expect(within(screen.getByTestId('displayer')).getAllByText(node.name)).toHaveLength(2);
			const restoredNodeItem = screen.getByTestId(`node-item-${node.id}`);
			expect(restoredNodeItem).toBeVisible();
			fireEvent.contextMenu(restoredNodeItem);
			await waitForNetworkResponse();
			await screen.findByText(actionRegexp.moveToTrash);
			expect(screen.getByText(actionRegexp.moveToTrash)).toBeVisible();
			expect(screen.queryByText(actionRegexp.deletePermanently)).not.toBeInTheDocument();
			expect(screen.queryByText(actionRegexp.restore)).not.toBeInTheDocument();
		});
	});
});
