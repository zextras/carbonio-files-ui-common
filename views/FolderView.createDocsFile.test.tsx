/*
 * SPDX-FileCopyrightText: 2022 Zextras <https://www.zextras.com>
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import React from 'react';

import { act, screen, waitForElementToBeRemoved, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import find from 'lodash/find';
import { graphql, rest } from 'msw';

import { CreateOptionsContent } from '../../hooks/useCreateOptions';
import server from '../../mocks/server';
import {
	CREATE_FILE_PATH,
	DOCS_ENDPOINT,
	NODES_LOAD_LIMIT,
	NODES_SORT_DEFAULT
} from '../constants';
import {
	CreateDocsFileRequestBody,
	CreateDocsFileResponse
} from '../mocks/handleCreateDocsFileRequest';
import { populateFile, populateFolder, populateNodes, sortNodes } from '../mocks/mockUtils';
import { Node } from '../types/common';
import { Folder, GetNodeQuery, GetNodeQueryVariables } from '../types/graphql/types';
import {
	getChildrenVariables,
	mockGetChildren,
	mockGetParent,
	mockGetPermissions
} from '../utils/mockUtils';
import { render, triggerLoadMore } from '../utils/testUtils';
import { DisplayerProps } from './components/Displayer';
import FolderView from './FolderView';

let mockedCreateOptions: CreateOptionsContent['createOptions'];

beforeEach(() => {
	mockedCreateOptions = [];
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

jest.mock('./components/Displayer', () => ({
	Displayer: (props: DisplayerProps): JSX.Element => (
		<button
			data-testid="create-docs-document-test-id"
			onClick={(ev: React.MouseEvent<HTMLButtonElement>): void => {
				if (mockedCreateOptions) {
					const createDocsDocument = mockedCreateOptions.find(
						(element) => element.id === 'create-docs-document'
					);
					if (createDocsDocument) {
						createDocsDocument.action('target').click(ev);
					}
				}
			}}
		>
			{props.translationKey}:{props.icons}
		</button>
	)
}));

describe('Create docs file', () => {
	async function createNode(newNode: { name: string }): Promise<void> {
		// wait for the creation modal to be opened
		const inputFieldDiv = await screen.findByTestId('input-name');
		const inputField = within(inputFieldDiv).getByRole('textbox');
		expect(inputField).toHaveValue('');
		userEvent.type(inputField, newNode.name);
		expect(inputField).toHaveValue(newNode.name);
		const button = screen.getByRole('button', { name: /create/i });
		userEvent.click(button);
	}

	test('Create docs file operation fail shows an error in the modal and does not close it', async () => {
		const currentFolder = populateFolder();
		currentFolder.permissions.can_write_file = true;
		const node1 = populateFile('n1', 'first');
		const node2 = populateFile('n2', 'second');
		const node3 = populateFile('n3', 'third');
		currentFolder.children.push(node1, node2, node3);

		const newName = node2.name;

		const mocks = [
			mockGetParent({ node_id: currentFolder.id }, currentFolder),
			mockGetChildren(getChildrenVariables(currentFolder.id), currentFolder),
			mockGetPermissions({ node_id: currentFolder.id }, currentFolder)
		];

		server.use(
			rest.post(`${DOCS_ENDPOINT}${CREATE_FILE_PATH}`, (req, res, ctx) =>
				res(ctx.status(500, 'Error! Name already assigned'))
			),
			graphql.query<GetNodeQuery, GetNodeQueryVariables>('getNode', (req, res, ctx) =>
				res(ctx.data({ getNode: node2 }))
			)
		);

		render(<FolderView />, { initialRouterEntries: [`/?folder=${currentFolder.id}`], mocks });

		// wait for the load to be completed
		await waitForElementToBeRemoved(screen.queryByTestId('icon: Refresh'));
		expect(screen.getAllByTestId('node-item', { exact: false })).toHaveLength(
			currentFolder.children.length
		);

		const createDocsDocument = find(
			mockedCreateOptions,
			(option) => option.id === 'create-docs-document'
		);
		expect(createDocsDocument).toBeDefined();
		if (createDocsDocument) {
			act(() => {
				const createDocsDocumentElement = screen.getByTestId('create-docs-document-test-id');
				userEvent.click(createDocsDocumentElement);
			});
		} else {
			fail();
		}

		await createNode(node2);
		const error = await screen.findByText(/Error! Name already assigned/);
		expect(error).toBeVisible();
		const inputFieldDiv = screen.getByTestId('input-name');
		const inputField = within(inputFieldDiv).getByRole('textbox');
		expect(inputField).toBeVisible();
		expect(inputField).toHaveValue(newName);
		expect(screen.getAllByTestId('node-item', { exact: false })).toHaveLength(
			currentFolder.children.length
		);
	});

	test('Create docs add file node at folder content, showing the element in the ordered list if neighbor is already loaded and ordered', async () => {
		const currentFolder = populateFolder();
		currentFolder.permissions.can_write_file = true;
		const node1 = populateFile('n1', 'first');
		const node2 = populateFile('n2', 'second');
		node2.parent = currentFolder;
		const node3 = populateFile('n3', 'third');
		// add node 1 and 3 as children, node 2 is the new file
		currentFolder.children.push(node1, node3);

		const mocks = [
			mockGetParent({ node_id: currentFolder.id }, currentFolder),
			mockGetChildren(getChildrenVariables(currentFolder.id), currentFolder),
			mockGetPermissions({ node_id: currentFolder.id }, currentFolder)
		];

		server.use(
			rest.post(DOCS_ENDPOINT + CREATE_FILE_PATH, (req, res, ctx) =>
				res(
					ctx.json({
						nodeId: node2.id
					})
				)
			),
			graphql.query<GetNodeQuery, GetNodeQueryVariables>('getNode', (req, res, ctx) =>
				res(ctx.data({ getNode: node2 }))
			)
		);

		render(<FolderView />, { initialRouterEntries: [`/?folder=${currentFolder.id}`], mocks });

		// wait for the load to be completed
		await waitForElementToBeRemoved(screen.queryByTestId('icon: Refresh'));
		expect(screen.getAllByTestId('node-item', { exact: false })).toHaveLength(
			currentFolder.children.length
		);

		const createDocsDocument = find(
			mockedCreateOptions,
			(option) => option.id === 'create-docs-document'
		);
		expect(createDocsDocument).toBeDefined();
		if (createDocsDocument) {
			act(() => {
				const createDocsDocumentElement = screen.getByTestId('create-docs-document-test-id');
				userEvent.click(createDocsDocumentElement);
			});
		} else {
			fail();
		}

		// create action
		await createNode(node2);
		await screen.findByTestId(`node-item-${node2.id}`);

		const nodeItem = await screen.findByTestId(`node-item-${node2.id}`);
		expect(screen.queryByTestId('input-name')).not.toBeInTheDocument();
		expect(nodeItem).toBeVisible();
		expect(within(nodeItem).getByText(node2.name)).toBeVisible();
		const nodes = screen.getAllByTestId('node-item', { exact: false });
		expect(nodes).toHaveLength(currentFolder.children.length + 1);
		expect(nodes[1]).toBe(nodeItem);
	});

	test('Create docs file add file node as right sorted position of the list if neighbor is already loaded but unordered', async () => {
		const currentFolder = populateFolder();
		currentFolder.children = populateNodes(NODES_LOAD_LIMIT, 'Folder');
		sortNodes(currentFolder.children, NODES_SORT_DEFAULT);
		currentFolder.permissions.can_write_folder = true;
		const node1 = populateFile('n1', `zzzz-new-file-n1`);
		node1.parent = currentFolder;
		const node2 = populateFile('n2', `zzzz-new-file-n2`);
		node2.parent = currentFolder;
		const node3 = populateFile('n3', `zzzz-new-file-n3`);
		node3.parent = currentFolder;
		// 1) folder with more pages, just 1 loaded
		// 2) create node2 as unordered node3 (not loaded) as neighbor)
		// --> node2 should be last element of the list
		// 3) create node1 as unordered (node2 (loaded and unordered) as neighbor)
		// --> node1 should be put before node2 in the unordered
		// 4) trigger loadMore and load node1, node2, node3 with this order
		// --> list should be updated with the correct order

		const mocks = [
			mockGetChildren(getChildrenVariables(currentFolder.id), currentFolder),
			mockGetPermissions({ node_id: currentFolder.id }, currentFolder),
			// fetchMore request, cursor is still last ordered node (last child of initial folder)
			mockGetChildren(
				{
					...getChildrenVariables(currentFolder.id),
					cursor: (currentFolder.children[currentFolder.children.length - 1] as Node).id
				},
				{
					...currentFolder,
					// second page contains the new created nodes and node3, not loaded before
					children: [node1, node2, node3]
				} as Folder
			)
		];

		server.use(
			rest.post<CreateDocsFileRequestBody, never, CreateDocsFileResponse>(
				`${DOCS_ENDPOINT}${CREATE_FILE_PATH}`,
				(req, res, ctx) =>
					res(
						ctx.json({
							nodeId:
								(req.body.filename === node2.name && node2.id) ||
								(req.body.filename === node1.name && node1.id) ||
								null
						})
					)
			),
			graphql.query<GetNodeQuery, GetNodeQueryVariables>('getNode', (req, res, ctx) => {
				const { node_id: id } = req.variables;
				let result = null;
				if (id === node1.id) {
					result = node1;
				} else if (id === node2.id) {
					result = node2;
				}
				return res(ctx.data({ getNode: result }));
			})
		);

		render(<FolderView />, { initialRouterEntries: [`/?folder=${currentFolder.id}`], mocks });

		// wait for the load to be completed
		await waitForElementToBeRemoved(screen.queryByTestId('icon: Refresh'));
		let nodes = screen.getAllByTestId('node-item', { exact: false });
		expect(nodes).toHaveLength(currentFolder.children.length);

		const createDocsDocument = find(
			mockedCreateOptions,
			(option) => option.id === 'create-docs-document'
		);
		expect(createDocsDocument).toBeDefined();
		if (createDocsDocument) {
			act(() => {
				const createDocsDocumentElement = screen.getByTestId('create-docs-document-test-id');
				userEvent.click(createDocsDocumentElement);
			});
		} else {
			fail();
		}

		// create action
		await createNode(node2);
		await screen.findByTestId(`node-item-${node2.id}`);
		expect(screen.getByText(node2.name)).toBeVisible();

		const node2Item = screen.getByTestId(`node-item-${node2.id}`);
		expect(screen.queryByTestId('input-name')).not.toBeInTheDocument();
		expect(node2Item).toBeVisible();
		expect(within(node2Item).getByText(node2.name)).toBeVisible();
		nodes = screen.getAllByTestId('node-item', { exact: false });
		expect(nodes).toHaveLength(currentFolder.children.length + 1);
		// node2 is last element of the list
		expect(nodes[nodes.length - 1]).toBe(node2Item);

		act(() => {
			const createDocsDocumentElement = screen.getByTestId('create-docs-document-test-id');
			userEvent.click(createDocsDocumentElement);
		});

		// create action
		await createNode(node1);
		await screen.findByTestId(`node-item-${node1.id}`);
		expect(screen.getByText(node1.name)).toBeVisible();

		expect(screen.queryByTestId('input-name')).not.toBeInTheDocument();
		const node1Item = screen.getByTestId(`node-item-${node1.id}`);
		expect(node1Item).toBeVisible();
		expect(within(node1Item).getByText(node1.name)).toBeVisible();
		nodes = screen.getAllByTestId('node-item', { exact: false });
		expect(nodes).toHaveLength(currentFolder.children.length + 2);
		// node1 is before node2 of the list
		expect(nodes[nodes.length - 2]).toBe(node1Item);
		// node2 is last element of the list
		expect(nodes[nodes.length - 1]).toBe(screen.getByTestId(`node-item-${node2.id}`));
		// trigger load more
		await triggerLoadMore();
		// wait for the load to be completed (node3 is now loaded)
		await screen.findByTestId(`node-item-${node3.id}`);
		nodes = screen.getAllByTestId('node-item', { exact: false });
		expect(nodes).toHaveLength(currentFolder.children.length + 3);
		// node1, node2 and node3 should have the correct order
		expect(screen.getByTestId(`node-item-${node1.id}`)).toBe(nodes[nodes.length - 3]);
		expect(screen.getByTestId(`node-item-${node2.id}`)).toBe(nodes[nodes.length - 2]);
		expect(screen.getByTestId(`node-item-${node3.id}`)).toBe(nodes[nodes.length - 1]);
	});
});
