/*
 * SPDX-FileCopyrightText: 2022 Zextras <https://www.zextras.com>
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import React from 'react';

import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import 'jest-styled-components';
import forEach from 'lodash/forEach';
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
import { isFile, isFolder } from '../../utils/ActionsFactory';
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
	test('title and description are visible if set', async () => {
		const mocks = [mockGetRootsList()];
		render(
			<NodesSelectionModalContent
				confirmAction={confirmAction}
				confirmLabel="Confirm label"
				title="This is the title"
				closeAction={closeAction}
				description="This is the description"
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
		expect(screen.getByText('This is the title')).toBeVisible();
		expect(screen.getByText('This is the description')).toBeVisible();
		expect(screen.getByText(/confirm label/i)).toBeVisible();
	});

	test('Opened folder is a selectable node by param and by the validity check. Confirm button is enabled on navigation', async () => {
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

		const isValidSelection = jest.fn().mockReturnValue(() => true);

		const { findByTextWithMarkup } = render(
			<NodesSelectionModalContent
				confirmAction={confirmAction}
				confirmLabel="Select"
				title="Select nodes"
				closeAction={closeAction}
				canSelectOpenedFolder
				maxSelection={undefined}
				isValidSelection={isValidSelection}
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
		const confirmButton = screen.getByRole('button', { name: /select/i });
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
		// confirm button becomes enabled because opened folder is valid both by param and by validity check
		await waitFor(() => expect(confirmButton).not.toHaveAttribute('disabled', ''));
		expect(isValidSelection).toHaveBeenCalled();
		expect(isValidSelection).toHaveBeenLastCalledWith(
			expect.objectContaining({ id: localRoot.id })
		);
		act(() => {
			userEvent.click(confirmButton);
		});
		expect(confirmAction).toHaveBeenCalled();
		expect(confirmAction).toHaveBeenCalledWith([expect.objectContaining({ id: localRoot.id })]);
	});

	test('Opened folder is a selectable node by param and but not by the validity check. Confirm button is disabled on navigation', async () => {
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

		const isValidSelection = jest
			.fn()
			.mockImplementation(({ id }: { id: string }) => id !== localRoot.id);

		const { findByTextWithMarkup } = render(
			<NodesSelectionModalContent
				confirmAction={confirmAction}
				confirmLabel="Select"
				title="Select nodes"
				closeAction={closeAction}
				canSelectOpenedFolder
				maxSelection={undefined}
				isValidSelection={isValidSelection}
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
		const confirmButton = screen.getByRole('button', { name: /select/i });
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
		// wait a tick to allow getBaseNode query to complete
		await waitFor(
			() =>
				new Promise((resolve) => {
					setTimeout(resolve, 0);
				})
		);
		// confirm button remains disabled because opened folder is not valid by validity check
		expect(confirmButton).toHaveAttribute('disabled', '');
		expect(isValidSelection).toHaveBeenCalled();
		expect(isValidSelection).toHaveBeenLastCalledWith(
			expect.objectContaining({ id: localRoot.id })
		);
		act(() => {
			userEvent.click(confirmButton);
		});
		expect(confirmAction).not.toHaveBeenCalled();
	});

	test('Opened folder is not a selectable node by param and but it is by the validity check. Confirm button is disabled on navigation', async () => {
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

		const isValidSelection = jest.fn().mockReturnValue(true);

		const { findByTextWithMarkup } = render(
			<NodesSelectionModalContent
				confirmAction={confirmAction}
				confirmLabel="Select"
				title="Select nodes"
				closeAction={closeAction}
				canSelectOpenedFolder={false}
				maxSelection={undefined}
				isValidSelection={isValidSelection}
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
		const confirmButton = screen.getByRole('button', { name: /select/i });
		expect(confirmButton).toBeVisible();
		expect(confirmButton).toHaveAttribute('disabled', '');
		// reset number of calls
		isValidSelection.mockReset();
		userEvent.dblClick(screen.getByText(/home/i));
		await screen.findByText(folder.name);
		const breadcrumbItem = await findByTextWithMarkup(
			buildBreadCrumbRegExp('Files', localRoot.name)
		);
		expect(breadcrumbItem).toBeVisible();
		expect(screen.getByText(folder.name)).toBeVisible();
		expect(screen.getByText(file.name)).toBeVisible();
		// wait a tick to allow getBaseNode query to complete
		await waitFor(
			() =>
				new Promise((resolve) => {
					setTimeout(resolve, 0);
				})
		);
		// confirm button remains disabled because opened folder is not valid by validity check
		expect(confirmButton).toHaveAttribute('disabled', '');
		expect(isValidSelection).not.toHaveBeenCalledWith(
			expect.objectContaining({ id: localRoot.id })
		);
		act(() => {
			userEvent.click(confirmButton);
		});
		expect(confirmAction).not.toHaveBeenCalled();
	});

	test('Non selectable nodes show a tooltip on hover if provided', async () => {
		const mocks = [mockGetRootsList()];

		const isValidSelection = jest.fn().mockReturnValue(false);

		render(
			<NodesSelectionModalContent
				confirmAction={confirmAction}
				confirmLabel="Select"
				title="Select nodes"
				closeAction={closeAction}
				canSelectOpenedFolder={false}
				maxSelection={undefined}
				isValidSelection={isValidSelection}
				disabledTooltip="Node is not selectable"
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
		expect(screen.getByText(/home/i)).toBeVisible();
		expect(screen.getByText(/shared with me/i)).toBeVisible();
		const nodeAvatarIcons = screen.getAllByTestId('file-icon-preview');
		expect(nodeAvatarIcons).toHaveLength(2);
		expect(nodeAvatarIcons[0]).not.toHaveAttribute('disabled', '');
		expect(nodeAvatarIcons[1]).not.toHaveAttribute('disabled', '');
		act(() => {
			userEvent.hover(nodeAvatarIcons[0]);
		});
		await screen.findByText('Node is not selectable');
		expect(screen.getByText('Node is not selectable')).toBeVisible();
		act(() => {
			userEvent.unhover(nodeAvatarIcons[0]);
		});
		expect(screen.queryByText('Node is not selectable')).not.toBeInTheDocument();
		act(() => {
			userEvent.hover(nodeAvatarIcons[1]);
		});
		await screen.findByText('Node is not selectable');
		expect(screen.getByText('Node is not selectable')).toBeVisible();
		act(() => {
			userEvent.unhover(nodeAvatarIcons[1]);
		});
		expect(screen.queryByText('Node is not selectable')).not.toBeInTheDocument();
	});

	describe('Single selection', () => {
		test('number of selected items is not visible', async () => {
			const localRoot = populateLocalRoot();
			const mocks = [mockGetRootsList(), mockGetBaseNode({ node_id: localRoot.id }, localRoot)];

			render(
				<NodesSelectionModalContent
					confirmAction={confirmAction}
					confirmLabel="Confirm"
					title="This is the title"
					closeAction={closeAction}
					description="This is the description"
					maxSelection={1}
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
			const confirmButton = screen.getByRole('button', { name: /confirm/i });
			expect(confirmButton).toHaveAttribute('disabled', '');
			act(() => {
				userEvent.click(screen.getByText(/home/i));
			});
			await waitFor(() => expect(confirmButton).not.toHaveAttribute('disabled', ''));
			expect(screen.queryByText(/element selected/i)).not.toBeInTheDocument();
		});

		describe('without criteria to select nodes', () => {
			test('show roots by default. confirm button is disabled', async () => {
				render(
					<NodesSelectionModalContent
						confirmAction={confirmAction}
						confirmLabel="Select"
						title="Select nodes"
						closeAction={closeAction}
						maxSelection={1}
					/>,
					{
						mocks: [mockGetRootsList()]
					}
				);

				await screen.findByText('Select nodes');
				await screen.findByText(/home/i);
				// wait for root list query to be executed
				await waitFor(() =>
					expect(
						global.apolloClient.readQuery<GetRootsListQuery, GetRootsListQueryVariables>(
							mockGetRootsList().request
						)?.getRootsList || null
					).not.toBeNull()
				);
				expect(screen.getByText('Home')).toBeVisible();
				expect(screen.getByText('Shared with me')).toBeVisible();
				expect(screen.queryByText('Trash')).not.toBeInTheDocument();
				const confirmButton = screen.getByRole('button', { name: /select/i });
				expect(confirmButton).toBeVisible();
				expect(confirmButton).toHaveAttribute('disabled');
				act(() => {
					userEvent.click(confirmButton);
				});
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
					mockGetRootsList(),
					mockGetBaseNode({ node_id: localRoot.id }, localRoot),
					mockGetPath({ node_id: localRoot.id }, [localRoot]),
					mockGetChildren(getChildrenVariables(localRoot.id), localRoot)
				];

				const { findByTextWithMarkup } = render(
					<NodesSelectionModalContent
						confirmAction={confirmAction}
						confirmLabel="Select"
						title="Select nodes"
						closeAction={closeAction}
						maxSelection={1}
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
				await waitFor(() => expect(confirmAction).toHaveBeenCalled());
				expect(confirmAction).toHaveBeenCalledWith(
					expect.arrayContaining([
						expect.objectContaining({
							id: folder.id,
							name: folder.name
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
					mockGetRootsList(),
					mockGetBaseNode({ node_id: localRoot.id }, localRoot),
					mockGetPath({ node_id: localRoot.id }, [localRoot]),
					mockGetChildren(getChildrenVariables(localRoot.id), localRoot)
				];

				const { findByTextWithMarkup } = render(
					<NodesSelectionModalContent
						confirmAction={confirmAction}
						confirmLabel="Select"
						title="Select nodes"
						closeAction={closeAction}
						maxSelection={1}
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

			test('confirm button is enabled when navigating inside a folder if opened folder is selectable by param', async () => {
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
						canSelectOpenedFolder
						maxSelection={1}
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

			test('confirm button is disabled when navigating inside a folder if opened folder is not selectable by param', async () => {
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
						canSelectOpenedFolder={false}
						maxSelection={1}
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
				expect(confirmButton).toHaveAttribute('disabled', '');
				act(() => {
					userEvent.click(confirmButton);
				});
				expect(confirmAction).not.toHaveBeenCalled();
				// confirm leave selection as it is and button remains disabled
				expect(confirmButton).toHaveAttribute('disabled', '');
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
						maxSelection={1}
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

			test('navigation through breadcrumb reset active folder and set opened folder if is selectable by param', async () => {
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
						canSelectOpenedFolder
						maxSelection={1}
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
				// confirm button is enabled because of navigation
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

			test('navigation through breadcrumb reset active folder and disable confirm button if opened folder is not selectable by param', async () => {
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
						maxSelection={1}
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
				breadcrumbItem = await findByTextWithMarkup(buildBreadCrumbRegExp('Files', localRoot.name));
				expect(breadcrumbItem).toBeVisible();
				// confirm button is disabled because of navigation
				const confirmButton = screen.getByRole('button', { name: /select/i });
				expect(confirmButton).toBeVisible();
				expect(confirmButton).toHaveAttribute('disabled', '');
				// navigate inside a sub-folder
				userEvent.dblClick(screen.getByText(folder.name));
				await screen.findByText(/nothing here/i);
				await findByTextWithMarkup(buildBreadCrumbRegExp('Files', localRoot.name, folder.name));
				// navigate back to the local root through breadcrumb
				act(() => {
					userEvent.click(screen.getByText(localRoot.name));
				});
				// wait roots list to be rendered
				await screen.findByText(folder.name);
				expect(screen.queryByText(/nothing here/i)).not.toBeInTheDocument();
				expect(screen.getByText(folder.name)).toBeVisible();
				// confirm button is disabled because opened folder is not selectable by param
				expect(confirmButton).toHaveAttribute('disabled', '');
				act(() => {
					userEvent.click(confirmButton);
				});
				expect(confirmAction).not.toHaveBeenCalled();
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
						maxSelection={1}
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
					mockGetRootsList(),
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
						maxSelection={1}
					/>,
					{
						mocks
					}
				);
				await screen.findByText(/shared with me/i);
				// wait for root list query to be executed
				await waitFor(() =>
					expect(
						global.apolloClient.readQuery<GetRootsListQuery, GetRootsListQueryVariables>(
							mockGetRootsList().request
						)?.getRootsList || null
					).not.toBeNull()
				);
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

		describe('with criteria to select nodes', () => {
			test('only files are selectable; folders are still navigable but not selectable', async () => {
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
						maxSelection={1}
						canSelectOpenedFolder
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

			test('only folders are selectable; folders are navigable and selectable, files are fully disabled', async () => {
				const localRoot = populateLocalRoot();
				const file = populateFile();
				const folder = populateFolder(1);
				localRoot.children = [folder, file];
				folder.parent = localRoot;
				file.parent = localRoot;

				const isValidSelection = jest
					.fn()
					.mockImplementation((node: Pick<Node, '__typename'>) => isFolder(node));

				const mocks = [
					mockGetRootsList(),
					mockGetBaseNode({ node_id: localRoot.id }, localRoot),
					mockGetPath({ node_id: localRoot.id }, [localRoot]),
					mockGetChildren(getChildrenVariables(localRoot.id), localRoot)
				];

				render(
					<NodesSelectionModalContent
						title="Only folders"
						confirmAction={confirmAction}
						confirmLabel="Confirm"
						closeAction={closeAction}
						isValidSelection={isValidSelection}
						maxSelection={1}
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
				// file is disabled
				expect(screen.getByTestId(`node-item-${file.id}`)).toHaveAttribute('disabled', '');
				const confirmButton = screen.getByRole('button', { name: /confirm/i });
				// confirm button is disabled because local root is not selectable by param
				expect(confirmButton).toHaveAttribute('disabled', '');
				// click on folder
				act(() => {
					userEvent.click(screen.getByText(folder.name));
				});
				// confirm button becomes enabled
				expect(confirmButton).not.toHaveAttribute('disabled', '');
				// click on file
				act(() => {
					userEvent.click(screen.getByText(file.name));
				});
				// confirm button becomes disabled
				expect(confirmButton).toHaveAttribute('disabled', '');
				// click again on folder
				act(() => {
					userEvent.click(screen.getByText(folder.name));
				});
				// confirm button becomes enabled
				expect(confirmButton).not.toHaveAttribute('disabled', '');
				act(() => {
					userEvent.click(confirmButton);
				});
				expect(confirmAction).toHaveBeenCalled();
				expect(confirmAction).toHaveBeenCalledWith([
					expect.objectContaining({ id: folder.id, name: folder.name })
				]);
			});

			test('custom validity check set nodes that are not a valid selection as disabled. Folders remain navigable, files are fully disabled', async () => {
				const localRoot = populateLocalRoot();
				const validFile = populateFile(undefined, 'valid file');
				const validFolder = populateFolder(1, undefined, 'valid folder');
				const invalidFile = populateFile(undefined, 'not valid file');
				const invalidFolder = populateFolder(0, undefined, 'not valid folder');
				localRoot.children.push(validFile, validFolder, invalidFile, invalidFolder);
				validFolder.parent = localRoot;
				validFile.parent = localRoot;
				invalidFolder.parent = localRoot;
				invalidFile.parent = localRoot;

				const isValidSelection = jest
					.fn()
					.mockImplementation((node: Pick<Node, 'name'>) => node.name.startsWith('valid'));

				const mocks = [
					mockGetRootsList(),
					mockGetBaseNode({ node_id: localRoot.id }, localRoot),
					mockGetPath({ node_id: localRoot.id }, [localRoot]),
					mockGetChildren(getChildrenVariables(localRoot.id), localRoot),
					mockGetChildren(getChildrenVariables(invalidFolder.id), invalidFolder),
					mockGetPath({ node_id: invalidFolder.id }, [localRoot, invalidFolder])
				];

				const { findByTextWithMarkup } = render(
					<NodesSelectionModalContent
						title="Custom selector"
						confirmAction={confirmAction}
						confirmLabel="Confirm"
						closeAction={closeAction}
						isValidSelection={isValidSelection}
						maxSelection={1}
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
				await screen.findByText(validFolder.name);
				expect(screen.getByText(validFolder.name)).toBeVisible();
				expect(screen.getByText(validFile.name)).toBeVisible();
				expect(screen.getByText((localRoot.children[0] as Node).name)).toBeVisible();
				// valid folder is not disabled
				expect(screen.getByTestId(`node-item-${validFolder.id}`)).not.toHaveAttribute(
					'disabled',
					''
				);
				// valid file is not disabled
				expect(screen.getByTestId(`node-item-${validFile.id}`)).not.toHaveAttribute('disabled', '');
				// invalid file is disabled
				expect(screen.getByTestId(`node-item-${invalidFile.id}`)).toHaveAttribute('disabled', '');
				// invalid folder is not disabled because is navigable
				expect(screen.getByTestId(`node-item-${invalidFolder.id}`)).not.toHaveAttribute(
					'disabled',
					''
				);
				const confirmButton = screen.getByRole('button', { name: /confirm/i });
				// confirm button is disabled because local root is not selectable by param
				expect(confirmButton).toHaveAttribute('disabled', '');
				// click on valid folder
				act(() => {
					userEvent.click(screen.getByText(validFolder.name));
				});
				// confirm button becomes enabled
				expect(confirmButton).not.toHaveAttribute('disabled', '');
				act(() => {
					userEvent.click(confirmButton);
				});
				expect(confirmAction).toHaveBeenCalledTimes(1);
				expect(confirmAction).toHaveBeenCalledWith([
					expect.objectContaining({ id: validFolder.id, name: validFolder.name })
				]);
				// click on invalid folder
				act(() => {
					userEvent.click(screen.getByText(invalidFolder.name));
				});
				// confirm button becomes disabled
				expect(confirmButton).toHaveAttribute('disabled', '');
				act(() => {
					userEvent.click(confirmButton);
				});
				expect(confirmAction).toHaveBeenCalledTimes(1);
				// click on valid file
				act(() => {
					userEvent.click(screen.getByText(validFile.name));
				});
				// confirm button becomes enabled
				expect(confirmButton).not.toHaveAttribute('disabled', '');
				act(() => {
					userEvent.click(confirmButton);
				});
				expect(confirmAction).toHaveBeenCalledTimes(2);
				expect(confirmAction).toHaveBeenLastCalledWith([
					expect.objectContaining({ id: validFile.id, name: validFile.name })
				]);
				// click on invalid file
				act(() => {
					userEvent.click(screen.getByText(invalidFile.name));
				});
				// confirm button remains disabled
				expect(confirmButton).toHaveAttribute('disabled', '');
				act(() => {
					userEvent.click(confirmButton);
				});
				expect(confirmAction).toHaveBeenCalledTimes(2);
				// navigation inside invalid folder is enabled
				userEvent.dblClick(screen.getByText(invalidFolder.name));
				await screen.findByText(/nothing here/i);
				await findByTextWithMarkup(
					buildBreadCrumbRegExp('Files', localRoot.name, invalidFolder.name)
				);
				expect(screen.queryByText(validFolder.name)).not.toBeInTheDocument();
				expect(screen.queryByText(validFile.name)).not.toBeInTheDocument();
				expect(screen.queryByText(invalidFile.name)).not.toBeInTheDocument();
				expect(confirmButton).toHaveAttribute('disabled', '');
			});
		});
	});

	describe('Multiple selection', () => {
		test('number of selected items is visible', async () => {
			const localRoot = populateLocalRoot();
			const file = populateFile();
			const folder = populateFolder();
			localRoot.children = [file, folder];
			file.parent = localRoot;
			folder.parent = localRoot;
			const mocks = [
				mockGetRootsList(),
				mockGetBaseNode({ node_id: localRoot.id }, localRoot),
				mockGetPath({ node_id: localRoot.id }, [localRoot]),
				mockGetChildren(getChildrenVariables(localRoot.id), localRoot)
			];

			const { findByTextWithMarkup } = render(
				<NodesSelectionModalContent
					confirmAction={confirmAction}
					confirmLabel="Select"
					title="Multiple selection"
					closeAction={closeAction}
					maxSelection={undefined}
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
			userEvent.dblClick(screen.getByText(/home/i));
			await screen.findByText(folder.name);
			await findByTextWithMarkup(buildBreadCrumbRegExp('Files', localRoot.name));
			expect(screen.getByText(folder.name)).toBeVisible();
			expect(screen.getByText(file.name)).toBeVisible();
			const confirmButton = screen.getByRole('button', { name: /select/i });
			expect(confirmButton).toHaveAttribute('disabled', '');
			// number of selected items is hidden
			expect(screen.queryByText(/elements? selected/i)).not.toBeInTheDocument();
			// select a node
			act(() => {
				userEvent.click(screen.getByText(folder.name));
			});
			// confirm button becomes enabled
			await waitFor(() => expect(confirmButton).not.toHaveAttribute('disabled', ''));
			// number of selected items becomes visible
			expect(screen.getByText(/1 element selected/i)).toBeVisible();
			// select a second node
			act(() => {
				userEvent.click(screen.getByText(file.name));
			});
			// confirm button is still enabled
			expect(confirmButton).not.toHaveAttribute('disabled', '');
			// number of selected items is updated
			expect(screen.getByText(/2 elements selected/i)).toBeVisible();
		});

		test('if a max number of nodes is selectable, when limit is overreached confirm button becomes disabled', async () => {
			const localRoot = populateLocalRoot();
			const nodes = populateNodes(5);
			localRoot.children = [...nodes];
			forEach(nodes, (mockedNode) => {
				mockedNode.parent = localRoot;
			});
			const mocks = [
				mockGetRootsList(),
				mockGetBaseNode({ node_id: localRoot.id }, localRoot),
				mockGetPath({ node_id: localRoot.id }, [localRoot]),
				mockGetChildren(getChildrenVariables(localRoot.id), localRoot)
			];

			const { findByTextWithMarkup } = render(
				<NodesSelectionModalContent
					confirmAction={confirmAction}
					confirmLabel="Select"
					title="Multiple selection"
					closeAction={closeAction}
					maxSelection={3}
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
			userEvent.dblClick(screen.getByText(/home/i));
			await screen.findByText(nodes[0].name);
			await findByTextWithMarkup(buildBreadCrumbRegExp('Files', localRoot.name));
			expect(screen.getByText(nodes[0].name)).toBeVisible();
			const confirmButton = screen.getByRole('button', { name: /select/i });
			expect(confirmButton).toHaveAttribute('disabled', '');
			// number of selected items is hidden
			expect(screen.queryByText(/elements? selected/i)).not.toBeInTheDocument();
			// select a node
			act(() => {
				userEvent.click(screen.getByText(nodes[0].name));
			});
			// confirm button becomes enabled
			await waitFor(() => expect(confirmButton).not.toHaveAttribute('disabled', ''));
			// number of selected items becomes visible
			expect(screen.getByText(/1 element selected/i)).toBeVisible();
			// select a second node
			act(() => {
				userEvent.click(screen.getByText(nodes[1].name));
			});
			// select a third node
			act(() => {
				userEvent.click(screen.getByText(nodes[2].name));
			});
			// confirm button is still enabled
			expect(confirmButton).not.toHaveAttribute('disabled', '');
			// number of selected items is updated
			expect(screen.getByText(/3 elements selected/i)).toBeVisible();
			// try to click a fourth node
			act(() => {
				userEvent.click(screen.getByText(nodes[3].name));
			});
			// number of selected items is updated
			expect(screen.getByText(/4 elements selected/i)).toBeVisible();
			// confirm button becomes disabled
			expect(confirmButton).toHaveAttribute('disabled', '');
		});

		describe('without criteria to select nodes', () => {
			test('folder node is a valid selection', async () => {
				const localRoot = populateLocalRoot();
				const folder = populateFolder();
				const file = populateFile();
				localRoot.children = [folder, file];
				folder.parent = localRoot;
				file.parent = localRoot;

				const mocks = [
					mockGetRootsList(),
					mockGetBaseNode({ node_id: localRoot.id }, localRoot),
					mockGetPath({ node_id: localRoot.id }, [localRoot]),
					mockGetChildren(getChildrenVariables(localRoot.id), localRoot)
				];

				const { findByTextWithMarkup } = render(
					<NodesSelectionModalContent
						confirmAction={confirmAction}
						confirmLabel="Select"
						title="Select nodes"
						closeAction={closeAction}
						maxSelection={undefined}
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
				await waitFor(() => expect(confirmAction).toHaveBeenCalled());
				expect(confirmAction).toHaveBeenCalledWith(
					expect.arrayContaining([
						expect.objectContaining({
							id: folder.id,
							name: folder.name
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
					mockGetRootsList(),
					mockGetBaseNode({ node_id: localRoot.id }, localRoot),
					mockGetPath({ node_id: localRoot.id }, [localRoot]),
					mockGetChildren(getChildrenVariables(localRoot.id), localRoot)
				];

				const { findByTextWithMarkup } = render(
					<NodesSelectionModalContent
						confirmAction={confirmAction}
						confirmLabel="Select"
						title="Select nodes"
						closeAction={closeAction}
						maxSelection={undefined}
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

			test('confirm button is enabled when navigating inside a folder if opened folder is selectable by param', async () => {
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
						canSelectOpenedFolder
						maxSelection={undefined}
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
				// number of element selected is visible
				expect(screen.getByText(/1 element selected/i)).toBeVisible();
				act(() => {
					userEvent.click(confirmButton);
				});
				expect(confirmAction).toHaveBeenCalled();
				expect(confirmAction).toHaveBeenCalledWith(
					expect.arrayContaining([expect.objectContaining({ id: localRoot.id })])
				);
			});

			test('confirm button is disabled when navigating inside a folder if opened folder is not selectable by param', async () => {
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
						canSelectOpenedFolder={false}
						maxSelection={undefined}
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
				expect(confirmButton).toHaveAttribute('disabled', '');
				expect(screen.queryByText(/elements? selected/i)).not.toBeInTheDocument();
				act(() => {
					userEvent.click(confirmButton);
				});
				expect(confirmAction).not.toHaveBeenCalled();
				// confirm leave selection as it is and button remains disabled
				expect(confirmButton).toHaveAttribute('disabled', '');
			});

			test('Single click on a valid unselected node set the node as selected', async () => {
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
						canSelectOpenedFolder={false}
						maxSelection={undefined}
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
				const confirmButton = screen.getByRole('button', { name: /select/i });
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
				expect(screen.queryByText(/elements? selected/i)).not.toBeInTheDocument();
				expect(
					findStyled(screen.getByTestId(`node-item-${folder.id}`), HoverContainer)
				).not.toHaveStyle('background-color: #d5e3f6');
				act(() => {
					userEvent.click(screen.getByText(folder.name));
				});
				// ugly but it's the only way to check the item is visibly active
				expect(
					findStyled(screen.getByTestId(`node-item-${folder.id}`), HoverContainer)
				).toHaveStyle('background-color: #d5e3f6');
				expect(screen.getByText(/1 element selected/i)).toBeVisible();
				act(() => {
					userEvent.click(confirmButton);
				});
				expect(confirmAction).toHaveBeenCalledWith([expect.objectContaining({ id: folder.id })]);
				// ugly but it's the only way to check the item is visibly active
				expect(
					findStyled(screen.getByTestId(`node-item-${file.id}`), HoverContainer)
				).not.toHaveStyle('background-color: #d5e3f6');
				act(() => {
					userEvent.click(screen.getByText(file.name));
				});
				// both nodes are visibly active
				expect(findStyled(screen.getByTestId(`node-item-${file.id}`), HoverContainer)).toHaveStyle(
					'background-color: #d5e3f6'
				);
				expect(
					findStyled(screen.getByTestId(`node-item-${folder.id}`), HoverContainer)
				).toHaveStyle('background-color: #d5e3f6');
				expect(screen.getByText(/2 elements selected/i)).toBeVisible();
				act(() => {
					userEvent.click(confirmButton);
				});
				expect(confirmAction).toHaveBeenCalledWith([
					expect.objectContaining({ id: folder.id }),
					expect.objectContaining({ id: file.id })
				]);
			});

			test('With more then one node selected, single click on a selected node set the node as unselected. Other nodes remain selected', async () => {
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
						canSelectOpenedFolder={false}
						maxSelection={undefined}
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
				const confirmButton = screen.getByRole('button', { name: /select/i });
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
				expect(screen.queryByText(/elements? selected/i)).not.toBeInTheDocument();
				expect(
					findStyled(screen.getByTestId(`node-item-${folder.id}`), HoverContainer)
				).not.toHaveStyle('background-color: #d5e3f6');
				act(() => {
					userEvent.click(screen.getByText(folder.name));
				});
				act(() => {
					userEvent.click(screen.getByText(file.name));
				});
				// both nodes are visibly active
				expect(findStyled(screen.getByTestId(`node-item-${file.id}`), HoverContainer)).toHaveStyle(
					'background-color: #d5e3f6'
				);
				expect(
					findStyled(screen.getByTestId(`node-item-${folder.id}`), HoverContainer)
				).toHaveStyle('background-color: #d5e3f6');
				expect(screen.getByText(/2 elements selected/i)).toBeVisible();
				// click again on folder item to deselect it
				act(() => {
					userEvent.click(screen.getByText(folder.name));
				});
				// file remains visibly active, folder returns normal
				expect(findStyled(screen.getByTestId(`node-item-${file.id}`), HoverContainer)).toHaveStyle(
					'background-color: #d5e3f6'
				);
				expect(
					findStyled(screen.getByTestId(`node-item-${folder.id}`), HoverContainer)
				).not.toHaveStyle('background-color: #d5e3f6');
				act(() => {
					userEvent.click(confirmButton);
				});
				expect(confirmAction).toHaveBeenCalledWith([expect.objectContaining({ id: file.id })]);
			});

			test('With only one node selected and opened folder as invalid selection, single click on selected node set the node as unselected and confirm button as disabled', async () => {
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
						canSelectOpenedFolder={false}
						maxSelection={undefined}
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
				const confirmButton = screen.getByRole('button', { name: /select/i });
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
				expect(screen.queryByText(/elements? selected/i)).not.toBeInTheDocument();
				expect(
					findStyled(screen.getByTestId(`node-item-${folder.id}`), HoverContainer)
				).not.toHaveStyle('background-color: #d5e3f6');
				act(() => {
					userEvent.click(screen.getByText(folder.name));
				});
				// ugly but it's the only way to check the item is visibly active
				expect(
					findStyled(screen.getByTestId(`node-item-${folder.id}`), HoverContainer)
				).toHaveStyle('background-color: #d5e3f6');
				expect(screen.getByText(/1 element selected/i)).toBeVisible();
				// click again on folder item to deselect it
				act(() => {
					userEvent.click(screen.getByText(folder.name));
				});
				expect(
					findStyled(screen.getByTestId(`node-item-${folder.id}`), HoverContainer)
				).not.toHaveStyle('background-color: #d5e3f6');
				// confirm button becomes disabled since opened folder is not valid
				expect(confirmButton).toHaveAttribute('disabled', '');
				expect(screen.queryByText(/elements? selected/i)).not.toBeInTheDocument();
				act(() => {
					userEvent.click(confirmButton);
				});
				expect(confirmAction).not.toHaveBeenCalled();
			});

			test('With only one node selected and opened folder as valid selection, single click on selected node set the node as unselected and opened folder as selected. Confirm button is then enabled', async () => {
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
						canSelectOpenedFolder
						maxSelection={undefined}
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
				const confirmButton = screen.getByRole('button', { name: /select/i });
				expect(confirmButton).toBeVisible();
				expect(confirmButton).toHaveAttribute('disabled', '');
				userEvent.dblClick(screen.getByText(/home/i));
				await screen.findByText(folder.name);
				await findByTextWithMarkup(buildBreadCrumbRegExp('Files', localRoot.name));
				// confirm button is enabled because opened folder is a valid selection
				await waitFor(() => expect(confirmButton).not.toHaveAttribute('disabled', ''));
				expect(screen.getByText(/1 element selected/i)).toBeVisible();
				expect(screen.getByText(folder.name)).toBeVisible();
				expect(screen.getByText(file.name)).toBeVisible();
				expect(
					findStyled(screen.getByTestId(`node-item-${folder.id}`), HoverContainer)
				).not.toHaveStyle('background-color: #d5e3f6');
				act(() => {
					userEvent.click(screen.getByText(folder.name));
				});
				// ugly but it's the only way to check the item is visibly active
				expect(
					findStyled(screen.getByTestId(`node-item-${folder.id}`), HoverContainer)
				).toHaveStyle('background-color: #d5e3f6');
				expect(screen.getByText(/1 element selected/i)).toBeVisible();
				// click again on folder item to deselect it
				act(() => {
					userEvent.click(screen.getByText(folder.name));
				});
				expect(
					findStyled(screen.getByTestId(`node-item-${folder.id}`), HoverContainer)
				).not.toHaveStyle('background-color: #d5e3f6');
				// confirm button remains enabled since opened folder is valid
				expect(confirmButton).not.toHaveAttribute('disabled', '');
				expect(screen.getByText(/1 element selected/i)).toBeVisible();
				act(() => {
					userEvent.click(confirmButton);
				});
				// confirm action is called with local root node
				expect(confirmAction).toHaveBeenCalledWith([expect.objectContaining({ id: localRoot.id })]);
			});
		});

		describe('with criteria to select nodes', () => {
			test('only files are selectable; folders are still navigable but not selectable', async () => {
				const localRoot = populateLocalRoot();
				const file1 = populateFile();
				const file2 = populateFile();
				const folder = populateFolder(1);
				localRoot.children = [folder, file1, file2];
				folder.parent = localRoot;
				file1.parent = localRoot;
				file2.parent = localRoot;

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
						maxSelection={undefined}
						canSelectOpenedFolder
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
				expect(screen.getByText(file1.name)).toBeVisible();
				expect(screen.getByText(file2.name)).toBeVisible();
				// folder is not disabled
				expect(screen.getByTestId(`node-item-${folder.id}`)).not.toHaveAttribute('disabled', '');
				// file is not disabled
				expect(screen.getByTestId(`node-item-${file1.id}`)).not.toHaveAttribute('disabled', '');
				const confirmButton = screen.getByRole('button', { name: /confirm/i });
				// confirm button is disabled because local root is not a file
				expect(confirmButton).toHaveAttribute('disabled', '');
				// click on file
				act(() => {
					userEvent.click(screen.getByText(file1.name));
				});
				// confirm button becomes enabled
				await waitFor(() => expect(confirmButton).not.toHaveAttribute('disabled', ''));
				expect(screen.getByText(/1 element selected/i)).toBeVisible();
				// ugly but it's the only way to check the item is visibly active
				expect(findStyled(screen.getByTestId(`node-item-${file1.id}`), HoverContainer)).toHaveStyle(
					'background-color: #d5e3f6'
				);
				// click on folder
				act(() => {
					userEvent.click(screen.getByText(folder.name));
				});
				// confirm button remains enabled but selection is not changed
				expect(confirmButton).not.toHaveAttribute('disabled', '');
				// file 1 is still active
				expect(findStyled(screen.getByTestId(`node-item-${file1.id}`), HoverContainer)).toHaveStyle(
					'background-color: #d5e3f6'
				);
				// folder is not visibly active
				expect(
					findStyled(screen.getByTestId(`node-item-${folder.id}`), HoverContainer)
				).not.toHaveStyle('background-color: #d5e3f6');
				// number of selected node is not changed
				expect(screen.getByText(/1 element selected/i)).toBeVisible();
				// click on other file
				act(() => {
					userEvent.click(screen.getByText(file2.name));
				});
				// confirm button remains enabled
				expect(confirmButton).not.toHaveAttribute('disabled', '');
				// file 1 is still active
				expect(findStyled(screen.getByTestId(`node-item-${file1.id}`), HoverContainer)).toHaveStyle(
					'background-color: #d5e3f6'
				);
				// folder is not visibly active
				expect(
					findStyled(screen.getByTestId(`node-item-${folder.id}`), HoverContainer)
				).not.toHaveStyle('background-color: #d5e3f6');
				// file 2 is now also active
				expect(findStyled(screen.getByTestId(`node-item-${file2.id}`), HoverContainer)).toHaveStyle(
					'background-color: #d5e3f6'
				);
				act(() => {
					userEvent.click(confirmButton);
				});
				expect(confirmAction).toHaveBeenCalled();
				expect(confirmAction).toHaveBeenCalledWith([
					expect.objectContaining({ id: file1.id, name: file1.name }),
					expect.objectContaining({ id: file2.id, name: file2.name })
				]);
			});

			test('only folders are selectable; folders are navigable and selectable, files are fully disabled', async () => {
				const localRoot = populateLocalRoot();
				const file = populateFile();
				const folder1 = populateFolder(1);
				const folder2 = populateFolder(1);
				localRoot.children = [folder1, folder2, file];
				folder1.parent = localRoot;
				folder2.parent = localRoot;
				file.parent = localRoot;

				const isValidSelection = jest
					.fn()
					.mockImplementation((node: Pick<Node, '__typename'>) => isFolder(node));

				const mocks = [
					mockGetRootsList(),
					mockGetBaseNode({ node_id: localRoot.id }, localRoot),
					mockGetPath({ node_id: localRoot.id }, [localRoot]),
					mockGetChildren(getChildrenVariables(localRoot.id), localRoot)
				];

				render(
					<NodesSelectionModalContent
						title="Only folders"
						confirmAction={confirmAction}
						confirmLabel="Confirm"
						closeAction={closeAction}
						isValidSelection={isValidSelection}
						maxSelection={undefined}
						canSelectOpenedFolder
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
				await screen.findByText(folder1.name);
				expect(screen.getByText(folder1.name)).toBeVisible();
				expect(screen.getByText(folder2.name)).toBeVisible();
				expect(screen.getByText(file.name)).toBeVisible();
				// folder is not disabled
				expect(screen.getByTestId(`node-item-${folder1.id}`)).not.toHaveAttribute('disabled', '');
				expect(screen.getByTestId(`node-item-${folder2.id}`)).not.toHaveAttribute('disabled', '');
				// file is disabled
				expect(screen.getByTestId(`node-item-${file.id}`)).toHaveAttribute('disabled', '');
				const confirmButton = screen.getByRole('button', { name: /confirm/i });
				// confirm button is enabled because local root is a valid node
				expect(confirmButton).not.toHaveAttribute('disabled', '');
				expect(screen.getByText(/1 element selected/i)).toBeVisible();
				// click on folder
				act(() => {
					userEvent.click(screen.getByText(folder1.name));
				});
				// confirm button is still enabled
				expect(confirmButton).not.toHaveAttribute('disabled', '');
				// folder 1 is visibly active
				expect(
					findStyled(screen.getByTestId(`node-item-${folder1.id}`), HoverContainer)
				).toHaveStyle('background-color: #d5e3f6');
				// number of selected element is not changed because folder item from list has replaced opened folder in selection
				expect(screen.getByText(/1 element selected/i)).toBeVisible();
				// click on file
				act(() => {
					userEvent.click(screen.getByText(file.name));
				});
				// confirm button remains enable but selection is not changed
				expect(confirmButton).not.toHaveAttribute('disabled', '');
				// folder 1 is visibly active
				expect(
					findStyled(screen.getByTestId(`node-item-${folder1.id}`), HoverContainer)
				).toHaveStyle('background-color: #d5e3f6');
				// file is not visibly active
				expect(
					findStyled(screen.getByTestId(`node-item-${file.id}`), HoverContainer)
				).not.toHaveStyle('background-color: #d5e3f6');
				// number of selected element is not changed because folder item from list has replaced opened folder in selection
				expect(screen.getByText(/1 element selected/i)).toBeVisible();
				// click on other folder
				act(() => {
					userEvent.click(screen.getByText(folder2.name));
				});
				// folder 2 is now also active
				expect(
					findStyled(screen.getByTestId(`node-item-${folder2.id}`), HoverContainer)
				).toHaveStyle('background-color: #d5e3f6');
				// folder 1 is visibly active
				expect(
					findStyled(screen.getByTestId(`node-item-${folder1.id}`), HoverContainer)
				).toHaveStyle('background-color: #d5e3f6');
				// file is not visibly active
				expect(
					findStyled(screen.getByTestId(`node-item-${file.id}`), HoverContainer)
				).not.toHaveStyle('background-color: #d5e3f6');
				// number of selected element is changed
				expect(screen.getByText(/2 elements selected/i)).toBeVisible();
				// confirm button is enabled
				expect(confirmButton).not.toHaveAttribute('disabled', '');
				act(() => {
					userEvent.click(confirmButton);
				});
				expect(confirmAction).toHaveBeenCalled();
				expect(confirmAction).toHaveBeenCalledWith([
					expect.objectContaining({ id: folder1.id, name: folder1.name }),
					expect.objectContaining({ id: folder2.id, name: folder2.name })
				]);
			});

			test('custom validity check set nodes that are not a valid selection as disabled. Folders remain navigable, files are fully disabled', async () => {
				const localRoot = populateLocalRoot();
				const validFile = populateFile(undefined, 'valid file');
				const validFolder = populateFolder(1, undefined, 'valid folder');
				const invalidFile = populateFile(undefined, 'not valid file');
				const invalidFolder = populateFolder(0, undefined, 'not valid folder');
				localRoot.children.push(validFile, validFolder, invalidFile, invalidFolder);
				validFolder.parent = localRoot;
				validFile.parent = localRoot;
				invalidFolder.parent = localRoot;
				invalidFile.parent = localRoot;

				const isValidSelection = jest
					.fn()
					.mockImplementation((node: Pick<Node, 'name'>) => node.name.startsWith('valid'));

				const mocks = [
					mockGetRootsList(),
					mockGetBaseNode({ node_id: localRoot.id }, localRoot),
					mockGetPath({ node_id: localRoot.id }, [localRoot]),
					mockGetChildren(getChildrenVariables(localRoot.id), localRoot),
					mockGetChildren(getChildrenVariables(invalidFolder.id), invalidFolder),
					mockGetPath({ node_id: invalidFolder.id }, [localRoot, invalidFolder])
				];

				const { findByTextWithMarkup } = render(
					<NodesSelectionModalContent
						title="Custom selector"
						confirmAction={confirmAction}
						confirmLabel="Confirm"
						closeAction={closeAction}
						isValidSelection={isValidSelection}
						maxSelection={undefined}
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
				await screen.findByText(validFolder.name);
				expect(screen.getByText(validFolder.name)).toBeVisible();
				expect(screen.getByText(validFile.name)).toBeVisible();
				expect(screen.getByText((localRoot.children[0] as Node).name)).toBeVisible();
				// valid folder is not disabled
				expect(screen.getByTestId(`node-item-${validFolder.id}`)).not.toHaveAttribute(
					'disabled',
					''
				);
				// valid file is not disabled
				expect(screen.getByTestId(`node-item-${validFile.id}`)).not.toHaveAttribute('disabled', '');
				// invalid file is disabled
				expect(screen.getByTestId(`node-item-${invalidFile.id}`)).toHaveAttribute('disabled', '');
				// invalid folder is not disabled because is navigable
				expect(screen.getByTestId(`node-item-${invalidFolder.id}`)).not.toHaveAttribute(
					'disabled',
					''
				);
				const confirmButton = screen.getByRole('button', { name: /confirm/i });
				// confirm button is disabled because local root is not selectable by param
				expect(confirmButton).toHaveAttribute('disabled', '');
				// click on valid folder
				act(() => {
					userEvent.click(screen.getByText(validFolder.name));
				});
				// confirm button becomes enabled
				expect(confirmButton).not.toHaveAttribute('disabled', '');
				// valid folder is visibly active
				expect(
					findStyled(screen.getByTestId(`node-item-${validFolder.id}`), HoverContainer)
				).toHaveStyle('background-color: #d5e3f6');
				expect(screen.getByText(/1 element selected/i)).toBeVisible();
				// click on invalid folder does not change selection
				act(() => {
					userEvent.click(screen.getByText(invalidFolder.name));
				});
				expect(confirmButton).not.toHaveAttribute('disabled', '');
				expect(screen.getByText(/1 element selected/i)).toBeVisible();
				expect(
					findStyled(screen.getByTestId(`node-item-${validFolder.id}`), HoverContainer)
				).toHaveStyle('background-color: #d5e3f6');
				expect(
					findStyled(screen.getByTestId(`node-item-${invalidFolder.id}`), HoverContainer)
				).not.toHaveStyle('background-color: #d5e3f6');
				// click on valid file change selection
				act(() => {
					userEvent.click(screen.getByText(validFile.name));
				});
				expect(confirmButton).not.toHaveAttribute('disabled', '');
				expect(screen.getByText(/2 elements selected/i)).toBeVisible();
				expect(
					findStyled(screen.getByTestId(`node-item-${validFolder.id}`), HoverContainer)
				).toHaveStyle('background-color: #d5e3f6');
				expect(
					findStyled(screen.getByTestId(`node-item-${invalidFolder.id}`), HoverContainer)
				).not.toHaveStyle('background-color: #d5e3f6');
				expect(
					findStyled(screen.getByTestId(`node-item-${validFile.id}`), HoverContainer)
				).toHaveStyle('background-color: #d5e3f6');
				// click on invalid file does not change selection
				act(() => {
					userEvent.click(screen.getByText(invalidFile.name));
				});
				expect(confirmButton).not.toHaveAttribute('disabled', '');
				expect(screen.getByText(/2 elements selected/i)).toBeVisible();
				expect(
					findStyled(screen.getByTestId(`node-item-${validFolder.id}`), HoverContainer)
				).toHaveStyle('background-color: #d5e3f6');
				expect(
					findStyled(screen.getByTestId(`node-item-${invalidFolder.id}`), HoverContainer)
				).not.toHaveStyle('background-color: #d5e3f6');
				expect(
					findStyled(screen.getByTestId(`node-item-${validFile.id}`), HoverContainer)
				).toHaveStyle('background-color: #d5e3f6');
				expect(
					findStyled(screen.getByTestId(`node-item-${invalidFile.id}`), HoverContainer)
				).not.toHaveStyle('background-color: #d5e3f6');
				// call confirm action
				act(() => {
					userEvent.click(confirmButton);
				});
				expect(confirmAction).toHaveBeenCalledTimes(1);
				expect(confirmAction).toHaveBeenCalledWith([
					expect.objectContaining({ id: validFolder.id, name: validFolder.name }),
					expect.objectContaining({ id: validFile.id, name: validFile.name })
				]);
				// navigation inside invalid folder is enabled
				act(() => {
					userEvent.dblClick(screen.getByText(invalidFolder.name));
				});
				await screen.findByText(/nothing here/i);
				await findByTextWithMarkup(
					buildBreadCrumbRegExp('Files', localRoot.name, invalidFolder.name)
				);
				expect(screen.queryByText(validFolder.name)).not.toBeInTheDocument();
				expect(screen.queryByText(validFile.name)).not.toBeInTheDocument();
				expect(screen.queryByText(invalidFile.name)).not.toBeInTheDocument();
				// confirm button is disabled because navigation has reset selection and opened
				// folder is not a valid selection by param (and also by validity check)
				expect(confirmButton).toHaveAttribute('disabled', '');
				expect(screen.queryByText(/elements? selected/i)).not.toBeInTheDocument();
				// reset calls
				confirmAction.mockReset();
				act(() => {
					userEvent.click(confirmButton);
				});
				expect(confirmAction).not.toHaveBeenCalled();
			});
		});
	});
});
