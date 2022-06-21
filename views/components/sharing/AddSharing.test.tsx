/*
 * SPDX-FileCopyrightText: 2022 Zextras <https://www.zextras.com>
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import React from 'react';

import { ApolloError } from '@apollo/client';
import { act, screen, waitFor, waitForElementToBeRemoved } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import {
	populateGalContact,
	populateNode,
	populateShare,
	populateUser
} from '../../../mocks/mockUtils';
import { GetNodeQuery, GetNodeQueryVariables, SharePermission } from '../../../types/graphql/types';
import {
	getNodeVariables,
	mockCreateShare,
	mockGetAccountByEmail,
	mockGetNode
} from '../../../utils/mockUtils';
import { generateError, render } from '../../../utils/testUtils';
import { AddSharing } from './AddSharing';

const mockedSoapFetch: jest.Mock = jest.fn();

jest.mock('../../../../network/network', () => ({
	soapFetch: (): Promise<unknown> =>
		new Promise((resolve, reject) => {
			const result = mockedSoapFetch();
			result ? resolve(result) : reject(new Error('no result provided'));
		})
}));

describe('Add Sharing', () => {
	test('contact already added as new share is not shown in dropdown', async () => {
		const node = populateNode();
		node.permissions.can_share = true;
		const user = populateUser();
		// set email to lowercase to be compatible with the contacts regexp
		user.email = user.email.toLowerCase();
		const mocks = [mockGetAccountByEmail({ email: user.email }, user)];
		// mock soap fetch implementation
		mockedSoapFetch.mockReturnValue({
			match: [
				populateGalContact(`${user.full_name[0]}-other-contact-1`),
				populateGalContact(user.full_name, user.email),
				populateGalContact(`${user.full_name[0]}-other-contact-2`)
			]
		});

		render(<AddSharing node={node} />, { mocks });
		const chipInput = screen.getByText(/add new people or groups/i);
		expect(chipInput).toBeVisible();
		// type just the first character because the network search is requested only one time with first character.
		// All characters typed after the first one are just used to filter out the result obtained before
		userEvent.type(chipInput, user.full_name[0]);
		// wait for the single character to be typed
		await screen.findByText(user.full_name[0]);
		// wait for the dropdown to be shown
		await screen.findByText(user.email);
		expect(screen.getByText(user.full_name)).toBeVisible();
		expect(screen.getByText(user.email)).toBeVisible();
		userEvent.click(screen.getByText(user.email));
		// chip is created
		await screen.findByText(user.full_name);
		// dropdown is closed
		expect(screen.queryByText(user.email)).not.toBeInTheDocument();
		// now try to add a new share with the same email
		userEvent.type(chipInput, user.full_name[0]);
		await screen.findByText(RegExp(`^${user.full_name[0]}$`, 'i'));
		await screen.findAllByText(/other-contact/i);
		// email of previously added contact is not shown because this contact is filtered out from the dropdown
		expect(screen.queryByText(user.email)).not.toBeInTheDocument();
	});

	test('contact already existing as share is not shown in dropdown', async () => {
		const node = populateNode();
		node.permissions.can_share = true;
		const user = populateUser();
		// set email to lowercase to be compatible with the contacts regexp
		user.email = user.email.toLowerCase();
		const share = populateShare(node, 'existing-share-1', user);
		node.shares = [share];
		const mocks = [mockGetAccountByEmail({ email: user.email }, user)];
		// mock soap fetch implementation
		mockedSoapFetch.mockReturnValue({
			match: [
				populateGalContact(`${user.full_name[0]}-other-contact-1`),
				populateGalContact(user.full_name, user.email),
				populateGalContact(`${user.full_name[0]}-other-contact-2`)
			]
		});

		render(<AddSharing node={node} />, { mocks });
		const chipInput = screen.getByText(/add new people or groups/i);
		expect(chipInput).toBeVisible();
		// type just the first character because the network search is requested only one time with first character.
		// All characters typed after the first one are just used to filter out the result obtained before
		userEvent.type(chipInput, user.full_name[0]);
		// wait for the single character to be typed
		await screen.findByText(user.full_name[0]);
		// wait for the dropdown to be shown
		await screen.findAllByText(/other-contact/i);
		// other contacts are visible
		expect(screen.getByText(`${user.full_name[0]}-other-contact-1`)).toBeVisible();
		expect(screen.getByText(`${user.full_name[0]}-other-contact-2`)).toBeVisible();
		// already existing contact is not shown
		expect(screen.queryByText(user.full_name)).not.toBeInTheDocument();
		expect(screen.queryByText(user.email)).not.toBeInTheDocument();
	});

	test('contact of owner is not shown in dropdown', async () => {
		const node = populateNode();
		node.permissions.can_share = true;
		const user = populateUser();
		node.owner = user;
		// set email to lowercase to be compatible with the contacts regexp
		user.email = user.email.toLowerCase();
		// mock soap fetch implementation
		mockedSoapFetch.mockReturnValue({
			match: [
				populateGalContact(`${user.full_name[0]}-other-contact-1`),
				populateGalContact(user.full_name, user.email),
				populateGalContact(`${user.full_name[0]}-other-contact-2`)
			]
		});

		render(<AddSharing node={node} />, { mocks: [] });
		const chipInput = screen.getByText(/add new people or groups/i);
		expect(chipInput).toBeVisible();
		// type just the first character because the network search is requested only one time with first character.
		// All characters typed after the first one are just used to filter out the result obtained before
		userEvent.type(chipInput, user.full_name[0]);
		// wait for the single character to be typed
		await screen.findByText(user.full_name[0]);
		// wait for the dropdown to be shown
		await screen.findAllByText(/other-contact/i);
		// other contacts are visible
		expect(screen.getByText(`${user.full_name[0]}-other-contact-1`)).toBeVisible();
		expect(screen.getByText(`${user.full_name[0]}-other-contact-2`)).toBeVisible();
		// owner contact is not shown
		expect(screen.queryByText(user.full_name)).not.toBeInTheDocument();
		expect(screen.queryByText(user.email)).not.toBeInTheDocument();
	});

	test('contacts with same email are shown as uniq entry in dropdown', async () => {
		const node = populateNode();
		node.permissions.can_share = true;
		// mock soap fetch implementation
		mockedSoapFetch.mockReturnValue({
			match: [
				populateGalContact('contact-1', 'contact1@example.com'),
				populateGalContact('contact-2', 'contactsamemail@example.com'),
				populateGalContact('contact-3', 'contactsamemail@example.com'),
				populateGalContact('contact-4', 'contact4@example.com')
			]
		});

		render(<AddSharing node={node} />, { mocks: [] });
		const chipInput = screen.getByText(/add new people or groups/i);
		expect(chipInput).toBeVisible();
		userEvent.type(chipInput, 'c');
		// wait for the single character to be typed
		await screen.findByText('c');
		// wait for the dropdown to be shown
		await screen.findAllByText(/contact/i);
		expect(screen.getByText('contact1@example.com')).toBeVisible();
		// with the getBy query we assume there is just one entry
		expect(screen.getByText('contactsamemail@example.com')).toBeVisible();
		expect(screen.getByText('contact4@example.com')).toBeVisible();
		expect(screen.getAllByText(/contact-[0-9]/)).toHaveLength(3);
		expect(screen.queryByText('contact-3')).not.toBeInTheDocument();
	});

	test('when user delete text inside chip input dropdown is cleared', async () => {
		const node = populateNode();
		node.permissions.can_share = true;
		// mock soap fetch implementation
		mockedSoapFetch.mockReturnValue({
			match: [
				populateGalContact('contact-1', 'contact1@example.com'),
				populateGalContact('contact-2', 'contact2@example.com'),
				populateGalContact('contact-3', 'contact3@example.com')
			]
		});

		render(<AddSharing node={node} />, { mocks: [] });
		const chipInput = screen.getByText(/add new people or groups/i);
		expect(chipInput).toBeVisible();
		userEvent.type(chipInput, 'c');
		// wait for the single character to be typed
		await screen.findByText('c');
		// wait for the dropdown to be shown
		await screen.findAllByText(/contact/i);
		// dropdown contains 3 entries
		expect(screen.getAllByText(/contact-[1-3]/i)).toHaveLength(3);
		// delete input with backspace
		userEvent.type(chipInput, '{backspace}', { skipClick: true });
		await waitForElementToBeRemoved(screen.queryAllByText(/contact/i));
		expect(screen.queryByText('c')).not.toBeInTheDocument();
		expect(screen.queryByText(/contact/i)).not.toBeInTheDocument();
	});

	test('when user select a contact from the dropdown the chip is created with default permissions', async () => {
		const node = populateNode();
		node.permissions.can_share = true;
		const user = populateUser();
		// set email to lowercase to be compatible with the contacts regexp
		user.email = user.email.toLowerCase();
		const share = populateShare(node, 'new-share', user);
		share.permission = SharePermission.ReadOnly;
		const createShareMutationFn = jest.fn();
		const mocks = [
			mockGetAccountByEmail({ email: user.email }, user),
			mockCreateShare(
				{
					node_id: node.id,
					share_target_id: user.id,
					permission: SharePermission.ReadOnly
				},
				share,
				createShareMutationFn
			)
		];
		// mock soap fetch implementation
		mockedSoapFetch.mockReturnValue({
			match: [
				populateGalContact(`${user.full_name[0]}-other-contact-1`),
				populateGalContact(user.full_name, user.email),
				populateGalContact(`${user.full_name[0]}-other-contact-2`)
			]
		});

		render(<AddSharing node={node} />, { mocks });
		const chipInput = screen.getByText(/add new people or groups/i);
		expect(chipInput).toBeVisible();
		// type just the first character because the network search is requested only one time with first character.
		// All characters typed after the first one are just used to filter out the result obtained before
		userEvent.type(chipInput, user.full_name[0]);
		// wait for the single character to be typed
		await screen.findByText(user.full_name[0]);
		// wait for the dropdown to be shown
		await screen.findByText(user.email);
		expect(screen.getByText(user.full_name)).toBeVisible();
		expect(screen.getByText(user.email)).toBeVisible();
		userEvent.click(screen.getByText(user.email));
		// chip is created
		await screen.findByText(user.full_name);
		// dropdown is closed
		expect(screen.queryByText(user.email)).not.toBeInTheDocument();
		// chip is created with read-only permissions
		expect(screen.getByTestId('icon: EyeOutline')).toBeVisible();
		expect(screen.queryByTestId('icon: Edit2Outline')).not.toBeInTheDocument();
		expect(screen.queryByTestId('icon: Share')).not.toBeInTheDocument();
		expect(screen.getByRole('button', { name: /share/i })).not.toHaveAttribute('disabled');
		userEvent.click(screen.getByRole('button', { name: /share/i }));
		// create share mutation callback is called only if variables are an exact match
		await waitFor(() => expect(createShareMutationFn).toHaveBeenCalled());
	});

	test('when user click on a new share chip the popover is shown', async () => {
		const node = populateNode();
		node.permissions.can_share = true;
		const user = populateUser();
		// set email to lowercase to be compatible with the contacts regexp
		user.email = user.email.toLowerCase();
		const mocks = [mockGetAccountByEmail({ email: user.email }, user)];
		// mock soap fetch implementation
		mockedSoapFetch.mockReturnValue({
			match: [
				populateGalContact(`${user.full_name[0]}-other-contact-1`),
				populateGalContact(user.full_name, user.email),
				populateGalContact(`${user.full_name[0]}-other-contact-2`)
			]
		});

		render(<AddSharing node={node} />, { mocks });
		const chipInput = screen.getByText(/add new people or groups/i);
		expect(chipInput).toBeVisible();
		// type just the first character because the network search is requested only one time with first character.
		// All characters typed after the first one are just used to filter out the result obtained before
		userEvent.type(chipInput, user.full_name[0]);
		// wait for the single character to be typed
		await screen.findByText(user.full_name[0]);
		// wait for the dropdown to be shown
		await screen.findByText(user.email);
		expect(screen.getByText(user.full_name)).toBeVisible();
		expect(screen.getByText(user.email)).toBeVisible();
		userEvent.click(screen.getByText(user.email));
		// chip is created
		await screen.findByText(user.full_name);
		// dropdown is closed
		expect(screen.queryByText(user.email)).not.toBeInTheDocument();
		// click on the chip to open the popover
		userEvent.click(screen.getByText(user.full_name), undefined, { skipHover: true });
		await screen.findByText(/viewer/i);
		// wait for the popover to register listener
		await waitFor(
			() =>
				new Promise((resolve) => {
					setTimeout(resolve, 2);
				})
		);
		expect(screen.getByText(/viewer/i)).toBeVisible();
		expect(screen.getByText(/editor/i)).toBeVisible();
		expect(screen.getByText(/sharing allowed/i)).toBeVisible();
		// click outside to close popover
		act(() => {
			userEvent.click(screen.getByText(/add new people or groups/i));
		});
		expect(screen.queryByText(/viewer/i)).not.toBeInTheDocument();
		expect(screen.queryByText(/editor/i)).not.toBeInTheDocument();
		expect(screen.queryByText(/sharing allowed/i)).not.toBeInTheDocument();
	});

	test('when user changes permissions from the popover the chip is immediately updated', async () => {
		const node = populateNode();
		node.permissions.can_write_file = true;
		node.permissions.can_write_folder = true;
		node.permissions.can_share = true;
		const user = populateUser();
		// set email to lowercase to be compatible with the contacts regexp
		user.email = user.email.toLowerCase();
		const share = populateShare(node, 'new-share', user);
		share.permission = SharePermission.ReadWriteAndShare;
		const createShareMutationFn = jest.fn();
		const mocks = [
			mockGetAccountByEmail({ email: user.email }, user),
			mockCreateShare(
				{
					node_id: node.id,
					share_target_id: user.id,
					permission: SharePermission.ReadWriteAndShare
				},
				share,
				createShareMutationFn
			)
		];
		// mock soap fetch implementation
		mockedSoapFetch.mockReturnValue({
			match: [
				populateGalContact(`${user.full_name[0]}-other-contact-1`),
				populateGalContact(user.full_name, user.email),
				populateGalContact(`${user.full_name[0]}-other-contact-2`)
			]
		});
		// write getNode in cache since it is used to establish permissions
		const mockedGetNodeQuery = mockGetNode(getNodeVariables(node.id), node);
		global.apolloClient.writeQuery<GetNodeQuery, GetNodeQueryVariables>({
			...mockedGetNodeQuery.request,
			data: {
				getNode: node
			}
		});

		render(<AddSharing node={node} />, { mocks, initialRouterEntries: [`/?node=${node.id}`] });
		const chipInput = screen.getByText(/add new people or groups/i);
		expect(chipInput).toBeVisible();
		// type just the first character because the network search is requested only one time with first character.
		// All characters typed after the first one are just used to filter out the result obtained before
		userEvent.type(chipInput, user.full_name[0]);
		// wait for the single character to be typed
		await screen.findByText(user.full_name[0]);
		// wait for the dropdown to be shown
		await screen.findByText(user.email);
		expect(screen.getByText(user.full_name)).toBeVisible();
		expect(screen.getByText(user.email)).toBeVisible();
		userEvent.click(screen.getByText(user.email));
		// chip is created
		await screen.findByText(user.full_name);
		// dropdown is closed
		expect(screen.queryByText(user.email)).not.toBeInTheDocument();
		// chip is created with read-only permissions
		expect(screen.getByTestId('icon: EyeOutline')).toBeVisible();
		expect(screen.queryByTestId('icon: Edit2Outline')).not.toBeInTheDocument();
		expect(screen.queryByTestId('icon: Share')).not.toBeInTheDocument();
		// click on chip to open popover
		userEvent.click(screen.getByTestId('icon: EyeOutline'), undefined, { skipHover: true });
		await screen.findByText(/viewer/i);
		// wait for the popover to register listeners
		await waitFor(
			() =>
				new Promise((resolve) => {
					setTimeout(resolve, 2);
				})
		);
		expect(screen.getByText(/editor/i)).toBeVisible();
		expect(screen.getByText(/sharing allowed/i)).toBeVisible();
		expect(screen.getByTestId('icon: Square')).toBeVisible();
		expect(screen.getByTestId('exclusive-selection-editor')).not.toHaveAttribute('disabled');
		expect(screen.getByTestId('icon: Square')).not.toHaveAttribute('disabled');
		userEvent.click(screen.getByText(/editor/i));
		// wait for the chip to update replacing the viewer icon with the editor one
		// there are 2 editor icons because one is inside the popover
		await waitFor(() => expect(screen.getAllByTestId('icon: Edit2Outline')).toHaveLength(2));
		// just 1 viewer icon is shown, the one inside the popover
		expect(screen.getByTestId('icon: EyeOutline')).toBeVisible();
		// share permission is not selected yet
		expect(screen.queryByTestId('icon: Share')).not.toBeInTheDocument();
		// double check that the popover is kept open
		expect(screen.getByText(/viewer/i)).toBeVisible();
		// now select the share permission
		act(() => {
			userEvent.click(screen.getByTestId('icon: Square'));
		});
		await screen.findByTestId('icon: Share');
		// popover is still open so there are 2 editor icons (chip and popover), 1 viewer (popover) and 1 share (chip)
		expect(screen.getAllByTestId('icon: Edit2Outline')).toHaveLength(2);
		expect(screen.getByTestId('icon: EyeOutline')).toBeVisible();
		expect(screen.getByTestId('icon: Share')).toBeVisible();
		expect(screen.getByText(/viewer/i)).toBeVisible();
		// and sharing allowed is now checked inside the popover
		expect(screen.queryByTestId('icon: Square')).not.toBeInTheDocument();
		expect(screen.getByTestId('icon: CheckmarkSquare')).toBeVisible();
		// close popover
		act(() => {
			userEvent.click(screen.getByText(/add new people or groups/i));
		});
		expect(screen.queryByText(/viewer/i)).not.toBeInTheDocument();
		// now only the chip is shown, so we have 1 editor icon, 1 share and no viewer
		expect(screen.getByTestId('icon: Edit2Outline')).toBeVisible();
		expect(screen.getByTestId('icon: Share')).toBeVisible();
		expect(screen.queryByTestId('icon: EyeOutline')).not.toBeInTheDocument();
		// confirm add with share button
		userEvent.click(screen.getByRole('button', { name: /share/i }));
		await waitFor(() => expect(createShareMutationFn).toHaveBeenCalled());
	});

	test('without write permissions editor role cannot be selected', async () => {
		const node = populateNode();
		node.permissions.can_write_file = false;
		node.permissions.can_write_folder = false;
		node.permissions.can_share = true;
		const user = populateUser();
		// set email to lowercase to be compatible with the contacts regexp
		user.email = user.email.toLowerCase();
		const share = populateShare(node, 'new-share', user);
		share.permission = SharePermission.ReadAndShare;
		const createShareMutationFn = jest.fn();
		const mocks = [
			mockGetAccountByEmail({ email: user.email }, user),
			mockCreateShare(
				{
					node_id: node.id,
					share_target_id: user.id,
					permission: SharePermission.ReadAndShare
				},
				share,
				createShareMutationFn
			)
		];
		// mock soap fetch implementation
		mockedSoapFetch.mockReturnValue({
			match: [
				populateGalContact(`${user.full_name[0]}-other-contact-1`),
				populateGalContact(user.full_name, user.email),
				populateGalContact(`${user.full_name[0]}-other-contact-2`)
			]
		});
		// write getNode in cache since it is used to establish permissions
		const mockedGetNodeQuery = mockGetNode(getNodeVariables(node.id), node);
		global.apolloClient.writeQuery<GetNodeQuery, GetNodeQueryVariables>({
			...mockedGetNodeQuery.request,
			data: {
				getNode: node
			}
		});

		render(<AddSharing node={node} />, { mocks, initialRouterEntries: [`/?node=${node.id}`] });
		const chipInput = screen.getByText(/add new people or groups/i);
		expect(chipInput).toBeVisible();
		// type just the first character because the network search is requested only one time with first character.
		// All characters typed after the first one are just used to filter out the result obtained before
		userEvent.type(chipInput, user.full_name[0]);
		// wait for the single character to be typed
		await screen.findByText(user.full_name[0]);
		// wait for the dropdown to be shown
		await screen.findByText(user.email);
		expect(screen.getByText(user.full_name)).toBeVisible();
		expect(screen.getByText(user.email)).toBeVisible();
		userEvent.click(screen.getByText(user.email));
		// chip is created
		await screen.findByText(user.full_name);
		// dropdown is closed
		expect(screen.queryByText(user.email)).not.toBeInTheDocument();
		// chip is created with read-only permissions
		expect(screen.getByTestId('icon: EyeOutline')).toBeVisible();
		expect(screen.queryByTestId('icon: Edit2Outline')).not.toBeInTheDocument();
		expect(screen.queryByTestId('icon: Share')).not.toBeInTheDocument();
		// click on chip to open popover
		userEvent.click(screen.getByTestId('icon: EyeOutline'), undefined, { skipHover: true });
		await screen.findByText(/viewer/i);
		// wait for the popover to register listeners
		await waitFor(
			() =>
				new Promise((resolve) => {
					setTimeout(resolve, 2);
				})
		);
		expect(screen.getByText(/editor/i)).toBeVisible();
		expect(screen.getByText(/sharing allowed/i)).toBeVisible();
		expect(screen.getByTestId('icon: Square')).toBeVisible();
		// editor item is disabled
		expect(screen.getByTestId('exclusive-selection-editor')).toHaveAttribute('disabled', '');
		expect(screen.getByTestId('icon: Square')).not.toHaveAttribute('disabled');
		// click on editor shouldn't do anything
		userEvent.click(screen.getByText(/editor/i));
		// click on share should set share permissions
		act(() => {
			userEvent.click(screen.getByTestId('icon: Square'));
		});
		// chip is updated
		await screen.findByTestId('icon: Share');
		// close popover
		act(() => {
			userEvent.click(screen.getByText(/add new people or groups/i));
		});
		expect(screen.queryByText(/viewer/i)).not.toBeInTheDocument();
		// chip has read and share permissions since click on editor did nothing
		expect(screen.getByTestId('icon: EyeOutline')).toBeVisible();
		expect(screen.getByTestId('icon: Share')).toBeVisible();
		userEvent.click(screen.getByRole('button', { name: /share/i }));
		await waitFor(() => expect(createShareMutationFn).toHaveBeenCalled());
	});

	test('when user click on share button shares are created, chip input and custom message textarea are cleared and shared button is disabled', async () => {
		const node = populateNode();
		node.permissions.can_share = true;
		const user = populateUser();
		// set email to lowercase to be compatible with the contacts regexp
		user.email = user.email.toLowerCase();
		const share = populateShare(node, 'new-share', user);
		share.permission = SharePermission.ReadOnly;
		const createShareMutationFn = jest.fn();
		const customMessage = 'this is a custom message';
		const mocks = [
			mockGetAccountByEmail({ email: user.email }, user),
			mockCreateShare(
				{
					node_id: node.id,
					share_target_id: user.id,
					permission: SharePermission.ReadOnly,
					custom_message: customMessage
				},
				share,
				createShareMutationFn
			)
		];
		// mock soap fetch implementation
		mockedSoapFetch.mockReturnValue({
			match: [
				populateGalContact(`${user.full_name[0]}-other-contact-1`),
				populateGalContact(user.full_name, user.email),
				populateGalContact(`${user.full_name[0]}-other-contact-2`)
			]
		});

		render(<AddSharing node={node} />, { mocks });
		const chipInput = screen.getByText(/add new people or groups/i);
		expect(chipInput).toBeVisible();
		// type just the first character because the network search is requested only one time with first character.
		// All characters typed after the first one are just used to filter out the result obtained before
		userEvent.type(chipInput, user.full_name[0]);
		// wait for the single character to be typed
		await screen.findByText(user.full_name[0]);
		// wait for the dropdown to be shown
		await screen.findByText(user.email);
		expect(screen.getByText(user.full_name)).toBeVisible();
		expect(screen.getByText(user.email)).toBeVisible();
		userEvent.click(screen.getByText(user.email));
		// chip is created
		await screen.findByText(user.full_name);
		// dropdown is closed
		expect(screen.queryByText(user.email)).not.toBeInTheDocument();
		// chip is created with read-only permissions
		expect(screen.getByTestId('icon: EyeOutline')).toBeVisible();
		expect(screen.queryByTestId('icon: Edit2Outline')).not.toBeInTheDocument();
		expect(screen.queryByTestId('icon: Share')).not.toBeInTheDocument();
		expect(screen.getByRole('button', { name: /share/i })).not.toHaveAttribute('disabled');
		// write a custom message
		const customMessageInputField = screen.getByRole('textbox', {
			name: /add a custom message to this notification/i
		});
		userEvent.type(customMessageInputField, customMessage);
		expect(customMessageInputField).toHaveValue(customMessage);
		userEvent.click(screen.getByRole('button', { name: /share/i }));
		// create share mutation callback is called only if variables are an exact match
		await waitFor(() => expect(createShareMutationFn).toHaveBeenCalled());
		expect(customMessageInputField).toHaveValue('');
		expect(screen.queryByText(user.full_name[0])).not.toBeInTheDocument();
		expect(screen.queryByText(user.full_name)).not.toBeInTheDocument();
		expect(screen.queryByTestId('icon: EyeOutline')).not.toBeInTheDocument();
		expect(screen.getByRole('button', { name: /share/i })).toHaveAttribute('disabled', '');
	});

	test('share button is enabled only when a valid new share chip is created', async () => {
		const node = populateNode();
		node.permissions.can_share = true;
		const user = populateUser();
		// set email to lowercase to be compatible with the contacts regexp
		user.email = user.email.toLowerCase();
		const share = populateShare(node, 'new-share', user);
		share.permission = SharePermission.ReadOnly;
		const createShareMutationFn = jest.fn();
		const customMessage = 'this is a custom message';
		const mocks = [
			mockGetAccountByEmail({ email: user.email }, user),
			mockCreateShare(
				{
					node_id: node.id,
					share_target_id: user.id,
					permission: SharePermission.ReadOnly,
					custom_message: customMessage
				},
				share,
				createShareMutationFn
			)
		];
		// mock soap fetch implementation
		mockedSoapFetch.mockReturnValue({
			match: [
				populateGalContact(`${user.full_name[0]}-other-contact-1`),
				populateGalContact(user.full_name, user.email),
				populateGalContact(`${user.full_name[0]}-other-contact-2`)
			]
		});

		render(<AddSharing node={node} />, { mocks });
		const chipInput = screen.getByText(/add new people or groups/i);
		expect(chipInput).toBeVisible();
		// share button is disabled
		expect(screen.getByRole('button', { name: /share/i })).toHaveAttribute('disabled', '');
		// write a custom message
		const customMessageInputField = screen.getByRole('textbox', {
			name: /add a custom message to this notification/i
		});
		userEvent.type(customMessageInputField, customMessage);
		expect(customMessageInputField).toHaveValue(customMessage);
		// share button is still disabled
		expect(screen.getByRole('button', { name: /share/i })).toHaveAttribute('disabled', '');
		// type just the first character because the network search is requested only one time with first character.
		// All characters typed after the first one are just used to filter out the result obtained before
		userEvent.type(chipInput, user.full_name[0]);
		// wait for the single character to be typed
		await screen.findByText(user.full_name[0]);
		// wait for the dropdown to be shown
		await screen.findByText(user.email);
		expect(screen.getByText(user.full_name)).toBeVisible();
		expect(screen.getByText(user.email)).toBeVisible();
		userEvent.click(screen.getByText(user.email));
		// chip is created
		await screen.findByText(user.full_name);
		// dropdown is closed
		expect(screen.queryByText(user.email)).not.toBeInTheDocument();
		// share button is now active
		expect(screen.getByRole('button', { name: /share/i })).not.toHaveAttribute('disabled');

		userEvent.click(screen.getByRole('button', { name: /share/i }));
		// create share mutation callback is called only if variables are an exact match
		await waitFor(() => expect(createShareMutationFn).toHaveBeenCalled());
		// share button returns to be disabled after creation success
		expect(screen.getByRole('button', { name: /share/i })).toHaveAttribute('disabled', '');
	});

	test('if no valid account is found chip is not added and share button remains disabled', async () => {
		const node = populateNode();
		node.permissions.can_share = true;
		const user = populateUser();
		// set email to lowercase to be compatible with the contacts regexp
		user.email = user.email.toLowerCase();
		// force error
		const error = generateError('account not found');
		const mocks = [
			mockGetAccountByEmail(
				{ email: user.email },
				null,
				new ApolloError({ graphQLErrors: [error] })
			)
		];
		// mock soap fetch implementation
		mockedSoapFetch.mockReturnValue({
			match: [
				populateGalContact(`${user.full_name[0]}-other-contact-1`),
				populateGalContact(user.full_name, user.email),
				populateGalContact(`${user.full_name[0]}-other-contact-2`)
			]
		});

		render(<AddSharing node={node} />, { mocks });
		const chipInput = screen.getByText(/add new people or groups/i);
		expect(chipInput).toBeVisible();
		// share button is disabled
		expect(screen.getByRole('button', { name: /share/i })).toHaveAttribute('disabled', '');
		// type just the first character because the network search is requested only one time with first character.
		// All characters typed after the first one are just used to filter out the result obtained before
		userEvent.type(chipInput, user.full_name[0]);
		// wait for the single character to be typed
		await screen.findByText(user.full_name[0]);
		// wait for the dropdown to be shown
		await screen.findByText(user.email);
		expect(screen.getByText(user.full_name)).toBeVisible();
		expect(screen.getByText(user.email)).toBeVisible();
		userEvent.click(screen.getByText(user.email));
		const snackbar = await screen.findByText(/Account not found/i);
		await waitForElementToBeRemoved(snackbar);
		// chip is not created
		expect(screen.queryByText(user.full_name)).not.toBeInTheDocument();
		// dropdown is closed
		expect(screen.queryByText(user.email)).not.toBeInTheDocument();
		// share button returns to be disabled after creation success
		expect(screen.getByRole('button', { name: /share/i })).toHaveAttribute('disabled', '');
	});

	test('multiple shares are creatable at once. Popover changes permissions of the active share only', async () => {
		const node = populateNode();
		node.permissions.can_write_file = true;
		node.permissions.can_write_folder = true;
		node.permissions.can_share = true;
		const user1 = populateUser();
		// set email to lowercase to be compatible with the contacts regexp
		user1.email = user1.email.toLowerCase();
		const share1 = populateShare(node, 'new-share-1', user1);
		share1.permission = SharePermission.ReadAndWrite;
		const user2 = populateUser();
		user2.email = user2.email.toLowerCase();
		const share2 = populateShare(node, 'new-share-2', user2);
		share2.permission = SharePermission.ReadAndShare;
		const createShareMutationFn = jest.fn();
		const mocks = [
			mockGetAccountByEmail({ email: user1.email }, user1),
			mockGetAccountByEmail({ email: user2.email }, user2),
			mockCreateShare(
				{
					node_id: node.id,
					share_target_id: user1.id,
					permission: SharePermission.ReadAndWrite
				},
				share1,
				createShareMutationFn
			),
			mockCreateShare(
				{
					node_id: node.id,
					share_target_id: user2.id,
					permission: SharePermission.ReadAndShare
				},
				share2,
				createShareMutationFn
			)
		];
		// mock soap fetch implementation for both the calls
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
					populateGalContact(user2.full_name, user2.email),
					populateGalContact(`${user2.full_name[0]}-other-contact-2`)
				]
			});
		// write getNode in cache since it is used to establish permissions
		const mockedGetNodeQuery = mockGetNode(getNodeVariables(node.id), node);
		global.apolloClient.writeQuery<GetNodeQuery, GetNodeQueryVariables>({
			...mockedGetNodeQuery.request,
			data: {
				getNode: node
			}
		});

		render(<AddSharing node={node} />, { mocks, initialRouterEntries: [`/?node=${node.id}`] });
		const chipInput = screen.getByText(/add new people or groups/i);
		expect(chipInput).toBeVisible();
		// type just the first character because the network search is requested only one time with first character.
		// All characters typed after the first one are just used to filter out the result obtained before
		userEvent.type(chipInput, user1.full_name[0]);
		// wait for the single character to be typed
		await screen.findByText(user1.full_name[0]);
		// wait for the dropdown to be shown
		await screen.findByText(user1.email);
		expect(screen.getByText(user1.full_name)).toBeVisible();
		expect(screen.getByText(user1.email)).toBeVisible();
		userEvent.click(screen.getByText(user1.email));
		// chip is created
		await screen.findByText(user1.full_name);
		// dropdown is closed
		expect(screen.queryByText(user1.email)).not.toBeInTheDocument();
		// chip is created with read-only permissions
		expect(screen.getByTestId('icon: EyeOutline')).toBeVisible();
		expect(screen.queryByTestId('icon: Edit2Outline')).not.toBeInTheDocument();
		expect(screen.queryByTestId('icon: Share')).not.toBeInTheDocument();
		// create second chip
		userEvent.type(chipInput, user2.full_name[0]);
		await screen.findByText(user2.full_name[0]);
		await screen.findByText(user2.email);
		expect(screen.getByText(user2.full_name)).toBeVisible();
		userEvent.click(screen.getByText(user2.full_name));
		// chip is created
		await screen.findByText(user2.full_name);
		// dropdown is closed
		expect(screen.queryByText(user2.email)).not.toBeInTheDocument();
		// chip is created with read-only permissions, so now we have 2 chips in read-only
		expect(screen.getAllByTestId('icon: EyeOutline')).toHaveLength(2);
		expect(screen.getAllByTestId('icon: Close')).toHaveLength(2);
		expect(screen.queryByTestId('icon: Edit2Outline')).not.toBeInTheDocument();
		expect(screen.queryByTestId('icon: Share')).not.toBeInTheDocument();

		// edit first share to be an editor
		// click on chip to open popover
		userEvent.click(screen.getByText(user1.full_name), undefined, { skipHover: true });
		await screen.findByText(/viewer/i);
		// wait for the popover to register listeners
		await waitFor(
			() =>
				new Promise((resolve) => {
					setTimeout(resolve, 2);
				})
		);
		expect(screen.getByText(/editor/i)).toBeVisible();
		expect(screen.getByTestId('exclusive-selection-editor')).not.toHaveAttribute('disabled');
		userEvent.click(screen.getByText(/editor/i));
		// wait for the chip to update replacing the viewer icon with the editor one
		// there are 2 editor icons because one is inside the popover
		await waitFor(() => expect(screen.getAllByTestId('icon: Edit2Outline')).toHaveLength(2));

		// edit second share to allow re-share
		act(() => {
			userEvent.click(screen.getByText(user2.full_name), undefined, { skipHover: true });
		});
		// previous popover is closed and the one related to second share is opened
		await screen.findByText(/viewer/i);
		// wait for the popover to register listeners
		await waitFor(
			() =>
				new Promise((resolve) => {
					setTimeout(resolve, 2);
				})
		);
		// select the share permission
		act(() => {
			userEvent.click(screen.getByTestId('icon: Square'));
		});
		// chip is updated, only this chip has the share icon
		await screen.findByTestId('icon: Share');
		// close popover
		act(() => {
			userEvent.click(screen.getByText(/add new people or groups/i));
		});
		expect(screen.queryByText(/viewer/i)).not.toBeInTheDocument();

		// now we have 2 chips, one with editor role and one with viewer with sharing role
		expect(screen.getAllByTestId('icon: Close')).toHaveLength(2);
		expect(screen.getByTestId('icon: Edit2Outline')).toBeVisible();
		expect(screen.getByTestId('icon: EyeOutline')).toBeVisible();
		expect(screen.getByTestId('icon: Share')).toBeVisible();

		// confirm add with share button
		userEvent.click(screen.getByRole('button', { name: /share/i }));
		await waitFor(() => expect(createShareMutationFn).toHaveBeenCalled());
		await waitFor(() => expect(createShareMutationFn).toHaveBeenCalled());
		// mutation is called 2 times, one for each new collaborator
		expect(createShareMutationFn).toHaveBeenCalledTimes(2);
	});
});
