/*
 * SPDX-FileCopyrightText: 2022 Zextras <https://www.zextras.com>
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import React from 'react';

import {
	act,
	fireEvent,
	screen,
	waitFor,
	waitForElementToBeRemoved,
	within
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import map from 'lodash/map';
import { graphql } from 'msw';
import { Route } from 'react-router-dom';

import { CreateOptionsContent } from '../../hooks/useCreateOptions';
import server from '../../mocks/server';
import { NODES_LOAD_LIMIT, ROOTS } from '../constants';
import FIND_NODES from '../graphql/queries/findNodes.graphql';
import GET_NODE from '../graphql/queries/getNode.graphql';
import handleFindNodesRequest from '../mocks/handleFindNodesRequest';
import {
	populateFolder,
	populateNode,
	populateNodePage,
	populateNodes,
	populateParents,
	populateShare,
	populateUser
} from '../mocks/mockUtils';
import { Node } from '../types/common';
import {
	DeleteShareMutation,
	DeleteShareMutationVariables,
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
	GetSharesQuery,
	GetSharesQueryVariables,
	NodeSort
} from '../types/graphql/types';
import { getFindNodesVariables, getNodeVariables } from '../utils/mockUtils';
import {
	actionRegexp,
	buildBreadCrumbRegExp,
	moveNode,
	render,
	selectNodes
} from '../utils/testUtils';
import FilterView from './FilterView';

let mockedRequestHandler: jest.Mock;
let mockedCreateOptions: CreateOptionsContent['createOptions'];

beforeEach(() => {
	mockedCreateOptions = [];
	mockedRequestHandler = jest.fn().mockImplementation(handleFindNodesRequest);
	server.use(
		graphql.query<FindNodesQuery, FindNodesQueryVariables>('findNodes', mockedRequestHandler)
	);
});

jest.mock('../../hooks/useCreateOptions', () => ({
	useCreateOptions: (): CreateOptionsContent => ({
		setCreateOptions: jest
			.fn()
			.mockImplementation((...options: Parameters<CreateOptionsContent['setCreateOptions']>[0]) => {
				mockedCreateOptions = options;
			}),
		removeCreateOptions: jest.fn()
	})
}));

describe('Filter view', () => {
	describe('Filter route param define findNodes query variables', () => {
		test('No param render a "Missing filter" message', async () => {
			render(<Route path="/filter/:filter?" component={FilterView} />, {
				initialRouterEntries: ['/filter/']
			});
			const message = await screen.findByText(/missing filter/i);
			expect(mockedRequestHandler).not.toHaveBeenCalled();
			expect(message).toBeVisible();
		});

		test('Flagged filter has flagged=true and excludes trashed nodes', async () => {
			render(<Route path="/filter/:filter?" component={FilterView} />, {
				initialRouterEntries: ['/filter/flagged']
			});
			await waitForElementToBeRemoved(screen.queryByTestId('icon: Refresh'));
			await screen.findByText(/view files and folders/i);
			const expectedVariables = {
				flagged: true,
				folder_id: ROOTS.LOCAL_ROOT,
				cascade: true,
				sort: NodeSort.NameAsc,
				limit: NODES_LOAD_LIMIT,
				shares_limit: 1
			};
			expect(mockedRequestHandler).toHaveBeenCalledWith(
				expect.objectContaining({
					variables: expectedVariables
				}),
				expect.anything(),
				expect.anything()
			);
			expect(screen.queryByText(/missing filter/i)).not.toBeInTheDocument();
		});

		test('My Trash filter sharedWithMe=false and includes only trashed nodes', async () => {
			render(<Route path="/filter/:filter?" component={FilterView} />, {
				initialRouterEntries: ['/filter/myTrash']
			});
			await waitForElementToBeRemoved(screen.queryByTestId('icon: Refresh'));
			await screen.findByText(/view files and folders/i);
			const expectedVariables = {
				folder_id: ROOTS.TRASH,
				cascade: false,
				shared_with_me: false,
				sort: NodeSort.NameAsc,
				limit: NODES_LOAD_LIMIT,
				shares_limit: 1
			};
			expect(mockedRequestHandler).toHaveBeenCalledWith(
				expect.objectContaining({
					variables: expectedVariables
				}),
				expect.anything(),
				expect.anything()
			);
			expect(screen.queryByText(/missing filter/i)).not.toBeInTheDocument();
		});

		test('Shared trash filter has sharedWithMe=true and includes only trashed nodes', async () => {
			render(<Route path="/filter/:filter?" component={FilterView} />, {
				initialRouterEntries: ['/filter/sharedTrash']
			});
			await waitForElementToBeRemoved(screen.queryByTestId('icon: Refresh'));
			await screen.findByText(/view files and folders/i);
			const expectedVariables = {
				folder_id: ROOTS.TRASH,
				cascade: false,
				shared_with_me: true,
				sort: NodeSort.NameAsc,
				limit: NODES_LOAD_LIMIT,
				shares_limit: 1
			};
			expect(mockedRequestHandler).toHaveBeenCalledWith(
				expect.objectContaining({
					variables: expectedVariables
				}),
				expect.anything(),
				expect.anything()
			);
			expect(screen.queryByText(/missing filter/i)).not.toBeInTheDocument();
		});

		test('Shared by me filter has sharedByMe=true and excludes trashed nodes', async () => {
			render(<Route path="/filter/:filter?" component={FilterView} />, {
				initialRouterEntries: ['/filter/sharedByMe']
			});
			await waitForElementToBeRemoved(screen.queryByTestId('icon: Refresh'));
			await screen.findByText(/view files and folders/i);
			const expectedVariables = {
				folder_id: ROOTS.LOCAL_ROOT,
				cascade: true,
				shared_by_me: true,
				sort: NodeSort.NameAsc,
				limit: NODES_LOAD_LIMIT,
				shares_limit: 1,
				direct_share: true
			};
			expect(mockedRequestHandler).toHaveBeenCalledWith(
				expect.objectContaining({
					variables: expectedVariables
				}),
				expect.anything(),
				expect.anything()
			);
			expect(screen.queryByText(/missing filter/i)).not.toBeInTheDocument();
		});

		test('Shared with me filter has sharedWithMe=true and excludes trashed nodes', async () => {
			render(<Route path="/filter/:filter?" component={FilterView} />, {
				initialRouterEntries: ['/filter/sharedWithMe']
			});
			await waitForElementToBeRemoved(screen.queryByTestId('icon: Refresh'));
			await screen.findByText(/view files and folders/i);
			const expectedVariables = {
				folder_id: ROOTS.LOCAL_ROOT,
				cascade: true,
				shared_with_me: true,
				sort: NodeSort.NameAsc,
				limit: NODES_LOAD_LIMIT,
				shares_limit: 1,
				direct_share: true
			};
			expect(mockedRequestHandler).toHaveBeenCalledWith(
				expect.objectContaining({
					variables: expectedVariables
				}),
				expect.anything(),
				expect.anything()
			);
			expect(screen.queryByText(/missing filter/i)).not.toBeInTheDocument();
		});
	});

	describe('Create Folder', () => {
		test('Create folder option is always disabled', async () => {
			render(<FilterView />);
			await screen.findByText(/view files and folders/i);
			expect(map(mockedCreateOptions, (createOption) => createOption.action({}))).toEqual(
				expect.arrayContaining([expect.objectContaining({ id: 'create-folder', disabled: true })])
			);
		});
	});

	describe('Displayer', () => {
		test('Single click on a node opens the details tab on displayer', async () => {
			const nodes = populateNodes(10);
			const node = nodes[0];
			server.use(
				graphql.query<FindNodesQuery, FindNodesQueryVariables>('findNodes', (req, res, ctx) =>
					res(ctx.data({ findNodes: populateNodePage(nodes) }))
				),
				graphql.query<GetNodeQuery, GetNodeQueryVariables>('getNode', (req, res, ctx) => {
					const { node_id: id } = req.variables;
					const result = id === node.id ? node : null;
					return res(ctx.data({ getNode: result as Node }));
				})
			);
			const { getByTextWithMarkup } = render(
				<Route path="/filter/:filter?">
					<FilterView />
				</Route>,
				{
					initialRouterEntries: [`/filter/flagged`]
				}
			);
			// wait the content to be rendered
			await screen.findAllByTestId('node-item', { exact: false });
			await screen.findByText(/view files and folders/i);
			expect(screen.getAllByTestId('node-item', { exact: false })).toHaveLength(nodes.length);
			const nodeItem = screen.getByText(node.name);
			expect(nodeItem).toBeVisible();
			expect(screen.queryByText(/details/)).not.toBeInTheDocument();
			userEvent.click(nodeItem);
			await waitForElementToBeRemoved(screen.queryByText(/view files and folders/i));
			await screen.findByText(/details/i);
			expect(screen.getByText(/details/i)).toBeVisible();
			const displayer = screen.getByTestId('displayer');
			await within(displayer).findAllByText(node.name);
			expect(within(displayer).getAllByText(node.name)).toHaveLength(2);
			expect(getByTextWithMarkup(buildBreadCrumbRegExp(node.name))).toBeVisible();
			act(() => {
				// run timers of displayer preview
				jest.runOnlyPendingTimers();
			});
			expect.assertions(6);
		});

		test('Move action does not close the displayer if node is not removed from the main list', async () => {
			const nodes = populateNodes(2);
			const node = nodes[0];
			node.parent = populateFolder();
			const { path: parentPath } = populateParents(node.parent);
			const destinationFolder = populateFolder();
			destinationFolder.permissions.can_write_folder = true;
			destinationFolder.permissions.can_write_file = true;
			(node.parent as Folder).children.nodes.push(destinationFolder);
			node.parent.permissions.can_write_folder = true;
			node.parent.permissions.can_write_file = true;
			node.permissions.can_write_folder = true;
			node.permissions.can_write_file = true;
			node.flagged = true;
			const path = [...parentPath, node];
			const pathUpdated = [...parentPath, destinationFolder, node];
			const pathResponse = [path, pathUpdated];
			server.use(
				graphql.query<FindNodesQuery, FindNodesQueryVariables>('findNodes', (req, res, ctx) =>
					res(ctx.data({ findNodes: populateNodePage(nodes) }))
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
				<Route path="/filter/:filter?">
					<FilterView />
				</Route>,
				{
					initialRouterEntries: ['/filter/flagged']
				}
			);

			// wait the content to be rendered
			await screen.findAllByTestId('node-item', { exact: false });
			await screen.findByText(/view files and folders/i);
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
			await within(displayer).findByText(node.parent.name);
			const fullPathOriginalRegexp = buildBreadCrumbRegExp(...map(path, (parent) => parent.name));
			await findByTextWithMarkup(fullPathOriginalRegexp);
			expect(getByTextWithMarkup(fullPathOriginalRegexp)).toBeVisible();
			// right click to open contextual menu
			const nodeToMoveItem = screen.getByTestId(`node-item-${node.id}`);
			fireEvent.contextMenu(nodeToMoveItem);
			await moveNode(destinationFolder);
			const snackbar = await screen.findByText(/item moved/i);
			await waitForElementToBeRemoved(snackbar);
			const fullPathUpdatedItem = await findByTextWithMarkup(
				buildBreadCrumbRegExp(...map(pathUpdated, (parent) => parent.name))
			);
			// old breadcrumb is not visible anymore
			expect(queryByTextWithMarkup(fullPathOriginalRegexp)).not.toBeInTheDocument();
			// updated breadcrumb is visible instead
			expect(fullPathUpdatedItem).toBeVisible();
			expect(screen.getAllByTestId('node-item', { exact: false })).toHaveLength(nodes.length);
			expect(within(screen.getByTestId('list-')).getByText(node.name)).toBeVisible();
			expect(within(displayer).getAllByText(node.name)).toHaveLength(2);
		});

		test('Restore close the displayer from trash views', async () => {
			render(
				<Route path="/filter/:filter?">
					<FilterView />
				</Route>,
				{
					initialRouterEntries: ['/filter/myTrash']
				}
			);

			// wait the content to be rendered
			await screen.findAllByTestId('node-item', { exact: false });
			await screen.findByText(/view files and folders/i);
			const queryResult = global.apolloClient.readQuery<FindNodesQuery, FindNodesQueryVariables>({
				query: FIND_NODES,
				variables: getFindNodesVariables({
					shared_with_me: false,
					folder_id: ROOTS.TRASH,
					cascade: false
				})
			});
			expect(queryResult?.findNodes?.nodes || null).not.toBeNull();
			const nodes = queryResult?.findNodes?.nodes as Node[];
			expect(nodes.length).toBeGreaterThan(0);
			const cachedNode = nodes[0];
			const node = populateNode(cachedNode.__typename, cachedNode.id, cachedNode.name);
			node.rootId = ROOTS.TRASH;
			node.permissions.can_write_file = true;
			node.permissions.can_write_folder = true;
			global.apolloClient.writeQuery<GetNodeQuery, GetNodeQueryVariables>({
				query: GET_NODE,
				variables: getNodeVariables(node.id),
				data: {
					getNode: { ...node, description: '' }
				}
			});

			const nodeItem = screen.getByText(node.name);
			expect(nodeItem).toBeVisible();
			expect(screen.queryByText(/details/)).not.toBeInTheDocument();
			userEvent.click(nodeItem);
			await screen.findByText(/details/i);
			expect(screen.getByText(/details/i)).toBeVisible();
			const displayer = screen.getByTestId('displayer');
			expect(within(displayer).getAllByText(node.name)).toHaveLength(2);
			const restoreAction = within(displayer).getByTestId('icon: RestoreOutline');
			expect(restoreAction).toBeVisible();
			act(() => {
				userEvent.click(restoreAction);
			});
			await waitFor(() =>
				expect(screen.queryAllByTestId('node-item-', { exact: false })).toHaveLength(
					nodes.length - 1
				)
			);
			const snackbar = await screen.findByText(/^success$/i);
			await waitForElementToBeRemoved(snackbar);
			await screen.findByText(/view files and folders/i);
			expect(within(displayer).queryByText(node.name)).not.toBeInTheDocument();
			expect(restoreAction).not.toBeInTheDocument();
			expect(
				screen.getByText(/View files and folders, share them with your contacts/i)
			).toBeVisible();
		});

		test('Delete permanently close the displayer from trash views', async () => {
			render(
				<Route path="/filter/:filter?">
					<FilterView />
				</Route>,
				{
					initialRouterEntries: ['/filter/myTrash']
				}
			);

			// wait the content to be rendered
			await screen.findAllByTestId('node-item', { exact: false });
			await screen.findByText(/view files and folders/i);
			const queryResult = global.apolloClient.readQuery<FindNodesQuery, FindNodesQueryVariables>({
				query: FIND_NODES,
				variables: getFindNodesVariables({
					shared_with_me: false,
					folder_id: ROOTS.TRASH,
					cascade: false
				})
			});
			expect(queryResult?.findNodes?.nodes || null).not.toBeNull();
			const nodes = queryResult?.findNodes?.nodes as Node[];
			expect(nodes.length).toBeGreaterThan(0);
			const cachedNode = nodes[0];
			const node = populateNode(cachedNode.__typename, cachedNode.id, cachedNode.name);
			node.rootId = ROOTS.TRASH;
			node.permissions.can_write_file = true;
			node.permissions.can_write_folder = true;
			node.permissions.can_delete = true;
			global.apolloClient.writeQuery<GetNodeQuery, GetNodeQueryVariables>({
				query: GET_NODE,
				variables: getNodeVariables(node.id),
				data: {
					getNode: { ...node, description: '' }
				}
			});

			const nodeItem = screen.getByText(node.name);
			expect(nodeItem).toBeVisible();
			expect(screen.queryByText(/details/)).not.toBeInTheDocument();
			userEvent.click(nodeItem);
			await screen.findByText(/details/i);
			expect(screen.getByText(/details/i)).toBeVisible();
			const displayer = screen.getByTestId('displayer');
			expect(within(displayer).getAllByText(node.name)).toHaveLength(2);
			const deletePermanentlyAction = within(displayer).getByTestId(
				'icon: DeletePermanentlyOutline'
			);
			expect(deletePermanentlyAction).toBeVisible();
			act(() => {
				userEvent.click(deletePermanentlyAction);
			});
			const deletePermanentlyConfirm = await screen.findByRole('button', {
				name: actionRegexp.deletePermanently
			});
			userEvent.click(deletePermanentlyConfirm);
			await waitForElementToBeRemoved(deletePermanentlyConfirm);
			await waitFor(() =>
				expect(screen.queryAllByTestId('node-item-', { exact: false })).toHaveLength(
					nodes.length - 1
				)
			);
			const snackbar = await screen.findByText(/^success$/i);
			await waitForElementToBeRemoved(snackbar);
			await screen.findByText(/view files and folders/i);
			expect(within(displayer).queryByText(node.name)).not.toBeInTheDocument();
			expect(deletePermanentlyAction).not.toBeInTheDocument();
			expect(
				screen.getByText(/View files and folders, share them with your contacts/i)
			).toBeVisible();
		});
	});

	describe('Context dependant actions', () => {
		test('in trash filter only restore and delete permanently actions are visible', async () => {
			render(
				<Route path="/filter/:filter?">
					<FilterView />
				</Route>,
				{ initialRouterEntries: ['/filter/myTrash'] }
			);

			// right click to open contextual menu
			const nodeItems = await screen.findAllByTestId('node-item', { exact: false });
			await screen.findByText(/view files and folders/i);
			fireEvent.contextMenu(nodeItems[0]);
			// check that restore action becomes visible
			const restoreAction = await screen.findByText(actionRegexp.restore);
			expect(restoreAction).toBeVisible();
			expect(screen.getByText(actionRegexp.deletePermanently)).toBeVisible();
			expect(screen.queryByText(actionRegexp.rename)).not.toBeInTheDocument();
			expect(screen.queryByText(actionRegexp.flag)).not.toBeInTheDocument();
			expect(screen.queryByText(actionRegexp.unflag)).not.toBeInTheDocument();
			expect(screen.queryByText(actionRegexp.move)).not.toBeInTheDocument();
			expect(screen.queryByText(actionRegexp.moveToTrash)).not.toBeInTheDocument();
			expect(screen.queryByText(actionRegexp.download)).not.toBeInTheDocument();
			expect(screen.queryByText(actionRegexp.copy)).not.toBeInTheDocument();

			const queryResult = global.apolloClient.readQuery<FindNodesQuery, FindNodesQueryVariables>({
				query: FIND_NODES,
				variables: getFindNodesVariables({
					shared_with_me: false,
					folder_id: ROOTS.TRASH,
					cascade: false
				})
			});
			expect(queryResult?.findNodes?.nodes || null).not.toBeNull();
			const nodes = queryResult?.findNodes?.nodes as Node[];
			// selection mode
			selectNodes([nodes[0].id]);
			expect(screen.getByTestId('checkedAvatar')).toBeInTheDocument();
			expect(screen.queryByTestId('icon: MoreVertical')).not.toBeInTheDocument();
			const restoreActionSelection = await within(
				screen.getByTestId('list-header-selectionModeActive')
			).findByTestId('icon: RestoreOutline');
			expect(restoreActionSelection).toBeVisible();
			expect(
				within(screen.getByTestId('list-header-selectionModeActive')).getByTestId(
					'icon: DeletePermanentlyOutline'
				)
			).toBeVisible();
			expect(screen.queryByText(actionRegexp.rename)).not.toBeInTheDocument();
			expect(screen.queryByText(actionRegexp.flag)).not.toBeInTheDocument();
			expect(screen.queryByText(actionRegexp.unflag)).not.toBeInTheDocument();
			expect(screen.queryByText(actionRegexp.move)).not.toBeInTheDocument();
			expect(screen.queryByText(actionRegexp.moveToTrash)).not.toBeInTheDocument();
			expect(screen.queryByText(actionRegexp.download)).not.toBeInTheDocument();
			expect(screen.queryByText(actionRegexp.copy)).not.toBeInTheDocument();
			// exit selection mode
			act(() => {
				userEvent.click(screen.getByTestId('icon: ArrowBackOutline'));
			});
			expect(restoreActionSelection).not.toBeInTheDocument();
			expect(screen.queryByTestId('icon: MoreVertical')).not.toBeInTheDocument();
			expect(screen.queryByTestId('checkedAvatar')).not.toBeInTheDocument();

			const node = populateNode(nodes[0].__typename, nodes[0].id, nodes[0].name);
			node.permissions.can_write_folder = true;
			node.permissions.can_write_file = true;
			node.permissions.can_delete = true;
			node.rootId = ROOTS.TRASH;
			global.apolloClient.writeQuery<GetNodeQuery, GetNodeQueryVariables>({
				query: GET_NODE,
				variables: getNodeVariables(node.id),
				data: {
					getNode: node
				}
			});

			// displayer
			userEvent.click(nodeItems[0]);
			await screen.findByText(/details/i);
			const displayer = screen.getByTestId('displayer');
			await within(displayer).findAllByText(nodes[0].name);
			expect(screen.queryByTestId('icon: MoreVertical')).not.toBeInTheDocument();
			expect(within(displayer).getByTestId('icon: RestoreOutline')).toBeVisible();
			expect(within(displayer).getByTestId('icon: DeletePermanentlyOutline')).toBeVisible();
			expect(screen.queryByText(actionRegexp.rename)).not.toBeInTheDocument();
			expect(screen.queryByText(actionRegexp.flag)).not.toBeInTheDocument();
			expect(screen.queryByText(actionRegexp.unflag)).not.toBeInTheDocument();
			expect(screen.queryByText(actionRegexp.move)).not.toBeInTheDocument();
			expect(screen.queryByText(actionRegexp.moveToTrash)).not.toBeInTheDocument();
			expect(screen.queryByText(actionRegexp.download)).not.toBeInTheDocument();
			expect(screen.queryByText(actionRegexp.copy)).not.toBeInTheDocument();
			act(() => {
				// run preview of displayer
				jest.runOnlyPendingTimers();
			});
		});
	});

	describe('Share with me filter', () => {
		test('Node is removed from the list if user remove his share', async () => {
			const currentFilter = populateNodes(2);
			const node = currentFilter[0];
			node.owner = populateUser();
			const mockedUserLogged = populateUser(
				global.mockedUserLogged.id,
				global.mockedUserLogged.name
			);
			node.shares = [populateShare({ ...node, shares: [] }, 'share-to-remove', mockedUserLogged)];

			// override handlers to return wanted data
			server.use(
				graphql.query<FindNodesQuery, FindNodesQueryVariables>('findNodes', (req, res, ctx) =>
					res(ctx.data({ findNodes: populateNodePage(currentFilter) }))
				),
				graphql.query<GetNodeQuery, GetNodeQueryVariables>('getNode', (req, res, ctx) =>
					res(ctx.data({ getNode: node as File | Folder }))
				),
				graphql.query<GetSharesQuery, GetSharesQueryVariables>('getShares', (req, res, ctx) =>
					res(ctx.data({ getNode: node }))
				),
				graphql.mutation<DeleteShareMutation, DeleteShareMutationVariables>(
					'deleteShare',
					(req, res, ctx) => res(ctx.data({ deleteShare: true }))
				)
			);

			render(
				<Route path="/filter/:filter?">
					<FilterView />
				</Route>,
				{ initialRouterEntries: ['/filter/sharedWithMe'] }
			);

			await screen.findByText(node.name);
			await screen.findByText(/view files and folders/i);
			// open displayer
			userEvent.click(screen.getByText(node.name));
			await screen.findByText(/sharing/i);
			// go to share tab
			userEvent.click(screen.getByText(/sharing/i));
			// logged user chip is shown
			await screen.findByText(/you$/i);
			// wait for tooltip to register listeners
			await waitFor(
				() =>
					new Promise((resolve) => {
						setTimeout(resolve, 2);
					})
			);
			const sharingContent = screen.getByTestId('node-sharing');
			// owner chip is visible
			expect(within(sharingContent).getByText(node.owner.full_name)).toBeVisible();
			// close button is visible on logged user chip
			expect(within(sharingContent).getByTestId('icon: Close')).toBeVisible();
			userEvent.click(within(sharingContent).getByTestId('icon: Close'), undefined, {
				skipHover: true
			});
			// confirmation modal
			await screen.findByRole('button', { name: /remove/i });
			userEvent.click(screen.getByRole('button', { name: /remove/i }));
			await waitForElementToBeRemoved(screen.queryAllByText(node.name));
			const snackbar = await screen.findByText(/success/i);
			await waitForElementToBeRemoved(snackbar);
			// node is removed from the list and displayer is closed
			expect(screen.queryByText(node.name)).not.toBeInTheDocument();
			expect(screen.queryByText(/you$/i)).not.toBeInTheDocument();
			expect(screen.queryByText(/details/i)).not.toBeInTheDocument();
		});
	});
});
