/*
 * SPDX-FileCopyrightText: 2022 Zextras <https://www.zextras.com>
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import React from 'react';

import { gql } from '@apollo/client';
import { act, fireEvent, screen, waitFor, waitForElementToBeRemoved } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import forEach from 'lodash/forEach';
import map from 'lodash/map';
import { graphql } from 'msw';

import { CreateOptionsContent } from '../../hooks/useCreateOptions';
import server from '../../mocks/server';
import {
	populateFile,
	populateFolder,
	populateNodes,
	populateParents,
	populateUser
} from '../mocks/mockUtils';
import { Node } from '../types/common';
import {
	File as FilesFile,
	Folder,
	GetChildQuery,
	GetChildQueryVariables
} from '../types/graphql/types';
import {
	getChildrenVariables,
	mockGetChildren,
	mockGetParent,
	mockGetPath,
	mockGetPermissions,
	mockMoveNodes
} from '../utils/mockUtils';
import { render, selectNodes } from '../utils/testUtils';
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
		<div data-testid="displayer">
			{props.translationKey}:{props.icons}
		</div>
	)
}));

describe('Drag and drop', () => {
	test('Drag of files in a folder with right permissions shows upload dropzone with dropzone message. Drop triggers upload in current folder', async () => {
		const currentFolder = populateFolder();
		currentFolder.permissions.can_write_file = true;
		const uploadedFiles = populateNodes(2, 'File') as FilesFile[];
		const files: File[] = [];
		forEach(uploadedFiles, (file) => {
			// eslint-disable-next-line no-param-reassign
			file.parent = currentFolder;
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
			mockGetPermissions({ node_id: currentFolder.id }, currentFolder),
			mockGetChildren(getChildrenVariables(currentFolder.id), currentFolder)
		];

		const dataTransferObj = {
			types: ['Files'],
			files
		};

		render(<FolderView />, { initialRouterEntries: [`/?folder=${currentFolder.id}`], mocks });

		await screen.findByText(/nothing here/i);

		fireEvent.dragEnter(screen.getByText(/nothing here/i), {
			dataTransfer: dataTransferObj
		});

		await screen.findByTestId('dropzone-overlay');
		expect(
			screen.getByText(/Drop here your attachments to quick-add them to this folder/m)
		).toBeVisible();

		fireEvent.drop(screen.getByText(/nothing here/i), {
			dataTransfer: dataTransferObj
		});

		await screen.findByText(uploadedFiles[0].name);
		await screen.findByText(uploadedFiles[1].name);
		expect(screen.getByText(uploadedFiles[0].name)).toBeVisible();
		expect(screen.getByText(uploadedFiles[1].name)).toBeVisible();
		expect(screen.getAllByTestId('node-item', { exact: false })).toHaveLength(
			currentFolder.children.nodes.length + uploadedFiles.length
		);
		expect(
			screen.queryByText(/Drop here your attachments to quick-add them to this folder/m)
		).not.toBeInTheDocument();
	});

	test('Drag of files in a folder without right permissions shows upload dropzone "not allowed" message. Drop does nothing', async () => {
		const currentFolder = populateFolder();
		currentFolder.permissions.can_write_file = false;
		const uploadedFiles = populateNodes(2, 'File') as FilesFile[];
		const files: File[] = [];
		forEach(uploadedFiles, (file) => {
			// eslint-disable-next-line no-param-reassign
			file.parent = currentFolder;
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
			mockGetPermissions({ node_id: currentFolder.id }, currentFolder),
			mockGetChildren(getChildrenVariables(currentFolder.id), currentFolder)
		];

		const dataTransferObj = {
			types: ['Files'],
			files
		};

		render(<FolderView />, { initialRouterEntries: [`/?folder=${currentFolder.id}`], mocks });

		await screen.findByText(/nothing here/i);

		fireEvent.dragEnter(screen.getByText(/nothing here/i), {
			dataTransfer: dataTransferObj
		});

		await screen.findByTestId('dropzone-overlay');
		expect(screen.getByText(/You cannot drop an attachment in this area/m)).toBeVisible();

		fireEvent.drop(screen.getByText(/nothing here/i), {
			dataTransfer: dataTransferObj
		});

		expect(screen.queryByText(uploadedFiles[0].name)).not.toBeInTheDocument();
		expect(screen.queryByText(uploadedFiles[1].name)).not.toBeInTheDocument();
		expect(screen.queryByTestId('node-item', { exact: false })).not.toBeInTheDocument();
		expect(
			screen.queryByText(/You cannot drop an attachment in this area/m)
		).not.toBeInTheDocument();
	});

	test('Drag of files in a folder node with right permissions inside a list shows upload dropzone of the list item. Drop triggers upload in list item folder', async () => {
		const currentFolder = populateFolder(2);
		currentFolder.permissions.can_write_file = true;
		const destinationFolder = populateFolder();
		destinationFolder.permissions.can_write_file = true;
		destinationFolder.parent = { ...currentFolder, children: { nodes: [] } } as Folder;
		currentFolder.children.nodes.push(destinationFolder);
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
			mockGetPermissions({ node_id: currentFolder.id }, currentFolder),
			mockGetChildren(getChildrenVariables(currentFolder.id), currentFolder)
		];

		const dataTransferObj = {
			types: ['Files'],
			files
		};

		render(<FolderView />, { initialRouterEntries: [`/?folder=${currentFolder.id}`], mocks });

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
		expect(screen.getAllByTestId('node-item', { exact: false })).toHaveLength(
			currentFolder.children.nodes.length
		);
		expect(screen.queryByTestId('dropzone-overlay')).not.toBeInTheDocument();
	});

	test('Drag of files in a folder node without right permissions inside a list shows upload dropzone of the list item. Drop does nothing', async () => {
		const currentFolder = populateFolder(2);
		currentFolder.permissions.can_write_file = true;
		const destinationFolder = populateFolder();
		destinationFolder.permissions.can_write_file = false;
		destinationFolder.parent = { ...currentFolder, children: { nodes: [] } } as Folder;
		currentFolder.children.nodes.push(destinationFolder);
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
			mockGetPermissions({ node_id: currentFolder.id }, currentFolder),
			mockGetChildren(getChildrenVariables(currentFolder.id), currentFolder)
		];

		const dataTransferObj = {
			types: ['Files'],
			files
		};

		render(<FolderView />, { initialRouterEntries: [`/?folder=${currentFolder.id}`], mocks });

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
		expect(screen.queryByText(/Upload occurred/i)).not.toBeInTheDocument();
		expect(screen.getAllByTestId('node-item', { exact: false })).toHaveLength(
			currentFolder.children.nodes.length
		);
		expect(reqIndex).toBe(0);
	});

	test('Drag of files in a file node inside a list with right permissions shows upload dropzone of the list. Drop trigger upload in the current folder', async () => {
		const currentFolder = populateFolder(2);
		currentFolder.permissions.can_write_file = true;
		const destinationFile = populateFile();
		destinationFile.permissions.can_write_file = true;
		destinationFile.parent = { ...currentFolder, children: { nodes: [] } } as Folder;
		currentFolder.children.nodes.push(destinationFile);
		const uploadedFiles = populateNodes(2, 'File') as FilesFile[];
		const files: File[] = [];
		forEach(uploadedFiles, (file) => {
			// eslint-disable-next-line no-param-reassign
			file.parent = currentFolder;
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
			mockGetPermissions({ node_id: currentFolder.id }, currentFolder),
			mockGetChildren(getChildrenVariables(currentFolder.id), currentFolder)
		];

		const dataTransferObj = {
			types: ['Files'],
			files
		};

		render(<FolderView />, { initialRouterEntries: [`/?folder=${currentFolder.id}`], mocks });

		await screen.findByText(destinationFile.name);

		fireEvent.dragEnter(screen.getByText(destinationFile.name), {
			dataTransfer: dataTransferObj
		});

		await screen.findByTestId('dropzone-overlay');
		expect(
			screen.queryByText(/Drop here your attachments to quick-add them to this folder/m)
		).toBeVisible();

		fireEvent.drop(screen.getByText(destinationFile.name), {
			dataTransfer: dataTransferObj
		});

		await screen.findByText(uploadedFiles[0].name);
		await screen.findByText(uploadedFiles[1].name);
		expect(screen.getByText(uploadedFiles[0].name)).toBeVisible();
		expect(screen.getByText(uploadedFiles[1].name)).toBeVisible();
		expect(screen.getAllByTestId('node-item', { exact: false })).toHaveLength(
			currentFolder.children.nodes.length + uploadedFiles.length
		);
		expect(
			screen.queryByText(/Drop here your attachments to quick-add them to this folder/m)
		).not.toBeInTheDocument();
	});

	test('Drag of a node shows move dropzone in other nodes. Dragged node is disabled. Drop triggers move only on folders with right permissions.	Dragged node is removed from current folder list', async () => {
		const currentFolder = populateFolder(5);
		currentFolder.permissions.can_write_file = true;
		currentFolder.permissions.can_write_folder = true;
		const nodesToDrag = [currentFolder.children.nodes[0]] as Node[];
		forEach(nodesToDrag, (mockedNode) => {
			mockedNode.permissions.can_write_file = true;
			mockedNode.permissions.can_write_folder = true;
		});
		const destinationFolder = populateFolder();
		destinationFolder.permissions.can_write_folder = true;
		destinationFolder.permissions.can_write_file = true;
		destinationFolder.parent = currentFolder;
		currentFolder.children.nodes.push(destinationFolder);
		const folderWithoutPermission = populateFolder();
		folderWithoutPermission.permissions.can_write_folder = false;
		folderWithoutPermission.permissions.can_write_file = false;
		folderWithoutPermission.parent = currentFolder;
		currentFolder.children.nodes.push(folderWithoutPermission);

		const mocks = [
			mockGetChildren(getChildrenVariables(currentFolder.id), currentFolder),
			mockGetPermissions({ node_id: currentFolder.id }, currentFolder),
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

		render(<FolderView />, { initialRouterEntries: [`/?folder=${currentFolder.id}`], mocks });

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
		await waitFor(
			() =>
				new Promise((resolve) => {
					setTimeout(resolve, 100);
				})
		);
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
		expect(screen.queryByTestId('dropzone-overlay')).not.toBeInTheDocument();
		await waitForElementToBeRemoved(itemToDrag);
		expect(screen.queryByText(nodesToDrag[0].name)).not.toBeInTheDocument();
		const snackbar = await screen.findByText(/Item moved/i);
		await waitForElementToBeRemoved(snackbar);
	});

	test('Drag of a node without move permissions cause no dropzone to be shown', async () => {
		const currentFolder = populateFolder(5);
		currentFolder.permissions.can_write_file = true;
		currentFolder.permissions.can_write_folder = true;
		const nodesToDrag = [currentFolder.children.nodes[0]] as Node[];
		forEach(nodesToDrag, (mockedNode) => {
			mockedNode.permissions.can_write_file = false;
			mockedNode.permissions.can_write_folder = false;
		});
		const destinationFolder = populateFolder();
		destinationFolder.permissions.can_write_folder = true;
		destinationFolder.permissions.can_write_file = true;
		destinationFolder.parent = currentFolder;
		currentFolder.children.nodes.push(destinationFolder);
		const folderWithoutPermission = populateFolder();
		folderWithoutPermission.permissions.can_write_folder = false;
		folderWithoutPermission.permissions.can_write_file = false;
		folderWithoutPermission.parent = currentFolder;
		currentFolder.children.nodes.push(folderWithoutPermission);

		const mocks = [
			mockGetPermissions({ node_id: currentFolder.id }, currentFolder),
			mockGetChildren(getChildrenVariables(currentFolder.id), currentFolder)
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

		render(<FolderView />, { initialRouterEntries: [`/?folder=${currentFolder.id}`], mocks });

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

	test('Drag of multiple nodes create a list of dragged nodes images', async () => {
		const currentFolder = populateFolder(5);
		currentFolder.permissions.can_write_file = true;
		currentFolder.permissions.can_write_folder = true;
		const nodesToDrag = [...currentFolder.children.nodes] as Node[];
		forEach(nodesToDrag, (mockedNode) => {
			mockedNode.permissions.can_write_file = true;
			mockedNode.permissions.can_write_folder = true;
		});
		const destinationFolder = populateFolder();
		destinationFolder.permissions.can_write_folder = true;
		destinationFolder.permissions.can_write_file = true;
		destinationFolder.parent = currentFolder;
		currentFolder.children.nodes.push(destinationFolder);

		const mocks = [
			mockGetChildren(getChildrenVariables(currentFolder.id), currentFolder),
			mockGetPermissions({ node_id: currentFolder.id }, currentFolder),
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

		render(<FolderView />, { initialRouterEntries: [`/?folder=${currentFolder.id}`], mocks });

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

		const destinationItem = screen.getByText(destinationFolder.name);
		fireEvent.dragEnter(destinationItem, { dataTransfer: dataTransfer() });
		await screen.findByTestId('dropzone-overlay');
		expect(screen.getByTestId('dropzone-overlay')).toBeVisible();
		expect(screen.queryByText('Drag&Drop Mode')).not.toBeInTheDocument();
		fireEvent.drop(destinationItem, { dataTransfer: dataTransfer() });
		fireEvent.dragEnd(itemToDrag, { dataTransfer: dataTransfer() });
		expect(screen.queryByTestId('dropzone-overlay')).not.toBeInTheDocument();
		const snackbar = await screen.findByText(/Item moved/i);
		await waitForElementToBeRemoved(snackbar);
		forEach(nodesToDrag, (node) => {
			const draggedImage = screen.queryByText(node.name);
			expect(draggedImage).not.toBeInTheDocument();
		});

		expect(screen.queryByTestId('checkedAvatar')).not.toBeInTheDocument();
	});

	test('Drag of a node shows move dropzone in breadcrumbs. Drop triggers move only on crumbs with right permissions. Dragged node is removed from current folder list', async () => {
		const owner = populateUser();
		const currentFolder = populateFolder(5);
		currentFolder.permissions.can_write_file = true;
		currentFolder.permissions.can_write_folder = true;
		currentFolder.owner = owner;
		const { path } = populateParents(currentFolder, 4);
		path[0].permissions.can_write_folder = true;
		path[0].permissions.can_write_file = true;
		path[0].owner = owner;
		path[1].permissions.can_write_folder = false;
		path[1].permissions.can_write_file = false;
		path[1].owner = owner;

		const nodesToDrag = [currentFolder.children.nodes[0]] as Node[];
		forEach(nodesToDrag, (mockedNode) => {
			mockedNode.permissions.can_write_file = true;
			mockedNode.permissions.can_write_folder = true;
			mockedNode.owner = owner;
		});

		const mocks = [
			mockGetChildren(getChildrenVariables(currentFolder.id), currentFolder),
			mockGetPermissions({ node_id: currentFolder.id }, currentFolder),
			mockGetParent({ node_id: currentFolder.id }, currentFolder),
			mockGetPath({ node_id: currentFolder.id }, path),
			mockMoveNodes(
				{
					node_ids: map(nodesToDrag, (node) => node.id),
					destination_id: path[0].id
				},
				map(nodesToDrag, (node) => ({ ...node, parent: path[0] }))
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

		render(<FolderView />, { initialRouterEntries: [`/?folder=${currentFolder.id}`], mocks });

		const itemToDrag = await screen.findByText(nodesToDrag[0].name);

		// load full path
		await screen.findByText((currentFolder.parent as Folder).name);
		act(() => {
			userEvent.click(screen.getByTestId('icon: ChevronRight'));
		});
		await screen.findByText(path[0].name);
		// TODO: move fragment to graphql file and add type
		// add missing data in cache
		global.apolloClient.writeFragment({
			fragment: gql`
				fragment NodeOwner on Node {
					owner {
						id
						email
						full_name
					}
				}
			`,
			id: global.apolloClient.cache.identify(path[0]),
			data: {
				owner
			}
		});
		// TODO: move fragment to graphql file and add type
		// add missing data in cache
		global.apolloClient.writeFragment({
			fragment: gql`
				fragment NodeOwner on Node {
					owner {
						id
						email
						full_name
					}
				}
			`,
			id: global.apolloClient.cache.identify(path[1]),
			data: {
				owner
			}
		});

		// start to drag an item of the list
		fireEvent.dragStart(itemToDrag, { dataTransfer: dataTransfer() });

		// drag and drop on crumb without permissions
		const folderWithoutPermissionsItem = screen.getByText(path[1].name);
		fireEvent.dragEnter(folderWithoutPermissionsItem, { dataTransfer: dataTransfer() });
		fireEvent.dragOver(folderWithoutPermissionsItem, { dataTransfer: dataTransfer() });
		expect(folderWithoutPermissionsItem.parentElement).toHaveStyle({
			'background-color': 'rgba(130, 130, 130, 0.4)'
		});
		fireEvent.drop(folderWithoutPermissionsItem, { dataTransfer: dataTransfer() });
		fireEvent.dragEnd(itemToDrag, { dataTransfer: dataTransfer() });
		expect(itemToDrag).toBeVisible();
		expect(itemToDrag).not.toHaveAttribute('disabled', '');
		expect(folderWithoutPermissionsItem).toHaveStyle({
			'background-color': ''
		});

		// drag and drop on crumb with permissions
		const destinationItem = screen.getByText(path[0].name);
		fireEvent.dragStart(itemToDrag, { dataTransfer: dataTransfer() });
		fireEvent.dragEnter(destinationItem, { dataTransfer: dataTransfer() });
		fireEvent.dragOver(destinationItem, { dataTransfer: dataTransfer() });
		expect(destinationItem.parentElement).toHaveStyle({
			'background-color': 'rgba(43, 115, 210, 0.4)'
		});
		fireEvent.drop(destinationItem, { dataTransfer: dataTransfer() });
		fireEvent.dragEnd(itemToDrag, { dataTransfer: dataTransfer() });
		expect(destinationItem).toHaveStyle({
			'background-color': ''
		});
		await waitForElementToBeRemoved(itemToDrag);
		const snackbar = await screen.findByText(/Item moved/i);
		await waitForElementToBeRemoved(snackbar);
		expect(screen.queryByText(nodesToDrag[0].name)).not.toBeInTheDocument();
	});
});
