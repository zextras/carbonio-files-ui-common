/*
 * SPDX-FileCopyrightText: 2022 Zextras <https://www.zextras.com>
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import React from 'react';

import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { populateNode } from '../../../mocks/mockUtils';
import { Role } from '../../../types/common';
import { getNodeVariables, mockGetNode } from '../../../utils/mockUtils';
import { render } from '../../../utils/testUtils';
import { AddShareChip } from './AddShareChip';

describe('Add Share Chip', () => {
	test('render a chip for share with read-only permissions', () => {
		const onUpdateFn = jest.fn();
		const onCloseFn = jest.fn();
		render(
			<AddShareChip
				value={{ id: 'chip', type: 'whats dis', role: Role.Viewer, sharingAllowed: false }}
				onUpdate={onUpdateFn}
				label="Someone Name"
				onClose={onCloseFn}
			/>
		);

		expect(screen.getByText('Someone Name')).toBeVisible();
		expect(screen.getByTestId('icon: EyeOutline')).toBeVisible();
		expect(screen.queryByTestId('icon: Edit2Outline')).not.toBeInTheDocument();
		expect(screen.queryByTestId('icon: Share')).not.toBeInTheDocument();
		expect(screen.getByTestId('icon: Close')).toBeVisible();

		// eslint-disable-next-line testing-library/no-unnecessary-act
		act(() => {
			userEvent.click(screen.getByTestId('icon: Close'));
		});

		expect(onCloseFn).toHaveBeenCalled();
	});

	test('render a chip for share with read and write permissions', () => {
		const onUpdateFn = jest.fn();
		const onCloseFn = jest.fn();
		render(
			<AddShareChip
				value={{ id: 'chip', type: 'whats dis', role: Role.Editor, sharingAllowed: false }}
				onUpdate={onUpdateFn}
				label="Someone Name"
				onClose={onCloseFn}
			/>
		);

		expect(screen.getByText('Someone Name')).toBeVisible();
		expect(screen.queryByTestId('icon: EyeOutline')).not.toBeInTheDocument();
		expect(screen.getByTestId('icon: Edit2Outline')).toBeVisible();
		expect(screen.queryByTestId('icon: Share')).not.toBeInTheDocument();
		expect(screen.getByTestId('icon: Close')).toBeVisible();

		// eslint-disable-next-line testing-library/no-unnecessary-act
		act(() => {
			userEvent.click(screen.getByTestId('icon: Close'));
		});

		expect(onCloseFn).toHaveBeenCalled();
	});

	test('render a chip for share with read and share permissions', () => {
		const onUpdateFn = jest.fn();
		const onCloseFn = jest.fn();
		render(
			<AddShareChip
				value={{ id: 'chip', type: 'whats dis', role: Role.Viewer, sharingAllowed: true }}
				onUpdate={onUpdateFn}
				label="Someone Name"
				onClose={onCloseFn}
			/>
		);

		expect(screen.getByText('Someone Name')).toBeVisible();
		expect(screen.getByTestId('icon: EyeOutline')).toBeVisible();
		expect(screen.queryByTestId('icon: Edit2Outline')).not.toBeInTheDocument();
		expect(screen.getByTestId('icon: Share')).toBeVisible();
		expect(screen.getByTestId('icon: Close')).toBeVisible();

		// eslint-disable-next-line testing-library/no-unnecessary-act
		act(() => {
			userEvent.click(screen.getByTestId('icon: Close'));
		});

		expect(onCloseFn).toHaveBeenCalled();
	});

	test('render a chip for share with write and share permissions', () => {
		const onUpdateFn = jest.fn();
		const onCloseFn = jest.fn();
		render(
			<AddShareChip
				value={{ id: 'chip', type: 'whats dis', role: Role.Editor, sharingAllowed: true }}
				onUpdate={onUpdateFn}
				label="Someone Name"
				onClose={onCloseFn}
			/>
		);

		expect(screen.getByText('Someone Name')).toBeVisible();
		expect(screen.queryByTestId('icon: EyeOutline')).not.toBeInTheDocument();
		expect(screen.getByTestId('icon: Edit2Outline')).toBeVisible();
		expect(screen.getByTestId('icon: Share')).toBeVisible();
		expect(screen.getByTestId('icon: Close')).toBeVisible();

		// eslint-disable-next-line testing-library/no-unnecessary-act
		act(() => {
			userEvent.click(screen.getByTestId('icon: Close'));
		});

		expect(onCloseFn).toHaveBeenCalled();
	});

	test('click on the chip open popover which contains roles and description of roles', () => {
		const onUpdateFn = jest.fn();
		const onCloseFn = jest.fn();
		render(
			<AddShareChip
				value={{ id: 'chip', type: 'whats dis', role: Role.Viewer, sharingAllowed: false }}
				onUpdate={onUpdateFn}
				label="Someone Name"
				onClose={onCloseFn}
			/>
		);

		expect(screen.getByText('Someone Name')).toBeVisible();

		// eslint-disable-next-line testing-library/no-unnecessary-act
		act(() => {
			userEvent.click(screen.getByText('Someone Name'));
		});

		expect(screen.getByText('Viewer')).toBeVisible();
		expect(screen.getByText('It will only be able to view or download the file or folder'));
		expect(screen.getByText('Editor')).toBeVisible();
		expect(screen.getByText('It will be able to view and edit the file or folder'));
		expect(screen.getByText('Sharing allowed')).toBeVisible();
		expect(screen.getByText('It will be able to manage shares of the file or folder'));
	});

	describe('Within popover', () => {
		test('click on other role trigger update of the chip. Popover remains open', () => {
			const node = populateNode();
			node.permissions.can_write_file = true;
			node.permissions.can_write_folder = true;
			const onUpdateFn = jest.fn();
			const onCloseFn = jest.fn();

			const mockedGetNodeQuery = mockGetNode(getNodeVariables(node.id), node);

			global.apolloClient.writeQuery({
				...mockedGetNodeQuery.request,
				...mockedGetNodeQuery.result
			});

			const chip = { id: 'chip-id', type: 'whats dis', role: Role.Viewer, sharingAllowed: false };

			render(
				<AddShareChip
					value={chip}
					onUpdate={onUpdateFn}
					label="Someone Name"
					onClose={onCloseFn}
				/>,
				{ initialRouterEntries: [`/?node=${node.id}`] }
			);

			expect(screen.getByText('Someone Name')).toBeVisible();

			// eslint-disable-next-line testing-library/no-unnecessary-act
			act(() => {
				userEvent.click(screen.getByText('Someone Name'));
			});

			expect(screen.getByText('Editor')).toBeVisible();
			userEvent.click(screen.getByText('Editor'));
			expect(onUpdateFn).toHaveBeenCalled();
			expect(onUpdateFn).toHaveBeenCalledWith(chip.id, { role: Role.Editor });
			expect(screen.getByText('Viewer')).toBeVisible();
			expect(screen.getByText('Editor')).toBeVisible();
			expect(screen.getByText('Sharing allowed')).toBeVisible();
		});

		test('editor entry is disabled if user has not write permissions. Popover remains open', () => {
			const node = populateNode();
			node.permissions.can_write_file = false;
			node.permissions.can_write_folder = false;
			const onUpdateFn = jest.fn();
			const onCloseFn = jest.fn();

			const mockedGetNodeQuery = mockGetNode(getNodeVariables(node.id), node);

			global.apolloClient.writeQuery({
				...mockedGetNodeQuery.request,
				...mockedGetNodeQuery.result
			});

			render(
				<AddShareChip
					value={{ id: 'chip', type: 'whats dis', role: Role.Viewer, sharingAllowed: false }}
					onUpdate={onUpdateFn}
					label="Someone Name"
					onClose={onCloseFn}
				/>,
				{ initialRouterEntries: [`/?node=${node.id}`] }
			);

			expect(screen.getByText('Someone Name')).toBeVisible();

			// eslint-disable-next-line testing-library/no-unnecessary-act
			act(() => {
				userEvent.click(screen.getByText('Someone Name'));
			});

			expect(screen.getByTestId('exclusive-selection-editor')).toBeInTheDocument();
			expect(screen.getByText('Editor')).toBeVisible();
			expect(screen.getByTestId('exclusive-selection-editor')).toHaveAttribute('disabled', '');
			userEvent.click(screen.getByText('Editor'));
			expect(onUpdateFn).not.toHaveBeenCalled();
			expect(screen.getByText('Viewer')).toBeVisible();
			expect(screen.getByText('Editor')).toBeVisible();
			expect(screen.getByText('Sharing allowed')).toBeVisible();
		});

		test('click on unchecked checkbox "Sharing allowed" trigger update of the chip. Popover remains open', () => {
			const node = populateNode();
			node.permissions.can_write_file = true;
			node.permissions.can_write_folder = true;
			const onUpdateFn = jest.fn();
			const onCloseFn = jest.fn();

			const mockedGetNodeQuery = mockGetNode(getNodeVariables(node.id), node);

			global.apolloClient.writeQuery({
				...mockedGetNodeQuery.request,
				...mockedGetNodeQuery.result
			});

			const chip = { id: 'chip-id', type: 'whats dis', role: Role.Viewer, sharingAllowed: false };

			render(
				<AddShareChip
					value={chip}
					onUpdate={onUpdateFn}
					label="Someone Name"
					onClose={onCloseFn}
				/>,
				{ initialRouterEntries: [`/?node=${node.id}`] }
			);

			expect(screen.getByText('Someone Name')).toBeVisible();

			// eslint-disable-next-line testing-library/no-unnecessary-act
			act(() => {
				userEvent.click(screen.getByText('Someone Name'));
			});

			expect(screen.getByText('Sharing allowed')).toBeVisible();
			expect(screen.getByTestId('icon: Square')).toBeVisible();
			expect(screen.queryByTestId('icon: CheckmarkSquare')).not.toBeInTheDocument();
			// only click on checkbox trigger update
			userEvent.click(screen.getByText('Sharing allowed'));
			expect(onUpdateFn).not.toHaveBeenCalled();
			userEvent.click(screen.getByTestId('icon: Square'));
			expect(onUpdateFn).toHaveBeenCalled();
			expect(onUpdateFn).toHaveBeenCalledWith(chip.id, { sharingAllowed: true });
			expect(screen.getByText('Viewer')).toBeVisible();
			expect(screen.getByText('Editor')).toBeVisible();
			expect(screen.getByText('Sharing allowed')).toBeVisible();
		});

		test('click on checked checkbox "Sharing allowed" trigger update of the chip. Popover remains open', () => {
			const node = populateNode();
			node.permissions.can_write_file = true;
			node.permissions.can_write_folder = true;
			const onUpdateFn = jest.fn();
			const onCloseFn = jest.fn();

			const mockedGetNodeQuery = mockGetNode(getNodeVariables(node.id), node);

			global.apolloClient.writeQuery({
				...mockedGetNodeQuery.request,
				...mockedGetNodeQuery.result
			});

			const chip = { id: 'chip-id', type: 'whats dis', role: Role.Viewer, sharingAllowed: true };

			render(
				<AddShareChip
					value={chip}
					onUpdate={onUpdateFn}
					label="Someone Name"
					onClose={onCloseFn}
				/>,
				{ initialRouterEntries: [`/?node=${node.id}`] }
			);

			expect(screen.getByText('Someone Name')).toBeVisible();

			// eslint-disable-next-line testing-library/no-unnecessary-act
			act(() => {
				userEvent.click(screen.getByText('Someone Name'));
			});

			expect(screen.getByText('Sharing allowed')).toBeVisible();
			expect(screen.getByTestId('icon: CheckmarkSquare')).toBeVisible();
			expect(screen.queryByTestId('icon: Square')).not.toBeInTheDocument();
			userEvent.click(screen.getByTestId('icon: CheckmarkSquare'));
			expect(onUpdateFn).toHaveBeenCalled();
			expect(onUpdateFn).toHaveBeenCalledWith(chip.id, { sharingAllowed: false });
			expect(screen.getByText('Viewer')).toBeVisible();
			expect(screen.getByText('Editor')).toBeVisible();
			expect(screen.getByText('Sharing allowed')).toBeVisible();
		});
	});
});
