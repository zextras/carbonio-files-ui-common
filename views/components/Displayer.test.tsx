/*
 * SPDX-FileCopyrightText: 2022 Zextras <https://www.zextras.com>
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import React from 'react';

import { screen, waitForElementToBeRemoved, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { act } from 'react-dom/test-utils';

import GET_CHILDREN from '../../graphql/queries/getChildren.graphql';
import {
	populateFolder,
	populateNode,
	populateNodePage,
	populateShares
} from '../../mocks/mockUtils';
import {
	File,
	Folder,
	GetChildrenQuery,
	GetChildrenQueryVariables,
	Maybe
} from '../../types/graphql/types';
import {
	getChildrenVariables,
	getNodeVariables,
	getSharesVariables,
	mockCopyNodes,
	mockGetChildren,
	mockGetNode,
	mockGetPath,
	mockGetShares,
	mockMoveNodes,
	mockUpdateNode
} from '../../utils/mockUtils';
import {
	actionRegexp,
	buildBreadCrumbRegExp,
	iconRegexp,
	renameNode,
	render
} from '../../utils/testUtils';
import { getChipLabel } from '../../utils/utils';
import { Displayer } from './Displayer';

describe('Displayer', () => {
	test('Copy action open copy modal', async () => {
		const node = populateNode();
		const parent = populateFolder(1);
		parent.permissions.can_write_file = true;
		parent.permissions.can_write_folder = true;
		parent.children.nodes.push(node);
		node.parent = parent;
		const copyNode = {
			...node,
			id: 'copied-id',
			name: `${node.name}(1)`
		};
		const mocks = [
			mockGetNode(getNodeVariables(node.id), node),
			mockGetPath({ node_id: parent.id }, [parent]),
			mockGetChildren(getChildrenVariables(parent.id), parent),
			mockCopyNodes({ node_ids: [node.id], destination_id: parent.id }, [copyNode]),
			mockGetChildren(getChildrenVariables(parent.id), {
				...parent,
				children: populateNodePage([...parent.children.nodes, copyNode])
			} as Folder),
			mockGetNode(getNodeVariables(node.id), node),
			mockGetNode(getNodeVariables(node.id), node)
		];
		const { findByTextWithMarkup } = render(<Displayer translationKey="No.node" />, {
			initialRouterEntries: [`/?node=${node.id}`],
			mocks
		});
		await screen.findAllByText(node.name);

		const copyIcon = within(screen.getByTestId('displayer-actions-header')).queryByTestId(
			iconRegexp.copy
		);
		if (copyIcon) {
			expect(copyIcon.parentNode).not.toHaveAttribute('disabled');
			act(() => {
				userEvent.click(copyIcon);
			});
		} else {
			const moreVertical = await screen.findByTestId('icon: MoreVertical');
			if (moreVertical) {
				userEvent.click(moreVertical);
				const copyAction = await screen.findByText(actionRegexp.copy);
				expect(copyAction.parentNode).not.toHaveAttribute('disabled');
				userEvent.click(copyAction);
			} else {
				fail();
			}
		}
		// modal opening
		const copyButton = await screen.findByRole('button', { name: actionRegexp.copy });
		// breadcrumb loading
		await findByTextWithMarkup(buildBreadCrumbRegExp(parent.name));
		// folder loading
		await screen.findByText((parent.children.nodes[0] as File | Folder).name);
		expect(copyButton).not.toHaveAttribute('disabled');
		act(() => {
			userEvent.click(copyButton);
		});
		await waitForElementToBeRemoved(copyButton);
		const snackbar = await screen.findByText(/item copied/i);
		await waitForElementToBeRemoved(snackbar);
		const queryResult = global.apolloClient.readQuery<GetChildrenQuery, GetChildrenQueryVariables>({
			query: GET_CHILDREN,
			variables: getChildrenVariables(parent.id)
		});
		expect((queryResult?.getNode as Maybe<Folder> | undefined)?.children.nodes || []).toHaveLength(
			3
		);
	});

	test('Move action open move modal', async () => {
		const node = populateNode();
		node.permissions.can_write_folder = true;
		node.permissions.can_write_file = true;
		const destinationFolder = populateFolder();
		destinationFolder.permissions.can_write_file = true;
		destinationFolder.permissions.can_write_folder = true;
		const parent = populateFolder();
		parent.permissions.can_write_folder = true;
		parent.permissions.can_write_file = true;
		parent.children.nodes.push(destinationFolder);
		node.parent = parent;
		const mocks = [
			mockGetNode(getNodeVariables(node.id), node),
			mockGetChildren(getChildrenVariables(parent.id), {
				...parent,
				children: populateNodePage([...parent.children.nodes, node])
			} as Folder),
			mockGetPath({ node_id: parent.id }, [parent]),
			mockMoveNodes({ node_ids: [node.id], destination_id: destinationFolder.id }, [
				{ ...node, parent: destinationFolder }
			]),
			mockGetChildren(getChildrenVariables(parent.id), parent),
			mockGetNode(getNodeVariables(node.id), node),
			mockGetNode(getNodeVariables(node.id), node)
		];
		const { findByTextWithMarkup } = render(<Displayer translationKey="No.node" />, {
			initialRouterEntries: [`/?node=${node.id}`],
			mocks
		});
		await screen.findAllByText(node.name);
		const moreVertical = screen.getByTestId('icon: MoreVertical');
		expect(moreVertical).toBeVisible();
		userEvent.click(moreVertical);
		const moveAction = await screen.findByText(actionRegexp.move);
		expect(moveAction.parentNode).not.toHaveAttribute('disabled');
		userEvent.click(moveAction);
		// modal opening
		const moveButton = await screen.findByRole('button', { name: actionRegexp.move });
		// folder loading
		const destinationFolderItem = await screen.findByText(
			(parent.children.nodes[0] as File | Folder).name
		);
		// breadcrumb loading
		await findByTextWithMarkup(buildBreadCrumbRegExp(parent.name));
		expect(moveButton).toHaveAttribute('disabled');
		userEvent.click(destinationFolderItem);
		expect(moveButton).not.toHaveAttribute('disabled');
		act(() => {
			userEvent.click(moveButton);
		});
		await waitForElementToBeRemoved(moveButton);
		const snackbar = await screen.findByText(/item moved/i);
		await waitForElementToBeRemoved(snackbar);
		await screen.findByText(/view files and folders/i);
		const queryResult = global.apolloClient.readQuery<GetChildrenQuery, GetChildrenQueryVariables>({
			query: GET_CHILDREN,
			variables: getChildrenVariables(parent.id)
		});
		expect((queryResult?.getNode as Maybe<Folder> | undefined)?.children.nodes || []).toHaveLength(
			1
		);
	});

	test('Rename action open rename modal', async () => {
		const node = populateNode();
		node.permissions.can_write_file = true;
		node.permissions.can_write_folder = true;
		const parent = populateFolder(1);
		parent.children.nodes.push(node);
		node.parent = parent;
		const newName = 'new name';
		const mocks = [
			mockGetNode(getNodeVariables(node.id), node),
			mockGetChildren(getChildrenVariables(parent.id), parent),
			mockUpdateNode({ node_id: node.id, name: newName }, { ...node, name: newName })
		];
		const { getByTextWithMarkup } = render(<Displayer translationKey="No.node" />, {
			initialRouterEntries: [`/?node=${node.id}`],
			mocks
		});
		await screen.findAllByText(node.name);
		const moreVertical = screen.getByTestId('icon: MoreVertical');
		expect(moreVertical).toBeVisible();
		userEvent.click(moreVertical);
		await renameNode(newName);
		await waitForElementToBeRemoved(screen.queryByRole('button', { name: actionRegexp.rename }));
		expect(screen.getAllByText(newName)).toHaveLength(2);
		expect(screen.queryByText(node.name)).not.toBeInTheDocument();
		expect(getByTextWithMarkup(buildBreadCrumbRegExp(newName))).toBeVisible();
	});

	test('click on collaborators avatar in details tab open shares tab', async () => {
		const node = populateNode();
		node.shares = populateShares(node, 10);
		node.permissions.can_share = false;
		const mocks = [
			mockGetNode(getNodeVariables(node.id), node),
			mockGetShares(getSharesVariables(node.id), node)
		];

		const collaborator0Name = getChipLabel(node.shares[0]?.share_target ?? { name: '' });
		const collaborator5Name = getChipLabel(node.shares[5]?.share_target ?? { name: '' });
		render(<Displayer translationKey="No.node" />, {
			initialRouterEntries: [`/?node=${node.id}`],
			mocks
		});
		await screen.findAllByText(node.name);
		await screen.findByTestId('icon: MoreHorizontalOutline');
		expect(screen.queryByText(collaborator0Name)).not.toBeInTheDocument();
		expect(screen.queryByText(collaborator5Name)).not.toBeInTheDocument();
		expect(screen.getByTestId('icon: MoreHorizontalOutline')).toBeVisible();
		act(() => {
			userEvent.click(screen.getByTestId('icon: MoreHorizontalOutline'));
		});
		await screen.findByText(collaborator0Name);
		await screen.findByText(collaborator5Name);
		await screen.findAllByTestId(/icon: (EyeOutline|Edit2Outline)/);
		// tab is changed
		expect(screen.getByText(collaborator0Name)).toBeVisible();
		expect(screen.getByText(collaborator5Name)).toBeVisible();
	});
});
