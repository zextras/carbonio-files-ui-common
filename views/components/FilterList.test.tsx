/*
 * SPDX-FileCopyrightText: 2022 Zextras <https://www.zextras.com>
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import React from 'react';

import { ApolloError } from '@apollo/client';
import {
	act,
	fireEvent,
	screen,
	waitFor,
	waitForElementToBeRemoved,
	within
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import find from 'lodash/find';
import forEach from 'lodash/forEach';
import last from 'lodash/last';
import map from 'lodash/map';
import { graphql } from 'msw';
import { Link, Route, Switch } from 'react-router-dom';

import server from '../../../mocks/server';
import { NODES_LOAD_LIMIT, NODES_SORT_DEFAULT, ROOTS } from '../../constants';
import FIND_NODES from '../../graphql/queries/findNodes.graphql';
import GET_CHILDREN from '../../graphql/queries/getChildren.graphql';
import {
	populateFile,
	populateFolder,
	populateLocalRoot,
	populateNode,
	populateNodes,
	populateParents,
	sortNodes
} from '../../mocks/mockUtils';
import { Node } from '../../types/common';
import {
	File as FilesFile,
	FindNodesQuery,
	FindNodesQueryVariables,
	Folder,
	GetChildQuery,
	GetChildQueryVariables,
	GetChildrenQuery,
	GetChildrenQueryVariables,
	Maybe
} from '../../types/graphql/types';
import {
	getChildrenVariables,
	getFindNodesVariables,
	mockCopyNodes,
	mockDeletePermanently,
	mockFindNodes,
	mockFlagNodes,
	mockGetChildren,
	mockGetPath,
	mockMoveNodes,
	mockRestoreNodes,
	mockTrashNodes,
	mockUpdateNode,
	mockUpdateNodeError
} from '../../utils/mockUtils';
import {
	actionRegexp,
	buildBreadCrumbRegExp,
	generateError,
	renameNode,
	render,
	selectNodes,
	triggerLoadMore
} from '../../utils/testUtils';
import { addNodeInSortedList } from '../../utils/utils';
import FilterList from './FilterList';
import FolderList from './FolderList';

describe('Filter list', () => {
	describe('Generic filter', () => {
		test('first access to a filter show loading state and than show nodes', async () => {
			render(<FilterList flagged />);

			expect(screen.getByTestId('icon: Refresh')).toBeVisible();
			await waitForElementToBeRemoved(() =>
				within(screen.getByTestId('list-header')).queryByTestId('icon: Refresh')
			);
			expect(screen.getByTestId(`list-`)).not.toBeEmptyDOMElement();
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

			render(<FilterList flagged />, { mocks });

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

			render(<FilterList flagged />, { mocks });

			await waitForElementToBeRemoved(screen.queryByTestId('icon: Refresh'));

			expect(screen.getAllByTestId('icon: Flag')).toHaveLength(nodes.length);
		});

		test('breadcrumb show Flagged', async () => {
			const { getByTextWithMarkup } = render(<FilterList flagged />);

			await waitForElementToBeRemoved(screen.queryByTestId('icon: Refresh'));

			const breadcrumbRegExp = buildBreadCrumbRegExp('Flagged');

			expect(getByTextWithMarkup(breadcrumbRegExp)).toBeVisible();
		});

		test('filter are refetch on subsequent navigations', async () => {
			const nodes = populateNodes(1);
			const currentFolder = populateFolder();
			const node = populateNode();
			node.flagged = false;
			currentFolder.children.push(node);

			const mocks = [
				mockFindNodes(getFindNodesVariables({ flagged: true }), nodes),
				mockGetChildren(getChildrenVariables(currentFolder.id), currentFolder),
				mockFlagNodes(
					{
						node_ids: [node.id],
						flag: true
					},
					[node.id]
				),
				mockFindNodes(getFindNodesVariables({ flagged: true }), [...nodes, node])
			];

			const setNewFolderMock = jest.fn();
			const setNewFileMock = jest.fn();

			render(
				<div>
					<Link to="/folder">Go to folder</Link>
					<Link to="/filter">Go to filter</Link>
					<Switch>
						<Route path="/filter" exact>
							<FilterList flagged />
						</Route>
						<Route path="/folder">
							<FolderList
								folderId={currentFolder.id}
								canUploadFile={false}
								setNewFolder={setNewFolderMock}
								setNewFile={setNewFileMock}
							/>
						</Route>
					</Switch>
				</div>,
				{ initialRouterEntries: ['/filter'], mocks }
			);

			// filter list, first load to write data in cache
			await screen.findByTestId(`node-item-${nodes[0].id}`);
			// only 1 item load
			expect(screen.getByTestId('node-item', { exact: false })).toBeInTheDocument();
			// navigate to folder
			userEvent.click(screen.getByRole('link', { name: 'Go to folder' }));
			// folder list, first load
			await screen.findByTestId(`node-item-${node.id}`);
			expect(screen.getByTestId('node-item', { exact: false })).toBeInTheDocument();
			// flag the node through the hover bar
			act(() => {
				userEvent.click(screen.getByTestId('icon: FlagOutline'));
			});
			await screen.findByTestId('icon: Flag');
			// navigate to filter again
			userEvent.click(screen.getByRole('link', { name: 'Go to filter' }));
			// filter list, second load but with a new network request. Wait for loading icon to be removed
			const listHeader = screen.getByTestId('list-header');
			await waitForElementToBeRemoved(within(listHeader).queryByTestId('icon: Refresh'));
			const nodesItems = screen.getAllByTestId('node-item', { exact: false });
			expect(nodesItems).toHaveLength(2);
			expect(screen.getByTestId(`node-item-${node.id}`)).toBe(nodesItems[1]);
		});

		describe('Selection mode', () => {
			describe('Rename', () => {
				test('Rename is disabled when multiple files are selected', async () => {
					const nodes = [];
					// enable permission to rename
					for (let i = 0; i < 2; i += 1) {
						const node = populateFile();
						node.permissions.can_write_file = true;
						nodes.push(node);
					}

					const mocks = [mockFindNodes(getFindNodesVariables({ flagged: true }), nodes)];

					render(<FilterList flagged />, { mocks });

					// wait for the load to be completed
					await waitForElementToBeRemoved(screen.queryByTestId('icon: Refresh'));

					// activate selection mode by selecting items
					selectNodes(map(nodes, (node) => node.id));
					// check that all wanted items are selected
					expect(screen.getAllByTestId('checkedAvatar')).toHaveLength(nodes.length);
					expect(screen.getByTestId('icon: MoreVertical')).toBeVisible();
					userEvent.click(screen.getByTestId('icon: MoreVertical'));
					const renameAction = await screen.findByText(actionRegexp.rename);
					expect(renameAction).toBeVisible();
					expect(renameAction.parentElement).toHaveAttribute('disabled', '');
				});

				test('Rename is disabled if node does not have permissions', async () => {
					// disable permission to rename
					const node = populateFile();
					node.permissions.can_write_file = false;

					const mocks = [mockFindNodes(getFindNodesVariables({ flagged: true }), [node])];

					render(<FilterList flagged />, { mocks });

					// wait for the load to be completed
					await waitForElementToBeRemoved(screen.queryByTestId('icon: Refresh'));

					// activate selection mode by selecting items
					selectNodes([node.id]);
					// check that all wanted items are selected
					expect(screen.getByTestId('checkedAvatar')).toBeInTheDocument();
					expect(screen.getByTestId('icon: MoreVertical')).toBeVisible();
					userEvent.click(screen.getByTestId('icon: MoreVertical'));
					const renameAction = await screen.findByText(actionRegexp.rename);
					expect(renameAction).toBeVisible();
					expect(renameAction.parentElement).toHaveAttribute('disabled', '');
				});

				test('Rename operation fail shows an error in the modal and does not close it', async () => {
					const nodes = populateNodes(3, 'Folder');
					// enable permission to rename
					forEach(nodes, (mockedNode) => {
						mockedNode.permissions.can_write_folder = true;
						mockedNode.flagged = true;
					});
					sortNodes(nodes, NODES_SORT_DEFAULT);

					// rename first element with name of the second one
					const element = nodes[0];
					const newName = nodes[1].name;

					const mocks = [
						mockFindNodes(getFindNodesVariables({ flagged: true }), nodes),
						mockUpdateNodeError(
							{
								node_id: element.id,
								name: newName
							},
							new ApolloError({ graphQLErrors: [generateError('Error! Name already assigned')] })
						)
					];

					render(<FilterList flagged />, { mocks });

					// wait for the load to be completed
					await waitForElementToBeRemoved(screen.queryByTestId('icon: Refresh'));

					// activate selection mode by selecting items
					selectNodes([element.id]);
					// check that all wanted items are selected
					expect(screen.getByTestId('checkedAvatar')).toBeInTheDocument();
					expect(screen.getByTestId('icon: MoreVertical')).toBeVisible();
					userEvent.click(screen.getByTestId('icon: MoreVertical'));
					await renameNode(newName);
					// following text is in the modal and in snackbar
					await waitFor(() =>
						expect(screen.getAllByText(/Error! Name already assigned/)).toHaveLength(2)
					);
					await waitFor(() =>
						// eslint-disable-next-line jest-dom/prefer-in-document
						expect(screen.getAllByText(/Error! Name already assigned/)).toHaveLength(1)
					);
					// when find only 1 occurrence means that snackbar is hidden
					const error = screen.getByText(/Error! Name already assigned/);
					expect(error).toBeVisible();
					const inputFieldDiv = screen.getByTestId('input-name');
					const inputField = within(inputFieldDiv).getByRole('textbox');
					expect(inputField).toBeVisible();
					expect(inputField).toHaveValue(newName);
				});

				test('Rename change node name and leave node at same position in the list', async () => {
					const nodes = populateNodes(5, 'Folder');
					// enable permission to rename
					forEach(nodes, (mockedNode) => {
						mockedNode.permissions.can_write_folder = true;
						mockedNode.flagged = true;
					});
					sortNodes(nodes, NODES_SORT_DEFAULT);

					// the element to rename is the first of the list
					const element = nodes[0];
					const lastElementName = nodes[nodes.length - 1].name;
					const newName = lastElementName.substring(0, lastElementName.length - 1);

					const mocks = [
						mockFindNodes(getFindNodesVariables({ flagged: true }), nodes),
						mockUpdateNode(
							{
								node_id: element.id,
								name: newName
							},
							{
								...element,
								name: newName
							}
						)
					];

					render(<FilterList flagged />, { mocks });

					// wait for the load to be completed
					await waitForElementToBeRemoved(screen.queryByTestId('icon: Refresh'));

					// activate selection mode by selecting items
					selectNodes([element.id]);
					// check that all wanted items are selected
					expect(screen.getByTestId('checkedAvatar')).toBeInTheDocument();
					expect(screen.getByTestId('icon: MoreVertical')).toBeVisible();
					userEvent.click(screen.getByTestId('icon: MoreVertical'));
					await renameNode(newName);
					// wait for the modal to be closed
					const inputFieldDiv = await screen.findByTestId('input-name');
					await waitForElementToBeRemoved(inputFieldDiv);
					// check the node. It should have the new name and be at same position
					const nodeItem = screen.getByTestId(`node-item-${element.id}`);
					expect(nodeItem).toBeVisible();
					expect(within(nodeItem).getByText(newName)).toBeVisible();
					const nodeItems = screen.getAllByTestId('node-item', { exact: false });
					expect(nodeItems).toHaveLength(nodes.length);
					expect(nodeItems[0]).toBe(nodeItem);
					// selection mode is de-activate
					expect(screen.queryByTestId('checkedAvatar')).not.toBeInTheDocument();
					expect(screen.queryByTestId('icon: MoreVertical')).not.toBeInTheDocument();
				});
			});
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
				expect(screen.getByTestId('icon: MoreVertical')).toBeVisible();
				userEvent.click(screen.getByTestId('icon: MoreVertical'));
				await screen.findByText(actionRegexp.unflag);
				// flag action should be disabled
				const flagAction = screen.getByText(actionRegexp.flag);
				expect(flagAction).toBeVisible();
				expect(flagAction.parentElement).toHaveAttribute('disabled', '');
				// click on unflag action on header bar
				userEvent.click(screen.getByText(actionRegexp.unflag));
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

			describe('Mark for deletion', () => {
				test('Mark for deletion remove selected items from the filter list', async () => {
					const currentFilter = populateNodes(3);
					forEach(currentFilter, (mockedNode) => {
						mockedNode.flagged = true;
					});

					currentFilter[0].permissions.can_write_folder = true;
					currentFilter[0].permissions.can_write_file = true;

					const nodesIdsToMFD = [currentFilter[0].id];

					const mocks = [
						mockFindNodes(
							getFindNodesVariables({ flagged: true, folder_id: ROOTS.LOCAL_ROOT, cascade: true }),
							currentFilter
						),
						mockTrashNodes(
							{
								node_ids: nodesIdsToMFD
							},
							nodesIdsToMFD
						)
					];

					render(<FilterList flagged trashed={false} cascade />, { mocks });

					// wait for the load to be completed
					await waitForElementToBeRemoved(screen.queryByTestId('icon: Refresh'));
					// activate selection mode by selecting items
					selectNodes(nodesIdsToMFD);
					// check that all wanted items are selected
					expect(screen.getByTestId('checkedAvatar')).toBeInTheDocument();
					expect(screen.getByTestId('icon: MoreVertical')).toBeVisible();

					const selectionModeActiveListHeader = screen.getByTestId(
						'list-header-selectionModeActive'
					);

					const trashIcon = within(selectionModeActiveListHeader).getByTestId(
						'icon: Trash2Outline'
					);
					expect(trashIcon).toBeInTheDocument();
					expect(trashIcon).toBeVisible();
					expect(trashIcon).not.toHaveAttribute('disabled', '');

					userEvent.click(trashIcon);

					// wait for the snackbar to appear and disappear
					const snackbar = await screen.findByText(/item moved to trash/i);
					await waitForElementToBeRemoved(snackbar);
					expect(screen.queryByTestId('checkedAvatar')).not.toBeInTheDocument();

					expect(screen.queryAllByTestId(`file-icon-preview`).length).toEqual(2);

					expect.assertions(7);
				});

				test('Mark for deletion is hidden if not all nodes are not trashed', async () => {
					const currentFilter = populateNodes(3);
					forEach(currentFilter, (mockedNode) => {
						mockedNode.flagged = true;
					});

					currentFilter[0].permissions.can_write_folder = true;
					currentFilter[0].permissions.can_write_file = true;

					currentFilter[1].permissions.can_write_folder = true;
					currentFilter[1].permissions.can_write_file = true;
					currentFilter[1].rootId = ROOTS.TRASH;

					const nodesIdsToMFD = [currentFilter[0].id, currentFilter[1].id];

					const mocks = [mockFindNodes(getFindNodesVariables({ flagged: true }), currentFilter)];

					render(<FilterList flagged />, { mocks });

					// wait for the load to be completed
					await waitForElementToBeRemoved(screen.queryByTestId('icon: Refresh'));
					// activate selection mode by selecting items
					selectNodes(nodesIdsToMFD);
					// check that all wanted items are selected
					expect(screen.getAllByTestId('checkedAvatar')).toHaveLength(2);
					expect(screen.getByTestId('icon: MoreVertical')).toBeVisible();

					const selectionModeActiveListHeader = screen.getByTestId(
						'list-header-selectionModeActive'
					);

					const trashIcon = within(selectionModeActiveListHeader).queryByTestId(
						'icon: Trash2Outline'
					);
					expect(trashIcon).not.toBeInTheDocument();
					expect.assertions(3);
				});
			});

			describe('Restore', () => {
				test('Restore remove selected items from the filter list', async () => {
					const currentFilter = populateNodes(3);
					forEach(currentFilter, (mockedNode) => {
						mockedNode.rootId = ROOTS.TRASH;
						mockedNode.parent = populateNode('Folder', ROOTS.TRASH, 'Trash');
					});

					currentFilter[0].permissions.can_write_folder = true;
					currentFilter[0].permissions.can_write_file = true;

					const nodesIdsToRestore = [currentFilter[0].id];

					const mocks = [
						mockFindNodes(
							getFindNodesVariables({ folder_id: ROOTS.TRASH, cascade: false }),
							currentFilter
						),
						mockRestoreNodes(
							{
								node_ids: nodesIdsToRestore
							},
							[{ ...currentFilter[0], rootId: ROOTS.LOCAL_ROOT, parent: populateLocalRoot() }]
						)
					];

					render(<FilterList trashed cascade={false} />, { mocks });

					// wait for the load to be completed
					await waitForElementToBeRemoved(screen.queryByTestId('icon: Refresh'));
					// activate selection mode by selecting items
					selectNodes(nodesIdsToRestore);
					// check that all wanted items are selected
					expect(screen.getByTestId('checkedAvatar')).toBeInTheDocument();
					expect(screen.getByTestId('icon: MoreVertical')).toBeVisible();

					const selectionModeActiveListHeader = screen.getByTestId(
						'list-header-selectionModeActive'
					);

					const restoreIcon = within(selectionModeActiveListHeader).getByTestId(
						'icon: RestoreOutline'
					);
					expect(restoreIcon).toBeInTheDocument();
					expect(restoreIcon).toBeVisible();
					expect(restoreIcon).not.toHaveAttribute('disabled', '');

					userEvent.click(restoreIcon);

					const snackbar = await screen.findByText(/^success$/i);
					await waitForElementToBeRemoved(snackbar);
					expect(screen.queryByTestId('checkedAvatar')).not.toBeInTheDocument();

					expect(screen.queryAllByTestId(`file-icon-preview`).length).toEqual(2);

					expect.assertions(7);
				});

				test('Restore do not remove selected items from the filter list if is a filter without trashed param', async () => {
					const currentFilter = populateNodes(3);
					forEach(currentFilter, (mockedNode) => {
						mockedNode.flagged = true;
						mockedNode.rootId = ROOTS.TRASH;
					});

					currentFilter[0].permissions.can_write_folder = true;
					currentFilter[0].permissions.can_write_file = true;

					const nodesIdsToRestore = [currentFilter[0].id];

					const mocks = [
						mockFindNodes(getFindNodesVariables({ flagged: true }), currentFilter),
						mockRestoreNodes(
							{
								node_ids: nodesIdsToRestore
							},
							[currentFilter[0]]
						)
					];

					render(<FilterList flagged />, { mocks });

					// wait for the load to be completed
					await waitForElementToBeRemoved(screen.queryByTestId('icon: Refresh'));
					// activate selection mode by selecting items
					selectNodes(nodesIdsToRestore);
					// check that all wanted items are selected
					expect(screen.getByTestId('checkedAvatar')).toBeInTheDocument();
					expect(screen.getByTestId('icon: MoreVertical')).toBeVisible();

					const selectionModeActiveListHeader = screen.getByTestId(
						'list-header-selectionModeActive'
					);

					const restoreIcon = within(selectionModeActiveListHeader).getByTestId(
						'icon: RestoreOutline'
					);
					expect(restoreIcon).toBeInTheDocument();
					expect(restoreIcon).toBeVisible();
					expect(restoreIcon).not.toHaveAttribute('disabled', '');

					const unselectAllIcon = screen.getByTestId('icon: ArrowBackOutline');
					expect(unselectAllIcon).toBeInTheDocument();
					expect(unselectAllIcon).toBeVisible();

					userEvent.click(restoreIcon);

					// await waitForElementToBeRemoved(unselectAllIcon);
					const snackbar = await screen.findByText(/^success$/i);
					await waitForElementToBeRemoved(snackbar);

					const elementsWithSelectionModeOff = await screen.findAllByTestId('file-icon-preview');
					const restoredItem = screen.queryByText(currentFilter[0].name);
					expect(restoredItem).toBeInTheDocument();
					expect(restoredItem).toBeVisible();

					expect(screen.queryAllByTestId('node-item', { exact: false })).toHaveLength(3);
					expect(elementsWithSelectionModeOff).toHaveLength(3);
					expect.assertions(11);
				});

				test('Restore is hidden if not all nodes are trashed', async () => {
					const currentFilter = populateNodes(3);
					forEach(currentFilter, (mockedNode) => {
						mockedNode.flagged = true;
					});

					currentFilter[0].permissions.can_write_folder = true;
					currentFilter[0].permissions.can_write_file = true;
					currentFilter[0].rootId = ROOTS.LOCAL_ROOT;

					currentFilter[1].permissions.can_write_folder = true;
					currentFilter[1].permissions.can_write_file = true;
					currentFilter[1].rootId = ROOTS.TRASH;

					const nodesIdsToRestore = [currentFilter[0].id, currentFilter[1].id];

					const mocks = [mockFindNodes(getFindNodesVariables({ flagged: true }), currentFilter)];

					render(<FilterList flagged />, { mocks });

					// wait for the load to be completed
					await waitForElementToBeRemoved(screen.queryByTestId('icon: Refresh'));
					// activate selection mode by selecting items
					selectNodes(nodesIdsToRestore);
					// check that all wanted items are selected
					expect(screen.getAllByTestId('checkedAvatar')).toHaveLength(2);
					expect(screen.getByTestId('icon: MoreVertical')).toBeVisible();

					const selectionModeActiveListHeader = screen.getByTestId(
						'list-header-selectionModeActive'
					);

					const restoreIcon = within(selectionModeActiveListHeader).queryByTestId(
						'icon: RestoreOutline'
					);
					expect(restoreIcon).not.toBeInTheDocument();

					const trashIcon = within(selectionModeActiveListHeader).queryByTestId(
						'icon: Trash2Outline'
					);
					expect(trashIcon).not.toBeInTheDocument();

					const moreIcon = within(selectionModeActiveListHeader).getByTestId('icon: MoreVertical');
					expect(moreIcon).toBeInTheDocument();

					expect.assertions(5);
				});
			});

			describe('Delete Permanently', () => {
				test('Delete Permanently remove selected items from the filter list', async () => {
					const currentFilter = populateNodes(3);
					forEach(currentFilter, (mockedNode) => {
						mockedNode.rootId = ROOTS.TRASH;
					});

					currentFilter[0].permissions.can_write_folder = true;
					currentFilter[0].permissions.can_write_file = true;
					currentFilter[0].permissions.can_delete = true;

					const nodesIdsToDeletePermanently = [currentFilter[0].id];

					const mocks = [
						mockFindNodes(
							getFindNodesVariables({ folder_id: ROOTS.TRASH, cascade: false }),
							currentFilter
						),
						mockDeletePermanently(
							{
								node_ids: nodesIdsToDeletePermanently
							},
							nodesIdsToDeletePermanently
						)
					];

					render(<FilterList trashed cascade={false} />, { mocks });

					// wait for the load to be completed
					await waitForElementToBeRemoved(screen.queryByTestId('icon: Refresh'));
					// activate selection mode by selecting items
					selectNodes(nodesIdsToDeletePermanently);
					// check that all wanted items are selected
					expect(screen.getByTestId('checkedAvatar')).toBeInTheDocument();
					expect(screen.getByTestId('icon: MoreVertical')).toBeVisible();

					const element = await screen.findByText(currentFilter[0].name);

					const selectionModeActiveListHeader = screen.getByTestId(
						'list-header-selectionModeActive'
					);

					const deletePermanentlyIcon = within(selectionModeActiveListHeader).getByTestId(
						'icon: DeletePermanentlyOutline'
					);
					expect(deletePermanentlyIcon).toBeInTheDocument();
					expect(deletePermanentlyIcon).toBeVisible();
					expect(deletePermanentlyIcon).not.toHaveAttribute('disabled', '');

					userEvent.click(deletePermanentlyIcon);

					const confirmButton = await screen.findByRole('button', { name: /delete permanently/i });
					userEvent.click(confirmButton);
					const snackbar = await screen.findByText(/^success$/i);
					await waitForElementToBeRemoved(snackbar);
					expect(confirmButton).not.toBeInTheDocument();

					expect(element).not.toBeInTheDocument();
					expect(screen.queryByTestId('checkedAvatar')).not.toBeInTheDocument();
					expect(screen.queryAllByTestId(`file-icon-preview`).length).toEqual(2);

					expect.assertions(9);
				});

				test('Delete Permanently is hidden if not all nodes are trashed', async () => {
					const currentFilter = populateNodes(3);
					forEach(currentFilter, (mockedNode) => {
						mockedNode.flagged = true;
					});

					currentFilter[0].permissions.can_write_folder = true;
					currentFilter[0].permissions.can_write_file = true;
					currentFilter[0].rootId = ROOTS.LOCAL_ROOT;

					currentFilter[1].permissions.can_write_folder = true;
					currentFilter[1].permissions.can_write_file = true;
					currentFilter[1].rootId = ROOTS.TRASH;

					const nodesIdsToDeletePermanently = [currentFilter[0].id, currentFilter[1].id];

					const mocks = [mockFindNodes(getFindNodesVariables({ flagged: true }), currentFilter)];

					render(<FilterList flagged />, { mocks });

					// wait for the load to be completed
					await waitForElementToBeRemoved(screen.queryByTestId('icon: Refresh'));
					// activate selection mode by selecting items
					selectNodes(nodesIdsToDeletePermanently);
					// check that all wanted items are selected
					expect(screen.getAllByTestId('checkedAvatar')).toHaveLength(2);
					expect(screen.getByTestId('icon: MoreVertical')).toBeVisible();

					const selectionModeActiveListHeader = screen.getByTestId(
						'list-header-selectionModeActive'
					);

					const restoreIcon = within(selectionModeActiveListHeader).queryByTestId(
						'icon: RestoreOutline'
					);
					expect(restoreIcon).not.toBeInTheDocument();

					const trashIcon = within(selectionModeActiveListHeader).queryByTestId(
						'icon: Trash2Outline'
					);
					expect(trashIcon).not.toBeInTheDocument();

					const deletePermanentlyIcon = within(selectionModeActiveListHeader).queryByTestId(
						'icon: DeletePermanentlyOutline'
					);
					expect(deletePermanentlyIcon).not.toBeInTheDocument();

					const moreIcon = within(selectionModeActiveListHeader).getByTestId('icon: MoreVertical');
					expect(moreIcon).toBeInTheDocument();

					expect.assertions(6);
				});
			});

			describe('Move', () => {
				test('Move is disabled if node has not permissions', async () => {
					const currentFilter = [];
					const file = populateFile();
					file.permissions.can_write_file = false;
					file.parent = populateFolder();
					file.parent.permissions.can_write_file = true;
					const folder = populateFolder();
					folder.permissions.can_write_folder = false;
					folder.parent = populateFolder();
					folder.parent.permissions.can_write_folder = true;
					const node = populateNode();
					node.permissions.can_write_folder = true;
					node.permissions.can_write_file = true;
					node.parent = populateFolder();
					node.parent.permissions.can_write_folder = true;
					node.parent.permissions.can_write_file = true;
					currentFilter.push(file, folder, node);

					const mocks = [mockFindNodes(getFindNodesVariables({ flagged: true }), currentFilter)];

					render(<FilterList flagged />, { mocks });

					await screen.findByText(file.name);
					// activate selection mode by selecting items
					selectNodes([file.id]);
					// check that all wanted items are selected
					expect(screen.getByTestId('checkedAvatar')).toBeInTheDocument();
					expect(screen.getByTestId('icon: MoreVertical')).toBeVisible();
					userEvent.click(screen.getByTestId('icon: MoreVertical'));
					let moveAction = await screen.findByText(actionRegexp.move);
					expect(moveAction).toBeVisible();
					expect(moveAction.parentElement).toHaveAttribute('disabled', '');
					// activate selection mode by selecting items
					selectNodes([file.id, folder.id]);
					// check that all wanted items are selected
					expect(screen.getByTestId('checkedAvatar')).toBeInTheDocument();
					expect(screen.getByTestId('icon: MoreVertical')).toBeVisible();
					userEvent.click(screen.getByTestId('icon: MoreVertical'));
					moveAction = await screen.findByText(actionRegexp.move);
					expect(moveAction).toBeVisible();
					expect(moveAction.parentElement).toHaveAttribute('disabled', '');
					// activate selection mode by selecting items
					selectNodes([folder.id, node.id]);
					// check that all wanted items are selected
					expect(screen.getByTestId('checkedAvatar')).toBeInTheDocument();
					expect(screen.getByTestId('icon: MoreVertical')).toBeVisible();
					userEvent.click(screen.getByTestId('icon: MoreVertical'));
					moveAction = await screen.findByText(actionRegexp.move);
					expect(moveAction).toBeVisible();
					expect(moveAction.parentElement).not.toHaveAttribute('disabled', '');
				});

				test('Move is disabled when multiple files are selected', async () => {
					const currentFilter = [];
					const parent = populateFolder();
					const file = populateFile();
					file.permissions.can_write_file = true;
					file.parent = parent;
					const folder = populateFolder();
					folder.permissions.can_write_folder = true;
					folder.parent = parent;
					currentFilter.push(file, folder);

					const mocks = [mockFindNodes(getFindNodesVariables({ flagged: true }), currentFilter)];

					render(<FilterList flagged />, { mocks });

					await screen.findByText(file.name);
					selectNodes([file.id, folder.id]);

					// check that all wanted items are selected
					expect(screen.getAllByTestId('checkedAvatar')).toHaveLength(2);
					expect(screen.getByTestId('icon: MoreVertical')).toBeVisible();
					userEvent.click(screen.getByTestId('icon: MoreVertical'));
					const moveAction = await screen.findByText(actionRegexp.move);
					expect(moveAction).toBeVisible();
					expect(moveAction.parentElement).toHaveAttribute('disabled', '');
				});

				test('Move is disabled if node has no parent or parent has not right permissions', async () => {
					const currentFilter = [];
					const file = populateFile();
					file.permissions.can_write_file = true;
					file.parent = populateFolder();
					file.parent.permissions.can_write_file = false;
					const folder = populateFolder();
					folder.permissions.can_write_folder = true;
					folder.parent = populateFolder();
					folder.parent.permissions.can_write_folder = false;
					const node = populateNode();
					node.permissions.can_write_folder = true;
					node.permissions.can_write_file = true;
					node.parent = null;
					currentFilter.push(file, folder, node);

					const mocks = [mockFindNodes(getFindNodesVariables({ flagged: true }), currentFilter)];

					render(<FilterList flagged />, { mocks });

					await screen.findByText(file.name);
					// activate selection mode by selecting items
					selectNodes([file.id]);
					// check that all wanted items are selected
					expect(screen.getByTestId('checkedAvatar')).toBeInTheDocument();
					expect(screen.getByTestId('icon: MoreVertical')).toBeVisible();
					userEvent.click(screen.getByTestId('icon: MoreVertical'));
					let moveAction = await screen.findByText(actionRegexp.move);
					expect(moveAction).toBeVisible();
					expect(moveAction.parentElement).toHaveAttribute('disabled', '');
					// activate selection mode by selecting items
					selectNodes([file.id, folder.id]);
					// check that all wanted items are selected
					expect(screen.getByTestId('checkedAvatar')).toBeInTheDocument();
					expect(screen.getByTestId('icon: MoreVertical')).toBeVisible();
					userEvent.click(screen.getByTestId('icon: MoreVertical'));
					moveAction = await screen.findByText(actionRegexp.move);
					expect(moveAction).toBeVisible();
					expect(moveAction.parentElement).toHaveAttribute('disabled', '');
					// activate selection mode by selecting items
					selectNodes([folder.id, node.id]);
					// check that all wanted items are selected
					expect(screen.getByTestId('checkedAvatar')).toBeInTheDocument();
					expect(screen.getByTestId('icon: MoreVertical')).toBeVisible();
					userEvent.click(screen.getByTestId('icon: MoreVertical'));
					moveAction = await screen.findByText(actionRegexp.move);
					expect(moveAction).toBeVisible();
					expect(moveAction.parentElement).toHaveAttribute('disabled', '');
				});

				test('Move open modal showing parent folder content. Confirm action close the modal, leave moved items in filter list and clear cached data for destination folder', async () => {
					const currentFilter = populateNodes(5);
					const destinationFolder = populateFolder();
					destinationFolder.permissions.can_write_folder = true;
					destinationFolder.permissions.can_write_file = true;
					currentFilter.push(destinationFolder);
					const { node: nodeToMove, path } = populateParents(currentFilter[0], 2, true);
					forEach(path, (mockedNode) => {
						mockedNode.permissions.can_write_folder = true;
						mockedNode.permissions.can_write_file = true;
					});
					nodeToMove.permissions.can_write_folder = true;
					nodeToMove.permissions.can_write_file = true;
					const parentFolder = nodeToMove.parent as Folder;
					parentFolder.children = [nodeToMove, destinationFolder];
					destinationFolder.parent = parentFolder;

					// write destination folder in cache as if it was already loaded
					global.apolloClient.writeQuery<GetChildrenQuery, GetChildrenQueryVariables>({
						query: GET_CHILDREN,
						variables: getChildrenVariables(destinationFolder.id),
						data: {
							getNode: destinationFolder
						}
					});
					const mocks = [
						mockFindNodes(getFindNodesVariables({ flagged: true }), currentFilter),
						mockGetPath({ node_id: parentFolder.id }, path.slice(0, path.length - 1)),
						mockGetChildren(getChildrenVariables(parentFolder.id), parentFolder),
						mockMoveNodes(
							{
								node_ids: [nodeToMove.id],
								destination_id: destinationFolder.id
							},
							[{ ...nodeToMove, parent: destinationFolder }]
						)
					];

					const { getByTextWithMarkup, findByTextWithMarkup } = render(<FilterList flagged />, {
						mocks
					});

					await screen.findByText(nodeToMove.name);

					let destinationFolderCachedData = global.apolloClient.readQuery<
						GetChildrenQuery,
						GetChildrenQueryVariables
					>({
						query: GET_CHILDREN,
						variables: getChildrenVariables(destinationFolder.id)
					});

					expect(destinationFolderCachedData?.getNode || null).not.toBeNull();
					expect((destinationFolderCachedData?.getNode as Folder).id).toBe(destinationFolder.id);

					// activate selection mode by selecting items
					selectNodes([nodeToMove.id]);
					// check that all wanted items are selected
					expect(screen.getByTestId('checkedAvatar')).toBeInTheDocument();
					expect(screen.getByTestId('icon: MoreVertical')).toBeVisible();
					userEvent.click(screen.getByTestId('icon: MoreVertical'));
					const moveAction = await screen.findByText(actionRegexp.move);
					expect(moveAction).toBeVisible();
					userEvent.click(moveAction);

					const modalList = await screen.findByTestId(`modal-list-${parentFolder.id}`);
					const destinationFolderItem = await within(modalList).findByText(destinationFolder.name);
					const breadcrumbRegexp = buildBreadCrumbRegExp(
						...map(path.slice(0, path.length - 1), (node) => node.name)
					);
					await findByTextWithMarkup(breadcrumbRegexp);
					expect(getByTextWithMarkup(breadcrumbRegexp)).toBeVisible();

					userEvent.click(destinationFolderItem);
					expect(screen.getByRole('button', { name: actionRegexp.move })).not.toHaveAttribute(
						'disabled',
						''
					);
					act(() => {
						userEvent.click(screen.getByRole('button', { name: actionRegexp.move }));
					});
					await waitForElementToBeRemoved(
						screen.queryByRole('button', { name: actionRegexp.move })
					);
					const snackbar = await screen.findByText(/item moved/i);
					await waitForElementToBeRemoved(snackbar);
					expect(screen.queryByRole('button', { name: actionRegexp.move })).not.toBeInTheDocument();
					// exit selection mode
					expect(screen.queryByTestId('checkedAvatar')).not.toBeInTheDocument();

					expect(screen.queryAllByTestId('node-item', { exact: false })).toHaveLength(
						currentFilter.length
					);

					destinationFolderCachedData = global.apolloClient.readQuery<
						GetChildrenQuery,
						GetChildrenQueryVariables
					>({
						query: GET_CHILDREN,
						variables: getChildrenVariables(destinationFolder.id)
					});

					expect(destinationFolderCachedData).toBeNull();
				});
			});

			describe('Copy', () => {
				test('Copy is enabled when multiple files are selected', async () => {
					const currentFilter = [];
					const file = populateFile();
					file.parent = populateFolder();
					const folder = populateFolder();
					folder.parent = populateFolder();
					currentFilter.push(file, folder);

					const mocks = [mockFindNodes(getFindNodesVariables({ flagged: true }), currentFilter)];

					render(<FilterList flagged />, { mocks });

					await screen.findByText(file.name);
					selectNodes([file.id, folder.id]);

					// check that all wanted items are selected
					expect(screen.getAllByTestId('checkedAvatar')).toHaveLength(2);
					expect(screen.getByTestId('icon: MoreVertical')).toBeVisible();
					userEvent.click(screen.getByTestId('icon: MoreVertical'));
					const copyAction = await screen.findByText(actionRegexp.copy);
					expect(copyAction).toBeVisible();
					expect(copyAction.parentElement).not.toHaveAttribute('disabled', '');
				});

				test('Copy open modal showing parent folder content. Confirm action close the modal and clear cached data for destination folder', async () => {
					const currentFilter = populateNodes(5);
					const destinationFolder = populateFolder();
					destinationFolder.permissions.can_write_folder = true;
					destinationFolder.permissions.can_write_file = true;
					currentFilter.push(destinationFolder);
					const { node: nodeToCopy, path } = populateParents(currentFilter[0], 2, true);
					const parentFolder = nodeToCopy.parent as Folder;
					parentFolder.children = [nodeToCopy, destinationFolder];

					// write destination folder in cache as if it was already loaded
					global.apolloClient.writeQuery<GetChildrenQuery, GetChildrenQueryVariables>({
						query: GET_CHILDREN,
						variables: getChildrenVariables(destinationFolder.id),
						data: {
							getNode: destinationFolder
						}
					});
					const mocks = [
						mockFindNodes(getFindNodesVariables({ flagged: true }), currentFilter),
						mockGetPath({ node_id: parentFolder.id }, path.slice(0, path.length - 1)),
						mockGetChildren(getChildrenVariables(parentFolder.id), parentFolder),
						mockCopyNodes(
							{
								node_ids: [nodeToCopy.id],
								destination_id: destinationFolder.id
							},
							[{ ...nodeToCopy, parent: destinationFolder }]
						)
					];

					const { getByTextWithMarkup, findByTextWithMarkup } = render(<FilterList flagged />, {
						mocks
					});

					await screen.findByText(nodeToCopy.name);

					let destinationFolderCachedData = global.apolloClient.readQuery<
						GetChildrenQuery,
						GetChildrenQueryVariables
					>({
						query: GET_CHILDREN,
						variables: getChildrenVariables(destinationFolder.id)
					});

					expect(destinationFolderCachedData?.getNode || null).not.toBeNull();
					expect((destinationFolderCachedData?.getNode as Folder).id).toBe(destinationFolder.id);

					// activate selection mode by selecting items
					selectNodes([nodeToCopy.id]);
					// check that all wanted items are selected
					expect(screen.getByTestId('checkedAvatar')).toBeInTheDocument();
					expect(screen.getByTestId('icon: MoreVertical')).toBeVisible();
					userEvent.click(screen.getByTestId('icon: MoreVertical'));
					const copyAction = await screen.findByText(actionRegexp.copy);
					expect(copyAction).toBeVisible();
					userEvent.click(copyAction);

					const modalList = await screen.findByTestId(`modal-list-${parentFolder.id}`);
					const destinationFolderItem = await within(modalList).findByText(destinationFolder.name);
					const breadcrumbRegexp = buildBreadCrumbRegExp(
						'Files',
						...map(path.slice(0, path.length - 1), (node) => node.name)
					);
					await findByTextWithMarkup(buildBreadCrumbRegExp(path[0].name));
					expect(getByTextWithMarkup(breadcrumbRegexp)).toBeVisible();

					userEvent.click(destinationFolderItem);
					expect(screen.getByRole('button', { name: actionRegexp.copy })).not.toHaveAttribute(
						'disabled',
						''
					);
					act(() => {
						userEvent.click(screen.getByRole('button', { name: actionRegexp.copy }));
					});
					await waitForElementToBeRemoved(screen.queryByTestId('modal-list', { exact: false }));
					const snackbar = await screen.findByText(/item copied/i);
					await waitForElementToBeRemoved(snackbar);
					expect(screen.queryByRole('button', { name: actionRegexp.copy })).not.toBeInTheDocument();
					// exit selection mode
					expect(screen.queryByTestId('checkedAvatar')).not.toBeInTheDocument();

					expect(screen.queryAllByTestId('node-item', { exact: false })).toHaveLength(
						currentFilter.length
					);

					destinationFolderCachedData = global.apolloClient.readQuery<
						GetChildrenQuery,
						GetChildrenQueryVariables
					>({
						query: GET_CHILDREN,
						variables: getChildrenVariables(destinationFolder.id)
					});

					expect(destinationFolderCachedData).toBeNull();
				});

				test('Copy for multiple nodes with same parent open modal showing parent folder content. Confirm action close the modal and clear cached data for destination folder', async () => {
					const currentFilter = populateNodes(5);
					const parentFolder = populateFolder(2);
					const destinationFolder = populateFolder();
					destinationFolder.permissions.can_write_folder = true;
					destinationFolder.permissions.can_write_file = true;
					destinationFolder.parent = parentFolder;
					const nodesToCopy = currentFilter.slice(0, 2);
					forEach(nodesToCopy, (mockedNode) => {
						mockedNode.parent = parentFolder;
					});
					parentFolder.children.push(destinationFolder, ...nodesToCopy);

					// write destination folder in cache as if it was already loaded
					global.apolloClient.writeQuery<GetChildrenQuery, GetChildrenQueryVariables>({
						query: GET_CHILDREN,
						variables: getChildrenVariables(destinationFolder.id),
						data: {
							getNode: destinationFolder
						}
					});

					const mocks = [
						mockFindNodes(getFindNodesVariables({ flagged: true }), currentFilter),
						mockGetPath({ node_id: parentFolder.id }, [parentFolder]),
						mockGetChildren(getChildrenVariables(parentFolder.id), parentFolder),
						mockCopyNodes(
							{
								node_ids: map(nodesToCopy, (node) => node.id),
								destination_id: destinationFolder.id
							},
							map(nodesToCopy, (node) => ({ ...node, parent: destinationFolder }))
						)
					];

					const { findByTextWithMarkup } = render(<FilterList flagged />, {
						mocks
					});

					await screen.findByText(nodesToCopy[0].name);

					let destinationFolderCachedData = global.apolloClient.readQuery<
						GetChildrenQuery,
						GetChildrenQueryVariables
					>({
						query: GET_CHILDREN,
						variables: getChildrenVariables(destinationFolder.id)
					});

					expect(destinationFolderCachedData?.getNode || null).not.toBeNull();
					expect((destinationFolderCachedData?.getNode as Folder).id).toBe(destinationFolder.id);

					// activate selection mode by selecting items
					selectNodes(map(nodesToCopy, (node) => node.id));
					// check that all wanted items are selected
					expect(screen.getAllByTestId('checkedAvatar')).toHaveLength(nodesToCopy.length);
					expect(screen.getByTestId('icon: MoreVertical')).toBeVisible();
					userEvent.click(screen.getByTestId('icon: MoreVertical'));
					const copyAction = await screen.findByText(actionRegexp.copy);
					expect(copyAction).toBeVisible();
					userEvent.click(copyAction);

					const modalList = await screen.findByTestId(`modal-list-${parentFolder.id}`);
					const destinationFolderItem = await within(modalList).findByText(destinationFolder.name);
					const breadcrumbRegexp = buildBreadCrumbRegExp(parentFolder.name);
					const breadcrumb = await findByTextWithMarkup(breadcrumbRegexp);
					expect(breadcrumb).toBeVisible();

					userEvent.click(destinationFolderItem);
					expect(screen.getByRole('button', { name: actionRegexp.copy })).not.toHaveAttribute(
						'disabled',
						''
					);
					act(() => {
						userEvent.click(screen.getByRole('button', { name: actionRegexp.copy }));
					});
					await waitForElementToBeRemoved(screen.queryByTestId('modal-list', { exact: false }));
					const snackbar = await screen.findByText(/item copied/i);
					await waitForElementToBeRemoved(snackbar);
					expect(screen.queryByRole('button', { name: actionRegexp.copy })).not.toBeInTheDocument();
					// exit selection mode
					expect(screen.queryByTestId('checkedAvatar')).not.toBeInTheDocument();

					expect(screen.queryAllByTestId('node-item', { exact: false })).toHaveLength(
						currentFilter.length
					);

					destinationFolderCachedData = global.apolloClient.readQuery<
						GetChildrenQuery,
						GetChildrenQueryVariables
					>({
						query: GET_CHILDREN,
						variables: getChildrenVariables(destinationFolder.id)
					});

					expect(destinationFolderCachedData).toBeNull();
				});

				test('Copy for multiple nodes with different parents open modal showing roots. Confirm action close the modal and clear cached data for destination folder', async () => {
					const currentFilter = populateNodes(5);
					const localRoot = populateFolder(2, ROOTS.LOCAL_ROOT, 'Home');
					const destinationFolder = populateFolder();
					destinationFolder.permissions.can_write_folder = true;
					destinationFolder.permissions.can_write_file = true;
					localRoot.children.push(destinationFolder);
					const nodesToCopy = currentFilter.slice(0, 2);
					forEach(nodesToCopy, (mockedNode) => {
						mockedNode.parent = populateFolder();
					});

					// write destination folder in cache as if it was already loaded
					global.apolloClient.writeQuery<GetChildrenQuery, GetChildrenQueryVariables>({
						query: GET_CHILDREN,
						variables: getChildrenVariables(destinationFolder.id),
						data: {
							getNode: destinationFolder
						}
					});

					const mocks = [
						mockFindNodes(getFindNodesVariables({ flagged: true }), currentFilter),
						mockGetChildren(getChildrenVariables(localRoot.id), localRoot),
						mockCopyNodes(
							{
								node_ids: map(nodesToCopy, (node) => node.id),
								destination_id: destinationFolder.id
							},
							map(nodesToCopy, (node) => ({ ...node, parent: destinationFolder }))
						),
						mockGetPath({ node_id: localRoot.id }, [localRoot])
					];

					const { getByTextWithMarkup } = render(<FilterList flagged />, {
						mocks
					});

					await screen.findByText(nodesToCopy[0].name);

					let destinationFolderCachedData = global.apolloClient.readQuery<
						GetChildrenQuery,
						GetChildrenQueryVariables
					>({
						query: GET_CHILDREN,
						variables: getChildrenVariables(destinationFolder.id)
					});

					expect(destinationFolderCachedData?.getNode || null).not.toBeNull();
					expect((destinationFolderCachedData?.getNode as Folder).id).toBe(destinationFolder.id);

					// activate selection mode by selecting items
					selectNodes(map(nodesToCopy, (node) => node.id));
					// check that all wanted items are selected
					expect(screen.getAllByTestId('checkedAvatar')).toHaveLength(nodesToCopy.length);
					expect(screen.getByTestId('icon: MoreVertical')).toBeVisible();
					userEvent.click(screen.getByTestId('icon: MoreVertical'));
					const copyAction = await screen.findByText(actionRegexp.copy);
					expect(copyAction).toBeVisible();
					userEvent.click(copyAction);

					// open modal with roots
					let modalList = await screen.findByTestId('modal-list-roots');
					expect(within(modalList).getByText('Shared with me')).toBeInTheDocument();
					expect(within(modalList).getByText(localRoot.name)).toBeInTheDocument();
					expect(within(modalList).queryByText('Trash')).not.toBeInTheDocument();
					expect(getByTextWithMarkup(buildBreadCrumbRegExp('Files'))).toBeInTheDocument();
					expect(screen.getByRole('button', { name: actionRegexp.copy })).toHaveAttribute(
						'disabled',
						''
					);

					userEvent.dblClick(within(modalList).getByText(localRoot.name));

					modalList = await screen.findByTestId(`modal-list-${localRoot.id}`);
					const destinationFolderItem = await within(modalList).findByText(destinationFolder.name);

					userEvent.click(destinationFolderItem);
					expect(screen.getByRole('button', { name: actionRegexp.copy })).not.toHaveAttribute(
						'disabled',
						''
					);
					act(() => {
						userEvent.click(screen.getByRole('button', { name: actionRegexp.copy }));
					});
					await waitForElementToBeRemoved(screen.queryByTestId('modal-list', { exact: false }));
					const snackbar = await screen.findByText(/item copied/i);
					await waitForElementToBeRemoved(snackbar);
					expect(screen.queryByRole('button', { name: actionRegexp.copy })).not.toBeInTheDocument();
					// exit selection mode
					expect(screen.queryByTestId('checkedAvatar')).not.toBeInTheDocument();

					expect(screen.queryAllByTestId('node-item', { exact: false })).toHaveLength(
						currentFilter.length
					);

					destinationFolderCachedData = global.apolloClient.readQuery<
						GetChildrenQuery,
						GetChildrenQueryVariables
					>({
						query: GET_CHILDREN,
						variables: getChildrenVariables(destinationFolder.id)
					});

					expect(destinationFolderCachedData).toBeNull();
				});
			});

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
				expect(screen.getByTestId('icon: Trash2Outline').parentNode).toHaveAttribute(
					'disabled',
					''
				);
				expect(screen.getByTestId('icon: MoreVertical')).toBeVisible();
				userEvent.click(screen.getByTestId('icon: MoreVertical'));
				await screen.findByText(actionRegexp.rename);
				expect(screen.getByText(actionRegexp.rename)).toBeVisible();
				expect(screen.getByText(actionRegexp.rename).parentNode).toHaveAttribute('disabled', '');
				expect(screen.getByText(actionRegexp.copy)).toBeVisible();
				expect(screen.getByText(actionRegexp.copy).parentNode).toHaveAttribute('disabled', '');
				expect(screen.getByText(actionRegexp.move)).toBeVisible();
				expect(screen.getByText(actionRegexp.move).parentNode).toHaveAttribute('disabled', '');
				expect(screen.getByText(actionRegexp.flag)).toBeVisible();
				expect(screen.getByText(actionRegexp.flag).parentNode).toHaveAttribute('disabled', '');
				expect(screen.getByText(actionRegexp.unflag)).toBeVisible();
				expect(screen.getByText(actionRegexp.unflag).parentNode).toHaveAttribute('disabled', '');
				expect(screen.getByText(actionRegexp.download)).toBeVisible();
				expect(screen.getByText(actionRegexp.download).parentNode).toHaveAttribute('disabled', '');
				expect(screen.getByText(actionRegexp.openDocument)).toBeVisible();
				expect(screen.getByText(actionRegexp.openDocument).parentNode).toHaveAttribute(
					'disabled',
					''
				);
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

		describe('contextual menu actions', () => {
			describe('Mark for deletion', () => {
				test('Mark for deletion is hidden if the node is trashed', async () => {
					const node = populateFile();
					node.permissions.can_write_file = true;
					node.rootId = ROOTS.TRASH;

					const mocks = [mockFindNodes(getFindNodesVariables({ flagged: true }), [node])];

					render(<FilterList flagged />, { mocks });

					// wait for the load to be completed
					await waitForElementToBeRemoved(screen.queryByTestId('icon: Refresh'));

					// right click to open contextual menu
					const nodeItem = screen.getByTestId(`node-item-${node.id}`);
					fireEvent.contextMenu(nodeItem);
					const renameAction = await screen.findByText(actionRegexp.rename);
					expect(renameAction).toBeVisible();
					const restoreAction = await screen.findByText(actionRegexp.restore);
					expect(restoreAction).toBeVisible();
					const moveToTrashAction = screen.queryByText(actionRegexp.moveToTrash);
					expect(moveToTrashAction).not.toBeInTheDocument();
				});
			});

			describe('Restore', () => {
				test('Restore is hidden if the node is not trashed', async () => {
					const node = populateFile();
					node.permissions.can_write_file = true;
					node.rootId = ROOTS.LOCAL_ROOT;

					const mocks = [mockFindNodes(getFindNodesVariables({ flagged: true }), [node])];

					render(<FilterList flagged />, { mocks });

					// wait for the load to be completed
					await waitForElementToBeRemoved(screen.queryByTestId('icon: Refresh'));

					// right click to open contextual menu
					const nodeItem = screen.getByTestId(`node-item-${node.id}`);
					fireEvent.contextMenu(nodeItem);
					const renameAction = await screen.findByText(actionRegexp.rename);
					expect(renameAction).toBeVisible();
					const moveToTrashAction = await screen.findByText(actionRegexp.moveToTrash);
					expect(moveToTrashAction).toBeVisible();
					const restoreAction = screen.queryByText(actionRegexp.restore);
					expect(restoreAction).not.toBeInTheDocument();
				});
			});

			describe('Delete Permanently', () => {
				test('Delete Permanently is hidden if the node is not trashed', async () => {
					const node = populateFile();
					node.permissions.can_write_file = true;
					node.rootId = ROOTS.LOCAL_ROOT;

					const mocks = [mockFindNodes(getFindNodesVariables({ flagged: true }), [node])];

					render(<FilterList flagged />, { mocks });

					// wait for the load to be completed
					await waitForElementToBeRemoved(screen.queryByTestId('icon: Refresh'));

					// right click to open contextual menu
					const nodeItem = screen.getByTestId(`node-item-${node.id}`);
					fireEvent.contextMenu(nodeItem);
					const renameAction = await screen.findByText(actionRegexp.rename);
					expect(renameAction).toBeVisible();
					const moveToTrashAction = await screen.findByText(actionRegexp.moveToTrash);
					expect(moveToTrashAction).toBeVisible();
					const deletePermanentlyAction = screen.queryByText(actionRegexp.deletePermanently);
					expect(deletePermanentlyAction).not.toBeInTheDocument();
				});
			});

			describe('Rename', () => {
				test('right click on node open the contextual menu for the node, closing a previously opened one. Left click close it', async () => {
					const nodes = populateNodes(2);
					// set the node not flagged so that we can findNodes by flag action in the contextual menu of first node
					nodes[0].flagged = true;
					// set the second node flagged so that we can findNodes by unflag action in the contextual menu of second node
					nodes[1].flagged = true;

					const mocks = [mockFindNodes(getFindNodesVariables({ flagged: true }), nodes)];

					render(<FilterList flagged />, { mocks });

					// wait for the load to be completed
					await waitForElementToBeRemoved(screen.queryByTestId('icon: Refresh'));

					// right click to open contextual menu
					const node1Item = screen.getByTestId(`node-item-${nodes[0].id}`);
					const node2Item = screen.getByTestId(`node-item-${nodes[1].id}`);
					fireEvent.contextMenu(node1Item);
					// check that the flag action becomes visible (contextual menu of first node)
					const unflagAction1 = await screen.findByText(actionRegexp.unflag);
					expect(unflagAction1).toBeVisible();
					// right click on second node
					fireEvent.contextMenu(node2Item);
					// check that the unflag action becomes visible (contextual menu of second node)
					const unflagAction2 = await screen.findByText(actionRegexp.unflag);
					expect(unflagAction2).toBeVisible();
					// check that the flag action becomes invisible (contextual menu of first node is closed)
					expect(unflagAction1).not.toBeInTheDocument();
					// left click close all the contextual menu
					act(() => {
						userEvent.click(node2Item);
					});
					expect(unflagAction2).not.toBeInTheDocument();
					expect(unflagAction1).not.toBeInTheDocument();
				});

				test('Rename is disabled if node does not have permissions', async () => {
					const node = populateFile();
					node.permissions.can_write_file = false;

					const mocks = [mockFindNodes(getFindNodesVariables({ flagged: true }), [node])];

					render(<FilterList flagged />, { mocks });

					// wait for the load to be completed
					await waitForElementToBeRemoved(screen.queryByTestId('icon: Refresh'));

					// right click to open contextual menu
					const nodeItem = screen.getByTestId(`node-item-${node.id}`);
					fireEvent.contextMenu(nodeItem);
					const renameAction = await screen.findByText(actionRegexp.rename);
					expect(renameAction).toBeVisible();
					expect(renameAction.parentElement).toHaveAttribute('disabled', '');
				});

				test('Rename change node name and leave node at same position in the list', async () => {
					const nodes = populateNodes(5, 'File');
					// enable permission to rename
					forEach(nodes, (mockedNode) => {
						mockedNode.permissions.can_write_file = true;
						mockedNode.flagged = true;
					});
					sortNodes(nodes, NODES_SORT_DEFAULT);

					// the element to rename is the second of the list
					const element = nodes[1];
					const lastElementName = nodes[nodes.length - 1].name;
					const newName = lastElementName.substring(0, lastElementName.length - 1);

					const mocks = [
						mockFindNodes(getFindNodesVariables({ flagged: true }), nodes),
						mockUpdateNode(
							{
								node_id: element.id,
								name: newName
							},
							{
								...element,
								name: newName
							}
						)
					];

					render(<FilterList flagged />, { mocks });

					// wait for the load to be completed
					await waitForElementToBeRemoved(screen.queryByTestId('icon: Refresh'));

					// right click to open contextual menu
					const nodeItem = screen.getByTestId(`node-item-${element.id}`);
					// open context menu
					fireEvent.contextMenu(nodeItem);
					await renameNode(newName);
					const inputFieldDiv = await screen.findByTestId('input-name');
					// wait that the modal close
					await waitForElementToBeRemoved(inputFieldDiv);
					// check the new item. It has the new name and its located at same position
					const updatedNodeItem = screen.getByTestId(`node-item-${element.id}`);
					expect(updatedNodeItem).toBeVisible();
					expect(within(updatedNodeItem).getByText(newName)).toBeVisible();
					const nodeItems = screen.getAllByTestId('node-item', { exact: false });
					expect(nodeItems).toHaveLength(nodes.length);
					// element should be the second last in the list
					expect(nodeItems[1]).toBe(updatedNodeItem);
					// contextual menu is closed
					expect(screen.queryByText(actionRegexp.rename)).not.toBeInTheDocument();
				});

				test('Rename a node already loaded in a folder change position of the node in the folder from ordered to unordered', async () => {
					// nodes shown in the filter, only one page
					const currentFilter = populateNodes(NODES_LOAD_LIMIT - 1, 'Folder');
					// the element to rename is the first of the list
					// its new position is going to be the same for the filter view,
					// while in the parent folder it will be positioned in the unordered elements at the end of the list
					const timestamp = Date.now();
					const element = currentFilter[0];
					const newName = `${element.name}-${timestamp}`;
					// nodes of the folder already cached from a previous navigation (1 page of n)
					const parentFolder = populateFolder(NODES_LOAD_LIMIT - 1);
					// put element as first node of the folder
					parentFolder.children.unshift(element);
					// enable permission to rename
					parentFolder.permissions.can_write_folder = true;
					element.permissions.can_write_folder = true;

					// prepare the cache with the parent folder as if already loaded
					global.apolloClient.cache.writeQuery<GetChildrenQuery, GetChildrenQueryVariables>({
						query: GET_CHILDREN,
						variables: getChildrenVariables(parentFolder.id),
						data: {
							getNode: parentFolder
						}
					});

					const newPosition = addNodeInSortedList(
						parentFolder.children,
						{ ...element, name: newName },
						NODES_SORT_DEFAULT
					);

					const mocks = [
						mockFindNodes(getFindNodesVariables({ flagged: true }), currentFilter),
						mockUpdateNode(
							{
								node_id: element.id,
								name: newName
							},
							{
								...element,
								name: newName,
								// update mutation return also the parent
								parent: parentFolder
							}
						)
					];

					render(<FilterList flagged />, { mocks });

					// wait for the load to be completed
					await waitForElementToBeRemoved(screen.queryByTestId('icon: Refresh'));

					// check the position of the node to update in the cached parent folder
					// load two pages even if only one should be written in cache
					let parentFolderData = global.apolloClient.cache.readQuery<
						GetChildrenQuery,
						GetChildrenQueryVariables
					>({
						query: GET_CHILDREN,
						variables: getChildrenVariables(parentFolder.id, NODES_LOAD_LIMIT * 2)
					});
					expect(parentFolderData?.getNode).toBeDefined();
					expect(parentFolderData?.getNode).not.toBeNull();
					expect((parentFolderData?.getNode as Folder).children).toHaveLength(NODES_LOAD_LIMIT);
					expect(((parentFolderData?.getNode as Folder).children[0] as Node).id).toBe(element.id);
					// right click to open contextual menu
					const nodeItem = screen.getByTestId(`node-item-${element.id}`);
					// open context menu
					fireEvent.contextMenu(nodeItem);
					await renameNode(newName);
					// wait that the modal close
					const inputFieldDiv = await screen.findByTestId('input-name');
					await waitForElementToBeRemoved(inputFieldDiv);
					// check the new item. It has the new name and it is at same position in the filter list
					const updatedNodeItem = screen.getByTestId(`node-item-${element.id}`);
					expect(updatedNodeItem).toBeVisible();
					expect(within(updatedNodeItem).getByText(newName)).toBeVisible();
					const nodes = screen.getAllByTestId('node-item', { exact: false });
					expect(nodes).toHaveLength(currentFilter.length);
					expect(nodes[0]).toBe(updatedNodeItem);
					// check that in the parent folder the node has changed its position to last position
					parentFolderData = global.apolloClient.cache.readQuery<
						GetChildrenQuery,
						GetChildrenQueryVariables
					>({
						query: GET_CHILDREN,
						variables: getChildrenVariables(parentFolder.id, NODES_LOAD_LIMIT * 2)
					});
					expect((parentFolderData?.getNode as Folder).children).toHaveLength(
						parentFolder.children.length
					);
					// element is moved at its new position ( -1 because it is also remove from its previous position)
					expect(((parentFolderData?.getNode as Folder).children[newPosition - 1] as Node).id).toBe(
						element.id
					);
					expect(
						((parentFolderData?.getNode as Folder).children[newPosition - 1] as Node).name
					).toBe(newName);
				});

				test('Rename a node with a parent folder already partially loaded, where node is not loaded yet, add node in cached children of the parent folder', async () => {
					// nodes shown in the filter, only one page
					const currentFilter = populateNodes(NODES_LOAD_LIMIT - 1, 'Folder');
					// the element to rename is the last of the filter list
					// its new position is going to be the same for the filter view,
					// while in the parent folder it will be positioned as first element of the ordered list
					const element = currentFilter[currentFilter.length - 1];
					// nodes of the folder already cached from a previous navigation (1 page of n)
					// node is not present in the cached children of the folder
					const parentFolder = populateFolder(NODES_LOAD_LIMIT);
					// enable permission to rename
					parentFolder.permissions.can_write_folder = true;
					element.permissions.can_write_folder = true;
					// new name set to put element as first element in folder
					const newName = (parentFolder.children[0] as Node).name.substring(
						0,
						(parentFolder.children[0] as Node).name.length - 1
					);

					// prepare the cache with the parent folder as if already loaded
					global.apolloClient.cache.writeQuery<GetChildrenQuery, GetChildrenQueryVariables>({
						query: GET_CHILDREN,
						variables: getChildrenVariables(parentFolder.id),
						data: {
							getNode: parentFolder
						}
					});

					const mocks = [
						mockFindNodes(getFindNodesVariables({ flagged: true }), currentFilter),
						mockUpdateNode(
							{
								node_id: element.id,
								name: newName
							},
							{
								...element,
								name: newName,
								// update mutation return also the parent
								parent: parentFolder
							}
						)
					];

					render(<FilterList flagged />, { mocks });

					// wait for the load to be completed
					await waitForElementToBeRemoved(screen.queryByTestId('icon: Refresh'));

					// check the position of the node to update in the cached parent folder
					// load two pages even if only one should be written in cache
					let parentFolderData = global.apolloClient.cache.readQuery<
						GetChildrenQuery,
						GetChildrenQueryVariables
					>({
						query: GET_CHILDREN,
						variables: getChildrenVariables(parentFolder.id, NODES_LOAD_LIMIT * 2)
					});
					expect(parentFolderData?.getNode).toBeDefined();
					expect(parentFolderData?.getNode).not.toBeNull();
					expect((parentFolderData?.getNode as Folder).children).toHaveLength(NODES_LOAD_LIMIT);
					// element is not present in the cache
					expect(
						find(
							(parentFolderData?.getNode as Folder).children,
							(child) => (child as Node).id === element.id
						)
					).toBe(undefined);
					// right click to open contextual menu
					const nodeItem = screen.getByTestId(`node-item-${element.id}`);
					// open context menu
					fireEvent.contextMenu(nodeItem);
					await renameNode(newName);
					// wait that the modal close
					const inputFieldDiv = await screen.findByTestId('input-name');
					await waitForElementToBeRemoved(inputFieldDiv);
					// check the new item. It has the new name and its located at same position
					const updatedNodeItem = screen.getByTestId(`node-item-${element.id}`);
					expect(updatedNodeItem).toBeVisible();
					expect(within(updatedNodeItem).getByText(newName)).toBeVisible();
					const nodes = screen.getAllByTestId('node-item', { exact: false });
					expect(nodes).toHaveLength(currentFilter.length);
					expect(nodes[nodes.length - 1]).toBe(updatedNodeItem);
					// check that in the parent folder the node has changed its position to first position
					parentFolderData = global.apolloClient.cache.readQuery<
						GetChildrenQuery,
						GetChildrenQueryVariables
					>({
						query: GET_CHILDREN,
						variables: getChildrenVariables(parentFolder.id, NODES_LOAD_LIMIT * 2)
					});
					// cached folder has 1 element more than the initial children list
					expect((parentFolderData?.getNode as Folder).children).toHaveLength(
						parentFolder.children.length + 1
					);
					expect(((parentFolderData?.getNode as Folder).children[0] as Node).id).toBe(element.id);
					expect(((parentFolderData?.getNode as Folder).children[0] as Node).name).toBe(newName);
				});
			});

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

			describe('Move', () => {
				test('Move is disabled if node has not permissions', async () => {
					const currentFilter = [];
					const file = populateFile();
					file.permissions.can_write_file = false;
					file.parent = populateFolder();
					file.parent.permissions.can_write_file = true;
					const folder = populateFolder();
					folder.permissions.can_write_folder = false;
					folder.parent = populateFolder();
					folder.parent.permissions.can_write_folder = true;
					const node = populateNode();
					node.permissions.can_write_folder = true;
					node.permissions.can_write_file = true;
					node.parent = populateFolder();
					node.parent.permissions.can_write_folder = true;
					node.parent.permissions.can_write_file = true;
					currentFilter.push(file, folder, node);

					const mocks = [mockFindNodes(getFindNodesVariables({ flagged: true }), currentFilter)];

					render(<FilterList flagged />, { mocks });

					// right click to open contextual menu on file without permission
					const fileItem = await screen.findByText(file.name);
					fireEvent.contextMenu(fileItem);
					let moveAction = await screen.findByText(actionRegexp.move);
					expect(moveAction).toBeVisible();
					expect(moveAction.parentElement).toHaveAttribute('disabled', '');
					// right click to open contextual menu on folder without permission
					const folderItem = await screen.findByText(folder.name);
					fireEvent.contextMenu(folderItem);
					moveAction = await screen.findByText(actionRegexp.move);
					expect(moveAction).toBeVisible();
					expect(moveAction.parentElement).toHaveAttribute('disabled', '');
					// right click to open contextual menu on node with permission
					const nodeItem = await screen.findByText(node.name);
					fireEvent.contextMenu(nodeItem);
					moveAction = await screen.findByText(actionRegexp.move);
					expect(moveAction).toBeVisible();
					expect(moveAction.parentElement).not.toHaveAttribute('disabled', '');
				});

				test('Move open modal showing parent folder content. Confirm action close the modal, leave moved items in filter list and clear cached data for destination folder', async () => {
					const currentFilter = populateNodes(5);
					const destinationFolder = populateFolder();
					destinationFolder.permissions.can_write_folder = true;
					destinationFolder.permissions.can_write_file = true;
					currentFilter.push(destinationFolder);
					const { node: nodeToMove, path } = populateParents(currentFilter[0], 2, true);
					forEach(path, (mockedNode) => {
						mockedNode.permissions.can_write_file = true;
						mockedNode.permissions.can_write_folder = true;
					});
					nodeToMove.permissions.can_write_folder = true;
					nodeToMove.permissions.can_write_file = true;
					const parentFolder = nodeToMove.parent as Folder;
					parentFolder.children = [nodeToMove, destinationFolder];

					// write destination folder in cache as if it was already loaded
					global.apolloClient.writeQuery<GetChildrenQuery, GetChildrenQueryVariables>({
						query: GET_CHILDREN,
						variables: getChildrenVariables(destinationFolder.id),
						data: {
							getNode: destinationFolder
						}
					});
					const mocks = [
						mockFindNodes(getFindNodesVariables({ flagged: true }), currentFilter),
						mockGetPath({ node_id: parentFolder.id }, path.slice(0, path.length - 1)),
						mockGetChildren(getChildrenVariables(parentFolder.id), parentFolder),
						mockMoveNodes(
							{
								node_ids: [nodeToMove.id],
								destination_id: destinationFolder.id
							},
							[{ ...nodeToMove, parent: destinationFolder }]
						)
					];

					const { getByTextWithMarkup, findByTextWithMarkup } = render(<FilterList flagged />, {
						mocks
					});

					await screen.findByText(nodeToMove.name);

					let destinationFolderCachedData = global.apolloClient.readQuery<
						GetChildrenQuery,
						GetChildrenQueryVariables
					>({
						query: GET_CHILDREN,
						variables: getChildrenVariables(destinationFolder.id)
					});

					expect(destinationFolderCachedData?.getNode || null).not.toBeNull();
					expect((destinationFolderCachedData?.getNode as Folder).id).toBe(destinationFolder.id);

					// right click to open contextual menu on folder
					const nodeToMoveItem = await screen.findByText(nodeToMove.name);
					fireEvent.contextMenu(nodeToMoveItem);
					const moveAction = await screen.findByText(actionRegexp.move);
					expect(moveAction).toBeVisible();
					userEvent.click(moveAction);

					const modalList = await screen.findByTestId(`modal-list-${parentFolder.id}`);
					const destinationFolderItem = await within(modalList).findByText(destinationFolder.name);
					const breadcrumbRegexp = buildBreadCrumbRegExp(
						...map(path.slice(0, path.length - 1), (node) => node.name)
					);
					await findByTextWithMarkup(breadcrumbRegexp);
					expect(getByTextWithMarkup(breadcrumbRegexp)).toBeVisible();

					userEvent.click(destinationFolderItem);
					expect(screen.getByRole('button', { name: actionRegexp.move })).not.toHaveAttribute(
						'disabled',
						''
					);
					act(() => {
						userEvent.click(screen.getByRole('button', { name: actionRegexp.move }));
					});
					await waitForElementToBeRemoved(
						screen.queryByRole('button', { name: actionRegexp.move })
					);
					const snackbar = await screen.findByText(/item moved/i);
					await waitForElementToBeRemoved(snackbar);
					expect(screen.queryByRole('button', { name: actionRegexp.move })).not.toBeInTheDocument();
					// context menu is closed
					expect(screen.queryByText(actionRegexp.move)).not.toBeInTheDocument();

					expect(screen.queryAllByTestId('node-item', { exact: false })).toHaveLength(
						currentFilter.length
					);

					destinationFolderCachedData = global.apolloClient.readQuery<
						GetChildrenQuery,
						GetChildrenQueryVariables
					>({
						query: GET_CHILDREN,
						variables: getChildrenVariables(destinationFolder.id)
					});

					expect(destinationFolderCachedData).toBeNull();
				});
			});

			describe('Copy', () => {
				test('Copy open modal showing parent folder content. Confirm action close the modal and clear cached data for destination folder', async () => {
					const currentFilter = populateNodes(5);
					const destinationFolder = populateFolder();
					destinationFolder.permissions.can_write_folder = true;
					destinationFolder.permissions.can_write_file = true;
					currentFilter.push(destinationFolder);
					const { node: nodeToCopy, path } = populateParents(currentFilter[0], 2, true);
					const parentFolder = nodeToCopy.parent as Folder;
					parentFolder.children = [nodeToCopy, destinationFolder];

					// write destination folder in cache as if it was already loaded
					global.apolloClient.writeQuery<GetChildrenQuery, GetChildrenQueryVariables>({
						query: GET_CHILDREN,
						variables: getChildrenVariables(destinationFolder.id),
						data: {
							getNode: destinationFolder
						}
					});
					const mocks = [
						mockFindNodes(getFindNodesVariables({ flagged: true }), currentFilter),
						mockGetPath({ node_id: parentFolder.id }, path.slice(0, path.length - 1)),
						mockGetChildren(getChildrenVariables(parentFolder.id), parentFolder),
						mockCopyNodes(
							{
								node_ids: [nodeToCopy.id],
								destination_id: destinationFolder.id
							},
							[{ ...nodeToCopy, parent: destinationFolder }]
						)
					];

					const { getByTextWithMarkup, findByTextWithMarkup } = render(<FilterList flagged />, {
						mocks
					});

					await screen.findByText(nodeToCopy.name);

					let destinationFolderCachedData = global.apolloClient.readQuery<
						GetChildrenQuery,
						GetChildrenQueryVariables
					>({
						query: GET_CHILDREN,
						variables: getChildrenVariables(destinationFolder.id)
					});

					expect(destinationFolderCachedData?.getNode || null).not.toBeNull();
					expect((destinationFolderCachedData?.getNode as Folder).id).toBe(destinationFolder.id);

					// right click to open contextual menu on folder
					const nodeToCopyItem = await screen.findByText(nodeToCopy.name);
					fireEvent.contextMenu(nodeToCopyItem);
					const copyAction = await screen.findByText(actionRegexp.copy);
					expect(copyAction).toBeVisible();
					userEvent.click(copyAction);

					const modalList = await screen.findByTestId(`modal-list-${parentFolder.id}`);
					const destinationFolderItem = await within(modalList).findByText(destinationFolder.name);
					const breadcrumbRegexp = buildBreadCrumbRegExp(
						'Files',
						...map(path.slice(0, path.length - 1), (node) => node.name)
					);
					await findByTextWithMarkup(breadcrumbRegexp);
					expect(getByTextWithMarkup(breadcrumbRegexp)).toBeVisible();

					userEvent.click(destinationFolderItem);
					expect(screen.getByRole('button', { name: actionRegexp.copy })).not.toHaveAttribute(
						'disabled',
						''
					);
					act(() => {
						userEvent.click(screen.getByRole('button', { name: actionRegexp.copy }));
					});
					await waitForElementToBeRemoved(screen.queryByTestId('modal-list', { exact: false }));
					const snackbar = await screen.findByText(/item copied/i);
					await waitForElementToBeRemoved(snackbar);
					expect(screen.queryByRole('button', { name: actionRegexp.copy })).not.toBeInTheDocument();
					// context menu is closed
					expect(screen.queryByText(actionRegexp.copy)).not.toBeInTheDocument();

					expect(screen.queryAllByTestId('node-item', { exact: false })).toHaveLength(
						currentFilter.length
					);

					destinationFolderCachedData = global.apolloClient.readQuery<
						GetChildrenQuery,
						GetChildrenQueryVariables
					>({
						query: GET_CHILDREN,
						variables: getChildrenVariables(destinationFolder.id)
					});

					expect(destinationFolderCachedData).toBeNull();
				});
			});
		});

		test('refetch filter if not all pages are loaded and all nodes are trashed', async () => {
			const firstPage = populateNodes(NODES_LOAD_LIMIT);
			forEach(firstPage, (node) => {
				// eslint-disable-next-line no-param-reassign
				node.permissions.can_write_file = true;
				// eslint-disable-next-line no-param-reassign
				node.permissions.can_write_folder = true;
			});
			const secondPage = populateNodes(NODES_LOAD_LIMIT);
			forEach(secondPage, (node) => {
				// eslint-disable-next-line no-param-reassign
				node.permissions.can_write_file = true;
				// eslint-disable-next-line no-param-reassign
				node.permissions.can_write_folder = true;
			});
			const nodesToTrash = map(firstPage, (node) => node.id);

			const mocks = [
				mockFindNodes(
					getFindNodesVariables({ flagged: true, folder_id: ROOTS.LOCAL_ROOT, cascade: true }),
					firstPage
				),
				mockTrashNodes({ node_ids: nodesToTrash }, nodesToTrash),
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
			selectNodes(nodesToTrash);
			// check that all wanted items are selected
			expect(screen.getAllByTestId('checkedAvatar')).toHaveLength(firstPage.length);
			expect(screen.getByTestId('icon: MoreVertical')).toBeVisible();
			const trashAction = await screen.findByTestId('icon: Trash2Outline');
			expect(trashAction).toBeVisible();
			expect(trashAction.parentNode).not.toHaveAttribute('disabled', '');
			userEvent.click(trashAction);
			await waitForElementToBeRemoved(screen.queryByText(firstPage[0].name));
			const snackbar = await screen.findByText(/item moved to trash/i);
			await waitForElementToBeRemoved(snackbar);
			await screen.findByText(secondPage[0].name);
			expect(screen.getByText(secondPage[0].name)).toBeVisible();
			expect(screen.queryByText(firstPage[0].name)).not.toBeInTheDocument();
			expect(screen.queryByText((last(firstPage) as Node).name)).not.toBeInTheDocument();
		}, 60000);

		test('refetch filter if not all pages are loaded and all nodes are unflagged', async () => {
			const firstPage = populateNodes(NODES_LOAD_LIMIT);
			forEach(firstPage, (node) => {
				// eslint-disable-next-line no-param-reassign
				node.flagged = true;
			});
			const secondPage = populateNodes(NODES_LOAD_LIMIT);
			forEach(secondPage, (node) => {
				// eslint-disable-next-line no-param-reassign
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
			expect(screen.getByTestId('icon: MoreVertical')).toBeVisible();
			userEvent.click(screen.getByTestId('icon: MoreVertical'));
			const unflagAction = await screen.findByText(actionRegexp.unflag);
			expect(unflagAction).toBeVisible();
			expect(unflagAction.parentNode).not.toHaveAttribute('disabled', '');
			userEvent.click(unflagAction);
			await waitForElementToBeRemoved(screen.queryByText(firstPage[0].name));
			await screen.findByText(secondPage[0].name);
			expect(screen.getByText(secondPage[0].name)).toBeVisible();
			expect(screen.queryByText(firstPage[0].name)).not.toBeInTheDocument();
			expect(screen.queryByText((last(firstPage) as Node).name)).not.toBeInTheDocument();
		}, 60000);

		test('refetch trash filter if not all pages are loaded and all nodes are restored', async () => {
			const firstPage = populateNodes(NODES_LOAD_LIMIT);
			forEach(firstPage, (node) => {
				// eslint-disable-next-line no-param-reassign
				node.rootId = ROOTS.TRASH;
				// eslint-disable-next-line no-param-reassign
				node.permissions.can_write_file = true;
				// eslint-disable-next-line no-param-reassign
				node.permissions.can_write_folder = true;
			});
			const secondPage = populateNodes(NODES_LOAD_LIMIT);
			forEach(secondPage, (node) => {
				// eslint-disable-next-line no-param-reassign
				node.rootId = ROOTS.TRASH;
				// eslint-disable-next-line no-param-reassign
				node.permissions.can_write_file = true;
				// eslint-disable-next-line no-param-reassign
				node.permissions.can_write_folder = true;
			});
			const nodesToRestore = map(firstPage, (node) => node.id);

			const mocks = [
				mockFindNodes(getFindNodesVariables({ folder_id: ROOTS.TRASH, cascade: false }), firstPage),
				mockRestoreNodes({ node_ids: nodesToRestore }, firstPage),
				mockFindNodes(getFindNodesVariables({ folder_id: ROOTS.TRASH, cascade: false }), secondPage)
			];

			render(<FilterList trashed cascade={false} />, { mocks });

			await screen.findByText(firstPage[0].name);
			expect(screen.getByText(firstPage[0].name)).toBeVisible();
			expect(screen.getByText((last(firstPage) as Node).name)).toBeVisible();
			expect(screen.queryByText(secondPage[0].name)).not.toBeInTheDocument();

			// select all loaded nodes
			selectNodes(nodesToRestore);
			// check that all wanted items are selected
			expect(screen.getAllByTestId('checkedAvatar')).toHaveLength(firstPage.length);
			expect(screen.getByTestId('icon: MoreVertical')).toBeVisible();
			userEvent.click(screen.getByTestId('icon: MoreVertical'));
			const restoreAction = await screen.findByTestId('icon: RestoreOutline');
			expect(restoreAction).toBeVisible();
			expect(restoreAction.parentNode).not.toHaveAttribute('disabled', '');
			userEvent.click(restoreAction);
			await waitForElementToBeRemoved(screen.queryByText(firstPage[0].name));
			const snackbar = await screen.findByText(/^success$/i);
			await waitForElementToBeRemoved(snackbar);
			await screen.findByText(secondPage[0].name);
			expect(screen.getByText(secondPage[0].name)).toBeVisible();
			expect(screen.queryByText(firstPage[0].name)).not.toBeInTheDocument();
			expect(screen.queryByText((last(firstPage) as Node).name)).not.toBeInTheDocument();
		}, 60000);

		test('refetch trash filter if not all pages are loaded and all nodes are deleted permanently', async () => {
			const firstPage = populateNodes(NODES_LOAD_LIMIT);
			forEach(firstPage, (mockedNode) => {
				mockedNode.rootId = ROOTS.TRASH;
				mockedNode.permissions.can_delete = true;
			});
			const secondPage = populateNodes(NODES_LOAD_LIMIT);
			forEach(secondPage, (mockedNode) => {
				mockedNode.rootId = ROOTS.TRASH;
				mockedNode.permissions.can_delete = true;
			});
			const nodesToDelete = map(firstPage, (node) => node.id);

			const mocks = [
				mockFindNodes(getFindNodesVariables({ folder_id: ROOTS.TRASH, cascade: false }), firstPage),
				mockDeletePermanently({ node_ids: nodesToDelete }, nodesToDelete),
				mockFindNodes(getFindNodesVariables({ folder_id: ROOTS.TRASH, cascade: false }), secondPage)
			];

			render(<FilterList trashed cascade={false} />, { mocks });

			await screen.findByText(firstPage[0].name);
			expect(screen.getByText(firstPage[0].name)).toBeVisible();
			expect(screen.getByText((last(firstPage) as Node).name)).toBeVisible();
			expect(screen.queryByText(secondPage[0].name)).not.toBeInTheDocument();

			// select all loaded nodes
			selectNodes(nodesToDelete);
			// check that all wanted items are selected
			expect(screen.getAllByTestId('checkedAvatar')).toHaveLength(firstPage.length);
			expect(screen.getByTestId('icon: MoreVertical')).toBeVisible();
			userEvent.click(screen.getByTestId('icon: MoreVertical'));
			const deletePermanentlyAction = await screen.findByTestId('icon: DeletePermanentlyOutline');
			expect(deletePermanentlyAction).toBeVisible();
			expect(deletePermanentlyAction.parentNode).not.toHaveAttribute('disabled', '');
			userEvent.click(deletePermanentlyAction);
			const confirmDeleteButton = await screen.findByRole('button', {
				name: actionRegexp.deletePermanently
			});
			userEvent.click(confirmDeleteButton);
			await waitForElementToBeRemoved(screen.queryByText(firstPage[0].name));
			const snackbar = await screen.findByText(/^success$/i);
			await waitForElementToBeRemoved(snackbar);
			await screen.findByText(secondPage[0].name);
			expect(screen.getByText(secondPage[0].name)).toBeVisible();
			expect(screen.queryByText(firstPage[0].name)).not.toBeInTheDocument();
			expect(screen.queryByText((last(firstPage) as Node).name)).not.toBeInTheDocument();
		}, 60000);
	});

	describe('Drag and drop', () => {
		test('Drag of files in a filter shows upload dropzone with dropzone message. Drop triggers upload in local root', async () => {
			const currentFilter = populateNodes(5, 'File');
			const localRoot = populateFolder(0, ROOTS.LOCAL_ROOT);
			const uploadedFiles = populateNodes(2, 'File') as FilesFile[];
			const files: File[] = [];
			forEach(uploadedFiles, (file) => {
				// eslint-disable-next-line no-param-reassign
				file.parent = localRoot;
				files.push(new File(['(⌐□_□)'], file.name, { type: file.mime_type }));
			});
			let reqIndex = 0;

			// write local root data in cache as if it was already loaded
			const getChildrenMockedQuery = mockGetChildren(getChildrenVariables(localRoot.id), localRoot);
			global.apolloClient.cache.writeQuery<GetChildrenQuery, GetChildrenQueryVariables>({
				...getChildrenMockedQuery.request,
				data: {
					getNode: localRoot
				}
			});

			server.use(
				graphql.query<GetChildQuery, GetChildQueryVariables>('getChild', (req, res, ctx) => {
					const { node_id: id } = req.variables;
					const result = (reqIndex < uploadedFiles.length && uploadedFiles[reqIndex]) || null;
					if (result) {
						result.id = id;
						reqIndex += 1;
					}
					return res(ctx.data({ getNode: result }));
				})
			);
			const mocks = [
				mockFindNodes(
					getFindNodesVariables({
						shared_with_me: true,
						folder_id: ROOTS.LOCAL_ROOT,
						cascade: false
					}),
					currentFilter
				)
			];

			const dataTransferObj = {
				types: ['Files'],
				files
			};

			render(<FilterList sharedWithMe trashed={false} canUploadFile cascade={false} />, { mocks });

			await screen.findByText(currentFilter[0].name);

			fireEvent.dragEnter(screen.getByText(currentFilter[0].name), {
				dataTransfer: dataTransferObj
			});

			await screen.findByTestId('dropzone-overlay');
			expect(
				screen.getByText(/Drop here your attachments to quick-add them to your Home/m)
			).toBeVisible();

			fireEvent.drop(screen.getByText(currentFilter[0].name), {
				dataTransfer: dataTransferObj
			});

			const snackbar = await screen.findByText(/upload occurred in Files' home/i);
			await waitForElementToBeRemoved(snackbar);

			expect(screen.getAllByTestId('node-item', { exact: false })).toHaveLength(
				currentFilter.length
			);
			expect(screen.queryByText(/Drop here your attachments/m)).not.toBeInTheDocument();

			await waitFor(() => {
				const localRootCachedData = global.apolloClient.readQuery<
					GetChildrenQuery,
					GetChildrenQueryVariables
				>(getChildrenMockedQuery.request);
				return expect(
					(localRootCachedData?.getNode as Maybe<Folder> | undefined)?.children || []
				).toHaveLength(uploadedFiles.length);
			});
		});

		test('Drag of files in trash filter shows upload dropzone with dropzone message "not allowed"', async () => {
			const currentFilter = populateNodes(5);
			const localRoot = populateFolder(0, ROOTS.LOCAL_ROOT);
			const uploadedFiles = populateNodes(2, 'File') as FilesFile[];
			const files: File[] = [];
			forEach(uploadedFiles, (file) => {
				// eslint-disable-next-line no-param-reassign
				file.parent = localRoot;
				files.push(new File(['(⌐□_□)'], file.name, { type: file.mime_type }));
			});
			let reqIndex = 0;

			// write local root data in cache as if it was already loaded
			const getChildrenMockedQuery = mockGetChildren(getChildrenVariables(localRoot.id), localRoot);
			global.apolloClient.cache.writeQuery<GetChildrenQuery, GetChildrenQueryVariables>({
				...getChildrenMockedQuery.request,
				data: {
					getNode: localRoot
				}
			});

			server.use(
				graphql.query<GetChildQuery, GetChildQueryVariables>('getChild', (req, res, ctx) => {
					const { node_id: id } = req.variables;
					const result = (reqIndex < uploadedFiles.length && uploadedFiles[reqIndex]) || null;
					if (result) {
						result.id = id;
						reqIndex += 1;
					}
					return res(ctx.data({ getNode: result }));
				})
			);
			const mocks = [
				mockFindNodes(
					getFindNodesVariables({ shared_with_me: false, folder_id: ROOTS.TRASH, cascade: false }),
					currentFilter
				)
			];

			const dataTransferObj = {
				types: ['Files'],
				files
			};

			render(
				<Route path="/filter/:filter">
					<FilterList sharedWithMe={false} trashed canUploadFile={false} cascade={false} />
				</Route>,
				{
					mocks,
					initialRouterEntries: ['/filter/myTrash']
				}
			);

			await screen.findByText(currentFilter[0].name);

			fireEvent.dragEnter(screen.getByText(currentFilter[0].name), {
				dataTransfer: dataTransferObj
			});

			await screen.findByTestId('dropzone-overlay');
			expect(screen.getByText(/You cannot drop an attachment in this area/im)).toBeVisible();

			fireEvent.drop(screen.getByText(currentFilter[0].name), {
				dataTransfer: dataTransferObj
			});

			expect(screen.getAllByTestId('node-item', { exact: false })).toHaveLength(
				currentFilter.length
			);
			expect(
				screen.queryByText(/You cannot drop an attachment in this area/m)
			).not.toBeInTheDocument();

			expect(reqIndex).toBe(0);
			const localRootCachedData = global.apolloClient.readQuery<
				GetChildrenQuery,
				GetChildrenQueryVariables
			>(getChildrenMockedQuery.request);
			expect(localRootCachedData?.getNode || null).not.toBeNull();
			expect((localRootCachedData?.getNode as Folder).children).toHaveLength(0);
		});

		test('Drag of files in a folder node with right permissions inside a filter shows upload dropzone of the list item. Drop triggers upload in list item folder', async () => {
			const currentFilter = populateNodes(2);
			const destinationFolder = populateFolder();
			destinationFolder.permissions.can_write_file = true;
			currentFilter.push(destinationFolder);
			const uploadedFiles = populateNodes(2, 'File') as FilesFile[];
			const files: File[] = [];
			forEach(uploadedFiles, (file) => {
				// eslint-disable-next-line no-param-reassign
				file.parent = destinationFolder;
				files.push(new File(['(⌐□_□)'], file.name, { type: file.mime_type }));
			});
			let reqIndex = 0;

			server.use(
				graphql.query<GetChildQuery, GetChildQueryVariables>('getChild', (req, res, ctx) => {
					const { node_id: id } = req.variables;
					const result = (reqIndex < uploadedFiles.length && uploadedFiles[reqIndex]) || null;
					if (result) {
						result.id = id;
						reqIndex += 1;
					}
					return res(ctx.data({ getNode: result || null }));
				})
			);
			const mocks = [
				mockFindNodes(
					getFindNodesVariables({
						shared_with_me: true,
						folder_id: ROOTS.LOCAL_ROOT,
						cascade: true
					}),
					currentFilter
				)
			];

			const dataTransferObj = {
				types: ['Files'],
				files
			};

			render(<FilterList trashed={false} sharedWithMe cascade canUploadFile />, { mocks });

			await screen.findByText(destinationFolder.name);

			fireEvent.dragEnter(screen.getByText(destinationFolder.name), {
				dataTransfer: dataTransferObj
			});

			await screen.findByTestId('dropzone-overlay');
			expect(
				screen.queryByText(/Drop here your attachments to quick-add them to this folder/m)
			).not.toBeInTheDocument();

			fireEvent.drop(screen.getByText(destinationFolder.name), {
				dataTransfer: dataTransferObj
			});

			const snackbar = await screen.findByText(
				new RegExp(`Upload occurred in ${destinationFolder.name}`, 'i')
			);
			await waitForElementToBeRemoved(snackbar);
			expect(screen.queryByTestId('dropzone-overlay')).not.toBeInTheDocument();
		});

		test('Drag of files in a folder node without right permissions inside a filter shows upload dropzone of the list item. Drop does nothing', async () => {
			const currentFilter = populateNodes(2);
			const destinationFolder = populateFolder();
			destinationFolder.permissions.can_write_file = false;
			currentFilter.push(destinationFolder);
			const uploadedFiles = populateNodes(2, 'File') as FilesFile[];
			const files: File[] = [];
			forEach(uploadedFiles, (file) => {
				// eslint-disable-next-line no-param-reassign
				file.parent = destinationFolder;
				files.push(new File(['(⌐□_□)'], file.name, { type: file.mime_type }));
			});
			let reqIndex = 0;

			server.use(
				graphql.query<GetChildQuery, GetChildQueryVariables>('getChild', (req, res, ctx) => {
					const { node_id: id } = req.variables;
					const result = (reqIndex < uploadedFiles.length && uploadedFiles[reqIndex]) || null;
					if (result) {
						result.id = id;
						reqIndex += 1;
					}
					return res(ctx.data({ getNode: result }));
				})
			);
			const mocks = [
				mockFindNodes(getFindNodesVariables({ flagged: true, cascade: true }), currentFilter)
			];

			const dataTransferObj = {
				types: ['Files'],
				files
			};

			render(<FilterList flagged cascade canUploadFile />, { mocks });

			await screen.findByText(destinationFolder.name);

			fireEvent.dragEnter(screen.getByText(destinationFolder.name), {
				dataTransfer: dataTransferObj
			});

			await screen.findByTestId('dropzone-overlay');
			expect(
				screen.queryByText(/Drop here your attachments to quick-add them to this folder/m)
			).not.toBeInTheDocument();

			fireEvent.drop(screen.getByText(destinationFolder.name), {
				dataTransfer: dataTransferObj
			});

			expect(screen.queryByTestId('dropzone-overlay')).not.toBeInTheDocument();
			expect(screen.queryByText(/upload occurred/i)).not.toBeInTheDocument();
			expect(reqIndex).toBe(0);
		});

		test('Drag of files in a folder node with right permissions inside a trash filter shows disabled upload dropzone of the trash filter', async () => {
			const currentFilter = populateNodes(2);
			const destinationFolder = populateFolder();
			destinationFolder.permissions.can_write_file = true;
			currentFilter.push(destinationFolder);
			const uploadedFiles = populateNodes(2, 'File') as FilesFile[];
			const files: File[] = [];
			forEach(uploadedFiles, (file) => {
				// eslint-disable-next-line no-param-reassign
				file.parent = destinationFolder;
				files.push(new File(['(⌐□_□)'], file.name, { type: file.mime_type }));
			});
			let reqIndex = 0;

			server.use(
				graphql.query<GetChildQuery, GetChildQueryVariables>('getChild', (req, res, ctx) => {
					const { node_id: id } = req.variables;
					const result = (reqIndex < uploadedFiles.length && uploadedFiles[reqIndex]) || null;
					if (result) {
						result.id = id;
						reqIndex += 1;
					}
					return res(ctx.data({ getNode: result }));
				})
			);
			const mocks = [
				mockFindNodes(
					getFindNodesVariables({ folder_id: ROOTS.TRASH, cascade: true }),
					currentFilter
				)
			];

			const dataTransferObj = {
				types: ['Files'],
				files
			};

			render(
				<Route path="/filter/:filter">
					<FilterList trashed cascade canUploadFile={false} />
				</Route>,
				{ mocks, initialRouterEntries: ['/filter/myTrash'] }
			);

			await screen.findByText(destinationFolder.name);

			fireEvent.dragEnter(screen.getByText(destinationFolder.name), {
				dataTransfer: dataTransferObj
			});

			await screen.findByTestId('dropzone-overlay');
			expect(screen.getByText(/You cannot drop an attachment in this area/im)).toBeVisible();

			fireEvent.drop(screen.getByText(destinationFolder.name), {
				dataTransfer: dataTransferObj
			});

			expect(
				screen.queryByText(/You cannot drop an attachment in this area/m)
			).not.toBeInTheDocument();
			expect(reqIndex).toBe(0);
		});

		test('Drag of a node marked for deletion is not permitted. Dropzone is not shown', async () => {
			const currentFilter = populateNodes(5);
			const nodesToDrag = [currentFilter[0]];
			forEach(nodesToDrag, (mockedNode) => {
				mockedNode.permissions.can_write_file = true;
				mockedNode.permissions.can_write_folder = true;
				mockedNode.parent = populateFolder();
				mockedNode.parent.permissions.can_write_folder = true;
				mockedNode.parent.permissions.can_write_file = true;
				mockedNode.rootId = ROOTS.TRASH;
			});
			const destinationFolder = populateFolder();
			destinationFolder.permissions.can_write_folder = true;
			destinationFolder.permissions.can_write_file = true;
			currentFilter.push(destinationFolder);

			const mocks = [
				mockFindNodes(
					getFindNodesVariables({ shared_with_me: false, folder_id: ROOTS.TRASH, cascade: false }),
					currentFilter
				)
			];

			let dataTransferData: Record<string, string> = {};
			let dataTransferTypes: string[] = [];
			const dataTransfer = (): Partial<DataTransfer> => ({
				setDragImage: jest.fn(),
				setData: jest.fn().mockImplementation((type, data) => {
					dataTransferData[type] = data;
					dataTransferTypes.includes(type) || dataTransferTypes.push(type);
				}),
				getData: jest.fn().mockImplementation((type) => dataTransferData[type]),
				types: dataTransferTypes,
				clearData: jest.fn().mockImplementation(() => {
					dataTransferTypes = [];
					dataTransferData = {};
				})
			});

			render(<FilterList sharedWithMe={false} trashed canUploadFile={false} cascade={false} />, {
				mocks
			});

			const itemToDrag = await screen.findByText(currentFilter[0].name);

			fireEvent.dragStart(itemToDrag, { dataTransfer: dataTransfer() });
			forEach(nodesToDrag, (node) => {
				const draggedImage = screen.getAllByText(node.name);
				expect(draggedImage).toHaveLength(2);
				expect(draggedImage[0]).toHaveAttribute('disabled', '');
				expect(draggedImage[1]).not.toHaveAttribute('disabled', '');
			});

			// dropzone is not shown
			const destinationItem = screen.getByText(destinationFolder.name);
			fireEvent.dragEnter(destinationItem, { dataTransfer: dataTransfer() });
			await waitFor(
				() =>
					new Promise((resolve) => {
						setTimeout(resolve, 100);
					})
			);
			expect(screen.queryByTestId('dropzone-overlay')).not.toBeInTheDocument();
			fireEvent.drop(destinationItem, { dataTransfer: dataTransfer() });
			fireEvent.dragEnd(itemToDrag, { dataTransfer: dataTransfer() });
		});

		test('Drag of a node shows move dropzone in other nodes. Dragged node is disabled. Drop triggers move only on folders with right permissions.	Dragged node is not removed from current filter list', async () => {
			const currentFilter = populateNodes(5);
			const nodesToDrag = [currentFilter[0]];
			forEach(nodesToDrag, (mockedNode) => {
				mockedNode.permissions.can_write_file = true;
				mockedNode.permissions.can_write_folder = true;
				mockedNode.parent = populateFolder();
				mockedNode.parent.permissions.can_write_folder = true;
				mockedNode.parent.permissions.can_write_file = true;
			});
			const destinationFolder = populateFolder();
			destinationFolder.permissions.can_write_folder = true;
			destinationFolder.permissions.can_write_file = true;
			currentFilter.push(destinationFolder);
			const folderWithoutPermission = populateFolder();
			folderWithoutPermission.permissions.can_write_folder = false;
			folderWithoutPermission.permissions.can_write_file = false;
			currentFilter.push(folderWithoutPermission);

			const mocks = [
				mockFindNodes(
					getFindNodesVariables({ flagged: true, folder_id: ROOTS.LOCAL_ROOT, cascade: true }),
					currentFilter
				),
				mockMoveNodes(
					{
						node_ids: map(nodesToDrag, (node) => node.id),
						destination_id: destinationFolder.id
					},
					map(nodesToDrag, (node) => ({ ...node, parent: destinationFolder }))
				)
			];

			let dataTransferData: Record<string, string> = {};
			let dataTransferTypes: string[] = [];
			const dataTransfer = (): Partial<DataTransfer> => ({
				setDragImage: jest.fn(),
				setData: jest.fn().mockImplementation((type, data) => {
					dataTransferData[type] = data;
					dataTransferTypes.includes(type) || dataTransferTypes.push(type);
				}),
				getData: jest.fn().mockImplementation((type) => dataTransferData[type]),
				types: dataTransferTypes,
				clearData: jest.fn().mockImplementation(() => {
					dataTransferTypes = [];
					dataTransferData = {};
				})
			});

			render(<FilterList flagged trashed={false} canUploadFile cascade />, { mocks });

			const itemToDrag = await screen.findByText(nodesToDrag[0].name);
			fireEvent.dragStart(itemToDrag, { dataTransfer: dataTransfer() });
			fireEvent.dragEnter(itemToDrag, { dataTransfer: dataTransfer() });
			await waitFor(
				() =>
					new Promise((resolve) => {
						setTimeout(resolve, 100);
					})
			);
			// two items are visible for the node, the one in the list is disabled, the other one is the one dragged and is not disabled
			const draggedNodeItems = screen.getAllByText(nodesToDrag[0].name);
			expect(draggedNodeItems).toHaveLength(2);
			expect(draggedNodeItems[0]).toHaveAttribute('disabled', '');
			expect(draggedNodeItems[1]).not.toHaveAttribute('disabled', '');
			expect(screen.queryByTestId('dropzone-overlay')).not.toBeInTheDocument();
			fireEvent.dragLeave(itemToDrag, { dataTransfer: dataTransfer() });

			// drag and drop on folder without permissions
			const folderWithoutPermissionsItem = screen.getByText(folderWithoutPermission.name);
			fireEvent.dragEnter(folderWithoutPermissionsItem, { dataTransfer: dataTransfer() });
			await screen.findByTestId('dropzone-overlay');
			expect(screen.getByTestId('dropzone-overlay')).toBeVisible();
			expect(screen.queryByText('Drag&Drop Mode')).not.toBeInTheDocument();
			fireEvent.drop(folderWithoutPermissionsItem, { dataTransfer: dataTransfer() });
			fireEvent.dragEnd(itemToDrag, { dataTransfer: dataTransfer() });

			expect(screen.queryByTestId('dropzone-overlay')).not.toBeInTheDocument();
			expect(itemToDrag).toBeVisible();
			expect(itemToDrag).not.toHaveAttribute('disabled', '');

			// drag and drop on folder with permissions
			const destinationItem = screen.getByText(destinationFolder.name);
			fireEvent.dragStart(itemToDrag, { dataTransfer: dataTransfer() });
			fireEvent.dragEnter(destinationItem, { dataTransfer: dataTransfer() });
			await screen.findByTestId('dropzone-overlay');
			expect(screen.getByTestId('dropzone-overlay')).toBeVisible();
			expect(screen.queryByText('Drag&Drop Mode')).not.toBeInTheDocument();
			fireEvent.drop(destinationItem, { dataTransfer: dataTransfer() });
			fireEvent.dragEnd(itemToDrag, { dataTransfer: dataTransfer() });
			const snackbar = await screen.findByText(/item moved/i);
			await waitForElementToBeRemoved(snackbar);
			expect(screen.queryByTestId('dropzone-overlay')).not.toBeInTheDocument();
			expect(screen.getByText(nodesToDrag[0].name)).toBeInTheDocument();
			expect(screen.getByText(nodesToDrag[0].name)).toBeVisible();
			expect(screen.getByText(nodesToDrag[0].name)).not.toHaveAttribute('disabled', '');
		});

		test('Drag of a node without move permissions cause no dropzone to be shown', async () => {
			const currentFilter = populateNodes(5);
			const nodesToDrag = [currentFilter[0]];
			forEach(nodesToDrag, (mockedNode) => {
				mockedNode.permissions.can_write_file = false;
				mockedNode.permissions.can_write_folder = false;
				mockedNode.parent = populateFolder();
				mockedNode.parent.permissions.can_write_folder = true;
				mockedNode.parent.permissions.can_write_file = true;
			});
			const destinationFolder = populateFolder();
			destinationFolder.permissions.can_write_folder = true;
			destinationFolder.permissions.can_write_file = true;
			currentFilter.push(destinationFolder);
			const folderWithoutPermission = populateFolder();
			folderWithoutPermission.permissions.can_write_folder = false;
			folderWithoutPermission.permissions.can_write_file = false;
			currentFilter.push(folderWithoutPermission);

			const mocks = [
				mockFindNodes(
					getFindNodesVariables({ flagged: true, folder_id: ROOTS.LOCAL_ROOT, cascade: true }),
					currentFilter
				)
			];

			let dataTransferData: Record<string, string> = {};
			let dataTransferTypes: string[] = [];
			const dataTransfer = (): Partial<DataTransfer> => ({
				setDragImage: jest.fn(),
				setData: jest.fn().mockImplementation((type, data) => {
					dataTransferData[type] = data;
					dataTransferTypes.includes(type) || dataTransferTypes.push(type);
				}),
				getData: jest.fn().mockImplementation((type) => dataTransferData[type]),
				types: dataTransferTypes,
				clearData: jest.fn().mockImplementation(() => {
					dataTransferTypes = [];
					dataTransferData = {};
				})
			});

			render(<FilterList flagged trashed={false} canUploadFile cascade />, { mocks });

			const itemToDrag = await screen.findByText(nodesToDrag[0].name);
			fireEvent.dragStart(itemToDrag, { dataTransfer: dataTransfer() });
			fireEvent.dragEnter(itemToDrag, { dataTransfer: dataTransfer() });
			await waitFor(
				() =>
					new Promise((resolve) => {
						setTimeout(resolve, 100);
					})
			);
			// two items are visible for the node, the one in the list is disabled, the other one is the one dragged and is not disabled
			const draggedNodeItems = screen.getAllByText(nodesToDrag[0].name);
			expect(draggedNodeItems).toHaveLength(2);
			expect(draggedNodeItems[0]).toHaveAttribute('disabled', '');
			expect(draggedNodeItems[1]).not.toHaveAttribute('disabled', '');
			expect(screen.queryByTestId('dropzone-overlay')).not.toBeInTheDocument();
			fireEvent.dragLeave(itemToDrag, { dataTransfer: dataTransfer() });

			// drag and drop on folder without permissions. Overlay is not shown.
			const folderWithoutPermissionsItem = screen.getByText(folderWithoutPermission.name);
			fireEvent.dragEnter(folderWithoutPermissionsItem, { dataTransfer: dataTransfer() });
			await waitFor(
				() =>
					new Promise((resolve) => {
						setTimeout(resolve, 100);
					})
			);
			expect(screen.queryByTestId('dropzone-overlay')).not.toBeInTheDocument();
			fireEvent.drop(folderWithoutPermissionsItem, { dataTransfer: dataTransfer() });
			fireEvent.dragEnd(itemToDrag, { dataTransfer: dataTransfer() });
			expect(itemToDrag).toBeVisible();
			expect(itemToDrag).not.toHaveAttribute('disabled', '');

			// drag and drop on folder with permissions. Overlay is not shown.
			const destinationItem = screen.getByText(destinationFolder.name);
			fireEvent.dragStart(itemToDrag, { dataTransfer: dataTransfer() });
			fireEvent.dragEnter(destinationItem, { dataTransfer: dataTransfer() });
			await waitFor(
				() =>
					new Promise((resolve) => {
						setTimeout(resolve, 100);
					})
			);
			expect(screen.queryByTestId('dropzone-overlay')).not.toBeInTheDocument();
			fireEvent.drop(destinationItem, { dataTransfer: dataTransfer() });
			fireEvent.dragEnd(itemToDrag, { dataTransfer: dataTransfer() });
			expect(itemToDrag).toBeVisible();
			expect(itemToDrag).not.toHaveAttribute('disabled', '');
		});

		test('Drag of multiple nodes is not permitted', async () => {
			const currentFilter = populateNodes(5);
			const nodesToDrag = [...currentFilter];
			const parent = populateFolder();
			parent.permissions.can_write_folder = true;
			parent.permissions.can_write_file = true;
			forEach(nodesToDrag, (mockedNode) => {
				mockedNode.permissions.can_write_file = true;
				mockedNode.permissions.can_write_folder = true;
				mockedNode.parent = parent;
			});
			const destinationFolder = populateFolder();
			destinationFolder.permissions.can_write_folder = true;
			destinationFolder.permissions.can_write_file = true;
			destinationFolder.parent = parent;
			currentFilter.push(destinationFolder);

			const mocks = [
				mockFindNodes(
					getFindNodesVariables({ flagged: true, folder_id: ROOTS.LOCAL_ROOT, cascade: true }),
					currentFilter
				),
				mockMoveNodes(
					{
						node_ids: map(nodesToDrag, (node) => node.id),
						destination_id: destinationFolder.id
					},
					map(nodesToDrag, (node) => ({ ...node, parent: destinationFolder }))
				)
			];

			let dataTransferData: Record<string, string> = {};
			let dataTransferTypes: string[] = [];
			const dataTransfer = (): Partial<DataTransfer> => ({
				setDragImage: jest.fn(),
				setData: jest.fn().mockImplementation((type, data) => {
					dataTransferData[type] = data;
					dataTransferTypes.includes(type) || dataTransferTypes.push(type);
				}),
				getData: jest.fn().mockImplementation((type) => dataTransferData[type]),
				types: dataTransferTypes,
				clearData: jest.fn().mockImplementation(() => {
					dataTransferTypes = [];
					dataTransferData = {};
				})
			});

			render(
				<Route path="/filter/:filter">
					<FilterList flagged trashed={false} canUploadFile cascade />
				</Route>,
				{
					mocks,
					initialRouterEntries: ['/filter/flagged']
				}
			);

			const itemToDrag = await screen.findByText(nodesToDrag[0].name);
			await selectNodes(map(nodesToDrag, (node) => node.id));
			// check that all wanted items are selected
			expect(screen.getAllByTestId('checkedAvatar')).toHaveLength(nodesToDrag.length);

			fireEvent.dragStart(itemToDrag, { dataTransfer: dataTransfer() });
			forEach(nodesToDrag, (node) => {
				const draggedImage = screen.getAllByText(node.name);
				expect(draggedImage).toHaveLength(2);
				expect(draggedImage[0]).toHaveAttribute('disabled', '');
				expect(draggedImage[1]).not.toHaveAttribute('disabled', '');
			});

			// dropzone is not shown
			const destinationItem = screen.getByText(destinationFolder.name);
			fireEvent.dragEnter(destinationItem, { dataTransfer: dataTransfer() });
			await waitFor(
				() =>
					new Promise((resolve) => {
						setTimeout(resolve, 100);
					})
			);
			expect(screen.queryByTestId('dropzone-overlay')).not.toBeInTheDocument();
			fireEvent.drop(destinationItem, { dataTransfer: dataTransfer() });
			fireEvent.dragEnd(itemToDrag, { dataTransfer: dataTransfer() });

			// selection mode stays active
			expect(screen.getAllByTestId('checkedAvatar')).toHaveLength(nodesToDrag.length);
		});
	});

	describe('Trash filter', () => {
		describe('Selection mode', () => {
			test('if there is no element selected, trash actions are visible and disabled', async () => {
				const nodes = populateNodes(10);
				forEach(nodes, (mockedNode) => {
					mockedNode.rootId = ROOTS.TRASH;
				});

				const mocks = [
					mockFindNodes(getFindNodesVariables({ folder_id: ROOTS.TRASH, cascade: false }), nodes)
				];
				render(
					<Route path="/filter/:filter">
						<FilterList trashed cascade={false} />
					</Route>,
					{ mocks, initialRouterEntries: ['/filter/myTrash'] }
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
				expect(screen.getByTestId('icon: RestoreOutline')).toBeVisible();
				expect(screen.getByTestId('icon: RestoreOutline').parentNode).toHaveAttribute(
					'disabled',
					''
				);
				expect(screen.getByTestId('icon: DeletePermanentlyOutline')).toBeVisible();
				expect(screen.getByTestId('icon: DeletePermanentlyOutline').parentNode).toHaveAttribute(
					'disabled',
					''
				);
				expect(screen.queryByTestId('icon: MoreVertical')).not.toBeInTheDocument();
				expect(screen.queryByTestId('icon: Trash2Outline')).not.toBeInTheDocument();
				expect(screen.getByTestId('icon: ArrowBackOutline')).toBeVisible();
				userEvent.click(screen.getByTestId('icon: ArrowBackOutline'));
				const listHeader = screen.getByTestId('list-header', { exact: false });
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
