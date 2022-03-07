/*
 * SPDX-FileCopyrightText: 2022 Zextras <https://www.zextras.com>
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import React from 'react';

import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import 'jest-styled-components';
import { find as findStyled } from 'styled-components/test-utils';

import { ROOTS } from '../../constants';
import {
	populateFile,
	populateFolder,
	populateLocalRoot,
	populateNodes
} from '../../mocks/mockUtils';
import { Node } from '../../types/common';
import { GetRootsListQuery, GetRootsListQueryVariables } from '../../types/graphql/types';
import { isFile } from '../../utils/ActionsFactory';
import {
	getChildrenVariables,
	getFindNodesVariables,
	mockFindNodes,
	mockGetBaseNode,
	mockGetChildren,
	mockGetPath,
	mockGetRootsList
} from '../../utils/mockUtils';
import { buildBreadCrumbRegExp, render } from '../../utils/testUtils';
import { NodesSelectionModalContent } from './NodesSelectionModalContent';
import { HoverContainer } from './StyledComponents';

let confirmAction: jest.Mock;
let closeAction: jest.Mock;

beforeEach(() => {
	confirmAction = jest.fn();
	closeAction = jest.fn();
});

describe('Nodes Selection Modal Content', () => {
	describe('without criteria to disable nodes, single selection', () => {
		test('show roots by default. confirm button is disabled', async () => {
			render(
				<NodesSelectionModalContent
					confirmAction={confirmAction}
					confirmLabel="Select"
					title="Select nodes"
					closeAction={closeAction}
				/>,
				{
					mocks: []
				}
			);

			await screen.findByText('Select nodes');
			await screen.findByText(/home/i);
			expect(screen.getByText('Home')).toBeVisible();
			expect(screen.getByText('Shared with me')).toBeVisible();
			expect(screen.queryByText('Trash')).not.toBeInTheDocument();
			const confirmButton = screen.getByRole('button', { name: /select/i });
			expect(confirmButton).toBeVisible();
			expect(confirmButton).toHaveAttribute('disabled');
			userEvent.click(confirmButton);
			// wait a tick to be sure rerender operations are done
			await waitFor(
				() =>
					new Promise((resolve) => {
						setTimeout(resolve, 0);
					})
			);
			expect(confirmAction).not.toHaveBeenCalled();
		});

		test('folder node is a valid selection', async () => {
			const localRoot = populateLocalRoot();
			const folder = populateFolder();
			const file = populateFile();
			localRoot.children = [folder, file];
			folder.parent = localRoot;
			file.parent = localRoot;

			const mocks = [
				mockGetPath({ node_id: localRoot.id }, [localRoot]),
				mockGetChildren(getChildrenVariables(localRoot.id), localRoot)
			];

			const { findByTextWithMarkup } = render(
				<NodesSelectionModalContent
					confirmAction={confirmAction}
					confirmLabel="Select"
					title="Select nodes"
					closeAction={closeAction}
				/>,
				{
					mocks
				}
			);
			await screen.findByText(/home/i);
			userEvent.dblClick(screen.getByText(/home/i));
			await screen.findByText(folder.name);
			await findByTextWithMarkup(buildBreadCrumbRegExp('Files', localRoot.name));
			const confirmButton = screen.getByRole('button', { name: /select/i });
			// click on a folder enable confirm button
			userEvent.click(screen.getByText(folder.name));
			// confirm button is active
			await waitFor(() => expect(confirmButton).not.toHaveAttribute('disabled', ''));
			// click on confirm button
			act(() => {
				userEvent.click(confirmButton);
			});
			expect(confirmAction).toHaveBeenCalled();
			expect(confirmAction).toHaveBeenCalledWith(
				expect.arrayContaining([
					expect.objectContaining({
						id: folder.id,
						name: folder.name
					})
				])
			);
			// confirm leave selection as it is in the modal
			expect(confirmButton).not.toHaveAttribute('disabled', '');
			// click on a file
			act(() => {
				userEvent.click(screen.getByText(file.name));
			});
			// confirm button becomes active
			await waitFor(() => expect(confirmButton).not.toHaveAttribute('disabled', ''));
			// click on confirm button
			act(() => {
				userEvent.click(confirmButton);
			});
			expect(confirmAction).toHaveBeenCalled();
			expect(confirmAction).toHaveBeenCalledWith(
				expect.arrayContaining([
					expect.objectContaining({
						id: file.id,
						name: file.name
					})
				])
			);
		});

		test('file node is a valid selection', async () => {
			const localRoot = populateLocalRoot();
			const folder = populateFolder();
			const file = populateFile();
			localRoot.children = [folder, file];
			folder.parent = localRoot;
			file.parent = localRoot;

			const mocks = [
				mockGetPath({ node_id: localRoot.id }, [localRoot]),
				mockGetChildren(getChildrenVariables(localRoot.id), localRoot)
			];

			const { findByTextWithMarkup } = render(
				<NodesSelectionModalContent
					confirmAction={confirmAction}
					confirmLabel="Select"
					title="Select nodes"
					closeAction={closeAction}
				/>,
				{
					mocks
				}
			);
			await screen.findByText(/home/i);
			userEvent.dblClick(screen.getByText(/home/i));
			await screen.findByText(folder.name);
			await findByTextWithMarkup(buildBreadCrumbRegExp('Files', localRoot.name));
			const confirmButton = screen.getByRole('button', { name: /select/i });
			// click on a file
			act(() => {
				userEvent.click(screen.getByText(file.name));
			});
			// confirm button becomes active
			await waitFor(() => expect(confirmButton).not.toHaveAttribute('disabled', ''));
			// click on confirm button
			act(() => {
				userEvent.click(confirmButton);
			});
			expect(confirmAction).toHaveBeenCalled();
			expect(confirmAction).toHaveBeenCalledWith(
				expect.arrayContaining([
					expect.objectContaining({
						id: file.id,
						name: file.name
					})
				])
			);
		});

		test('confirm button is enabled when navigating inside a folder', async () => {
			const localRoot = populateLocalRoot();
			const folder = populateFolder();
			const file = populateFile();
			localRoot.children = [folder, file];
			folder.parent = localRoot;
			file.parent = localRoot;

			const mocks = [
				mockGetRootsList(),
				mockGetPath({ node_id: localRoot.id }, [localRoot]),
				mockGetChildren(getChildrenVariables(localRoot.id), localRoot),
				mockGetBaseNode({ node_id: localRoot.id }, localRoot)
			];

			const { findByTextWithMarkup } = render(
				<NodesSelectionModalContent
					confirmAction={confirmAction}
					confirmLabel="Select"
					title="Select nodes"
					closeAction={closeAction}
				/>,
				{
					mocks
				}
			);
			await screen.findByText(/home/i);
			// wait for root list query to be executed
			await waitFor(() =>
				expect(
					global.apolloClient.readQuery<GetRootsListQuery, GetRootsListQueryVariables>(
						mockGetRootsList().request
					)?.getRootsList || null
				).not.toBeNull()
			);
			// confirm button is disabled
			let confirmButton = screen.getByRole('button', { name: /select/i });
			expect(confirmButton).toBeVisible();
			expect(confirmButton).toHaveAttribute('disabled', '');
			userEvent.dblClick(screen.getByText(/home/i));
			await screen.findByText(folder.name);
			const breadcrumbItem = await findByTextWithMarkup(
				buildBreadCrumbRegExp('Files', localRoot.name)
			);
			expect(breadcrumbItem).toBeVisible();
			expect(screen.getByText(folder.name)).toBeVisible();
			expect(screen.getByText(file.name)).toBeVisible();
			// all nodes are enabled
			expect(screen.getByTestId(`node-item-${file.id}`)).not.toHaveAttribute('disabled', '');
			expect(screen.getByTestId(`node-item-${folder.id}`)).not.toHaveAttribute('disabled', '');
			expect(screen.getByTestId(`node-item-${folder.id}`)).not.toHaveAttribute('disabled', '');
			// confirm button is enabled because navigation set opened folder as selected node
			confirmButton = screen.getByRole('button', { name: /select/i });
			expect(confirmButton).toBeVisible();
			expect(confirmButton).not.toHaveAttribute('disabled', '');
			act(() => {
				userEvent.click(confirmButton);
			});
			expect(confirmAction).toHaveBeenCalled();
			expect(confirmAction).toHaveBeenCalledWith(
				expect.arrayContaining([expect.objectContaining({ id: localRoot.id })])
			);
			// confirm leave selection as it is and button remains enabled
			expect(confirmButton).not.toHaveAttribute('disabled', '');
		});

		test('local root item is valid, other roots are not valid', async () => {
			const localRoot = populateFolder(2, ROOTS.LOCAL_ROOT);

			const mocks = [mockGetRootsList(), mockGetBaseNode({ node_id: localRoot.id }, localRoot)];

			const { findByTextWithMarkup } = render(
				<NodesSelectionModalContent
					confirmAction={confirmAction}
					confirmLabel="Select"
					title="Select nodes"
					closeAction={closeAction}
				/>,
				{
					mocks
				}
			);

			await screen.findByText(/home/i);
			// wait for root list query to be executed
			await waitFor(() =>
				expect(
					global.apolloClient.readQuery<GetRootsListQuery, GetRootsListQueryVariables>(
						mockGetRootsList().request
					)?.getRootsList || null
				).not.toBeNull()
			);
			const breadcrumbItem = await findByTextWithMarkup(buildBreadCrumbRegExp('Files'));
			expect(breadcrumbItem).toBeVisible();
			expect(screen.getByText(/home/i)).toBeVisible();
			// confirm button is disabled
			const confirmButton = screen.getByRole('button', { name: /select/i });
			expect(confirmButton).toBeVisible();
			expect(confirmButton).toHaveAttribute('disabled', '');
			// click on other root
			act(() => {
				userEvent.click(screen.getByText(/shared with me/i));
			});
			// item is not a valid selection
			expect(confirmButton).toHaveAttribute('disabled', '');
			act(() => {
				userEvent.click(screen.getByText(/home/i));
			});
			// confirm button becomes enabled because local root is a valid selection
			await waitFor(() => expect(confirmButton).not.toHaveAttribute('disabled', ''));
			// ugly but it's the only way to check the item is visibly active
			expect(
				findStyled(screen.getByTestId(`node-item-${localRoot.id}`), HoverContainer)
			).toHaveStyle('background-color: #d5e3f6');
			act(() => {
				userEvent.click(confirmButton);
			});
			expect(confirmAction).toHaveBeenCalledWith(
				expect.arrayContaining([expect.objectContaining({ id: localRoot.id })])
			);
		});

		test('navigation through breadcrumb reset active folder', async () => {
			const localRoot = populateFolder(2, ROOTS.LOCAL_ROOT);
			const folder = populateFolder();
			localRoot.children.push(folder);
			folder.parent = localRoot;

			const mocks = [
				mockGetRootsList(),
				mockGetBaseNode({ node_id: localRoot.id }, localRoot),
				mockGetPath({ node_id: localRoot.id }, [localRoot]),
				mockGetChildren(getChildrenVariables(localRoot.id), localRoot),
				mockGetPath({ node_id: folder.id }, [localRoot, folder]),
				mockGetChildren(getChildrenVariables(folder.id), folder)
			];

			const { findByTextWithMarkup } = render(
				<NodesSelectionModalContent
					confirmAction={confirmAction}
					confirmLabel="Select"
					title="Select nodes"
					closeAction={closeAction}
				/>,
				{
					mocks
				}
			);

			await screen.findByText(/home/i);
			// wait for root list query to be executed
			await waitFor(() =>
				expect(
					global.apolloClient.readQuery<GetRootsListQuery, GetRootsListQueryVariables>(
						mockGetRootsList().request
					)?.getRootsList || null
				).not.toBeNull()
			);
			let breadcrumbItem = await findByTextWithMarkup(buildBreadCrumbRegExp('Files'));
			expect(breadcrumbItem).toBeVisible();
			expect(screen.getByText(/home/i)).toBeVisible();
			act(() => {
				userEvent.click(screen.getByText(/home/i));
			});
			// ugly but it's the only way to check the item is visibly active
			await waitFor(() =>
				expect(
					findStyled(screen.getByTestId(`node-item-${localRoot.id}`), HoverContainer)
				).toHaveStyle('background-color: #d5e3f6')
			);
			userEvent.dblClick(screen.getByText(/home/i));
			await screen.findByText(folder.name);
			expect(screen.getByText(folder.name)).toBeVisible();
			expect(screen.getByText((localRoot.children[0] as Node).name)).toBeVisible();
			breadcrumbItem = await findByTextWithMarkup(
				buildBreadCrumbRegExp('Files', folder.parent.name)
			);
			expect(breadcrumbItem).toBeVisible();
			// confirm button is disabled because of navigation
			const confirmButton = screen.getByRole('button', { name: /select/i });
			expect(confirmButton).toBeVisible();
			expect(confirmButton).not.toHaveAttribute('disabled', '');
			// navigate back to the roots list through breadcrumb
			act(() => {
				userEvent.click(screen.getByText('Files'));
			});
			// wait roots list to be rendered
			await screen.findByText(/home/i);
			expect(screen.queryByText(folder.name)).not.toBeInTheDocument();
			expect(screen.getByText(/home/i)).toBeVisible();
			expect(screen.getByText(/shared with me/i)).toBeVisible();
			// confirm button is disabled because is now referring the entry point, which is not valid
			expect(confirmButton).toHaveAttribute('disabled', '');
			// local root item is not visibly active
			expect(
				findStyled(screen.getByTestId(`node-item-${localRoot.id}`), HoverContainer)
			).not.toHaveStyle('background-color: #d5e3f6');
			act(() => {
				userEvent.click(confirmButton);
			});
			expect(confirmAction).not.toHaveBeenCalled();
			// navigate again inside local root
			userEvent.dblClick(screen.getByText(/home/i));
			await screen.findByText(folder.name);
			expect(screen.getByText(folder.name)).toBeVisible();
			expect(screen.getByText((localRoot.children[0] as Node).name)).toBeVisible();
			breadcrumbItem = await findByTextWithMarkup(
				buildBreadCrumbRegExp('Files', folder.parent.name)
			);
			expect(breadcrumbItem).toBeVisible();
			// confirm button is disabled
			expect(confirmButton).toBeVisible();
			expect(confirmButton).not.toHaveAttribute('disabled', '');
			act(() => {
				userEvent.click(confirmButton);
			});
			expect(confirmAction).toHaveBeenCalled();
			expect(confirmAction).toHaveBeenCalledWith(
				expect.arrayContaining([
					expect.objectContaining({
						id: localRoot.id,
						name: localRoot.name
					})
				])
			);
			// select a valid node
			act(() => {
				userEvent.click(screen.getByText(folder.name));
			});
			// confirm button is active because folder is a valid selection
			await waitFor(() => expect(confirmButton).not.toHaveAttribute('disabled', ''));
			act(() => {
				userEvent.click(confirmButton);
			});
			expect(confirmAction).toHaveBeenCalled();
			expect(confirmAction).toHaveBeenCalledWith(
				expect.arrayContaining([
					expect.objectContaining({
						id: folder.id,
						name: folder.name
					})
				])
			);
		});

		test('shared with me root is navigable', async () => {
			const sharedWithMeFilter = populateNodes(4);
			const mocks = [
				mockGetRootsList(),
				mockFindNodes(
					getFindNodesVariables({
						shared_with_me: true,
						cascade: false,
						folder_id: ROOTS.LOCAL_ROOT
					}),
					sharedWithMeFilter
				)
			];
			const { getByTextWithMarkup } = render(
				<NodesSelectionModalContent
					confirmAction={confirmAction}
					confirmLabel="Select"
					title="Select nodes"
					closeAction={closeAction}
				/>,
				{
					mocks
				}
			);

			await screen.findByText(/home/i);
			// wait for root list query to be executed
			await waitFor(() =>
				expect(
					global.apolloClient.readQuery<GetRootsListQuery, GetRootsListQueryVariables>(
						mockGetRootsList().request
					)?.getRootsList || null
				).not.toBeNull()
			);
			expect(screen.getByText(/shared with me/i)).toBeVisible();
			const confirmButton = screen.getByRole('button', { name: /select/i });
			expect(confirmButton).toBeVisible();
			// confirm button is disabled because entry point is not a valid selection
			expect(confirmButton).toHaveAttribute('disabled', '');
			userEvent.click(screen.getByText(/shared with me/i));
			// shared with me item is not a valid selection
			expect(confirmButton).toHaveAttribute('disabled', '');
			act(() => {
				userEvent.click(confirmButton);
			});
			expect(confirmAction).not.toHaveBeenCalled();
			expect(screen.queryByText(/trash/i)).not.toBeInTheDocument();
			// navigate inside shared with me
			userEvent.dblClick(screen.getByText(/shared with me/i));
			await screen.findByText(sharedWithMeFilter[0].name);
			expect(screen.getByText(sharedWithMeFilter[0].name)).toBeVisible();
			expect(getByTextWithMarkup(buildBreadCrumbRegExp('Files', 'Shared with me'))).toBeVisible();
			expect(confirmButton).toHaveAttribute('disabled', '');
			act(() => {
				userEvent.click(confirmButton);
			});
			expect(confirmAction).not.toHaveBeenCalled();
		});

		test('confirm action is called with array containing active item after click on shared node', async () => {
			const filter = populateNodes(2);
			const folder = populateFolder(3);
			filter.push(folder);
			const mocks = [
				mockFindNodes(
					getFindNodesVariables({
						shared_with_me: true,
						cascade: false,
						folder_id: ROOTS.LOCAL_ROOT
					}),
					filter
				)
			];

			render(
				<NodesSelectionModalContent
					confirmAction={confirmAction}
					confirmLabel="Select"
					title="Select nodes"
					closeAction={closeAction}
				/>,
				{
					mocks
				}
			);
			await screen.findByText(/shared with me/i);
			userEvent.dblClick(screen.getByText(/shared with me/i));
			await screen.findByText(folder.name);
			expect(screen.getByText(filter[0].name)).toBeVisible();
			expect(screen.getByText(folder.name)).toBeVisible();
			const confirmButton = screen.getByRole('button', { name: /select/i });
			expect(confirmButton).toHaveAttribute('disabled', '');
			act(() => {
				userEvent.click(screen.getByText(folder.name));
			});
			await waitFor(() => expect(confirmButton).not.toHaveAttribute('disabled', ''));
			act(() => {
				userEvent.click(confirmButton);
			});
			expect(confirmAction).toHaveBeenCalled();
			expect(confirmAction).toHaveBeenLastCalledWith(
				expect.arrayContaining([expect.objectContaining({ id: folder.id, name: folder.name })])
			);
		});
	});

	describe('only files are selectable', () => {
		test('folders are still navigable but not selectable', async () => {
			const localRoot = populateLocalRoot();
			const file = populateFile();
			const folder = populateFolder(1);
			localRoot.children = [folder, file];
			folder.parent = localRoot;
			file.parent = localRoot;

			const isValidSelection = jest
				.fn()
				.mockImplementation((node: Pick<Node, '__typename'>) => isFile(node));

			const mocks = [
				mockGetRootsList(),
				mockGetBaseNode({ node_id: localRoot.id }, localRoot),
				mockGetPath({ node_id: localRoot.id }, [localRoot]),
				mockGetChildren(getChildrenVariables(localRoot.id), localRoot)
			];

			render(
				<NodesSelectionModalContent
					title="Only files"
					confirmAction={confirmAction}
					confirmLabel="Confirm"
					closeAction={closeAction}
					isValidSelection={isValidSelection}
				/>,
				{ mocks }
			);

			await screen.findByText(/home/i);
			// wait for root list query to be executed
			await waitFor(() =>
				expect(
					global.apolloClient.readQuery<GetRootsListQuery, GetRootsListQueryVariables>(
						mockGetRootsList().request
					)?.getRootsList || null
				).not.toBeNull()
			);

			// navigate inside home
			userEvent.dblClick(screen.getByText(/home/i));
			await screen.findByText(folder.name);
			expect(screen.getByText(folder.name)).toBeVisible();
			expect(screen.getByText(file.name)).toBeVisible();
			// folder is not disabled
			expect(screen.getByTestId(`node-item-${folder.id}`)).not.toHaveAttribute('disabled', '');
			// file is not disabled
			expect(screen.getByTestId(`node-item-${file.id}`)).not.toHaveAttribute('disabled', '');
			const confirmButton = screen.getByRole('button', { name: /confirm/i });
			// confirm button is disabled because local root is not a file
			expect(confirmButton).toHaveAttribute('disabled', '');
			// click on folder
			act(() => {
				userEvent.click(screen.getByText(folder.name));
			});
			// confirm button remains disabled
			expect(confirmButton).toHaveAttribute('disabled', '');
			// wait a tick to get getBaseNode time to complete
			await waitFor(
				() =>
					new Promise((resolve) => {
						setTimeout(resolve, 0);
					})
			);
			// click on file
			act(() => {
				userEvent.click(screen.getByText(file.name));
			});
			// confirm button becomes enabled
			await waitFor(() => expect(confirmButton).not.toHaveAttribute('disabled', ''));
			act(() => {
				userEvent.click(confirmButton);
			});
			expect(confirmAction).toHaveBeenCalled();
			expect(confirmAction).toHaveBeenCalledWith([
				expect.objectContaining({ id: file.id, name: file.name })
			]);
		});
	});
});
