/*
 * SPDX-FileCopyrightText: 2022 Zextras <https://www.zextras.com>
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import React from 'react';

import { screen, waitForElementToBeRemoved } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import forEach from 'lodash/forEach';

import { CreateOptionsContent } from '../../hooks/useCreateOptions';
import { NODES_LOAD_LIMIT } from '../constants';
import { populateFolder, populateNodePage, populateNodes } from '../mocks/mockUtils';
import { Node } from '../types/common';
import { Folder } from '../types/graphql/types';
import {
	getChildrenVariables,
	mockGetChildren,
	mockGetParent,
	mockGetPermissions
} from '../utils/mockUtils';
import { iconRegexp, render, selectNodes, triggerLoadMore } from '../utils/testUtils';
import { DisplayerProps } from './components/Displayer';
import FolderView from './FolderView';

jest.mock('../../hooks/useCreateOptions', () => ({
	useCreateOptions: (): CreateOptionsContent => ({
		setCreateOptions: jest.fn(),
		removeCreateOptions: jest.fn()
	})
}));

jest.mock('./components/Displayer', () => ({
	Displayer: (props: DisplayerProps): JSX.Element => (
		<div data-testid="displayer-test-id">
			{props.translationKey}:{props.icons}
		</div>
	)
}));

describe('Folder View Selection mode', () => {
	test('if there is no element selected, all actions are visible and disabled', async () => {
		const currentFolder = populateFolder(10);
		const mocks = [
			mockGetParent({ node_id: currentFolder.id }, currentFolder),
			mockGetChildren(getChildrenVariables(currentFolder.id), currentFolder),
			mockGetPermissions({ node_id: currentFolder.id }, currentFolder)
		];
		render(<FolderView />, { initialRouterEntries: [`/?folder=${currentFolder.id}`], mocks });

		await screen.findByText((currentFolder.children.nodes[0] as Node).name);
		expect(screen.getByText((currentFolder.children.nodes[0] as Node).name)).toBeVisible();
		expect(screen.queryByTestId('checkedAvatar')).not.toBeInTheDocument();
		selectNodes([(currentFolder.children.nodes[0] as Node).id]);
		// check that all wanted items are selected
		expect(screen.getByTestId('checkedAvatar')).toBeInTheDocument();
		expect(screen.getByText(/select all/i)).toBeVisible();
		// deselect node. Selection mode remains active
		selectNodes([(currentFolder.children.nodes[0] as Node).id]);
		expect(screen.queryByTestId('checkedAvatar')).not.toBeInTheDocument();
		expect(screen.getAllByTestId('unCheckedAvatar')).toHaveLength(
			currentFolder.children.nodes.length
		);
		expect(screen.getByText(/select all/i)).toBeVisible();

		expect(screen.queryByTestId(iconRegexp.moveToTrash)).not.toBeInTheDocument();
		expect(screen.queryByTestId(iconRegexp.moreVertical)).not.toBeInTheDocument();
		expect(screen.queryByTestId(iconRegexp.rename)).not.toBeInTheDocument();
		expect(screen.queryByTestId(iconRegexp.copy)).not.toBeInTheDocument();
		expect(screen.queryByTestId(iconRegexp.move)).not.toBeInTheDocument();
		expect(screen.queryByTestId(iconRegexp.flag)).not.toBeInTheDocument();
		expect(screen.queryByTestId(iconRegexp.unflag)).not.toBeInTheDocument();
		expect(screen.queryByTestId(iconRegexp.download)).not.toBeInTheDocument();
		expect(screen.queryByTestId(iconRegexp.openDocument)).not.toBeInTheDocument();
		expect(screen.queryByTestId(iconRegexp.restore)).not.toBeInTheDocument();
		expect(screen.queryByTestId(iconRegexp.deletePermanently)).not.toBeInTheDocument();

		const arrowBack = screen.getByTestId('icon: ArrowBackOutline');
		expect(arrowBack).toBeVisible();
		userEvent.click(arrowBack);
		await waitForElementToBeRemoved(arrowBack);
		expect(screen.queryByTestId('unCheckedAvatar')).not.toBeInTheDocument();
		expect(screen.queryByTestId('checkedAvatar')).not.toBeInTheDocument();
		expect(screen.queryByText(/select all/i)).not.toBeInTheDocument();
	});

	test('if all loaded nodes are selected, unselect all action is visible', async () => {
		const currentFolder = populateFolder(NODES_LOAD_LIMIT);
		const secondPage = populateNodes(10) as Node[];
		forEach(secondPage, (mockedNode) => {
			mockedNode.parent = currentFolder;
		});
		const mocks = [
			mockGetParent({ node_id: currentFolder.id }, currentFolder),
			mockGetChildren(getChildrenVariables(currentFolder.id), currentFolder),
			mockGetPermissions({ node_id: currentFolder.id }, currentFolder),
			mockGetChildren(
				getChildrenVariables(currentFolder.id, undefined, undefined, undefined, true),
				{ ...currentFolder, children: populateNodePage(secondPage) } as Folder
			)
		];
		render(<FolderView />, { initialRouterEntries: [`/?folder=${currentFolder.id}`], mocks });

		await screen.findByText((currentFolder.children.nodes[0] as Folder).name);
		expect(screen.queryByText(/select all/i)).not.toBeInTheDocument();
		selectNodes([(currentFolder.children.nodes[0] as Folder).id]);
		// check that all wanted items are selected
		expect(screen.getByTestId('checkedAvatar')).toBeInTheDocument();
		expect(screen.getByText(/\bselect all/i)).toBeVisible();
		userEvent.click(screen.getByText(/\bselect all/i));
		await screen.findByText(/deselect all/i);
		expect(screen.queryByTestId('unCheckedAvatar')).not.toBeInTheDocument();
		expect(screen.getAllByTestId('checkedAvatar')).toHaveLength(
			currentFolder.children.nodes.length
		);
		expect(screen.getByText(/deselect all/i)).toBeVisible();
		expect(screen.queryByText(/\bselect all/i)).not.toBeInTheDocument();
		await triggerLoadMore();
		await screen.findByText(secondPage[0].name);
		expect(screen.getAllByTestId('checkedAvatar')).toHaveLength(
			currentFolder.children.nodes.length
		);
		expect(screen.getAllByTestId('unCheckedAvatar')).toHaveLength(secondPage.length);
		expect(screen.queryByText(/deselect all/i)).not.toBeInTheDocument();
		expect(screen.getByText(/\bselect all/i)).toBeVisible();
		userEvent.click(screen.getByText(/\bselect all/i));
		await screen.findByText(/deselect all/i);
		expect(screen.getAllByTestId('checkedAvatar')).toHaveLength(
			currentFolder.children.nodes.length + secondPage.length
		);
		expect(screen.queryByTestId('unCheckedAvatar')).not.toBeInTheDocument();
		expect(screen.getByText(/deselect all/i)).toBeVisible();
		userEvent.click(screen.getByText(/deselect all/i));
		await screen.findByText(/\bselect all/i);
		expect(screen.getAllByTestId('unCheckedAvatar')).toHaveLength(
			currentFolder.children.nodes.length + secondPage.length
		);
		expect(screen.queryByTestId('checkedAvatar')).not.toBeInTheDocument();
	});
});
