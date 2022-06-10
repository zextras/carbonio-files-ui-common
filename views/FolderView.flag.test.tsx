/*
 * SPDX-FileCopyrightText: 2022 Zextras <https://www.zextras.com>
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import React from 'react';

import { fireEvent, screen, waitForElementToBeRemoved, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import forEach from 'lodash/forEach';
import map from 'lodash/map';

import { CreateOptionsContent } from '../../hooks/useCreateOptions';
import { populateFolder, populateNode } from '../mocks/mockUtils';
import { Node } from '../types/common';
import { Folder } from '../types/graphql/types';
import { getChildrenVariables, mockFlagNodes, mockGetChildren } from '../utils/mockUtils';
import {
	actionRegexp,
	iconRegexp,
	render,
	selectNodes,
	waitForNetworkResponse
} from '../utils/testUtils';
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

describe('Flag', () => {
	describe('Selection mode', () => {
		test('Flag/Unflag action marks all and only selected items as flagged/unflagged', async () => {
			const currentFolder = populateFolder(4);
			forEach(currentFolder.children, (mockedNode) => {
				(mockedNode as Node).flagged = false;
			});

			const nodesIdsToFlag = map(
				currentFolder.children.slice(0, currentFolder.children.length / 2),
				(child) => (child as Node).id
			);

			const nodesIdsToUnflag = nodesIdsToFlag.slice(0, nodesIdsToFlag.length / 2);

			const mocks = [
				mockGetChildren(getChildrenVariables(currentFolder.id), {
					...currentFolder,
					children: currentFolder.children
				} as Folder),
				mockFlagNodes(
					{
						node_ids: nodesIdsToFlag,
						flag: true
					},
					nodesIdsToFlag
				),
				mockFlagNodes(
					{
						node_ids: nodesIdsToUnflag,
						flag: false
					},
					nodesIdsToUnflag
				)
			];

			render(<FolderView />, { initialRouterEntries: [`/?folder=${currentFolder.id}`], mocks });

			// wait for the load to be completed
			await waitForElementToBeRemoved(screen.queryByTestId('icon: Refresh'));
			expect(screen.queryByTestId('icon: Flag')).not.toBeInTheDocument();

			// activate selection mode by selecting items
			selectNodes(nodesIdsToFlag);

			// check that all wanted items are selected
			expect(screen.getAllByTestId('checkedAvatar')).toHaveLength(nodesIdsToFlag.length);

			const flagIcon = await screen.findByTestId(iconRegexp.flag);
			// click on flag action on header bar
			userEvent.click(flagIcon);
			await waitForElementToBeRemoved(screen.queryAllByTestId('checkedAvatar'));
			await screen.findAllByTestId('icon: Flag');
			expect(screen.getAllByTestId('icon: Flag')).toHaveLength(nodesIdsToFlag.length);

			// activate selection mode by selecting items
			selectNodes(nodesIdsToUnflag);
			// check that all wanted items are selected
			expect(screen.getAllByTestId('checkedAvatar')).toHaveLength(nodesIdsToUnflag.length);

			const unflagIcon = await screen.findByTestId(iconRegexp.unflag);
			userEvent.click(unflagIcon);
			await waitForElementToBeRemoved(screen.queryAllByTestId('checkedAvatar'));
			await screen.findAllByTestId('icon: Flag');
			expect(screen.getAllByTestId('icon: Flag')).toHaveLength(
				nodesIdsToFlag.length - nodesIdsToUnflag.length
			);
		});
	});

	describe('Contextual menu actions', () => {
		test('click on flag action changes flag icon visibility', async () => {
			const currentFolder = populateFolder();
			const node = populateNode();
			// set the node not flagged so that we can search by flag action in the contextual menu of first node
			node.flagged = false;
			currentFolder.children.push(node);

			const mocks = [
				mockGetChildren(getChildrenVariables(currentFolder.id), currentFolder),
				mockFlagNodes(
					{
						node_ids: [node.id],
						flag: true
					},
					[node.id]
				),
				mockFlagNodes(
					{
						node_ids: [node.id],
						flag: false
					},
					[node.id]
				)
			];

			render(<FolderView />, { initialRouterEntries: [`/?folder=${currentFolder.id}`], mocks });

			// wait for the load to be completed
			await waitForElementToBeRemoved(screen.queryByTestId('icon: Refresh'));

			// right click to open contextual menu
			const nodeItem = screen.getByTestId(`node-item-${node.id}`);
			// open context menu and click on flag action
			fireEvent.contextMenu(nodeItem);
			const flagAction = await screen.findByText(actionRegexp.flag);
			expect(flagAction).toBeVisible();
			userEvent.click(flagAction);
			await waitForNetworkResponse();
			await within(nodeItem).findByTestId('icon: Flag');
			expect(flagAction).not.toBeInTheDocument();
			expect(within(nodeItem).getByTestId('icon: Flag')).toBeVisible();
			// open context menu and click on unflag action
			fireEvent.contextMenu(nodeItem);
			const unflagAction = await screen.findByText(actionRegexp.unflag);
			expect(unflagAction).toBeVisible();
			userEvent.click(unflagAction);
			await waitForNetworkResponse();
			expect(unflagAction).not.toBeInTheDocument();
			expect(within(nodeItem).queryByTestId('icon: Flag')).not.toBeInTheDocument();
		});
	});
});
