/*
 * SPDX-FileCopyrightText: 2022 Zextras <https://www.zextras.com>
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import React from 'react';

import { act, screen, waitFor, waitForElementToBeRemoved } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { populateNode, populateShare, populateUser } from '../../../mocks/mockUtils';
import { SharedTarget, SharePermission } from '../../../types/graphql/types';
import { mockDeleteShare, mockUpdateShare } from '../../../utils/mockUtils';
import { render } from '../../../utils/testUtils';
import { EditShareChip } from './EditShareChip';

describe('Edit Share Chip', () => {
	describe('From a node with read-only permissions', () => {
		const node = populateNode();
		node.permissions.can_write_folder = false;
		node.permissions.can_write_file = false;
		node.permissions.can_share = false;
		const user = populateUser();

		test('render a chip of a read-only share', () => {
			const share = populateShare(node, 'abc', user);
			share.permission = SharePermission.ReadOnly;
			const deleteShare = jest.fn();
			render(
				<EditShareChip
					share={share}
					permissions={node.permissions}
					yourselfChip={false}
					deleteShare={deleteShare}
				/>
			);

			expect(screen.getByText(user.full_name)).toBeVisible();
			expect(screen.getByTestId('icon: EyeOutline')).toBeVisible();
			expect(screen.queryByTestId('icon: Edit2Outline')).not.toBeInTheDocument();
			expect(screen.queryByTestId('icon: Share')).not.toBeInTheDocument();
			expect(screen.queryByTestId('icon: Close')).not.toBeInTheDocument();
		});

		test('render a chip of a read-and-write share', () => {
			const share = populateShare(node, 'abc', user);
			share.permission = SharePermission.ReadAndWrite;
			const deleteShare = jest.fn();
			render(
				<EditShareChip
					share={share}
					permissions={node.permissions}
					yourselfChip={false}
					deleteShare={deleteShare}
				/>
			);

			expect(screen.getByText(user.full_name)).toBeVisible();
			expect(screen.queryByTestId('icon: EyeOutline')).not.toBeInTheDocument();
			expect(screen.getByTestId('icon: Edit2Outline')).toBeVisible();
			expect(screen.queryByTestId('icon: Share')).not.toBeInTheDocument();
			expect(screen.queryByTestId('icon: Close')).not.toBeInTheDocument();
		});

		test('render a chip of a read-and-share share', () => {
			const share = populateShare(node, 'abc', user);
			share.permission = SharePermission.ReadAndShare;
			const deleteShare = jest.fn();
			render(
				<EditShareChip
					deleteShare={deleteShare}
					share={share}
					permissions={node.permissions}
					yourselfChip={false}
				/>
			);

			expect(screen.getByText(user.full_name)).toBeVisible();
			expect(screen.getByTestId('icon: EyeOutline')).toBeVisible();
			expect(screen.queryByTestId('icon: Edit2Outline')).not.toBeInTheDocument();
			expect(screen.getByTestId('icon: Share')).toBeVisible();
			expect(screen.queryByTestId('icon: Close')).not.toBeInTheDocument();
		});

		test('render a chip of a read-write-and-share share', () => {
			const share = populateShare(node, 'abc', user);
			share.permission = SharePermission.ReadWriteAndShare;
			const deleteShare = jest.fn();
			render(
				<EditShareChip
					deleteShare={deleteShare}
					share={share}
					permissions={node.permissions}
					yourselfChip={false}
				/>
			);

			expect(screen.getByText(user.full_name)).toBeVisible();
			expect(screen.queryByTestId('icon: EyeOutline')).not.toBeInTheDocument();
			expect(screen.getByTestId('icon: Edit2Outline')).toBeVisible();
			expect(screen.getByTestId('icon: Share')).toBeVisible();
			expect(screen.queryByTestId('icon: Close')).not.toBeInTheDocument();
		});

		test('click on chip does not open popover', () => {
			const share = populateShare(node, 'abc', user);
			share.permission = SharePermission.ReadOnly;
			const deleteShare = jest.fn();
			render(
				<EditShareChip
					deleteShare={deleteShare}
					share={share}
					permissions={node.permissions}
					yourselfChip={false}
				/>
			);

			expect(screen.getByText(user.full_name)).toBeVisible();
			act(() => {
				userEvent.click(screen.getByText(user.full_name));
			});
			expect(screen.queryByText('Viewer')).not.toBeInTheDocument();
			expect(screen.queryByText('Editor')).not.toBeInTheDocument();
			expect(screen.queryByText('Sharing allowed')).not.toBeInTheDocument();
		});
	});

	describe('From a node with read and write permissions', () => {
		const node = populateNode();
		node.permissions.can_write_folder = true;
		node.permissions.can_write_file = true;
		node.permissions.can_share = false;
		const user = populateUser();

		test('render a chip of a read-only share', () => {
			const share = populateShare(node, 'abc', user);
			share.permission = SharePermission.ReadOnly;
			const deleteShare = jest.fn();
			render(
				<EditShareChip
					deleteShare={deleteShare}
					share={share}
					permissions={node.permissions}
					yourselfChip={false}
				/>
			);

			expect(screen.getByText(user.full_name)).toBeVisible();
			expect(screen.getByTestId('icon: EyeOutline')).toBeVisible();
			expect(screen.queryByTestId('icon: Edit2Outline')).not.toBeInTheDocument();
			expect(screen.queryByTestId('icon: Share')).not.toBeInTheDocument();
			expect(screen.queryByTestId('icon: Close')).not.toBeInTheDocument();
		});

		test('render a chip of a read-and-write share', () => {
			const share = populateShare(node, 'abc', user);
			share.permission = SharePermission.ReadAndWrite;
			const deleteShare = jest.fn();
			render(
				<EditShareChip
					deleteShare={deleteShare}
					share={share}
					permissions={node.permissions}
					yourselfChip={false}
				/>
			);

			expect(screen.getByText(user.full_name)).toBeVisible();
			expect(screen.queryByTestId('icon: EyeOutline')).not.toBeInTheDocument();
			expect(screen.getByTestId('icon: Edit2Outline')).toBeVisible();
			expect(screen.queryByTestId('icon: Share')).not.toBeInTheDocument();
			expect(screen.queryByTestId('icon: Close')).not.toBeInTheDocument();
		});

		test('render a chip of a read-and-share share', () => {
			const share = populateShare(node, 'abc', user);
			share.permission = SharePermission.ReadAndShare;
			const deleteShare = jest.fn();
			render(
				<EditShareChip
					deleteShare={deleteShare}
					share={share}
					permissions={node.permissions}
					yourselfChip={false}
				/>
			);

			expect(screen.getByText(user.full_name)).toBeVisible();
			expect(screen.getByTestId('icon: EyeOutline')).toBeVisible();
			expect(screen.queryByTestId('icon: Edit2Outline')).not.toBeInTheDocument();
			expect(screen.getByTestId('icon: Share')).toBeVisible();
			expect(screen.queryByTestId('icon: Close')).not.toBeInTheDocument();
		});

		test('render a chip of a read-write-and-share share', () => {
			const share = populateShare(node, 'abc', user);
			share.permission = SharePermission.ReadWriteAndShare;
			const deleteShare = jest.fn();
			render(
				<EditShareChip
					deleteShare={deleteShare}
					share={share}
					permissions={node.permissions}
					yourselfChip={false}
				/>
			);

			expect(screen.getByText(user.full_name)).toBeVisible();
			expect(screen.queryByTestId('icon: EyeOutline')).not.toBeInTheDocument();
			expect(screen.getByTestId('icon: Edit2Outline')).toBeVisible();
			expect(screen.getByTestId('icon: Share')).toBeVisible();
			expect(screen.queryByTestId('icon: Close')).not.toBeInTheDocument();
		});

		test('click on chip does not open popover', () => {
			const share = populateShare(node, 'abc', user);
			share.permission = SharePermission.ReadOnly;
			const deleteShare = jest.fn();
			render(
				<EditShareChip
					deleteShare={deleteShare}
					share={share}
					permissions={node.permissions}
					yourselfChip={false}
				/>
			);

			expect(screen.getByText(user.full_name)).toBeVisible();
			act(() => {
				userEvent.click(screen.getByText(user.full_name));
			});
			expect(screen.queryByText('Viewer')).not.toBeInTheDocument();
			expect(screen.queryByText('Editor')).not.toBeInTheDocument();
			expect(screen.queryByText('Sharing allowed')).not.toBeInTheDocument();
		});
	});

	describe('From a node with read and share permissions', () => {
		const node = populateNode();
		node.permissions.can_write_folder = false;
		node.permissions.can_write_file = false;
		node.permissions.can_share = true;
		const user = populateUser();

		test('render a chip of a read-only share', () => {
			const share = populateShare(node, 'abc', user);
			share.permission = SharePermission.ReadOnly;
			const deleteShare = jest.fn();
			render(
				<EditShareChip
					deleteShare={deleteShare}
					share={share}
					permissions={node.permissions}
					yourselfChip={false}
				/>
			);

			expect(screen.getByText(user.full_name)).toBeVisible();
			expect(screen.getByTestId('icon: EyeOutline')).toBeVisible();
			expect(screen.queryByTestId('icon: Edit2Outline')).not.toBeInTheDocument();
			expect(screen.queryByTestId('icon: Share')).not.toBeInTheDocument();
			expect(screen.getByTestId('icon: Close')).toBeVisible();
		});

		test('render a chip of a read-and-write share', () => {
			const share = populateShare(node, 'abc', user);
			share.permission = SharePermission.ReadAndWrite;
			const deleteShare = jest.fn();
			render(
				<EditShareChip
					deleteShare={deleteShare}
					share={share}
					permissions={node.permissions}
					yourselfChip={false}
				/>
			);

			expect(screen.getByText(user.full_name)).toBeVisible();
			expect(screen.queryByTestId('icon: EyeOutline')).not.toBeInTheDocument();
			expect(screen.getByTestId('icon: Edit2Outline')).toBeVisible();
			expect(screen.queryByTestId('icon: Share')).not.toBeInTheDocument();
			expect(screen.getByTestId('icon: Close')).toBeVisible();
		});

		test('render a chip of a read-and-share share', () => {
			const share = populateShare(node, 'abc', user);
			share.permission = SharePermission.ReadAndShare;
			const deleteShare = jest.fn();
			render(
				<EditShareChip
					deleteShare={deleteShare}
					share={share}
					permissions={node.permissions}
					yourselfChip={false}
				/>
			);

			expect(screen.getByText(user.full_name)).toBeVisible();
			expect(screen.getByTestId('icon: EyeOutline')).toBeVisible();
			expect(screen.queryByTestId('icon: Edit2Outline')).not.toBeInTheDocument();
			expect(screen.getByTestId('icon: Share')).toBeVisible();
			expect(screen.getByTestId('icon: Close')).toBeVisible();
		});

		test('render a chip of a read-write-and-share share', () => {
			const share = populateShare(node, 'abc', user);
			share.permission = SharePermission.ReadWriteAndShare;
			const deleteShare = jest.fn();
			render(
				<EditShareChip
					deleteShare={deleteShare}
					share={share}
					permissions={node.permissions}
					yourselfChip={false}
				/>
			);

			expect(screen.getByText(user.full_name)).toBeVisible();
			expect(screen.queryByTestId('icon: EyeOutline')).not.toBeInTheDocument();
			expect(screen.getByTestId('icon: Edit2Outline')).toBeVisible();
			expect(screen.getByTestId('icon: Share')).toBeVisible();
			expect(screen.getByTestId('icon: Close')).toBeVisible();
		});

		test('click on close action open confirmation dialog and then delete share', async () => {
			const share = populateShare(node, 'abc', user);
			share.permission = SharePermission.ReadAndShare;
			const mocks = [
				mockDeleteShare(
					{ node_id: node.id, share_target_id: (share.share_target as SharedTarget).id },
					true
				)
			];
			const deleteShare = jest.fn(() => Promise.resolve({ data: { deleteShare: true } }));
			render(
				<EditShareChip
					deleteShare={deleteShare}
					share={share}
					permissions={node.permissions}
					yourselfChip={false}
				/>,
				{
					mocks
				}
			);

			expect(screen.getByText(user.full_name)).toBeVisible();
			expect(screen.getByTestId('icon: Close')).toBeVisible();
			act(() => {
				userEvent.click(screen.getByTestId('icon: Close'));
			});
			await screen.findByRole('button', { name: /remove/i });
			userEvent.click(screen.getByRole('button', { name: /remove/i }));
			await waitForElementToBeRemoved(screen.queryByRole('button', { name: /remove/i }));
			expect(deleteShare).toBeCalled();
		});

		test('click on chip open popover with Editor item disabled', () => {
			const share = populateShare(node, 'abc', user);
			share.permission = SharePermission.ReadOnly;
			const deleteShare = jest.fn();
			render(
				<EditShareChip
					deleteShare={deleteShare}
					share={share}
					permissions={node.permissions}
					yourselfChip={false}
				/>
			);

			expect(screen.getByText(user.full_name)).toBeVisible();
			act(() => {
				userEvent.click(screen.getByTestId('icon: EyeOutline'));
			});
			expect(screen.getByText('Viewer')).toBeVisible();
			expect(screen.getByText('Editor')).toBeVisible();
			expect(screen.getByText('Sharing allowed')).toBeVisible();
			expect(screen.getByRole('button', { name: /save/i })).toBeVisible();

			expect(screen.getByTestId('exclusive-selection-viewer')).not.toHaveAttribute('disabled');
			expect(screen.getByTestId('exclusive-selection-editor')).toHaveAttribute('disabled', '');
		});
	});

	describe('From a node with read, write and share permissions', () => {
		const node = populateNode();
		node.permissions.can_write_folder = true;
		node.permissions.can_write_file = true;
		node.permissions.can_share = true;
		const user = populateUser();

		test('render a chip of a read-only share', () => {
			const share = populateShare(node, 'abc', user);
			share.permission = SharePermission.ReadOnly;
			const deleteShare = jest.fn();
			render(
				<EditShareChip
					deleteShare={deleteShare}
					share={share}
					permissions={node.permissions}
					yourselfChip={false}
				/>
			);

			expect(screen.getByText(user.full_name)).toBeVisible();
			expect(screen.getByTestId('icon: EyeOutline')).toBeVisible();
			expect(screen.queryByTestId('icon: Edit2Outline')).not.toBeInTheDocument();
			expect(screen.queryByTestId('icon: Share')).not.toBeInTheDocument();
			expect(screen.getByTestId('icon: Close')).toBeVisible();
		});

		test('render a chip of a read-and-write share', () => {
			const share = populateShare(node, 'abc', user);
			share.permission = SharePermission.ReadAndWrite;
			const deleteShare = jest.fn();
			render(
				<EditShareChip
					deleteShare={deleteShare}
					share={share}
					permissions={node.permissions}
					yourselfChip={false}
				/>
			);

			expect(screen.getByText(user.full_name)).toBeVisible();
			expect(screen.queryByTestId('icon: EyeOutline')).not.toBeInTheDocument();
			expect(screen.getByTestId('icon: Edit2Outline')).toBeVisible();
			expect(screen.queryByTestId('icon: Share')).not.toBeInTheDocument();
			expect(screen.getByTestId('icon: Close')).toBeVisible();
		});

		test('render a chip of a read-and-share share', () => {
			const share = populateShare(node, 'abc', user);
			share.permission = SharePermission.ReadAndShare;
			const deleteShare = jest.fn();
			render(
				<EditShareChip
					deleteShare={deleteShare}
					share={share}
					permissions={node.permissions}
					yourselfChip={false}
				/>
			);

			expect(screen.getByText(user.full_name)).toBeVisible();
			expect(screen.getByTestId('icon: EyeOutline')).toBeVisible();
			expect(screen.queryByTestId('icon: Edit2Outline')).not.toBeInTheDocument();
			expect(screen.getByTestId('icon: Share')).toBeVisible();
			expect(screen.getByTestId('icon: Close')).toBeVisible();
		});

		test('render a chip of a read-write-and-share share', () => {
			const share = populateShare(node, 'abc', user);
			share.permission = SharePermission.ReadWriteAndShare;
			const deleteShare = jest.fn();
			render(
				<EditShareChip
					deleteShare={deleteShare}
					share={share}
					permissions={node.permissions}
					yourselfChip={false}
				/>
			);

			expect(screen.getByText(user.full_name)).toBeVisible();
			expect(screen.queryByTestId('icon: EyeOutline')).not.toBeInTheDocument();
			expect(screen.getByTestId('icon: Edit2Outline')).toBeVisible();
			expect(screen.getByTestId('icon: Share')).toBeVisible();
			expect(screen.getByTestId('icon: Close')).toBeVisible();
		});

		test('click on chip open popover with all items enabled', () => {
			const share = populateShare(node, 'abc', user);
			share.permission = SharePermission.ReadOnly;
			const deleteShare = jest.fn();
			render(
				<EditShareChip
					deleteShare={deleteShare}
					share={share}
					permissions={node.permissions}
					yourselfChip={false}
				/>
			);

			expect(screen.getByText(user.full_name)).toBeVisible();
			act(() => {
				userEvent.click(screen.getByTestId('icon: EyeOutline'));
			});
			expect(screen.getByText('Viewer')).toBeVisible();
			expect(screen.getByText('Editor')).toBeVisible();
			expect(screen.getByText('Sharing allowed')).toBeVisible();

			expect(screen.getByRole('button', { name: /save/i })).toBeVisible();

			expect(screen.getByTestId('exclusive-selection-viewer')).not.toHaveAttribute('disabled');
			expect(screen.getByTestId('exclusive-selection-editor')).not.toHaveAttribute('disabled');
		});
	});

	test('render a chip of the logged user share. Click on close action open confirmation modal and then delete share', async () => {
		const node = populateNode();
		const user = populateUser(mockedUserLogged.id, mockedUserLogged.name);
		const share = populateShare(node, 'abc', user);
		const mocks = [
			mockDeleteShare(
				{ node_id: node.id, share_target_id: (share.share_target as SharedTarget).id },
				true
			)
		];
		const deleteShare = jest.fn(() => Promise.resolve({ data: { deleteShare: true } }));
		render(
			<EditShareChip
				deleteShare={deleteShare}
				share={share}
				permissions={node.permissions}
				yourselfChip
			/>,
			{
				mocks
			}
		);

		expect(screen.queryByText(user.full_name)).not.toBeInTheDocument();
		expect(screen.getByText(/you/i)).toBeVisible();
		expect(screen.getByTestId('icon: Close')).toBeVisible();
		act(() => {
			userEvent.click(screen.getByTestId('icon: Close'));
		});
		await screen.findByRole('button', { name: /remove/i });
		expect(
			screen.getByText(/Are you sure to remove yourself from this collaboration/i)
		).toBeInTheDocument();
		expect(
			screen.getByText(/All the access permission previously given to you will be lost/i)
		).toBeInTheDocument();
		const regexp = RegExp(
			`Are you sure to remove all the access permission previously given to ${user.full_name}?`,
			'i'
		);
		expect(screen.queryByText(regexp)).not.toBeInTheDocument();
		userEvent.click(screen.getByRole('button', { name: /remove/i }));
		await waitForElementToBeRemoved(screen.queryByRole('button', { name: /remove/i }));
		expect(deleteShare).toBeCalled();
	});

	test('click on close action open confirmation dialog and then delete share', async () => {
		const node = populateNode();
		node.permissions.can_share = true;
		const user = populateUser();
		const share = populateShare(node, 'abc', user);
		share.permission = SharePermission.ReadAndShare;
		const mocks = [
			mockDeleteShare(
				{ node_id: node.id, share_target_id: (share.share_target as SharedTarget).id },
				true
			)
		];
		const deleteShare = jest.fn(() => Promise.resolve({ data: { deleteShare: true } }));
		const { getByTextWithMarkup } = render(
			<EditShareChip
				deleteShare={deleteShare}
				share={share}
				permissions={node.permissions}
				yourselfChip={false}
			/>,
			{
				mocks
			}
		);

		expect(screen.getByText(user.full_name)).toBeVisible();
		expect(screen.getByTestId('icon: Close')).toBeVisible();
		act(() => {
			userEvent.click(screen.getByTestId('icon: Close'));
		});
		await screen.findByRole('button', { name: /remove/i });
		expect(
			screen.queryByText(/Are you sure to remove yourself from this collaboration/i)
		).not.toBeInTheDocument();
		expect(
			screen.queryByText(/All the access permission previously given to you will be lost/i)
		).not.toBeInTheDocument();
		const regexp = RegExp(
			`Are you sure to remove all the access permission previously given to\\s*${user.full_name}\\s*?`,
			'i'
		);
		expect(getByTextWithMarkup(regexp)).toBeInTheDocument();
		userEvent.click(screen.getByRole('button', { name: /remove/i }));
		await waitForElementToBeRemoved(screen.queryByRole('button', { name: /remove/i }));
		expect(deleteShare).toBeCalled();
	});

	describe('within popover', () => {
		test('click on other enable save button but does not trigger chip update', async () => {
			const node = populateNode();
			node.permissions.can_write_file = true;
			node.permissions.can_write_folder = true;
			node.permissions.can_share = true;
			const user = populateUser();
			const share = populateShare(node, 'abc', user);
			share.permission = SharePermission.ReadOnly;
			const updateShareMutationFn = jest.fn();

			const mocks = [
				mockUpdateShare(
					{
						share_target_id: user.id,
						node_id: node.id,
						permission: SharePermission.ReadAndWrite
					},
					share,
					updateShareMutationFn
				)
			];
			const deleteShare = jest.fn();
			render(
				<EditShareChip
					deleteShare={deleteShare}
					share={share}
					permissions={node.permissions}
					yourselfChip={false}
				/>,
				{
					mocks
				}
			);

			expect(screen.getByText(user.full_name)).toBeVisible();
			act(() => {
				userEvent.click(screen.getByTestId('icon: EyeOutline'));
			});
			await screen.findByRole('button', { name: /save/i });
			expect(screen.getByRole('button', { name: /save/i })).toBeVisible();
			expect(screen.getByRole('button', { name: /save/i })).toHaveAttribute('disabled', '');
			expect(screen.getByText(/viewer/i)).toBeVisible();
			expect(screen.getByTestId('exclusive-selection-viewer')).not.toHaveAttribute('disabled');
			expect(screen.getByText(/editor/i)).toBeVisible();
			expect(screen.getByTestId('exclusive-selection-editor')).not.toHaveAttribute('disabled');
			userEvent.click(screen.getByText(/editor/i));
			await waitFor(() =>
				expect(screen.getByRole('button', { name: /save/i })).not.toHaveAttribute('disabled')
			);
			expect(updateShareMutationFn).not.toHaveBeenCalled();
		});

		test('editor entry is disabled if node has not write permissions', async () => {
			const node = populateNode();
			node.permissions.can_write_file = false;
			node.permissions.can_write_folder = false;
			node.permissions.can_share = true;
			const user = populateUser();
			const share = populateShare(node, 'abc', user);
			share.permission = SharePermission.ReadOnly;
			const updateShareMutationFn = jest.fn();

			const mocks = [
				mockUpdateShare(
					{
						share_target_id: user.id,
						node_id: node.id,
						permission: SharePermission.ReadAndWrite
					},
					share,
					updateShareMutationFn
				)
			];
			const deleteShare = jest.fn();
			render(
				<EditShareChip
					deleteShare={deleteShare}
					share={share}
					permissions={node.permissions}
					yourselfChip={false}
				/>,
				{
					mocks
				}
			);

			expect(screen.getByText(user.full_name)).toBeVisible();
			act(() => {
				userEvent.click(screen.getByTestId('icon: EyeOutline'));
			});
			await screen.findByRole('button', { name: /save/i });
			expect(screen.getByRole('button', { name: /save/i })).toBeVisible();
			expect(screen.getByRole('button', { name: /save/i })).toHaveAttribute('disabled', '');
			expect(screen.getByText(/viewer/i)).toBeVisible();
			expect(screen.getByTestId('exclusive-selection-viewer')).not.toHaveAttribute('disabled');
			expect(screen.getByText(/editor/i)).toBeVisible();
			expect(screen.getByTestId('exclusive-selection-editor')).toHaveAttribute('disabled');
			userEvent.click(screen.getByText(/editor/i));
			expect(screen.getByRole('button', { name: /save/i })).toHaveAttribute('disabled', '');
			expect(updateShareMutationFn).not.toHaveBeenCalled();
		});

		test('click on checkbox "sharing allowed" enable save button but does not trigger chip update', async () => {
			const node = populateNode();
			node.permissions.can_write_file = true;
			node.permissions.can_write_folder = true;
			node.permissions.can_share = true;
			const user = populateUser();
			const share = populateShare(node, 'abc', user);
			share.permission = SharePermission.ReadOnly;
			const updateShareMutationFn = jest.fn();

			const mocks = [
				mockUpdateShare(
					{
						share_target_id: user.id,
						node_id: node.id,
						permission: SharePermission.ReadAndWrite
					},
					share,
					updateShareMutationFn
				)
			];
			const deleteShare = jest.fn();
			render(
				<EditShareChip
					deleteShare={deleteShare}
					share={share}
					permissions={node.permissions}
					yourselfChip={false}
				/>,
				{
					mocks
				}
			);

			expect(screen.getByText(user.full_name)).toBeVisible();
			act(() => {
				userEvent.click(screen.getByTestId('icon: EyeOutline'));
			});
			await screen.findByRole('button', { name: /save/i });
			expect(screen.getByRole('button', { name: /save/i })).toBeVisible();
			expect(screen.getByRole('button', { name: /save/i })).toHaveAttribute('disabled', '');
			expect(screen.getByText(/viewer/i)).toBeVisible();
			expect(screen.getByText(/sharing allowed/i)).toBeVisible();
			expect(screen.getByTestId('icon: Square')).toBeVisible();
			expect(screen.queryByTestId('icon: CheckmarkSquare')).not.toBeInTheDocument();
			// FIXME: I can't understand why this click cause a
			//   Warning: An update to EditShareChip inside a test was not wrapped in act(...).
			//   even if there are the await statements after the click
			act(() => {
				userEvent.click(screen.getByTestId('icon: Square'));
			});
			await waitFor(() =>
				expect(screen.getByRole('button', { name: /save/i })).not.toHaveAttribute('disabled')
			);
			await screen.findByTestId('icon: CheckmarkSquare');

			expect(updateShareMutationFn).not.toHaveBeenCalled();
			expect(screen.queryByTestId('icon: Square')).not.toBeInTheDocument();
			expect(screen.getByTestId('icon: CheckmarkSquare')).toBeVisible();
		});

		test('click on save trigger chip update. Popover is closed', async () => {
			const node = populateNode();
			node.permissions.can_write_file = true;
			node.permissions.can_write_folder = true;
			node.permissions.can_share = true;
			const user = populateUser();
			const share = populateShare(node, 'abc', user);
			share.permission = SharePermission.ReadOnly;
			const updateShareMutationFn = jest.fn();

			const mocks = [
				mockUpdateShare(
					{
						share_target_id: user.id,
						node_id: node.id,
						permission: SharePermission.ReadWriteAndShare
					},
					share,
					updateShareMutationFn
				)
			];
			const deleteShare = jest.fn();
			render(
				<EditShareChip
					deleteShare={deleteShare}
					share={share}
					permissions={node.permissions}
					yourselfChip={false}
				/>,
				{
					mocks
				}
			);

			expect(screen.getByText(user.full_name)).toBeVisible();
			act(() => {
				userEvent.click(screen.getByTestId('icon: EyeOutline'));
			});
			await screen.findByRole('button', { name: /save/i });
			expect(screen.getByTestId('icon: Square')).toBeVisible();
			act(() => {
				userEvent.click(screen.getByTestId('icon: Square'));
			});
			await waitFor(() =>
				expect(screen.getByRole('button', { name: /save/i })).not.toHaveAttribute('disabled')
			);
			await screen.findByTestId('icon: CheckmarkSquare');

			userEvent.click(screen.getByText(/editor/i));
			userEvent.click(screen.getByRole('button', { name: /save/i }));
			await waitFor(() => expect(updateShareMutationFn).toHaveBeenCalled());
			expect(screen.queryByRole('button', { name: /save/i })).not.toBeInTheDocument();
			expect(screen.queryByText(/viewer/i)).not.toBeInTheDocument();
		});
	});
});
