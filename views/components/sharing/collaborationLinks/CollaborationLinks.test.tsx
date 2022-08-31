/*
 * SPDX-FileCopyrightText: 2022 Zextras <https://www.zextras.com>
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import React from 'react';

import { screen, waitFor, waitForElementToBeRemoved, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { populateCollaborationLink, populateNode } from '../../../../mocks/mockUtils';
import { SharePermission } from '../../../../types/graphql/types';
import { isFile } from '../../../../utils/ActionsFactory';
import {
	mockCreateCollaborationLink,
	mockDeleteCollaborationLinks,
	mockGetNodeCollaborationLinks
} from '../../../../utils/mockUtils';
import { render } from '../../../../utils/testUtils';
import * as moduleUtils from '../../../../utils/utils';
import { CollaborationLinks } from './CollaborationLinks';

describe('Collaboration Link', () => {
	test('no collaboration Links created', async () => {
		const node = populateNode();
		node.permissions.can_share = true;
		node.permissions.can_write_folder = true;
		node.permissions.can_write_file = true;
		const mocks = [mockGetNodeCollaborationLinks({ node_id: node.id }, node, [])];
		render(
			<CollaborationLinks
				nodeId={node.id}
				nodeName={node.name}
				nodeTypename={node.__typename}
				canWrite={
					isFile(node) ? node.permissions.can_write_file : node.permissions.can_write_folder
				}
			/>,
			{ mocks }
		);
		const readAndShareCollaborationLinkContainer = await screen.findByTestId(
			'read-share-collaboration-link-container'
		);
		const readAndShareGenerateButton = within(readAndShareCollaborationLinkContainer).getByRole(
			'button',
			{
				name: /generate link/i
			}
		);
		await waitFor(() => expect(readAndShareGenerateButton).not.toHaveAttribute('disabled', ''));
		const collaborationLinkContainer = screen.getByTestId('collaboration-link-container');
		expect(within(collaborationLinkContainer).getByText('Collaboration Links')).toBeVisible();
		expect(
			within(collaborationLinkContainer).getByText(
				'Internal users will receive the permissions by opening the link. You can always modify granted permissions.'
			)
		).toBeVisible();
		expect(
			within(readAndShareCollaborationLinkContainer).getByTestId('icon: EyeOutline')
		).toBeVisible();
		expect(
			within(readAndShareCollaborationLinkContainer).getByText('Read and Share')
		).toBeVisible();
		expect(
			within(readAndShareCollaborationLinkContainer).getByText(
				'Create a link in order to share the node'
			)
		).toBeVisible();
		expect(readAndShareGenerateButton).toBeVisible();
		const readAndShareRevokeButton = within(readAndShareCollaborationLinkContainer).queryByRole(
			'button',
			{
				name: /revoke/i
			}
		);
		expect(readAndShareRevokeButton).not.toBeInTheDocument();

		const readWriteAndShareCollaborationLinkContainer = screen.getByTestId(
			'read-write-share-collaboration-link-container'
		);
		expect(
			within(readWriteAndShareCollaborationLinkContainer).getByTestId('icon: Edit2Outline')
		).toBeVisible();
		expect(
			within(readWriteAndShareCollaborationLinkContainer).getByText('Write and Share')
		).toBeVisible();
		expect(
			within(readWriteAndShareCollaborationLinkContainer).getByText(
				'Create a link in order to share the node'
			)
		).toBeVisible();
		const readWriteAndShareGenerateButton = within(
			readWriteAndShareCollaborationLinkContainer
		).getByRole('button', {
			name: /generate link/i
		});
		expect(readWriteAndShareGenerateButton).toBeVisible();
		const readWriteAndShareRevokeButton = within(
			readWriteAndShareCollaborationLinkContainer
		).queryByRole('button', {
			name: /revoke/i
		});
		expect(readWriteAndShareRevokeButton).not.toBeInTheDocument();
	});

	test('starting with ReadAndShare collaboration link and then create ReadWriteAndShare collaboration link', async () => {
		const node = populateNode();
		node.permissions.can_share = true;
		node.permissions.can_write_folder = true;
		node.permissions.can_write_file = true;
		const readAndShareCollaborationLink = populateCollaborationLink(
			node,
			SharePermission.ReadAndShare
		);
		const readWriteAndShareCollaborationLink = populateCollaborationLink(
			node,
			SharePermission.ReadWriteAndShare
		);
		const mocks = [
			mockGetNodeCollaborationLinks({ node_id: node.id }, node, [readAndShareCollaborationLink]),
			mockCreateCollaborationLink(
				{ node_id: node.id, permission: SharePermission.ReadWriteAndShare },
				readWriteAndShareCollaborationLink
			)
		];
		render(
			<CollaborationLinks
				nodeId={node.id}
				nodeName={node.name}
				nodeTypename={node.__typename}
				canWrite={
					isFile(node) ? node.permissions.can_write_file : node.permissions.can_write_folder
				}
			/>,
			{ mocks }
		);
		await screen.findByText(readAndShareCollaborationLink.url);
		const readWriteAndShareCollaborationLinkContainer = screen.getByTestId(
			'read-write-share-collaboration-link-container'
		);
		const readWriteAndShareGenerateButton = within(
			readWriteAndShareCollaborationLinkContainer
		).getByRole('button', {
			name: /generate link/i
		});
		userEvent.click(readWriteAndShareGenerateButton);
		expect(await screen.findByText(readWriteAndShareCollaborationLink.url)).toBeVisible();
		const snackbar = await screen.findByText(/New Collaboration Link generated/i);
		expect(snackbar).toBeVisible();
		await waitForElementToBeRemoved(snackbar);
	});

	test('starting with ReadWriteAndShare collaboration link and then create ReadAndShare collaboration link', async () => {
		const node = populateNode();
		node.permissions.can_share = true;
		node.permissions.can_write_folder = true;
		node.permissions.can_write_file = true;
		const readAndShareCollaborationLink = populateCollaborationLink(
			node,
			SharePermission.ReadAndShare
		);
		const readWriteAndShareCollaborationLink = populateCollaborationLink(
			node,
			SharePermission.ReadWriteAndShare
		);
		const mocks = [
			mockGetNodeCollaborationLinks({ node_id: node.id }, node, [
				readWriteAndShareCollaborationLink
			]),
			mockCreateCollaborationLink(
				{ node_id: node.id, permission: SharePermission.ReadAndShare },
				readAndShareCollaborationLink
			)
		];
		render(
			<CollaborationLinks
				nodeId={node.id}
				nodeName={node.name}
				nodeTypename={node.__typename}
				canWrite={
					isFile(node) ? node.permissions.can_write_file : node.permissions.can_write_folder
				}
			/>,
			{ mocks }
		);
		await screen.findByText(readWriteAndShareCollaborationLink.url);
		const readAndShareCollaborationLinkContainer = screen.getByTestId(
			'read-share-collaboration-link-container'
		);
		const readAndShareGenerateButton = within(readAndShareCollaborationLinkContainer).getByRole(
			'button',
			{
				name: /generate link/i
			}
		);
		userEvent.click(readAndShareGenerateButton);
		expect(await screen.findByText(readAndShareCollaborationLink.url)).toBeVisible();
		const snackbar = await screen.findByText(/New Collaboration Link generated/i);
		expect(snackbar).toBeVisible();
		await waitForElementToBeRemoved(snackbar);
	});

	test('starting with ReadAndShare collaboration link and then delete it', async () => {
		const node = populateNode();
		node.permissions.can_share = true;
		node.permissions.can_write_folder = true;
		node.permissions.can_write_file = true;
		const readAndShareCollaborationLink = populateCollaborationLink(
			node,
			SharePermission.ReadAndShare
		);
		const mocks = [
			mockGetNodeCollaborationLinks({ node_id: node.id }, node, [readAndShareCollaborationLink]),
			mockDeleteCollaborationLinks({ collaboration_link_ids: [readAndShareCollaborationLink.id] }, [
				readAndShareCollaborationLink.id
			])
		];
		render(
			<CollaborationLinks
				nodeId={node.id}
				nodeName={node.name}
				nodeTypename={node.__typename}
				canWrite={
					isFile(node) ? node.permissions.can_write_file : node.permissions.can_write_folder
				}
			/>,
			{ mocks }
		);
		const urlElement = await screen.findByText(readAndShareCollaborationLink.url);
		const readAndShareCollaborationLinkContainer = screen.getByTestId(
			'read-share-collaboration-link-container'
		);
		const readAndShareRevokeButton = within(readAndShareCollaborationLinkContainer).getByRole(
			'button',
			{
				name: /revoke/i
			}
		);
		userEvent.click(readAndShareRevokeButton);

		const modalTitle = await screen.findByText(`Revoke ${node.name} collaboration link`);

		expect(modalTitle).toBeInTheDocument();

		const modalContent = await screen.findByText(
			`By revoking this link, you are blocking the possibility to create new shares with it. Everyone who has already used the collaboration link will keep the access to the node.`
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

	test('starting with ReadWriteAndShare collaboration link and then delete it', async () => {
		const node = populateNode();
		node.permissions.can_share = true;
		node.permissions.can_write_folder = true;
		node.permissions.can_write_file = true;
		const readWriteAndShareCollaborationLink = populateCollaborationLink(
			node,
			SharePermission.ReadWriteAndShare
		);
		const mocks = [
			mockGetNodeCollaborationLinks({ node_id: node.id }, node, [
				readWriteAndShareCollaborationLink
			]),
			mockDeleteCollaborationLinks(
				{ collaboration_link_ids: [readWriteAndShareCollaborationLink.id] },
				[readWriteAndShareCollaborationLink.id]
			)
		];
		render(
			<CollaborationLinks
				nodeId={node.id}
				nodeName={node.name}
				nodeTypename={node.__typename}
				canWrite={
					isFile(node) ? node.permissions.can_write_file : node.permissions.can_write_folder
				}
			/>,
			{ mocks }
		);
		const urlElement = await screen.findByText(readWriteAndShareCollaborationLink.url);
		const readWriteAndShareCollaborationLinkContainer = screen.getByTestId(
			'read-write-share-collaboration-link-container'
		);
		const readWriteAndShareRevokeButton = within(
			readWriteAndShareCollaborationLinkContainer
		).getByRole('button', {
			name: /revoke/i
		});
		userEvent.click(readWriteAndShareRevokeButton);

		const modalTitle = await screen.findByText(`Revoke ${node.name} collaboration link`);

		expect(modalTitle).toBeInTheDocument();

		const modalContent = await screen.findByText(
			`By revoking this link, you are blocking the possibility to create new shares with it. Everyone who has already used the collaboration link will keep the access to the node.`
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

	test('starting with ReadAndShare collaboration link, click on url chip copy the url to clipboard and show an info snackbar', async () => {
		const copyToClipboardFn = jest.spyOn(moduleUtils, 'copyToClipboard');

		const node = populateNode();
		node.permissions.can_share = true;
		node.permissions.can_write_folder = true;
		node.permissions.can_write_file = true;
		const readAndShareCollaborationLink = populateCollaborationLink(
			node,
			SharePermission.ReadAndShare
		);
		const mocks = [
			mockGetNodeCollaborationLinks({ node_id: node.id }, node, [readAndShareCollaborationLink])
		];
		render(
			<CollaborationLinks
				nodeId={node.id}
				nodeName={node.name}
				nodeTypename={node.__typename}
				canWrite={
					isFile(node) ? node.permissions.can_write_file : node.permissions.can_write_folder
				}
			/>,
			{ mocks }
		);
		const urlElement = await screen.findByText(readAndShareCollaborationLink.url);
		userEvent.click(urlElement);
		expect(copyToClipboardFn).toBeCalledWith(readAndShareCollaborationLink.url);

		const snackbar = await screen.findByText(/Collaboration Link copied/i);
		expect(snackbar).toBeVisible();
		await waitForElementToBeRemoved(snackbar);
	});

	test('If can_write is false than ReadWriteAndShare have to be hidden also if returned by query', async () => {
		const node = populateNode();
		node.permissions.can_share = true;
		node.permissions.can_write_folder = false;
		node.permissions.can_write_file = false;
		const readAndShareCollaborationLink = populateCollaborationLink(
			node,
			SharePermission.ReadAndShare
		);
		const readWriteAndShareCollaborationLink = populateCollaborationLink(
			node,
			SharePermission.ReadWriteAndShare
		);
		const mocks = [
			// Simulating that the BE wrongly return both the link
			mockGetNodeCollaborationLinks({ node_id: node.id }, node, [
				readAndShareCollaborationLink,
				readWriteAndShareCollaborationLink
			])
		];
		render(
			<CollaborationLinks
				nodeId={node.id}
				nodeName={node.name}
				nodeTypename={node.__typename}
				canWrite={
					isFile(node) ? node.permissions.can_write_file : node.permissions.can_write_folder
				}
			/>,
			{ mocks }
		);
		const readAndShareUrlElement = await screen.findByText(readAndShareCollaborationLink.url);
		expect(readAndShareUrlElement).toBeVisible();
		const readWriteAndShareUrlElement = screen.queryByText(readWriteAndShareCollaborationLink.url);
		expect(readWriteAndShareUrlElement).not.toBeInTheDocument();
	});
});
