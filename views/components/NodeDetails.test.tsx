/*
 * SPDX-FileCopyrightText: 2022 Zextras <https://www.zextras.com>
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import React from 'react';

import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import map from 'lodash/map';

import {
	populateFile,
	populateFolder,
	populateNode,
	populateNodes,
	populateParents,
	populateShare,
	populateShares,
	populateUser
} from '../../mocks/mockUtils';
import { canUpsertDescription } from '../../utils/ActionsFactory';
import { mockGetPath } from '../../utils/mockUtils';
import { buildBreadCrumbRegExp, render } from '../../utils/testUtils';
import { formatDate, formatTime, humanFileSize } from '../../utils/utils';
import { NodeDetails } from './NodeDetails';

describe('Node Details', () => {
	test('Show file info', () => {
		const node = populateFile();
		node.parent = populateFolder();
		node.last_editor = populateUser();
		const loadMore = jest.fn();
		const downloads = 123;
		render(
			<NodeDetails
				id={node.id}
				name={node.name}
				owner={node.owner}
				creator={node.creator}
				lastEditor={node.last_editor}
				createdAt={node.created_at}
				updatedAt={node.updated_at}
				description={node.description}
				canUpsertDescription={canUpsertDescription(node)}
				loadMore={loadMore}
				loading={false}
				shares={node.shares}
				hasMore={false}
				size={node.size}
				downloads={downloads}
				type={node.type}
			/>,
			{ mocks: [] }
		);
		// expect(screen.getByText(`/${node.name}`)).toBeVisible();
		expect(screen.getByText(node.owner.full_name)).toBeVisible();
		expect(
			screen.getByText(
				`${formatDate(node.created_at, undefined, 'UTC')} - ${formatTime(node.created_at, 'UTC')}`
			)
		).toBeVisible();
		expect(screen.getByText(node.last_editor.full_name)).toBeVisible();
		expect(screen.getByText(node.last_editor.email)).toBeVisible();
		expect(
			screen.getByText(
				`${formatDate(node.updated_at, undefined, 'UTC')} - ${formatTime(node.updated_at, 'UTC')}`
			)
		).toBeVisible();
		expect(screen.getByText(node.description)).toBeVisible();
		expect(screen.getByText(humanFileSize(node.size))).toBeVisible();
		expect(screen.getByText(downloads)).toBeVisible();
	});

	test('Show folder info', () => {
		const node = populateFolder();
		node.parent = populateFolder();
		node.last_editor = populateUser();
		node.shares = populateShares(node, 5);
		const children = populateNodes(2);
		const loadMore = jest.fn();
		render(
			<NodeDetails
				id={node.id}
				name={node.name}
				owner={node.owner}
				creator={node.creator}
				lastEditor={node.last_editor}
				createdAt={node.created_at}
				updatedAt={node.updated_at}
				description={node.description}
				canUpsertDescription={canUpsertDescription(node)}
				loadMore={loadMore}
				loading={false}
				shares={node.shares}
				hasMore={false}
				nodes={children}
				type={node.type}
			/>,
			{ mocks: [] }
		);
		expect(screen.getByText('Collaborators')).toBeVisible();
		expect(screen.getAllByText(node.owner.full_name)).toHaveLength(children.length + 1);
		expect(
			screen.getByText(
				`${formatDate(node.created_at, undefined, 'UTC')} - ${formatTime(node.created_at, 'UTC')}`
			)
		).toBeVisible();
		expect(screen.getByText(node.last_editor.full_name)).toBeVisible();
		expect(screen.getByText(node.last_editor.email)).toBeVisible();
		expect(
			screen.getByText(
				`${formatDate(node.updated_at, undefined, 'UTC')} - ${formatTime(node.updated_at, 'UTC')}`
			)
		).toBeVisible();
		expect(screen.getByText(node.description)).toBeVisible();
		expect(screen.queryByText('Size')).not.toBeInTheDocument();
		expect(screen.queryByText('Downloads')).not.toBeInTheDocument();
		expect(screen.getByText('Content')).toBeVisible();
		expect(screen.getByText(children[0].name)).toBeVisible();
		expect(screen.getByText(children[1].name)).toBeVisible();
	});

	test('Labels of empty info are hidden', () => {
		const node = populateFile();
		node.permissions.can_write_file = true;
		const loadMore = jest.fn();
		render(
			<NodeDetails
				id={node.id}
				name={node.name}
				owner={node.owner}
				creator={node.creator}
				lastEditor={undefined}
				createdAt={node.created_at}
				updatedAt={node.updated_at}
				description=""
				canUpsertDescription={canUpsertDescription(node)}
				loadMore={loadMore}
				loading={false}
				shares={[]}
				hasMore={false}
				size={undefined}
				downloads={undefined}
				type={node.type}
			/>,
			{ mocks: [] }
		);
		expect(screen.getByText(node.owner.full_name)).toBeVisible();
		expect(
			screen.getByText(
				`${formatDate(node.created_at, undefined, 'UTC')} - ${formatTime(node.created_at, 'UTC')}`
			)
		).toBeVisible();
		expect(screen.queryByText('Last edit')).not.toBeInTheDocument();
		expect(screen.getByText('Description')).toBeInTheDocument();
		expect(screen.getByText('Click the edit button to add a description')).toBeInTheDocument();
		expect(screen.queryByText('Size')).not.toBeInTheDocument();
		expect(screen.queryByText('Downloads')).not.toBeInTheDocument();
		expect(screen.queryByText('Collaborators')).not.toBeInTheDocument();
	});

	test('Show path button load the full path of the node. If path is reset in cache, full path is updated in the view', async () => {
		const { node, path } = populateParents(populateNode(), 3);
		const { node: newParent, path: newPath } = populateParents(populateFolder(), 4);

		const path2 = [...newPath, { ...node, parent: newParent }];

		const mocks = [mockGetPath({ id: node.id }, path), mockGetPath({ id: node.id }, path2)];

		const loadMore = jest.fn();
		const { getByTextWithMarkup, queryByTextWithMarkup, findByTextWithMarkup } = render(
			<NodeDetails
				id={node.id}
				name={node.name}
				owner={node.owner}
				creator={node.creator}
				lastEditor={node.last_editor}
				createdAt={node.created_at}
				updatedAt={node.updated_at}
				description={node.description}
				canUpsertDescription={canUpsertDescription(node)}
				loadMore={loadMore}
				loading={false}
				shares={[]}
				hasMore={false}
				size={0}
				downloads={0}
				type={node.type}
			/>,
			{ mocks }
		);

		await screen.findByText(node.name, { exact: false });
		expect(getByTextWithMarkup(buildBreadCrumbRegExp(node.name))).toBeVisible();
		// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
		expect(screen.queryByText(node.parent!.name, { exact: false })).not.toBeInTheDocument();
		const showPathButton = screen.getByRole('button', { name: /show path/i });
		expect(showPathButton).toBeVisible();
		userEvent.click(showPathButton);
		// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
		await screen.findByText(node.parent!.name, { exact: false });
		expect(
			getByTextWithMarkup(buildBreadCrumbRegExp(...map(path, (parent) => parent.name)))
		).toBeVisible();
		expect(showPathButton).not.toBeInTheDocument();
		global.apolloClient.cache.evict({
			fieldName: 'getPath',
			args: { id: node.id }
		});
		const newBreadcrumb = buildBreadCrumbRegExp(...map(path2, (parent) => parent.name));
		await findByTextWithMarkup(newBreadcrumb);
		expect(getByTextWithMarkup(newBreadcrumb)).toBeVisible();
		expect(
			queryByTextWithMarkup(buildBreadCrumbRegExp(...map(path, (parent) => parent.name)))
		).not.toBeInTheDocument();
		expect(showPathButton).not.toBeInTheDocument();
	});

	test('Collaborators are rendered with email capitals if full_name is empty', () => {
		const node = populateFile();
		node.permissions.can_write_file = true;
		const collaborator = populateUser();
		collaborator.full_name = '';
		const share = populateShare(node, 'share-1', collaborator);
		const loadMore = jest.fn();
		render(
			<NodeDetails
				id={node.id}
				name={node.name}
				owner={node.owner}
				creator={node.owner}
				lastEditor={undefined}
				createdAt={node.created_at}
				updatedAt={node.updated_at}
				description=""
				canUpsertDescription={canUpsertDescription(node)}
				loadMore={loadMore}
				loading={false}
				shares={[share]}
				hasMore={false}
				size={undefined}
				downloads={undefined}
				type={node.type}
			/>,
			{ mocks: [] }
		);

		expect(screen.getByText(/collaborators/i)).toBeVisible();
		// capitals should be first and last letter of the email
		expect(
			screen.getByText(
				`${collaborator.email[0]}${collaborator.email[collaborator.email.length - 1]}`.toUpperCase()
			)
		).toBeVisible();
	});

	test('If owner or creator or last editor have not full name, only email is shown in corresponding row', () => {
		const node = populateFile();
		node.permissions.can_write_file = true;
		node.owner = { ...node.owner, full_name: '' };
		node.last_editor = { ...populateUser(), full_name: '' };
		node.creator = { ...node.creator, full_name: '' };
		const loadMore = jest.fn();
		render(
			<NodeDetails
				id={node.id}
				name={node.name}
				owner={node.owner}
				creator={node.creator}
				lastEditor={node.last_editor}
				createdAt={node.created_at}
				updatedAt={node.updated_at}
				description=""
				canUpsertDescription={canUpsertDescription(node)}
				loadMore={loadMore}
				loading={false}
				shares={[]}
				hasMore={false}
				size={undefined}
				downloads={undefined}
				type={node.type}
			/>,
			{ mocks: [] }
		);

		expect(screen.getByText(/owner/i)).toBeVisible();
		expect(screen.getByText(node.owner.email)).toBeVisible();
		expect(screen.getByText(/last edit/i)).toBeVisible();
		expect(screen.getByText(node.last_editor.email)).toBeVisible();
		expect(screen.getByText(/created by/i)).toBeVisible();
		expect(screen.getByText(node.creator.email)).toBeVisible();
		expect(screen.queryByText('|')).not.toBeInTheDocument();
	});
});
