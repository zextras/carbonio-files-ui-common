/*
 * SPDX-FileCopyrightText: 2022 Zextras <https://www.zextras.com>
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import React from 'react';

import { screen, waitFor, waitForElementToBeRemoved, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { populateInvitationLink, populateNode } from '../../../../mocks/mockUtils';
import { SharePermission } from '../../../../types/graphql/types';
import { isFile } from '../../../../utils/ActionsFactory';
import {
	mockCreateInvitationLink,
	mockDeleteInvitationLinks,
	mockGetNodeInvitationLinks
} from '../../../../utils/mockUtils';
import { render } from '../../../../utils/testUtils';
import * as moduleUtils from '../../../../utils/utils';
import { InvitationLink } from './InvitationLink';

describe('Invitation Link', () => {
	test('no invitation Links created', async () => {
		const node = populateNode();
		node.permissions.can_share = true;
		node.permissions.can_write_folder = true;
		node.permissions.can_write_file = true;
		const mocks = [mockGetNodeInvitationLinks({ node_id: node.id }, node, [])];
		render(
			<InvitationLink
				nodeId={node.id}
				nodeName={node.name}
				nodeTypename={node.__typename}
				canWrite={
					isFile(node) ? node.permissions.can_write_file : node.permissions.can_write_folder
				}
			/>,
			{ mocks }
		);
		const readAndShareInvitationLinkContainer = await screen.findByTestId(
			'read-share-invitation-link-container'
		);
		const readAndShareGenerateButton = within(readAndShareInvitationLinkContainer).getByRole(
			'button',
			{
				name: /generate link/i
			}
		);
		await waitFor(() => expect(readAndShareGenerateButton).not.toHaveAttribute('disabled', ''));
		const invitationLinkContainer = screen.getByTestId('invitation-link-container');
		expect(within(invitationLinkContainer).getByText('Invitation Link')).toBeVisible();
		expect(
			within(invitationLinkContainer).getByText(
				'Internal users will receive the permissions by opening the link. You can always modify granted permissions once the users has clicked on the link.'
			)
		).toBeVisible();
		expect(
			within(readAndShareInvitationLinkContainer).getByTestId('icon: EyeOutline')
		).toBeVisible();
		expect(within(readAndShareInvitationLinkContainer).getByText('Read and Share')).toBeVisible();
		expect(
			within(readAndShareInvitationLinkContainer).getByText('Create a link in order to share it')
		).toBeVisible();
		expect(readAndShareGenerateButton).toBeVisible();
		const readAndShareRevokeButton = within(readAndShareInvitationLinkContainer).queryByRole(
			'button',
			{
				name: /revoke/i
			}
		);
		expect(readAndShareRevokeButton).not.toBeInTheDocument();

		const readWriteAndShareInvitationLinkContainer = screen.getByTestId(
			'read-write-share-invitation-link-container'
		);
		expect(
			within(readWriteAndShareInvitationLinkContainer).getByTestId('icon: Edit2Outline')
		).toBeVisible();
		expect(
			within(readWriteAndShareInvitationLinkContainer).getByText('Write and Share')
		).toBeVisible();
		expect(
			within(readWriteAndShareInvitationLinkContainer).getByText(
				'Create a link in order to share it'
			)
		).toBeVisible();
		const readWriteAndShareGenerateButton = within(
			readWriteAndShareInvitationLinkContainer
		).getByRole('button', {
			name: /generate link/i
		});
		expect(readWriteAndShareGenerateButton).toBeVisible();
		const readWriteAndShareRevokeButton = within(
			readWriteAndShareInvitationLinkContainer
		).queryByRole('button', {
			name: /revoke/i
		});
		expect(readWriteAndShareRevokeButton).not.toBeInTheDocument();
	});

	test('starting with ReadAndShare invitation link and then create ReadWriteAndShare invitation link', async () => {
		const node = populateNode();
		node.permissions.can_share = true;
		node.permissions.can_write_folder = true;
		node.permissions.can_write_file = true;
		const readAndShareInvitationLink = populateInvitationLink(node, SharePermission.ReadAndShare);
		const readWriteAndShareInvitationLink = populateInvitationLink(
			node,
			SharePermission.ReadWriteAndShare
		);
		const mocks = [
			mockGetNodeInvitationLinks({ node_id: node.id }, node, [readAndShareInvitationLink]),
			mockCreateInvitationLink(
				{ node_id: node.id, permission: SharePermission.ReadWriteAndShare },
				readWriteAndShareInvitationLink
			)
		];
		render(
			<InvitationLink
				nodeId={node.id}
				nodeName={node.name}
				nodeTypename={node.__typename}
				canWrite={
					isFile(node) ? node.permissions.can_write_file : node.permissions.can_write_folder
				}
			/>,
			{ mocks }
		);
		await screen.findByText(readAndShareInvitationLink.url);
		const readWriteAndShareInvitationLinkContainer = screen.getByTestId(
			'read-write-share-invitation-link-container'
		);
		const readWriteAndShareGenerateButton = within(
			readWriteAndShareInvitationLinkContainer
		).getByRole('button', {
			name: /generate link/i
		});
		userEvent.click(readWriteAndShareGenerateButton);
		expect(await screen.findByText(readWriteAndShareInvitationLink.url)).toBeVisible();
		const snackbar = await screen.findByText(/New Invitation Link generated/i);
		expect(snackbar).toBeVisible();
		await waitForElementToBeRemoved(snackbar);
	});

	test('starting with ReadWriteAndShare invitation link and then create ReadAndShare invitation link', async () => {
		const node = populateNode();
		node.permissions.can_share = true;
		node.permissions.can_write_folder = true;
		node.permissions.can_write_file = true;
		const readAndShareInvitationLink = populateInvitationLink(node, SharePermission.ReadAndShare);
		const readWriteAndShareInvitationLink = populateInvitationLink(
			node,
			SharePermission.ReadWriteAndShare
		);
		const mocks = [
			mockGetNodeInvitationLinks({ node_id: node.id }, node, [readWriteAndShareInvitationLink]),
			mockCreateInvitationLink(
				{ node_id: node.id, permission: SharePermission.ReadAndShare },
				readAndShareInvitationLink
			)
		];
		render(
			<InvitationLink
				nodeId={node.id}
				nodeName={node.name}
				nodeTypename={node.__typename}
				canWrite={
					isFile(node) ? node.permissions.can_write_file : node.permissions.can_write_folder
				}
			/>,
			{ mocks }
		);
		await screen.findByText(readWriteAndShareInvitationLink.url);
		const readAndShareInvitationLinkContainer = screen.getByTestId(
			'read-share-invitation-link-container'
		);
		const readAndShareGenerateButton = within(readAndShareInvitationLinkContainer).getByRole(
			'button',
			{
				name: /generate link/i
			}
		);
		userEvent.click(readAndShareGenerateButton);
		expect(await screen.findByText(readAndShareInvitationLink.url)).toBeVisible();
		const snackbar = await screen.findByText(/New Invitation Link generated/i);
		expect(snackbar).toBeVisible();
		await waitForElementToBeRemoved(snackbar);
	});

	test('starting with ReadAndShare invitation link and then delete it', async () => {
		const node = populateNode();
		node.permissions.can_share = true;
		node.permissions.can_write_folder = true;
		node.permissions.can_write_file = true;
		const readAndShareInvitationLink = populateInvitationLink(node, SharePermission.ReadAndShare);
		const mocks = [
			mockGetNodeInvitationLinks({ node_id: node.id }, node, [readAndShareInvitationLink]),
			mockDeleteInvitationLinks({ invitation_link_ids: [readAndShareInvitationLink.id] }, [
				readAndShareInvitationLink.id
			])
		];
		render(
			<InvitationLink
				nodeId={node.id}
				nodeName={node.name}
				nodeTypename={node.__typename}
				canWrite={
					isFile(node) ? node.permissions.can_write_file : node.permissions.can_write_folder
				}
			/>,
			{ mocks }
		);
		const urlElement = await screen.findByText(readAndShareInvitationLink.url);
		const readAndShareInvitationLinkContainer = screen.getByTestId(
			'read-share-invitation-link-container'
		);
		const readAndShareRevokeButton = within(readAndShareInvitationLinkContainer).getByRole(
			'button',
			{
				name: /revoke/i
			}
		);
		userEvent.click(readAndShareRevokeButton);

		const modalTitle = await screen.findByText(`Revoke ${node.name} invitation link`);

		expect(modalTitle).toBeInTheDocument();

		const modalContent = await screen.findByText(
			`By revoking this link, you are blocking access to ${node.name} for anyone who tries to use the link to access the file`
		);
		expect(modalContent).toBeInTheDocument();

		const revokeButtons = screen.getAllByRole('button', {
			name: /revoke/i
		});
		expect(revokeButtons).toHaveLength(2);
		userEvent.click(revokeButtons[1]);
		await waitForElementToBeRemoved(urlElement);
		expect(urlElement).not.toBeInTheDocument();
	});

	test('starting with ReadWriteAndShare invitation link and then delete it', async () => {
		const node = populateNode();
		node.permissions.can_share = true;
		node.permissions.can_write_folder = true;
		node.permissions.can_write_file = true;
		const readWriteAndShareInvitationLink = populateInvitationLink(
			node,
			SharePermission.ReadWriteAndShare
		);
		const mocks = [
			mockGetNodeInvitationLinks({ node_id: node.id }, node, [readWriteAndShareInvitationLink]),
			mockDeleteInvitationLinks({ invitation_link_ids: [readWriteAndShareInvitationLink.id] }, [
				readWriteAndShareInvitationLink.id
			])
		];
		render(
			<InvitationLink
				nodeId={node.id}
				nodeName={node.name}
				nodeTypename={node.__typename}
				canWrite={
					isFile(node) ? node.permissions.can_write_file : node.permissions.can_write_folder
				}
			/>,
			{ mocks }
		);
		const urlElement = await screen.findByText(readWriteAndShareInvitationLink.url);
		const readWriteAndShareInvitationLinkContainer = screen.getByTestId(
			'read-write-share-invitation-link-container'
		);
		const readWriteAndShareRevokeButton = within(
			readWriteAndShareInvitationLinkContainer
		).getByRole('button', {
			name: /revoke/i
		});
		userEvent.click(readWriteAndShareRevokeButton);

		const modalTitle = await screen.findByText(`Revoke ${node.name} invitation link`);

		expect(modalTitle).toBeInTheDocument();

		const modalContent = await screen.findByText(
			`By revoking this link, you are blocking access to ${node.name} for anyone who tries to use the link to access the file`
		);
		expect(modalContent).toBeInTheDocument();

		const revokeButtons = screen.getAllByRole('button', {
			name: /revoke/i
		});
		expect(revokeButtons).toHaveLength(2);
		userEvent.click(revokeButtons[1]);
		await waitForElementToBeRemoved(urlElement);
		expect(urlElement).not.toBeInTheDocument();
	});

	test('starting with ReadAndShare invitation link, click on url chip copy the url to clipboard and show an info snackbar', async () => {
		const copyToClipboardFn = jest.spyOn(moduleUtils, 'copyToClipboard');

		const node = populateNode();
		node.permissions.can_share = true;
		node.permissions.can_write_folder = true;
		node.permissions.can_write_file = true;
		const readAndShareInvitationLink = populateInvitationLink(node, SharePermission.ReadAndShare);
		const mocks = [
			mockGetNodeInvitationLinks({ node_id: node.id }, node, [readAndShareInvitationLink])
		];
		render(
			<InvitationLink
				nodeId={node.id}
				nodeName={node.name}
				nodeTypename={node.__typename}
				canWrite={
					isFile(node) ? node.permissions.can_write_file : node.permissions.can_write_folder
				}
			/>,
			{ mocks }
		);
		const urlElement = await screen.findByText(readAndShareInvitationLink.url);
		userEvent.click(urlElement);
		expect(copyToClipboardFn).toBeCalledWith(readAndShareInvitationLink.url);

		const snackbar = await screen.findByText(/Invitation Link copied/i);
		expect(snackbar).toBeVisible();
		await waitForElementToBeRemoved(snackbar);
	});

	test('If can_write is false than ReadWriteAndShare have to be hidden also if returned by query', async () => {
		const node = populateNode();
		node.permissions.can_share = true;
		node.permissions.can_write_folder = false;
		node.permissions.can_write_file = false;
		const readAndShareInvitationLink = populateInvitationLink(node, SharePermission.ReadAndShare);
		const readWriteAndShareInvitationLink = populateInvitationLink(
			node,
			SharePermission.ReadWriteAndShare
		);
		const mocks = [
			// Simulating that the BE wrongly return both the link
			mockGetNodeInvitationLinks({ node_id: node.id }, node, [
				readAndShareInvitationLink,
				readWriteAndShareInvitationLink
			])
		];
		render(
			<InvitationLink
				nodeId={node.id}
				nodeName={node.name}
				nodeTypename={node.__typename}
				canWrite={
					isFile(node) ? node.permissions.can_write_file : node.permissions.can_write_folder
				}
			/>,
			{ mocks }
		);
		const readAndShareUrlElement = await screen.findByText(readAndShareInvitationLink.url);
		expect(readAndShareUrlElement).toBeVisible();
		const readWriteAndShareUrlElement = screen.queryByText(readWriteAndShareInvitationLink.url);
		expect(readWriteAndShareUrlElement).not.toBeInTheDocument();
	});
});
