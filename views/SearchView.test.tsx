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

import { CreateOptionsContent } from '../../hooks/useCreateOptions';
import server from '../../mocks/server';
import { searchParamsVar } from '../apollo/searchVar';
import { ROOTS } from '../constants';
import BASE_NODE from '../graphql/fragments/baseNode.graphql';
import {
	populateFolder,
	populateNode,
	populateNodePage,
	populateNodes,
	populateParents,
	populatePermissions,
	populateShares
} from '../mocks/mockUtils';
import { AdvancedFilters, Node } from '../types/common';
import {
	BaseNodeFragment,
	FindNodesQuery,
	FindNodesQueryVariables,
	Folder,
	GetNodeQuery,
	GetNodeQueryVariables,
	NodeType,
	SharedTarget
} from '../types/graphql/types';
import {
	getChildrenVariables,
	getFindNodesVariables,
	getNodeVariables,
	getSharesVariables,
	mockDeleteShare,
	mockFindNodes,
	mockGetChildren,
	mockGetNode,
	mockGetNodeLinks,
	mockGetPath,
	mockGetShares,
	mockMoveNodes
} from '../utils/mockUtils';
import {
	actionRegexp,
	buildBreadCrumbRegExp,
	buildChipsFromKeywords,
	moveNode,
	render,
	waitForNetworkResponse
} from '../utils/testUtils';
import { getChipLabel } from '../utils/utils';
import { SearchView } from './SearchView';

jest.mock('../../hooks/useCreateOptions', () => ({
	useCreateOptions: (): CreateOptionsContent => ({
		setCreateOptions: jest.fn(),
		removeCreateOptions: jest.fn()
	})
}));

describe('Search view', () => {
	describe('Shared by me param', () => {
		test('Deletion of all collaborators does not remove node from list. Displayer is kept open', async () => {
			const searchParams: AdvancedFilters = { sharedByMe: { label: 'shared', value: true } };
			searchParamsVar(searchParams);
			const nodes = populateNodes(2);
			const nodeWithShares = populateNode();
			const shares = populateShares(nodeWithShares, 2);
			nodeWithShares.shares = shares;
			nodeWithShares.permissions.can_share = true;
			nodes.push(nodeWithShares);
			const mocks = [
				mockFindNodes(getFindNodesVariables({ shared_by_me: true, keywords: [] }), nodes),
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
				// FIXME: findNodes is called 2 times?
				mockFindNodes(getFindNodesVariables({ shared_by_me: true, keywords: [] }), nodes)
			];

			render(<SearchView />, {
				initialRouterEntries: [`/search/?node=${nodeWithShares.id}&tab=sharing`],
				mocks
			});
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
			expect(within(nodeItem).getByTestId('icon: ArrowCircleRight')).toBeVisible();
			expect(share1Item).toBeDefined();
			expect(share2Item).toBeDefined();
			expect(share1Item).toBeVisible();
			expect(share2Item).toBeVisible();
			const list = screen.getByTestId('list-');
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
			expect(within(list).getByText(nodeWithShares.name)).toBeVisible();
			// delete second share
			act(() => {
				userEvent.click(within(share2Item as HTMLElement).getByTestId('icon: Close'));
			});
			await screen.findByRole('button', { name: /remove/i });
			userEvent.click(screen.getByRole('button', { name: /remove/i }));
			await waitForElementToBeRemoved(screen.queryByText(getChipLabel(shares[1].share_target)));
			const snackbar2 = await screen.findByText(/success/i);
			await waitForElementToBeRemoved(snackbar2);
			// node is kept in main list but share icon is removed
			expect(nodeItem).toBeVisible();
			expect(within(nodeItem).queryByTestId('icon: ArrowCircleRight')).not.toBeInTheDocument();
			// displayer remains open
			expect(within(screen.getByTestId('displayer')).getByText(nodeWithShares.name)).toBeVisible();
			expect(screen.getByText(/sharing/i)).toBeVisible();
			expect(screen.getByText(/collaborators/i)).toBeVisible();
		});
	});

	describe('Displayer', () => {
		test('Single click on a node opens the details tab on displayer. Close displayer action keeps search view visible', async () => {
			const keywords = ['keyword1', 'keyword2'];
			const searchParams: AdvancedFilters = { keywords: buildChipsFromKeywords(keywords) };
			searchParamsVar(searchParams);
			const currentSearch = populateNodes(2);
			// prepare cache so that apollo client read data from the cache

			const mocks = [
				mockFindNodes(getFindNodesVariables({ keywords }), currentSearch),
				mockGetNode(getNodeVariables(currentSearch[0].id), currentSearch[0] as Node)
			];

			const { getByTextWithMarkup } = render(<SearchView />, {
				initialRouterEntries: ['/search'],
				mocks
			});
			expect(screen.queryByText('Previous view')).not.toBeInTheDocument();
			const nodeItem = await screen.findByText(currentSearch[0].name);
			expect(nodeItem).toBeVisible();
			const displayer = screen.getByTestId('displayer');
			expect(within(displayer).queryByText(/details/i)).not.toBeInTheDocument();
			userEvent.click(nodeItem);
			await screen.findByText(/details/i);
			expect(within(displayer).getAllByText(currentSearch[0].name)).toHaveLength(2);
			expect(getByTextWithMarkup(buildBreadCrumbRegExp(currentSearch[0].name))).toBeVisible();
			const closeDisplayerAction = within(screen.getByTestId('DisplayerHeader')).getByTestId(
				'icon: Close'
			);
			expect(closeDisplayerAction).toBeVisible();
			userEvent.click(closeDisplayerAction);
			expect(within(displayer).queryByText(/details/i)).not.toBeInTheDocument();
			expect(screen.getByText(currentSearch[0].name)).toBeVisible();
			await screen.findByText(/view files and folders/i);
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

			const mocks = [
				mockFindNodes(getFindNodesVariables({ keywords }), nodes),
				mockGetNode(getNodeVariables(node.id), node as Node),
				mockGetNode(getNodeVariables(node.parent.id), node.parent as Folder),
				mockGetNode(getNodeVariables(destinationFolder.id), destinationFolder),
				mockGetPath({ node_id: node.id }, pathResponse[0]),
				mockGetPath({ node_id: node.id }, pathResponse[1]),
				mockGetPath({ node_id: node.parent.id }, parentPath),
				mockGetPath({ node_id: destinationFolder.id }, [...parentPath, destinationFolder]),
				mockGetChildren(getChildrenVariables(node.parent.id), node.parent),
				mockMoveNodes({ node_ids: [node.id], destination_id: destinationFolder.id }, [node])
			];

			const { getByTextWithMarkup, queryByTextWithMarkup, findByTextWithMarkup } = render(
				<SearchView />,
				{
					initialRouterEntries: ['/search'],
					mocks
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

		test('Mark for deletion does not close the displayer from searches without trashed nodes', async () => {
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

			render(<SearchView />, {
				initialRouterEntries: ['/search']
			});

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

			render(<SearchView />, {
				initialRouterEntries: ['/search']
			});

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

		test('Restore does not close the displayer from searches with only trashed nodes', async () => {
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

			render(<SearchView />, {
				initialRouterEntries: ['/search']
			});

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

			render(<SearchView />, {
				initialRouterEntries: ['/search']
			});

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
