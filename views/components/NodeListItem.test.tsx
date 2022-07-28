/*
 * SPDX-FileCopyrightText: 2022 Zextras <https://www.zextras.com>
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import React from 'react';

import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { PREVIEW_PATH, PREVIEW_TYPE, REST_ENDPOINT, ROOTS } from '../../constants';
import { populateFile, populateFolder, populateNode, populateUser } from '../../mocks/mockUtils';
import { Action } from '../../types/common';
import { NodeType, User } from '../../types/graphql/types';
import { getPermittedHoverBarActions } from '../../utils/ActionsFactory';
import { iconRegexp, render } from '../../utils/testUtils';
import { formatDate, humanFileSize } from '../../utils/utils';
import * as moduleUtils from '../../utils/utils';
import { NodeListItem } from './NodeListItem';

let mockedUserLogged: User;
let mockedHistory: string[];
let mockedNavigation: jest.Mock;

beforeEach(() => {
	mockedUserLogged = populateUser(global.mockedUserLogged.id, global.mockedUserLogged.name);
	mockedHistory = [];
	mockedNavigation = jest.fn((path) => {
		mockedHistory.push(path);
	});
});

describe('Node List Item', () => {
	test('render a basic node in the list, logged user is owner and last editor', () => {
		const node = populateNode();
		render(
			<NodeListItem
				id={node.id}
				name={node.name}
				type={node.type}
				updatedAt={node.updated_at}
				owner={mockedUserLogged}
				lastEditor={mockedUserLogged}
			/>
		);

		expect(screen.getByTestId(`node-item-${node.id}`)).toBeInTheDocument();
		expect(screen.getByTestId(`node-item-${node.id}`)).toBeVisible();
		expect(screen.getByTestId(`node-item-${node.id}`)).not.toBeEmptyDOMElement();
		expect(screen.getByText(node.name)).toBeVisible();
		expect(screen.getByText(formatDate(node.updated_at, undefined, 'UTC'))).toBeVisible();
		expect(screen.queryByText(mockedUserLogged.full_name)).not.toBeInTheDocument();
	});

	test('render a folder item in the list', () => {
		const node = populateFolder();
		render(
			<NodeListItem
				id={node.id}
				name={node.name}
				type={node.type}
				updatedAt={node.updated_at}
				owner={node.owner}
			/>
		);
		expect(screen.getByText(/folder/i)).toBeInTheDocument();
		expect(screen.getByText(/folder/i)).toBeVisible();
	});

	test('ArrowCircleRight icon is visible if node is shared by me', () => {
		const node = populateNode();
		render(<NodeListItem id={node.id} name={node.name} type={node.type} outgoingShare />);
		expect(screen.getByTestId('icon: ArrowCircleRight')).toBeInTheDocument();
		expect(screen.getByTestId('icon: ArrowCircleRight')).toBeVisible();
		expect(screen.queryByTestId('icon: ArrowCircleLeft')).not.toBeInTheDocument();
	});

	test('ArrowCircleLeft icon is visible if node is shared with me', () => {
		const node = populateNode();
		render(<NodeListItem id={node.id} name={node.name} type={node.type} incomingShare />);
		expect(screen.getByTestId('icon: ArrowCircleLeft')).toBeInTheDocument();
		expect(screen.getByTestId('icon: ArrowCircleLeft')).toBeVisible();
		expect(screen.queryByTestId('icon: ArrowCircleRight')).not.toBeInTheDocument();
	});

	test('incoming and outgoing share icons are not visible if node is not shared', () => {
		const node = populateNode();
		render(
			<NodeListItem
				id={node.id}
				name={node.name}
				type={node.type}
				incomingShare={false}
				outgoingShare={false}
			/>
		);
		expect(screen.queryByTestId('icon: ArrowCircleLeft')).not.toBeInTheDocument();
		expect(screen.queryByTestId('icon: ArrowCircleRight')).not.toBeInTheDocument();
	});

	test('link icon is visible if node is linked', () => {
		const node = populateNode();
		render(<NodeListItem id={node.id} name={node.name} type={node.type} linkActive />);
		expect(screen.getByTestId('icon: Link2')).toBeInTheDocument();
		expect(screen.getByTestId('icon: Link2')).toBeVisible();
	});

	test('link icon is not visible if node is not linked', () => {
		const node = populateNode();
		render(<NodeListItem id={node.id} name={node.name} type={node.type} linkActive={false} />);
		expect(screen.queryByTestId('icon: Link2')).not.toBeInTheDocument();
	});

	test('flag icon is visible if node is flagged', () => {
		const node = populateNode();
		render(<NodeListItem id={node.id} name={node.name} type={node.type} flagActive />);
		expect(screen.getByTestId('icon: Flag')).toBeInTheDocument();
		expect(screen.getByTestId('icon: Flag')).toBeVisible();
	});

	test('flag icon is not visible if node is not flagged', () => {
		const node = populateNode();
		render(<NodeListItem id={node.id} name={node.name} type={node.type} flagActive={false} />);
		expect(screen.queryByTestId('icon: Flag')).not.toBeInTheDocument();
	});

	test('unflag action on hover is visible if node is flagged', () => {
		const node = populateNode();
		node.flagged = true;

		render(
			<NodeListItem
				id={node.id}
				name={node.name}
				type={node.type}
				flagActive={node.flagged}
				permittedHoverBarActions={getPermittedHoverBarActions(node)}
			/>
		);
		expect(screen.getByTestId('icon: UnflagOutline')).toBeInTheDocument();
		expect(screen.queryByTestId('icon: FlagOutline')).not.toBeInTheDocument();
	});

	test('flag action on hover is visible if node is not flagged ', () => {
		const node = populateNode();
		node.flagged = false;
		render(
			<NodeListItem
				id={node.id}
				name={node.name}
				type={node.type}
				flagActive={node.flagged}
				permittedHoverBarActions={getPermittedHoverBarActions(node)}
			/>
		);
		expect(screen.getByTestId('icon: FlagOutline')).toBeInTheDocument();
		expect(screen.queryByTestId('icon: UnflagOutline')).not.toBeInTheDocument();
		// TODO: toBeVisible fails but I don't know why
		// userEvent.hover(screen.getByTestId(`node-item-${node.id}`));
		// expect(screen.queryByTestId('icon: FlagOutline')).toBeVisible();
	});

	test('click on hover flag action changes flag icon visibility', () => {
		const node = populateNode();
		node.flagged = false;

		const toggleFlagTrueFunction = jest.fn();

		render(
			<NodeListItem
				id={node.id}
				name={node.name}
				type={node.type}
				flagActive={node.flagged}
				toggleFlagTrue={toggleFlagTrueFunction}
				permittedHoverBarActions={getPermittedHoverBarActions(node)}
			/>
		);
		expect(screen.queryByTestId('icon: Flag')).not.toBeInTheDocument();
		userEvent.click(screen.getByTestId('icon: FlagOutline'));
		expect(toggleFlagTrueFunction).toHaveBeenCalledTimes(1);
	});

	test('click on hover unflag action changes flag icon visibility', () => {
		const node = populateNode();
		node.flagged = true;

		const toggleFlagFalseFunction = jest.fn();

		render(
			<NodeListItem
				id={node.id}
				name={node.name}
				type={node.type}
				flagActive={node.flagged}
				toggleFlagFalse={toggleFlagFalseFunction}
				permittedHoverBarActions={getPermittedHoverBarActions(node)}
			/>
		);
		expect(screen.getByTestId('icon: Flag')).toBeInTheDocument();
		expect(screen.getByTestId('icon: Flag')).toBeVisible();
		userEvent.click(screen.getByTestId('icon: UnflagOutline'));
		expect(toggleFlagFalseFunction).toHaveBeenCalledTimes(1);
	});

	test('render a file item in the list', () => {
		const node = populateFile();
		render(
			<NodeListItem
				id={node.id}
				name={node.name}
				type={node.type}
				size={node.size}
				mimeType={node.mime_type}
				extension={node.extension}
			/>
		);
		expect(screen.getByText(node.extension as string)).toBeVisible();
		expect(screen.getByText(humanFileSize(node.size))).toBeVisible();
	});

	test('owner is visible if different from logged user', () => {
		const node = populateNode();
		node.owner = populateUser();
		render(<NodeListItem id={node.id} name={node.name} type={node.type} owner={node.owner} />);
		expect(screen.getByText(node.owner.full_name)).toBeVisible();
	});

	test('last modifier is visible if node is shared', () => {
		const node = populateNode();
		render(
			<NodeListItem
				id={node.id}
				name={node.name}
				type={node.type}
				owner={mockedUserLogged}
				lastEditor={node.last_editor}
				navigateTo={mockedNavigation}
			/>
		);
		expect(screen.getByText((node.last_editor as User).full_name)).toBeVisible();
	});

	test('double click on a folder activates navigation', () => {
		const node = populateFolder(0);
		const setActiveFn = jest.fn();
		render(
			<NodeListItem
				id={node.id}
				name={node.name}
				type={node.type}
				setActive={setActiveFn}
				navigateTo={mockedNavigation}
			/>
		);
		userEvent.dblClick(screen.getByTestId(`node-item-${node.id}`));
		expect(mockedNavigation).toHaveBeenCalledTimes(1);
		expect(mockedHistory).toContain(node.id);
		expect(mockedHistory[mockedHistory.length - 1]).toBe(node.id);
	});

	test('double click on a folder with selection mode active does nothing', () => {
		const node = populateFolder(0);
		const setActiveFn = jest.fn();
		render(
			<NodeListItem
				id={node.id}
				name={node.name}
				type={node.type}
				isSelectionModeActive
				setActive={setActiveFn}
				navigateTo={mockedNavigation}
			/>
		);
		userEvent.dblClick(screen.getByTestId(`node-item-${node.id}`));
		expect(mockedNavigation).not.toHaveBeenCalled();
	});

	test('double click on a folder marked for deletion does nothing', () => {
		const node = populateFolder(0);
		const setActiveFn = jest.fn();
		render(
			<NodeListItem
				id={node.id}
				name={node.name}
				type={node.type}
				setActive={setActiveFn}
				trashed
			/>
		);
		userEvent.dblClick(screen.getByTestId(`node-item-${node.id}`));
		expect(mockedNavigation).not.toHaveBeenCalled();
	});

	test('double click on a folder disabled does nothing', () => {
		const node = populateFolder(0);
		const setActiveFn = jest.fn();
		render(
			<NodeListItem
				id={node.id}
				name={node.name}
				type={node.type}
				setActive={setActiveFn}
				disabled
			/>
		);
		userEvent.dblClick(screen.getByTestId(`node-item-${node.id}`));
		expect(mockedNavigation).not.toHaveBeenCalled();
	});

	test('Icon change based on node type', () => {
		const { rerender } = render(<NodeListItem id="nodeId" name="name" type={NodeType.Folder} />);
		expect(screen.getByTestId('icon: Folder')).toBeInTheDocument();
		expect(screen.getByTestId('icon: Folder')).toBeVisible();
		rerender(<NodeListItem id="nodeId" name="name" type={NodeType.Text} />);
		expect(screen.getByTestId('icon: FileText')).toBeVisible();
		rerender(<NodeListItem id="nodeId" name="name" type={NodeType.Video} />);
		expect(screen.getByTestId('icon: Video')).toBeVisible();
		rerender(<NodeListItem id="nodeId" name="name" type={NodeType.Audio} />);
		expect(screen.getByTestId('icon: Music')).toBeVisible();
		rerender(<NodeListItem id="nodeId" name="name" type={NodeType.Image} />);
		expect(screen.getByTestId('icon: Image')).toBeVisible();
		rerender(<NodeListItem id="nodeId" name="name" type={NodeType.Message} />);
		expect(screen.getByTestId('icon: Email')).toBeVisible();
		rerender(<NodeListItem id="nodeId" name="name" type={NodeType.Presentation} />);
		expect(screen.getByTestId('icon: FilePresentation')).toBeVisible();
		rerender(<NodeListItem id="nodeId" name="name" type={NodeType.Spreadsheet} />);
		expect(screen.getByTestId('icon: FileCalc')).toBeVisible();
		rerender(<NodeListItem id="nodeId" name="name" type={NodeType.Application} />);
		expect(screen.getByTestId('icon: Code')).toBeVisible();
		rerender(<NodeListItem id="nodeId" name="name" type={NodeType.Other} />);
		expect(screen.getByTestId('icon: File')).toBeVisible();
		rerender(<NodeListItem id={ROOTS.TRASH} name="name" type={NodeType.Root} />);
		expect(screen.getByTestId('icon: Trash2')).toBeVisible();
		rerender(<NodeListItem id={ROOTS.SHARED_WITH_ME} name="name" type={NodeType.Root} />);
		expect(screen.getByTestId('icon: Share')).toBeVisible();
		rerender(<NodeListItem id={ROOTS.LOCAL_ROOT} name="name" type={NodeType.Root} />);
		expect(screen.getByTestId('icon: Home')).toBeVisible();
	});

	test('Double click on node of type image open preview to show image with original dimensions', async () => {
		const node = populateFile();
		node.type = NodeType.Image;
		node.extension = 'jpg';
		node.mime_type = 'image/jpeg';

		render(
			<NodeListItem
				id={node.id}
				name={node.name}
				type={node.type}
				extension={node.extension}
				size={node.size}
				version={node.version}
				mimeType={node.mime_type}
			/>
		);
		expect(screen.getByText(node.name)).toBeInTheDocument();
		expect(screen.getByText(node.name)).toBeVisible();
		expect(screen.getByText(humanFileSize(node.size))).toBeVisible();
		expect(screen.getByText(node.extension)).toBeVisible();
		userEvent.dblClick(screen.getByTestId(`node-item-${node.id}`));
		await waitFor(() => expect(screen.getAllByText(node.name)).toHaveLength(2));
		expect(screen.getAllByText(RegExp(humanFileSize(node.size)))).toHaveLength(2);
		expect(screen.getByAltText(node.name)).toBeInTheDocument();
		expect(screen.getByAltText(node.name)).toBeVisible();
		expect(screen.getByRole('img')).toHaveAttribute(
			'src',
			`${REST_ENDPOINT}${PREVIEW_PATH}/${PREVIEW_TYPE.IMAGE}/${node.id}/${node.version}/0x0?quality=high`
		);
	});

	test('Double click on node of type pdf open preview without action to open in docs', async () => {
		const node = populateFile();
		node.mime_type = 'application/pdf';
		node.type = NodeType.Application;
		node.extension = 'pdf';

		render(
			<NodeListItem
				id={node.id}
				name={node.name}
				type={node.type}
				extension={node.extension}
				size={node.size}
				version={node.version}
				mimeType={node.mime_type}
			/>
		);
		expect(screen.getByText(node.name)).toBeInTheDocument();
		expect(screen.getByText(node.name)).toBeVisible();
		expect(screen.getByText(humanFileSize(node.size))).toBeVisible();
		expect(screen.getByText(node.extension)).toBeVisible();
		userEvent.dblClick(screen.getByTestId(`node-item-${node.id}`));
		await waitFor(() => expect(screen.getAllByText(node.name)).toHaveLength(2));
		expect(screen.getAllByText(new RegExp(`^${node.extension}`, 'i'))).toHaveLength(2);
		expect(screen.getAllByText(new RegExp(humanFileSize(node.size), 'i'))).toHaveLength(2);
		expect(screen.getByTestId('icon: ArrowBackOutline')).toBeInTheDocument();
		expect(screen.getByTestId('icon: ShareOutline')).toBeInTheDocument();
		expect(screen.getByTestId('icon: DownloadOutline')).toBeInTheDocument();
		expect(screen.queryByTestId('icon: BookOpenOutline')).not.toBeInTheDocument();
	});

	test('Double click on node that is supported by both preview and docs open preview with action to open in docs', () => {
		const openWithDocsFn = jest.spyOn(moduleUtils, 'openNodeWithDocs');
		const node = populateFile();
		node.mime_type = 'application/vnd.oasis.opendocument.text';
		node.type = NodeType.Text;
		node.extension = 'odt';

		render(
			<NodeListItem
				id={node.id}
				name={node.name}
				type={node.type}
				extension={node.extension}
				size={node.size}
				version={node.version}
				mimeType={node.mime_type}
				permittedContextualMenuActions={[Action.OpenWithDocs]}
			/>
		);
		expect(screen.getByText(node.name)).toBeInTheDocument();
		expect(screen.getByText(node.name)).toBeVisible();
		expect(screen.getByText(humanFileSize(node.size))).toBeVisible();
		expect(screen.getByText(node.extension)).toBeVisible();
		userEvent.dblClick(screen.getByTestId(`node-item-${node.id}`));
		expect(screen.getAllByText(node.name)).toHaveLength(2);
		expect(screen.getAllByText(new RegExp(node.extension, 'i'))).toHaveLength(2);
		expect(screen.getAllByText(new RegExp(humanFileSize(node.size), 'i'))).toHaveLength(2);
		expect(screen.getByText(/loading pdf/i)).toBeInTheDocument();
		expect(screen.getByTestId('icon: ArrowBackOutline')).toBeInTheDocument();
		expect(screen.getByTestId('icon: ShareOutline')).toBeInTheDocument();
		expect(screen.getByTestId('icon: DownloadOutline')).toBeInTheDocument();
		expect(screen.getByTestId('icon: BookOpenOutline')).toBeInTheDocument();
		expect(openWithDocsFn).not.toHaveBeenCalled();
	});

	test('Double click on node that is not supported by preview nor docs does nothing', () => {
		const openWithDocsFn = jest.spyOn(moduleUtils, 'openNodeWithDocs');
		const getDocumentPreviewSrcFn = jest.spyOn(moduleUtils, 'getDocumentPreviewSrc');
		const getPdfPreviewSrcFn = jest.spyOn(moduleUtils, 'getPdfPreviewSrc');
		const getImgPreviewSrcFn = jest.spyOn(moduleUtils, 'getImgPreviewSrc');
		const node = populateFile();
		node.type = NodeType.Text;
		node.extension = 'txt';
		node.mime_type = 'text/plain';

		render(
			<NodeListItem
				id={node.id}
				name={node.name}
				type={node.type}
				extension={node.extension}
				size={node.size}
				version={node.version}
				mimeType={node.mime_type}
				permittedContextualMenuActions={[]}
			/>
		);
		expect(screen.getByText(node.name)).toBeInTheDocument();
		expect(screen.getByText(node.name)).toBeVisible();
		expect(screen.getByText(humanFileSize(node.size))).toBeVisible();
		expect(screen.getByText(node.extension)).toBeVisible();
		userEvent.dblClick(screen.getByTestId(`node-item-${node.id}`));
		expect(getDocumentPreviewSrcFn).not.toHaveBeenCalled();
		expect(getPdfPreviewSrcFn).not.toHaveBeenCalled();
		expect(getImgPreviewSrcFn).not.toHaveBeenCalled();
		expect(openWithDocsFn).not.toHaveBeenCalled();
	});

	test('Trash icon is visible if node is trashed and is search view', () => {
		const node = populateNode();
		render(<NodeListItem id={node.id} name={node.name} type={node.type} trashed />, {
			initialRouterEntries: ['/search']
		});
		expect(screen.getByText(node.name)).toBeVisible();
		expect(screen.getByTestId(iconRegexp.trash)).toBeVisible();
	});

	test('Trash icon is not visible if node is trashed but is not search view', () => {
		const node = populateNode();
		render(<NodeListItem id={node.id} name={node.name} type={node.type} trashed />);
		expect(screen.getByText(node.name)).toBeVisible();
		expect(screen.queryByTestId(iconRegexp.trash)).not.toBeInTheDocument();
	});

	test('Trash icon is not visible if node is not trashed and is search view', () => {
		const node = populateNode();
		render(<NodeListItem id={node.id} name={node.name} type={node.type} trashed={false} />, {
			initialRouterEntries: ['/search']
		});
		expect(screen.getByText(node.name)).toBeVisible();
		expect(screen.queryByTestId(iconRegexp.trash)).not.toBeInTheDocument();
	});
});
