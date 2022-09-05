/*
 * SPDX-FileCopyrightText: 2022 Zextras <https://www.zextras.com>
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import React from 'react';

import { act, screen, waitFor, waitForElementToBeRemoved, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import forEach from 'lodash/forEach';

import {
	populateGalContact,
	populateDistributionList,
	populateNode,
	populateShare,
	populateShares,
	populateUser
} from '../../../mocks/mockUtils';
import {
	GetNodeQuery,
	GetNodeQueryVariables,
	SharedTarget,
	SharePermission,
	User
} from '../../../types/graphql/types';
import {
	getNodeVariables,
	getSharesVariables,
	mockCreateShare,
	mockDeleteShare,
	mockGetAccountByEmail,
	mockGetNode,
	mockGetNodeCollaborationLinks,
	mockGetNodeLinks,
	mockGetShares,
	mockUpdateShare
} from '../../../utils/mockUtils';
import { render } from '../../../utils/testUtils';
import { getChipLabel } from '../../../utils/utils';
import { NodeSharing } from './NodeSharing';

let mockedUserLogged: User;
const mockedSoapFetch: jest.Mock = jest.fn();

beforeEach(() => {
	mockedUserLogged = populateUser(global.mockedUserLogged.id, global.mockedUserLogged.name);
});

jest.mock('../../../../network/network', () => ({
	soapFetch: (): Promise<unknown> =>
		new Promise((resolve, reject) => {
			const result = mockedSoapFetch();
			result ? resolve(result) : reject(new Error('no result provided'));
		})
}));

describe('Node Sharing', () => {
	test('render collaborators with owner as first one and logged user as second one', async () => {
		const node = populateNode();
		const user = populateUser();
		const distributionList = populateDistributionList(3);
		const userShare = populateShare(node, 'user-share', user);
		const dlShare = populateShare(node, 'dl-share', distributionList);
		const loggedUserShare = populateShare(node, 'logged-user-share', mockedUserLogged);
		node.shares = [userShare, dlShare, loggedUserShare];
		// set an owner different from logged user
		node.owner = populateUser();
		const mocks = [
			mockGetShares(getSharesVariables(node.id), node),
			mockGetNodeLinks({ node_id: node.id }, node),
			mockGetNodeCollaborationLinks({ node_id: node.id }, node)
		];
		const { getByTextWithMarkup } = render(<NodeSharing node={node} />, { mocks });
		await screen.findByText(/collaborators/i);
		await screen.findByText(user.full_name);
		expect(screen.getByText(/owner/i)).toBeVisible();
		expect(screen.getByText(node.owner.full_name)).toBeVisible();
		expect(screen.getByText(user.full_name)).toBeVisible();
		expect(screen.getByText(distributionList.name)).toBeVisible();
		expect(screen.queryByText(mockedUserLogged.full_name)).not.toBeInTheDocument();
		expect(screen.getByText(/you$/i)).toBeVisible();
		// check order of chips with a regexp
		// order is: <owner chip -> name - owner> <logged user chip -> YU (avatar label) You> <other collaborators>
		expect(
			getByTextWithMarkup(RegExp(`\\s*${node.owner.full_name}\\s*-\\s*owner\\s*YU\\s*you\\s*`, 'i'))
		).toBeInTheDocument();
	});

	describe('without share permissions', () => {
		test('render an info panel with explanation and collaborators. Add sharing panel is hidden', async () => {
			const node = populateNode();
			node.permissions.can_share = false;
			const shares = populateShares(node, 10);
			node.shares = shares;
			const mocks = [mockGetShares(getSharesVariables(node.id), node)];
			render(<NodeSharing node={node} />, { mocks });
			await screen.findByText(getChipLabel(shares[0].share_target as SharedTarget));
			expect(screen.getByText(/collaborators/i)).toBeVisible();
			forEach(shares, (share) => {
				expect(screen.getByText(getChipLabel(share.share_target as SharedTarget))).toBeVisible();
			});
			expect(screen.getByText(/You are not allowed to share this item/i)).toBeVisible();
			expect(screen.queryByText(/Add new people or groups/i)).not.toBeInTheDocument();
		});

		test('only logged user chip is removable', async () => {
			const node = populateNode();
			node.permissions.can_share = false;
			const shares = populateShares(node, 2);
			const loggedUserShare = populateShare(node, 'logged-user-share', mockedUserLogged);
			shares.push(loggedUserShare);
			node.shares = shares;
			// set owner different from logged user
			node.owner = populateUser();
			const mocks = [
				mockGetShares(getSharesVariables(node.id), node),
				mockDeleteShare(
					{ node_id: node.id, share_target_id: (loggedUserShare.share_target as SharedTarget).id },
					true
				)
			];
			render(<NodeSharing node={node} />, { mocks });
			await screen.findByText(getChipLabel(shares[0].share_target as SharedTarget));
			expect(screen.getByText(/you$/i)).toBeVisible();
			// only 1 icon close is shown, and it is the one of the logged user chip
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
			userEvent.click(screen.getByRole('button', { name: /remove/i }));
			await waitForElementToBeRemoved(screen.queryByRole('button', { name: /remove/i }));
			const snackbar = await screen.findByText(/success/i);
			await waitForElementToBeRemoved(snackbar);
			// logged user chip is removed from the list of collaborators
			expect(screen.queryByText(/you$/)).not.toBeInTheDocument();
			// no other chip is removable
			expect(screen.queryByTestId('icon: Close')).not.toBeInTheDocument();
		});
	});

	describe('with share permissions', () => {
		test('render collaborators and add sharing panel. Info panel is hidden', async () => {
			const node = populateNode();
			node.permissions.can_share = true;
			const shares = populateShares(node, 5);
			node.shares = shares;
			const mocks = [
				mockGetShares(getSharesVariables(node.id), node),
				mockGetNodeLinks({ node_id: node.id }, node),
				mockGetNodeCollaborationLinks({ node_id: node.id }, node)
			];
			render(<NodeSharing node={node} />, { mocks });
			await screen.findByText(getChipLabel(shares[0].share_target as SharedTarget));
			expect(screen.getByText(/collaborators/i)).toBeVisible();
			forEach(shares, (share) => {
				expect(screen.getByText(getChipLabel(share.share_target as SharedTarget))).toBeVisible();
			});
			expect(screen.queryByText(/You are not allowed to share this item/i)).not.toBeInTheDocument();
			expect(screen.getByText(/Add new people or groups/i)).toBeVisible();
		});

		test('owner chip is not removable', async () => {
			const node = populateNode();
			node.permissions.can_share = true;
			const shares = populateShares(node, 10);
			node.shares = shares;
			// set owner different from logged user
			node.owner = populateUser();
			const mocks = [
				mockGetShares(getSharesVariables(node.id), node),
				mockGetNodeLinks({ node_id: node.id }, node),
				mockGetNodeCollaborationLinks({ node_id: node.id }, node)
			];
			render(<NodeSharing node={node} />, { mocks });
			await screen.findByText(getChipLabel(shares[0].share_target as SharedTarget));
			expect(screen.getByText(node.owner.full_name)).toBeVisible();
			expect(screen.getAllByTestId('icon: Close')).toHaveLength(shares.length);
		});

		test('collaborator chip is removed if share is deleted', async () => {
			const node = populateNode();
			node.permissions.can_share = true;
			const user = populateUser();
			const share = populateShare(node, 'key', user);
			node.shares = [share];
			const mocks = [
				mockGetShares(getSharesVariables(node.id), node),
				mockGetNodeLinks({ node_id: node.id }, node),
				mockGetNodeCollaborationLinks({ node_id: node.id }, node),
				mockDeleteShare(
					{ node_id: node.id, share_target_id: (share.share_target as SharedTarget).id },
					true
				)
			];
			const { getByTextWithMarkup } = render(<NodeSharing node={node} />, { mocks });
			await screen.findByText(user.full_name);
			// only 1 icon close is shown, and it is the one of the collaborator
			expect(screen.getByTestId('icon: Close')).toBeVisible();
			act(() => {
				userEvent.click(screen.getByTestId('icon: Close'));
			});
			await screen.findByRole('button', { name: /remove/i });
			const regexp = RegExp(
				`Are you sure to remove all the access permission previously given to\\s*${user.full_name}\\s*?`,
				'i'
			);
			expect(getByTextWithMarkup(regexp)).toBeInTheDocument();
			userEvent.click(screen.getByRole('button', { name: /remove/i }));
			await waitForElementToBeRemoved(screen.queryByRole('button', { name: /remove/i }));
			const snackbar = await screen.findByText(/success/i);
			await waitForElementToBeRemoved(snackbar);
			// collaborator chip is removed from the list of collaborators
			expect(screen.queryByText(user.full_name)).not.toBeInTheDocument();
			// no other chip is removable
			expect(screen.queryByTestId('icon: Close')).not.toBeInTheDocument();
		});

		test('click on a collaborator chip open edit popover. On save only active chip is updated', async () => {
			const node = populateNode();
			node.permissions.can_write_file = true;
			node.permissions.can_write_folder = true;
			node.permissions.can_share = true;
			const shares = populateShares(node, 5);
			forEach(shares, (share) => {
				share.permission = SharePermission.ReadOnly;
			});
			node.shares = shares;
			const shareToUpdate = { ...shares[0], share_target: shares[0].share_target as SharedTarget };
			const mocks = [
				mockGetShares(getSharesVariables(node.id), node),
				mockGetNodeLinks({ node_id: node.id }, node),
				mockGetNodeCollaborationLinks({ node_id: node.id }, node),
				mockUpdateShare(
					{
						share_target_id: shareToUpdate.share_target.id,
						node_id: node.id,
						permission: SharePermission.ReadWriteAndShare
					},
					{ ...shareToUpdate, permission: SharePermission.ReadWriteAndShare }
				)
			];
			render(<NodeSharing node={node} />, { mocks });
			await screen.findByText(getChipLabel(shareToUpdate.share_target));
			const collaboratorsContainer = screen.getByTestId('node-sharing-collaborators');
			// all shares are set to be read-only so all chips should show EyeOutline icon
			expect(within(collaboratorsContainer).getAllByTestId('icon: EyeOutline')).toHaveLength(
				shares.length
			);
			expect(
				within(collaboratorsContainer).queryByTestId('icon: Edit2Outline')
			).not.toBeInTheDocument();
			expect(screen.queryByTestId('icon: Share')).not.toBeInTheDocument();
			// open on chip to open popover
			userEvent.click(screen.getAllByTestId('icon: EyeOutline')[0]);
			await screen.findByText(/viewer/i);
			// await screen.findByText(/edit collaboration/i);
			expect(screen.getByText(/viewer/i)).toBeVisible();
			expect(screen.getByText(/editor/i)).toBeVisible();
			expect(screen.getByText(/sharing allowed/i)).toBeVisible();
			// change share role to be editor allowed to share
			userEvent.click(screen.getByText(/editor/i));
			await waitFor(() =>
				expect(screen.getByRole('button', { name: /save/i })).not.toHaveAttribute('disabled')
			);
			act(() => {
				userEvent.click(screen.getByTestId('icon: Square'));
			});
			await screen.findByTestId('icon: CheckmarkSquare');
			act(() => {
				userEvent.click(screen.getByRole('button', { name: /save/i }));
			});
			await screen.findByTestId('icon: Edit2Outline');
			await screen.findByTestId('icon: Share');
			expect(screen.queryByRole('button', { name: /save/i })).not.toBeInTheDocument();
			expect(within(collaboratorsContainer).getAllByTestId('icon: EyeOutline')).toHaveLength(
				shares.length - 1
			);
			expect(within(collaboratorsContainer).getByTestId('icon: Edit2Outline')).toBeVisible();
			expect(within(collaboratorsContainer).getByTestId('icon: Share')).toBeVisible();
		});

		test('add of a collaborator render the new chip in the collaborators list', async () => {
			const node = populateNode();
			node.permissions.can_write_file = true;
			node.permissions.can_write_folder = true;
			node.permissions.can_share = true;
			const share = populateShare(node, 'existing-share');
			share.permission = SharePermission.ReadOnly;
			node.shares = [share];
			const user = populateUser();
			// put email to lowercase otherwise the regexp split parts in a weird way
			user.email = user.email.toLowerCase();
			const shareToCreate = populateShare(node, 'new-share', user);
			shareToCreate.permission = SharePermission.ReadWriteAndShare;
			// mock soap fetch implementation
			mockedSoapFetch.mockReturnValue({
				match: [
					populateGalContact(`${user.full_name[0]}-other-contact-1`),
					populateGalContact(user.full_name, user.email),
					populateGalContact(`${user.full_name[0]}-other-contact-2`)
				]
			});
			const mocks = [
				mockGetShares(getSharesVariables(node.id), node),
				mockGetNodeLinks({ node_id: node.id }, node),
				mockGetNodeCollaborationLinks({ node_id: node.id }, node),
				mockGetAccountByEmail({ email: user.email }, user),
				mockCreateShare(
					{
						node_id: node.id,
						permission: SharePermission.ReadWriteAndShare,
						share_target_id: (shareToCreate.share_target as SharedTarget).id
					},
					shareToCreate
				)
			];

			// write getNode query in cache and set initial router entry to contain active node id
			const mockedGetNodeQuery = mockGetNode(getNodeVariables(node.id), node);
			global.apolloClient.writeQuery<GetNodeQuery, GetNodeQueryVariables>({
				...mockedGetNodeQuery.request,
				data: {
					getNode: node
				}
			});
			render(<NodeSharing node={node} />, { mocks, initialRouterEntries: [`/?node=${node.id}`] });
			await screen.findByText(getChipLabel(share.share_target as SharedTarget));
			const collaboratorsContainer = screen.getByTestId('node-sharing-collaborators');
			await within(collaboratorsContainer).findByTestId('icon: EyeOutline');
			expect(screen.getByText(/Add new people or groups/i)).toBeVisible();
			expect(screen.getByRole('button', { name: /share/i })).toBeVisible();
			expect(screen.getByRole('button', { name: /share/i })).toHaveAttribute('disabled', '');
			// only 1 icon EyeOutline is visible, the one of the existing share
			expect(within(collaboratorsContainer).getByTestId('icon: EyeOutline')).toBeVisible();
			const chipInput = screen.getByRole('textbox', { name: /Add new people or groups/i });
			// type just the first character because the network search is requested only one time with first character.
			// All characters typed after the first one are just used to filter out the result obtained before
			act(() => {
				userEvent.type(chipInput, user.full_name[0]);
			});
			// wanted contact is shown in the dropdown
			await screen.findByTestId('dropdown-popper-list');
			await screen.findByText(user.full_name);
			expect(screen.getByText(user.full_name)).toBeVisible();
			expect(screen.getByText(user.email)).toBeVisible();
			expect(screen.getByText(RegExp(`${user.full_name[0]}-other-contact-1`, 'i'))).toBeVisible();
			expect(screen.getByText(RegExp(`${user.full_name[0]}-other-contact-2`, 'i'))).toBeVisible();
			// share button is still disabled since no valid contact has been selected yet
			expect(screen.getByRole('button', { name: /share/i })).toHaveAttribute('disabled', '');
			// now click on the dropdown element to create the chip
			userEvent.click(screen.getByText(user.full_name));
			// first contacts dropdown is closed
			await waitForElementToBeRemoved(screen.queryByText(user.email));
			// and then the new share is created as a chip
			await screen.findByText(user.full_name);
			expect(screen.queryByText(user.email)).not.toBeInTheDocument();
			expect(screen.queryByText(/other-contact/i)).not.toBeInTheDocument();
			expect(screen.getByText(user.full_name)).toBeVisible();
			// new share is created with read-only permissions by default so now there are 2 icons EyeOutline
			expect(within(collaboratorsContainer).getAllByTestId('icon: EyeOutline')).toHaveLength(2);
			// no one has the edit icon for now
			expect(
				within(collaboratorsContainer).queryByTestId('icon: Edit2Outline')
			).not.toBeInTheDocument();
			// share button is enabled
			expect(screen.getByRole('button', { name: /share/i })).not.toHaveAttribute('disabled');
			// change permissions on the new share
			userEvent.click(screen.getAllByTestId('icon: EyeOutline')[1], undefined, { skipHover: true });
			// the popover to change permission is shown
			await screen.findByText(/editor/i);
			// wait for the listener of the popover to be registered
			await waitFor(
				() =>
					new Promise((resolve) => {
						setTimeout(resolve, 2);
					})
			);
			expect(screen.getByTestId('icon: Square')).toBeVisible();
			// save button is not present since the changes on the chip are immediate
			expect(screen.queryByRole('button', { name: /save/i })).not.toBeInTheDocument();
			// now there are 2 icons EyeOutline because one is on the already existing share chip
			// and one in the new share chip.
			// The one inside the popover is not count because we are finding in collaboratorsContainer.
			expect(within(collaboratorsContainer).getAllByTestId('icon: EyeOutline')).toHaveLength(2);
			expect(screen.getByTestId('exclusive-selection-editor')).not.toHaveAttribute('disabled');
			// click on editor
			act(() => {
				userEvent.click(screen.getByText(/editor/i));
			});
			// icon on chip is immediately updated, so the edit icons become 2
			await within(collaboratorsContainer).findByTestId('icon: Edit2Outline');
			// so now we have 1 icons EyeOutline, the one in the existing share chip
			expect(within(collaboratorsContainer).getByTestId('icon: EyeOutline')).toBeInTheDocument();
			// give share permissions to the new share
			act(() => {
				userEvent.click(screen.getByTestId('icon: Square'));
			});
			await screen.findByTestId('icon: Share');
			// icon share is now visible on chip
			expect(screen.getByTestId('icon: Share')).toBeVisible();
			// click on chip to close popover
			act(() => {
				userEvent.click(screen.getByText(user.full_name), undefined, { skipHover: true });
			});
			// await waitForElementToBeRemoved(screen.queryByText(/viewer/i));
			expect(screen.queryByText(/viewer/i)).not.toBeInTheDocument();
			// click on share button to complete the creation of the new share
			userEvent.click(screen.getByRole('button', { name: /share/i }));
			// chip is removed from the add section
			expect(screen.queryByText(user.full_name)).not.toBeInTheDocument();
			// and then a new chip is created in the collaborators list
			await screen.findByText(user.full_name);
			// popover is closed
			expect(screen.queryByText(/viewer/i)).not.toBeInTheDocument();
			expect(screen.queryByText(/editor/i)).not.toBeInTheDocument();
			// share is created with read, write and share permissions, so edit and share icons are visible
			expect(screen.getByText(user.full_name)).toBeVisible();
			expect(within(collaboratorsContainer).getByTestId('icon: Edit2Outline')).toBeVisible();
			expect(screen.getByTestId('icon: Share')).toBeVisible();
			// in the collaborators list now there are 2 close icons, one for each collaborator
			expect(screen.getAllByTestId('icon: Close')).toHaveLength(2);
		});

		test('multiple share creation clears the add section and update collaborators list with newly created shares', async () => {
			const node = populateNode();
			node.permissions.can_write_file = true;
			node.permissions.can_write_folder = true;
			node.permissions.can_share = true;
			const share = populateShare(node, 'existing-share');
			share.permission = SharePermission.ReadOnly;
			node.shares = [share];
			const user1 = populateUser();
			// put email to lowercase otherwise the regexp split parts in a weird way
			user1.email = user1.email.toLowerCase();
			const user2 = populateUser();
			user2.email = user2.email.toLowerCase();
			const shareToCreate1 = populateShare(node, 'new-share-1', user1);
			shareToCreate1.permission = SharePermission.ReadAndWrite;

			const shareToCreate2 = populateShare(node, 'new-share-2', user2);
			shareToCreate2.permission = SharePermission.ReadAndShare;
			// mock soap fetch implementation
			mockedSoapFetch
				.mockReturnValueOnce({
					match: [
						populateGalContact(`${user1.full_name[0]}-other-contact-1`),
						populateGalContact(user1.full_name, user1.email),
						populateGalContact(`${user1.full_name[0]}-other-contact-2`)
					]
				})
				.mockReturnValueOnce({
					match: [
						populateGalContact(`${user2.full_name[0]}-other-contact-1`),
						populateGalContact(user2.full_name, user2.email)
					]
				});
			const mocks = [
				mockGetShares(getSharesVariables(node.id), node),
				mockGetNodeLinks({ node_id: node.id }, node),
				mockGetNodeCollaborationLinks({ node_id: node.id }, node),
				mockGetAccountByEmail({ email: user1.email }, user1),
				mockGetAccountByEmail({ email: user2.email }, user2),
				mockCreateShare(
					{
						node_id: node.id,
						permission: shareToCreate1.permission,
						share_target_id: (shareToCreate1.share_target as SharedTarget).id
					},
					shareToCreate1
				),
				mockCreateShare(
					{
						node_id: node.id,
						permission: shareToCreate2.permission,
						share_target_id: (shareToCreate2.share_target as SharedTarget).id
					},
					shareToCreate2
				)
			];

			// write getNode query in cache and set initial router entry to contain active node id
			const mockedGetNodeQuery = mockGetNode(getNodeVariables(node.id), node);
			global.apolloClient.writeQuery<GetNodeQuery, GetNodeQueryVariables>({
				...mockedGetNodeQuery.request,
				data: {
					getNode: node
				}
			});
			render(<NodeSharing node={node} />, { mocks, initialRouterEntries: [`/?node=${node.id}`] });
			await screen.findByText(getChipLabel(share.share_target as SharedTarget));
			const collaboratorsContainer = screen.getByTestId('node-sharing-collaborators');
			await within(collaboratorsContainer).findByTestId('icon: EyeOutline');
			expect(screen.getByText(/Add new people or groups/i)).toBeVisible();
			expect(screen.getByRole('button', { name: /share/i })).toBeVisible();
			expect(screen.getByRole('button', { name: /share/i })).toHaveAttribute('disabled', '');
			// 1 icon EyeOutline is visible, from the existing share
			expect(within(collaboratorsContainer).getByTestId('icon: EyeOutline')).toBeVisible();
			const chipInput = screen.getByRole('textbox', { name: /Add new people or groups/i });
			// type just the first character because the network search is requested only one time with first character.
			// All characters typed after the first one are just used to filter out the result obtained before
			act(() => {
				userEvent.type(chipInput, user1.full_name[0]);
			});
			// wanted contact is shown in the dropdown
			await screen.findByTestId('dropdown-popper-list');
			await screen.findByText(user1.full_name);
			expect(screen.getByText(user1.full_name)).toBeVisible();
			expect(screen.getByText(user1.email)).toBeVisible();
			// now click on the dropdown element to create the chip
			userEvent.click(screen.getByText(user1.full_name));
			// first contacts dropdown is closed
			await waitForElementToBeRemoved(screen.queryByText(user1.email));
			expect(screen.queryByText(user1.email)).not.toBeInTheDocument();
			// and then the new share is created as a chip
			await screen.findByText(user1.full_name);
			expect(screen.getByText(user1.full_name)).toBeVisible();
			// new share is created with read-only permissions by default so now there are 2 icons EyeOutline
			expect(within(collaboratorsContainer).getAllByTestId('icon: EyeOutline')).toHaveLength(2);
			// change permissions on the new share
			act(() => {
				userEvent.click(screen.getAllByTestId('icon: EyeOutline')[1]);
			});
			// the popover to change permission is shown
			await screen.findByText(/editor/i);
			// wait for the listener of the popover to be registered
			await waitFor(
				() =>
					new Promise((resolve) => {
						setTimeout(resolve, 2);
					})
			);
			expect(screen.getByTestId('exclusive-selection-editor')).not.toHaveAttribute('disabled');
			// click on editor to set read and write share permissions
			act(() => {
				userEvent.click(screen.getByText(/editor/i));
			});
			// icon on chip is immediately updated, so the edit icons become 1
			await within(collaboratorsContainer).findByTestId('icon: Edit2Outline');
			// now create the second share
			// type just the first character because the network search is requested only one time with first character.
			// All characters typed after the first one are just used to filter out the result obtained before
			act(() => {
				userEvent.type(chipInput, user2.full_name[0]);
			});
			// wanted contact is shown in the dropdown
			await screen.findByTestId('dropdown-popper-list');
			await screen.findByText(user2.full_name);
			// popover is closed
			expect(screen.getByText(user2.full_name)).toBeVisible();
			expect(screen.getByText(user2.email)).toBeVisible();
			// now click on the dropdown element to create the chip
			userEvent.click(screen.getByText(user2.full_name));
			// first contacts dropdown is closed
			await waitForElementToBeRemoved(screen.queryByText(user2.email));
			expect(screen.queryByText(user2.email)).not.toBeInTheDocument();
			// and then the new share is created as a chip
			await screen.findByText(user2.full_name);
			expect(screen.getByText(user2.full_name)).toBeVisible();
			// new share is created with read-only permissions by default so there are again two icon EyeOutline
			// because the other share is set on editor
			expect(within(collaboratorsContainer).getAllByTestId('icon: EyeOutline')).toHaveLength(2);
			// change permissions on the new share
			userEvent.click(screen.getAllByTestId('icon: EyeOutline')[1], undefined, { skipHover: true });
			// the popover to change permission is shown
			await screen.findByTestId('icon: Square');
			// wait for the listener of the popover to be registered
			await waitFor(
				() =>
					new Promise((resolve) => {
						setTimeout(resolve, 2);
					})
			);
			// click on the checkbox to set read and share permissions
			act(() => {
				userEvent.click(screen.getByTestId('icon: Square'));
			});
			await screen.findByTestId('icon: CheckmarkSquare');
			// the chip is updated immediately so the icon share is shown
			await screen.findByTestId('icon: Share');
			// click outside to close popover
			act(() => {
				userEvent.click(screen.getByText(/the standard message/i));
			});
			// popover is closed
			expect(screen.queryByText(/viewer/i)).not.toBeInTheDocument();
			expect(screen.queryByText(/editor/i)).not.toBeInTheDocument();
			// so now we have 1 share with write permissions (editor icon is shown)
			expect(within(collaboratorsContainer).getByTestId('icon: Edit2Outline')).toBeVisible();
			// 2 with read permission (the second one created and the already existing share)
			expect(within(collaboratorsContainer).getAllByTestId('icon: EyeOutline')).toHaveLength(2);
			// and 1 with share permissions
			expect(screen.getByTestId('icon: Share')).toBeVisible();
			// click on share button to complete the creation of the new share
			userEvent.click(screen.getByRole('button', { name: /share/i }));
			// chips are removed from the add section
			expect(screen.queryByText(user1.full_name)).not.toBeInTheDocument();
			expect(screen.queryByText(user2.full_name)).not.toBeInTheDocument();
			// and then the new chips are created in the collaborators list
			await screen.findByText(user1.full_name);
			await screen.findByText(user2.full_name);
			// shares are created with previously set permissions
			// share 1 with write
			expect(within(collaboratorsContainer).getByTestId('icon: Edit2Outline')).toBeVisible();
			// share 2 with share
			expect(screen.getByTestId('icon: Share')).toBeVisible();
			// and share 2 and pre-existing one with read
			expect(within(collaboratorsContainer).getAllByTestId('icon: EyeOutline')).toHaveLength(2);
			// in the collaborators list now there are 3 close icons, one for each collaborator
			expect(screen.getAllByTestId('icon: Close')).toHaveLength(3);
		});
	});
});
