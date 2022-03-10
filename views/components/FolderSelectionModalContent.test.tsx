/*
 * SPDX-FileCopyrightText: 2022 Zextras <https://www.zextras.com>
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import React from 'react';

import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import 'jest-styled-components';
import map from 'lodash/map';
import { find as findStyled } from 'styled-components/test-utils';

import { ROOTS } from '../../constants';
import {
	populateFile,
	populateFolder,
	populateLocalRoot,
	populateNodes,
	populateParents
} from '../../mocks/mockUtils';
import { Node } from '../../types/graphql/types';
import {
	getChildrenVariables,
	getFindNodesVariables,
	mockFindNodes,
	mockGetChildren,
	mockGetPath
} from '../../utils/mockUtils';
import { buildBreadCrumbRegExp, render } from '../../utils/testUtils';
import { FolderSelectionModalContent } from './FolderSelectionModalContent';
import { HoverContainer } from './StyledComponents';

let confirmAction: jest.Mock;

beforeEach(() => {
	confirmAction = jest.fn();
});

describe('Folder Selection Modal Content', () => {
	test('show roots if no folder is set. Choose button is disabled', async () => {
		render(<FolderSelectionModalContent confirmAction={confirmAction} />, { mocks: [] });

		await screen.findByText(/home/i);
		expect(screen.getByText('Home')).toBeVisible();
		expect(screen.getByText('Shared with me')).toBeVisible();
		expect(screen.getByText('Trash')).toBeVisible();
		const chooseButton = screen.getByRole('button', { name: /choose folder/i });
		expect(chooseButton).toBeVisible();
		expect(chooseButton).toHaveAttribute('disabled');
		userEvent.click(chooseButton);
		expect(confirmAction).not.toHaveBeenCalled();
	});

	test('if folder in list if parent is set. Choose button is disabled if active folder is same as the set one', async () => {
		const folder = populateFolder();
		const folder2 = populateFolder();
		const file = populateFile();
		const parent = populateFolder();
		const { path } = populateParents(parent, 2, true);
		parent.children = [folder, folder2, file];
		folder.parent = parent;
		folder2.parent = parent;
		file.parent = parent;

		const mocks = [
			// request to find out parent
			mockGetPath({ node_id: folder.id }, [...path, folder]),
			// request to create breadcrumb
			mockGetPath({ node_id: parent.id }, path),
			mockGetChildren(getChildrenVariables(parent.id), parent)
		];

		const { findByTextWithMarkup } = render(
			<FolderSelectionModalContent folderId={folder.id} confirmAction={confirmAction} />,
			{
				mocks
			}
		);
		await screen.findByText(folder.name);
		const breadcrumbItem = await findByTextWithMarkup(
			buildBreadCrumbRegExp('Files', ...map(path, (node) => node.name))
		);
		expect(breadcrumbItem).toBeVisible();
		expect(screen.getByText(folder.name)).toBeVisible();
		expect(screen.getByText(folder2.name)).toBeVisible();
		expect(screen.getByText(file.name)).toBeVisible();
		// file nodes are disabled
		expect(screen.getByTestId(`node-item-${file.id}`)).toHaveAttribute('disabled', '');
		expect(screen.getByTestId(`node-item-${folder.id}`)).not.toHaveAttribute('disabled', '');
		expect(screen.getByTestId(`node-item-${folder2.id}`)).not.toHaveAttribute('disabled', '');
		// choose button is disabled because active folder is same as set one
		const chooseButton = screen.getByRole('button', { name: /choose folder/i });
		expect(chooseButton).toBeVisible();
		expect(chooseButton).toHaveAttribute('disabled', '');
		// eslint-disable-next-line testing-library/no-unnecessary-act
		act(() => {
			userEvent.click(chooseButton);
		});
		expect(confirmAction).not.toHaveBeenCalled();
		// click on disabled choose button should leave the button disabled
		expect(chooseButton).toHaveAttribute('disabled', '');
		// click on disabled node set opened folder as active
		userEvent.click(screen.getByText(file.name));
		// choose button becomes active. Opened folder is a valid selection
		await waitFor(() => expect(chooseButton).not.toHaveAttribute('disabled', ''));
		// eslint-disable-next-line testing-library/no-unnecessary-act
		act(() => {
			userEvent.click(chooseButton);
		});
		expect(confirmAction).toHaveBeenCalled();
		expect(confirmAction).toHaveBeenCalledWith(
			expect.objectContaining({
				id: parent.id,
				name: parent.name
			}),
			false
		);
		// confirm reset active folder in the modal
		expect(chooseButton).toHaveAttribute('disabled', '');
		// click on other folder
		userEvent.click(screen.getByText(folder2.name));
		// choose button becomes active. Other folder is a valid selection
		await waitFor(() => expect(chooseButton).not.toHaveAttribute('disabled', ''));
		// eslint-disable-next-line testing-library/no-unnecessary-act
		act(() => {
			userEvent.click(chooseButton);
		});
		expect(confirmAction).toHaveBeenCalled();
		expect(confirmAction).toHaveBeenCalledWith(
			expect.objectContaining({
				id: folder2.id,
				name: folder2.name
			}),
			false
		);
		// confirm reset active folder in the modal
		expect(chooseButton).toHaveAttribute('disabled', '');
		// click on other folder
		userEvent.click(screen.getByText(folder2.name));
		// choose button becomes active. Other folder is a valid selection
		await waitFor(() => expect(chooseButton).not.toHaveAttribute('disabled', ''));
		// click on set folder
		// eslint-disable-next-line testing-library/no-unnecessary-act
		act(() => {
			userEvent.click(screen.getByText(folder.name));
		});
		// choose button becomes disabled. Folder already set in advanced params is not a valid selection
		await waitFor(() => expect(chooseButton).toHaveAttribute('disabled'));
	});

	test('root items are valid, roots entry point is not valid', async () => {
		const localRoot = populateFolder(2, ROOTS.LOCAL_ROOT);

		const mocks = [
			// request to find out parent
			mockGetPath({ node_id: localRoot.id }, [localRoot]),
			mockGetChildren(getChildrenVariables(localRoot.id), localRoot)
		];

		const { findByTextWithMarkup } = render(
			<FolderSelectionModalContent folderId={localRoot.id} confirmAction={confirmAction} />,
			{
				mocks
			}
		);

		// wait a tick to let the effect of the component run
		await waitFor(
			() =>
				new Promise((resolve) => {
					setTimeout(resolve, 1);
				})
		);
		await screen.findByText(/home/i);
		const breadcrumbItem = await findByTextWithMarkup(buildBreadCrumbRegExp('Files'));
		expect(breadcrumbItem).toBeVisible();
		expect(screen.getByText(/home/i)).toBeVisible();
		// ugly but it's the only way to check the item is visibly active
		expect(findStyled(screen.getByTestId(`node-item-${localRoot.id}`), HoverContainer)).toHaveStyle(
			'background-color: #d5e3f6'
		);
		expect(screen.getByText(/shared with me/i)).toBeVisible();
		expect(screen.getByText(/trash/i)).toBeVisible();
		// choose button is disabled because active folder is same as set one
		const chooseButton = screen.getByRole('button', { name: /choose folder/i });
		expect(chooseButton).toBeVisible();
		expect(chooseButton).toHaveAttribute('disabled', '');
		// click on other root
		userEvent.click(screen.getByText(/shared with me/i));
		await waitFor(() => expect(chooseButton).not.toHaveAttribute('disabled', ''));
		// active root is become the clicked root
		expect(
			findStyled(screen.getByTestId(`node-item-${ROOTS.SHARED_WITH_ME}`), HoverContainer)
		).toHaveStyle('background-color: #d5e3f6');
		expect(
			findStyled(screen.getByTestId(`node-item-${localRoot.id}`), HoverContainer)
		).not.toHaveStyle('background-color: #d5e3f6');
		// click on subtitle to reset active folder
		userEvent.click(screen.getByText(/searched only inside the selected folder/gi));
		// choose button becomes disabled because roots list entry point is not a valid selection
		await waitFor(() => expect(chooseButton).toHaveAttribute('disabled'));
		// eslint-disable-next-line testing-library/no-unnecessary-act
		act(() => {
			userEvent.click(chooseButton);
		});
		expect(confirmAction).not.toHaveBeenCalled();
	});

	test('navigation through breadcrumb reset active folder', async () => {
		const localRoot = populateFolder(2, ROOTS.LOCAL_ROOT);
		const folder = populateFolder();
		localRoot.children.push(folder);
		folder.parent = localRoot;

		const mocks = [
			// request to find out parent
			mockGetPath({ node_id: localRoot.id }, [localRoot]),
			mockGetChildren(getChildrenVariables(localRoot.id), localRoot),
			// request to create breadcrumb
			mockGetPath({ node_id: folder.id }, [localRoot, folder]),
			mockGetChildren(getChildrenVariables(folder.id), folder)
		];

		const { findByTextWithMarkup } = render(
			<FolderSelectionModalContent folderId={localRoot.id} confirmAction={confirmAction} />,
			{
				mocks
			}
		);

		await screen.findByText(/home/i);
		let breadcrumbItem = await findByTextWithMarkup(buildBreadCrumbRegExp('Files'));
		expect(breadcrumbItem).toBeVisible();
		expect(screen.getByText(/home/i)).toBeVisible();
		// ugly but it's the only way to check the item is visibly active
		expect(findStyled(screen.getByTestId(`node-item-${localRoot.id}`), HoverContainer)).toHaveStyle(
			'background-color: #d5e3f6'
		);
		userEvent.dblClick(screen.getByText(/home/i));
		await screen.findByText(folder.name);
		expect(screen.getByText(folder.name)).toBeVisible();
		expect(screen.getByText((localRoot.children[0] as Node).name)).toBeVisible();
		breadcrumbItem = await findByTextWithMarkup(buildBreadCrumbRegExp('Files', folder.parent.name));
		expect(breadcrumbItem).toBeVisible();
		// choose button is disabled because active folder (opened folder) is same as set one
		const chooseButton = screen.getByRole('button', { name: /choose folder/i });
		expect(chooseButton).toBeVisible();
		expect(chooseButton).toHaveAttribute('disabled', '');
		// navigate back to the roots list through breadcrumb
		userEvent.click(screen.getByText('Files'));
		// wait roots list to be rendered
		await screen.findByText(/home/i);
		expect(screen.queryByText(folder.name)).not.toBeInTheDocument();
		expect(screen.getByText(/home/i)).toBeVisible();
		expect(screen.getByText(/shared with me/i)).toBeVisible();
		expect(screen.getByText(/trash/i)).toBeVisible();
		// choose button is disabled because is now referring the entry point, which is not valid
		expect(chooseButton).toHaveAttribute('disabled', '');
		// local root item is not visibly active
		expect(
			findStyled(screen.getByTestId(`node-item-${localRoot.id}`), HoverContainer)
		).not.toHaveStyle('background-color: #d5e3f6');
		// eslint-disable-next-line testing-library/no-unnecessary-act
		act(() => {
			userEvent.click(chooseButton);
		});
		expect(confirmAction).not.toHaveBeenCalled();
		// navigate again inside local root
		userEvent.dblClick(screen.getByText(/home/i));
		await screen.findByText(folder.name);
		expect(screen.getByText(folder.name)).toBeVisible();
		expect(screen.getByText((localRoot.children[0] as Node).name)).toBeVisible();
		breadcrumbItem = await findByTextWithMarkup(buildBreadCrumbRegExp('Files', folder.parent.name));
		expect(breadcrumbItem).toBeVisible();
		// choose button is disabled because active folder (opened folder) is same as set one
		expect(chooseButton).toBeVisible();
		expect(chooseButton).toHaveAttribute('disabled', '');
		// eslint-disable-next-line testing-library/no-unnecessary-act
		act(() => {
			userEvent.click(chooseButton);
		});
		expect(confirmAction).not.toHaveBeenCalled();
		// select a valid folder
		userEvent.click(screen.getByText(folder.name));
		// choose button is active because folder is a valid selection
		await waitFor(() => expect(chooseButton).not.toHaveAttribute('disabled', ''));
		// eslint-disable-next-line testing-library/no-unnecessary-act
		act(() => {
			userEvent.click(chooseButton);
		});
		expect(confirmAction).toHaveBeenCalled();
		expect(confirmAction).toHaveBeenCalledWith(
			expect.objectContaining({
				id: folder.id,
				name: folder.name
			}),
			false
		);
	});

	test('search in sub-folders is checked if cascade is true', async () => {
		const localRoot = populateLocalRoot();
		const mocks = [mockGetPath({ node_id: localRoot.id }, [localRoot])];
		render(
			<FolderSelectionModalContent
				folderId={localRoot.id}
				confirmAction={confirmAction}
				cascadeDefault
			/>,
			{
				mocks
			}
		);

		// wait a tick to let getPath query to be executed
		await waitFor(
			() =>
				new Promise((resolve) => {
					setTimeout(resolve, 0);
				})
		);
		await screen.findByText(/home/i);
		const checkboxLabel = screen.getByText('search also in contained folders');
		expect(checkboxLabel).toBeVisible();
		const checkboxChecked = screen.getByTestId('icon: CheckmarkSquare');
		expect(checkboxChecked).toBeVisible();
		const chooseButton = screen.getByRole('button', { name: /choose folder/i });
		expect(chooseButton).toBeVisible();
		// choose button is disabled because active folder and cascade have same value as current filter
		expect(chooseButton).toHaveAttribute('disabled', '');
	});

	test('search in sub-folders check set cascade param', async () => {
		const localRoot = populateLocalRoot();
		const mocks = [mockGetPath({ node_id: localRoot.id }, [localRoot])];
		render(<FolderSelectionModalContent folderId={localRoot.id} confirmAction={confirmAction} />, {
			mocks
		});

		// wait a tick to let getPath query to be executed
		await waitFor(
			() =>
				new Promise((resolve) => {
					setTimeout(resolve, 0);
				})
		);
		await screen.findByText(/home/i);
		const checkboxLabel = screen.getByText('search also in contained folders');
		let checkboxUnchecked = screen.getByTestId('icon: Square');
		expect(checkboxLabel).toBeVisible();
		expect(checkboxUnchecked).toBeVisible();
		const chooseButton = screen.getByRole('button', { name: /choose folder/i });
		expect(chooseButton).toBeVisible();
		// choose button is disabled because active folder and cascade have same value as current filter
		expect(chooseButton).toHaveAttribute('disabled', '');
		// eslint-disable-next-line testing-library/no-unnecessary-act
		act(() => {
			userEvent.click(checkboxLabel);
		});
		const checkboxChecked = await screen.findByTestId('icon: CheckmarkSquare');
		expect(checkboxChecked).toBeVisible();
		// choose button is active because cascade has changed its value
		expect(chooseButton).not.toHaveAttribute('disabled', '');
		// eslint-disable-next-line testing-library/no-unnecessary-act
		act(() => {
			userEvent.click(checkboxChecked);
		});
		checkboxUnchecked = await screen.findByTestId('icon: Square');
		expect(checkboxUnchecked).toBeVisible();
		// choose button is disabled because active folder and cascade have same value as current filter
		expect(chooseButton).toHaveAttribute('disabled', '');
		// eslint-disable-next-line testing-library/no-unnecessary-act
		act(() => {
			userEvent.click(checkboxUnchecked);
		});
		await screen.findByTestId('icon: CheckmarkSquare');
		// eslint-disable-next-line testing-library/no-unnecessary-act
		act(() => {
			userEvent.click(chooseButton);
		});
		expect(confirmAction).toHaveBeenCalled();
		expect(confirmAction).toHaveBeenCalledWith(
			expect.objectContaining({
				id: localRoot.id,
				name: localRoot.name
			}),
			true
		);
	});

	test('shared with me roots is navigable. trash is not navigable. both are selectable', async () => {
		const sharedWithMeFilter = populateNodes(4);
		const mocks = [
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
			<FolderSelectionModalContent confirmAction={confirmAction} />,
			{
				mocks
			}
		);

		await screen.findByText(/home/i);
		expect(screen.getByText(/shared with me/i)).toBeVisible();
		const chooseButton = screen.getByRole('button', { name: /choose folder/i });
		expect(chooseButton).toBeVisible();
		// choose button is disabled because entry point is not a valid selection
		expect(chooseButton).toHaveAttribute('disabled', '');
		userEvent.click(screen.getByText(/shared with me/i));
		// shared with me item is a valid selection
		await waitFor(() => expect(chooseButton).not.toHaveAttribute('disabled', ''));
		userEvent.click(chooseButton);
		expect(confirmAction).toHaveBeenCalled();
		expect(confirmAction).toHaveBeenCalledWith(
			expect.objectContaining({ id: ROOTS.SHARED_WITH_ME, name: 'Shared with me' }),
			false
		);
		// choose button is now disabled because of reset
		expect(chooseButton).toHaveAttribute('disabled', '');
		expect(screen.getByText(/trash/i)).toBeVisible();
		userEvent.click(screen.getByText(/trash/i));
		// trash item is a valid selection
		await waitFor(() => expect(chooseButton).not.toHaveAttribute('disabled', ''));
		userEvent.click(chooseButton);
		expect(confirmAction).toHaveBeenCalledTimes(2);
		expect(confirmAction).toHaveBeenLastCalledWith(
			expect.objectContaining({ id: ROOTS.TRASH, name: 'Trash' }),
			false
		);
		// choose button is now disabled because of reset
		expect(chooseButton).toHaveAttribute('disabled', '');
		userEvent.dblClick(screen.getByText(/trash/i));
		// double-click on trash does not trigger navigation
		expect(screen.getByText(/trash/i)).toBeVisible();
		expect(screen.getByText(/home/i)).toBeVisible();
		expect(screen.getByText(/shared with me/i)).toBeVisible();
		// choose button is now active because trash is the active item
		expect(chooseButton).not.toHaveAttribute('disabled', '');
		// ugly but it's the only way to check the item is visibly active
		expect(findStyled(screen.getByTestId(`node-item-${ROOTS.TRASH}`), HoverContainer)).toHaveStyle(
			'background-color: #d5e3f6'
		);
		userEvent.dblClick(screen.getByText(/shared with me/i));
		await screen.findByText(sharedWithMeFilter[0].name);
		expect(screen.getByText(sharedWithMeFilter[0].name)).toBeVisible();
		expect(getByTextWithMarkup(buildBreadCrumbRegExp('Files', 'Shared with me'))).toBeVisible();
		expect(chooseButton).not.toHaveAttribute('disabled', '');
		// eslint-disable-next-line testing-library/no-unnecessary-act
		act(() => {
			userEvent.click(chooseButton);
		});
		expect(confirmAction).toHaveBeenCalledTimes(3);
		expect(confirmAction).toHaveBeenLastCalledWith(
			expect.objectContaining({ id: ROOTS.SHARED_WITH_ME, name: 'Shared with me' }),
			false
		);
	});

	test('confirm action is called with id and name after navigation of a folder inside a folder', async () => {
		const localRoot = populateLocalRoot(2);
		const folder = populateFolder(3);
		folder.parent = localRoot;
		localRoot.children.push(folder);
		const mocks = [
			mockGetChildren(getChildrenVariables(localRoot.id), localRoot),
			mockGetPath({ node_id: localRoot.id }, [localRoot]),
			mockGetChildren(getChildrenVariables(folder.id), folder),
			mockGetPath({ node_id: folder.id }, [localRoot, folder])
		];

		render(<FolderSelectionModalContent confirmAction={confirmAction} />, { mocks });
		await screen.findByText(/home/i);
		userEvent.dblClick(screen.getByText(/home/i));
		await screen.findByText(folder.name);
		expect(screen.getByText((localRoot.children[0] as Node).name)).toBeVisible();
		expect(screen.getByText(folder.name)).toBeVisible();
		userEvent.dblClick(screen.getByText(folder.name));
		await screen.findByText((folder.children[0] as Node).name);
		const chooseButton = screen.getByRole('button', { name: /choose folder/i });
		expect(chooseButton).not.toHaveAttribute('disabled', '');
		// eslint-disable-next-line testing-library/no-unnecessary-act
		act(() => {
			userEvent.click(chooseButton);
		});
		expect(confirmAction).toHaveBeenCalled();
		expect(confirmAction).toHaveBeenLastCalledWith(
			expect.objectContaining({ id: folder.id, name: folder.name }),
			false
		);
	});

	test('confirm action is called with id and name after navigation of a folder inside a filter', async () => {
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
			),
			mockGetChildren(getChildrenVariables(folder.id), folder),
			mockGetPath({ node_id: folder.id }, [folder])
		];

		render(<FolderSelectionModalContent confirmAction={confirmAction} />, { mocks });
		await screen.findByText(/shared with me/i);
		userEvent.dblClick(screen.getByText(/shared with me/i));
		await screen.findByText(folder.name);
		expect(screen.getByText(filter[0].name)).toBeVisible();
		expect(screen.getByText(folder.name)).toBeVisible();
		userEvent.dblClick(screen.getByText(folder.name));
		await screen.findByText((folder.children[0] as Node).name);
		const chooseButton = screen.getByRole('button', { name: /choose folder/i });
		expect(chooseButton).not.toHaveAttribute('disabled', '');
		// eslint-disable-next-line testing-library/no-unnecessary-act
		act(() => {
			userEvent.click(chooseButton);
		});
		expect(confirmAction).toHaveBeenCalled();
		expect(confirmAction).toHaveBeenLastCalledWith(
			expect.objectContaining({ id: folder.id, name: folder.name }),
			false
		);
	});
});
