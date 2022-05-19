/*
 * SPDX-FileCopyrightText: 2022 Zextras <https://www.zextras.com>
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import React from 'react';

import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import forEach from 'lodash/forEach';

import { CreateOptionsContent } from '../../hooks/useCreateOptions';
import { NODES_LOAD_LIMIT } from '../constants';
import { populateFolder, populateNodes } from '../mocks/mockUtils';
import { Node } from '../types/common';
import { Folder } from '../types/graphql/types';
import { getChildrenVariables, mockGetChildren, mockGetParent } from '../utils/mockUtils';
import { actionRegexp, render, selectNodes, triggerLoadMore } from '../utils/testUtils';
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

describe('Selection mode', () => {
	test('if there is no element selected, all actions are visible and disabled', async () => {
		const currentFolder = populateFolder(10);
		const mocks = [
			mockGetParent({ node_id: currentFolder.id }, currentFolder),
			mockGetChildren(getChildrenVariables(currentFolder.id), currentFolder)
		];
		render(<FolderView />, { initialRouterEntries: [`/?folder=${currentFolder.id}`], mocks });

		await screen.findByText((currentFolder.children[0] as Node).name);
		expect(screen.getByText((currentFolder.children[0] as Node).name)).toBeVisible();
		expect(screen.queryByTestId('checkedAvatar')).not.toBeInTheDocument();
		selectNodes([(currentFolder.children[0] as Node).id]);
		// check that all wanted items are selected
		expect(screen.getByTestId('checkedAvatar')).toBeInTheDocument();
		expect(screen.getByText(/select all/i)).toBeVisible();
		// deselect node. Selection mode remains active
		selectNodes([(currentFolder.children[0] as Node).id]);
		expect(screen.queryByTestId('checkedAvatar')).not.toBeInTheDocument();
		expect(screen.getAllByTestId('unCheckedAvatar')).toHaveLength(currentFolder.children.length);
		expect(screen.getByText(/select all/i)).toBeVisible();
		expect(screen.getByTestId('icon: Trash2Outline')).toBeVisible();
		expect(screen.getByTestId('icon: Trash2Outline').parentNode).toHaveAttribute('disabled', '');
		expect(screen.getByTestId('icon: MoreVertical')).toBeVisible();
		userEvent.click(screen.getByTestId('icon: MoreVertical'));
		await screen.findByText(actionRegexp.rename);
		expect(screen.getByText(actionRegexp.rename)).toBeVisible();
		expect(screen.getByText(actionRegexp.rename)).toHaveAttribute('disabled', '');
		expect(screen.getByText(actionRegexp.copy)).toBeVisible();
		expect(screen.getByText(actionRegexp.copy)).toHaveAttribute('disabled', '');
		expect(screen.getByText(actionRegexp.move)).toBeVisible();
		expect(screen.getByText(actionRegexp.move)).toHaveAttribute('disabled', '');
		expect(screen.getByText(actionRegexp.flag)).toBeVisible();
		expect(screen.getByText(actionRegexp.flag)).toHaveAttribute('disabled', '');
		expect(screen.getByText(actionRegexp.unflag)).toBeVisible();
		expect(screen.getByText(actionRegexp.unflag)).toHaveAttribute('disabled', '');
		expect(screen.getByText(actionRegexp.download)).toBeVisible();
		expect(screen.getByText(actionRegexp.download)).toHaveAttribute('disabled', '');
		expect(screen.getByText(actionRegexp.openDocument)).toBeVisible();
		expect(screen.getByText(actionRegexp.openDocument)).toHaveAttribute('disabled', '');
		expect(screen.queryByTestId('icon: RestoreOutline')).not.toBeInTheDocument();
		expect(screen.queryByTestId('icon: DeletePermanentlyOutline')).not.toBeInTheDocument();
		expect(screen.getByTestId('icon: ArrowBackOutline')).toBeVisible();
		userEvent.click(screen.getByTestId('icon: ArrowBackOutline'));
		expect(screen.queryByTestId('icon: Trash2Outline')).not.toBeInTheDocument();
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
			mockGetChildren(
				{
					...getChildrenVariables(currentFolder.id),
					cursor: (currentFolder.children[NODES_LOAD_LIMIT - 1] as Node).id
				},
				{ ...currentFolder, children: secondPage } as Folder
			)
		];
		render(<FolderView />, { initialRouterEntries: [`/?folder=${currentFolder.id}`], mocks });

		await screen.findByText((currentFolder.children[0] as Folder).name);
		expect(screen.queryByText(/select all/i)).not.toBeInTheDocument();
		selectNodes([(currentFolder.children[0] as Folder).id]);
		// check that all wanted items are selected
		expect(screen.getByTestId('checkedAvatar')).toBeInTheDocument();
		expect(screen.getByText(/\bselect all/i)).toBeVisible();
		userEvent.click(screen.getByText(/\bselect all/i));
		await screen.findByText(/deselect all/i);
		expect(screen.queryByTestId('unCheckedAvatar')).not.toBeInTheDocument();
		expect(screen.getAllByTestId('checkedAvatar')).toHaveLength(currentFolder.children.length);
		expect(screen.getByText(/deselect all/i)).toBeVisible();
		expect(screen.queryByText(/\bselect all/i)).not.toBeInTheDocument();
		await triggerLoadMore();
		await screen.findByText(secondPage[0].name);
		expect(screen.getAllByTestId('checkedAvatar')).toHaveLength(currentFolder.children.length);
		expect(screen.getAllByTestId('unCheckedAvatar')).toHaveLength(secondPage.length);
		expect(screen.queryByText(/deselect all/i)).not.toBeInTheDocument();
		expect(screen.getByText(/\bselect all/i)).toBeVisible();
		userEvent.click(screen.getByText(/\bselect all/i));
		await screen.findByText(/deselect all/i);
		expect(screen.getAllByTestId('checkedAvatar')).toHaveLength(
			currentFolder.children.length + secondPage.length
		);
		expect(screen.queryByTestId('unCheckedAvatar')).not.toBeInTheDocument();
		expect(screen.getByText(/deselect all/i)).toBeVisible();
		userEvent.click(screen.getByText(/deselect all/i));
		await screen.findByText(/\bselect all/i);
		expect(screen.getAllByTestId('unCheckedAvatar')).toHaveLength(
			currentFolder.children.length + secondPage.length
		);
		expect(screen.queryByTestId('checkedAvatar')).not.toBeInTheDocument();
	});
});
