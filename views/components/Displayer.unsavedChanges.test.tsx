/*
 * SPDX-FileCopyrightText: 2022 Zextras <https://www.zextras.com>
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */
import React from 'react';

import { ApolloError } from '@apollo/client';
import { faker } from '@faker-js/faker';
import { screen, waitFor, waitForElementToBeRemoved, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { act } from 'react-dom/test-utils';

import { DISPLAYER_TABS } from '../../constants';
import {
	populateFile,
	populateGalContact,
	populateLink,
	populateLinks,
	populateNode,
	populateShare,
	populateUser
} from '../../mocks/mockUtils';
import { Link, NodeType, SharePermission } from '../../types/graphql/types';
import {
	getNodeVariables,
	getSharesVariables,
	mockCreateLink,
	mockCreateLinkError,
	mockCreateShare,
	mockCreateShareError,
	mockGetAccountByEmail,
	mockGetNode,
	mockGetNodeLinks,
	mockGetShares,
	mockUpdateLink,
	mockUpdateLinkError,
	mockUpdateNodeDescription,
	mockUpdateNodeDescriptionError,
	mockUpdateShare,
	mockUpdateShareError
} from '../../utils/mockUtils';
import { generateError, render, waitForNetworkResponse } from '../../utils/testUtils';
import { formatDate, getChipLabel, initExpirationDate } from '../../utils/utils';
import { Displayer } from './Displayer';

const mockedSoapFetch: jest.Mock = jest.fn();

jest.mock('../../../network/network', () => ({
	soapFetch: (): Promise<unknown> =>
		new Promise((resolve, reject) => {
			const result = mockedSoapFetch();
			result ? resolve(result) : reject(new Error('no result provided'));
		})
}));

function getFirstOfNextMonth(from: Date | number = Date.now()): Date {
	const startingDate = new Date(from);
	let chosenDate: Date;
	if (startingDate.getMonth() === 11) {
		chosenDate = new Date(startingDate.getFullYear() + 1, 0, 1);
	} else {
		chosenDate = new Date(startingDate.getFullYear(), startingDate.getMonth() + 1, 1);
	}
	return chosenDate;
}

describe('Displayer', () => {
	describe('With unsaved changes', () => {
		describe('on description', () => {
			test('click on other tab show dialog to warn user about unsaved changes', async () => {
				const node = populateNode();
				node.permissions.can_write_file = true;
				node.permissions.can_write_folder = true;
				node.permissions.can_share = false;
				const newDescription = faker.lorem.words();
				const mocks = [mockGetNode(getNodeVariables(node.id), node)];

				render(<Displayer translationKey="No.node" />, {
					initialRouterEntries: [`/?node=${node.id}`],
					mocks
				});
				await screen.findByText(node.description);
				act(() => {
					// possible timers of displayer preview
					jest.runOnlyPendingTimers();
				});
				expect(screen.getByText(/details/i)).toBeVisible();
				expect(screen.getByText(/sharing/i)).toBeVisible();
				expect(screen.getByTestId('icon: Edit2Outline')).toBeVisible();
				userEvent.click(screen.getByTestId('icon: Edit2Outline'));
				const input = await screen.findByRole('textbox', {
					name: /maximum length allowed is 4096 characters/i
				});
				userEvent.clear(input);
				userEvent.type(input, newDescription);
				await waitFor(() => expect(input).toHaveDisplayValue(newDescription));
				expect(screen.getByTestId('icon: SaveOutline')).toBeVisible();
				expect(screen.getByTestId('icon: SaveOutline')).not.toHaveAttribute('disabled', '');
				userEvent.click(screen.getByText(/sharing/i));
				await screen.findByText(/you have unsaved changes/i);
				act(() => {
					// run modal timers
					jest.runOnlyPendingTimers();
				});
				expect(screen.getByText(/you have unsaved changes/i)).toBeVisible();
				expect(screen.getByText(/Do you want to leave the page without saving\?/i)).toBeVisible();
				expect(screen.getByText(/All unsaved changes will be lost/i)).toBeVisible();
				expect(screen.getByRole('button', { name: /cancel/i })).toBeVisible();
				expect(screen.getByRole('button', { name: /leave anyway/i })).toBeVisible();
				expect(screen.getByRole('button', { name: /save and leave/i })).toBeVisible();
			});

			test('cancel action leaves description input field open and valued and navigation is kept on details tab', async () => {
				const node = populateNode();
				node.permissions.can_write_file = true;
				node.permissions.can_write_folder = true;
				node.permissions.can_share = false;
				const newDescription = faker.lorem.words();
				const mocks = [mockGetNode(getNodeVariables(node.id), node)];

				render(<Displayer translationKey="No.node" />, {
					initialRouterEntries: [`/?node=${node.id}`],
					mocks
				});
				await screen.findByText(node.description);
				act(() => {
					// possible timers of displayer preview
					jest.runOnlyPendingTimers();
				});
				userEvent.click(screen.getByTestId('icon: Edit2Outline'));
				const input = await screen.findByRole('textbox', {
					name: /maximum length allowed is 4096 characters/i
				});
				userEvent.clear(input);
				userEvent.type(input, newDescription);
				await waitFor(() => expect(input).toHaveDisplayValue(newDescription));
				userEvent.click(screen.getByText(/sharing/i));
				await screen.findByText(/you have unsaved changes/i);
				act(() => {
					// run modal timers
					jest.runOnlyPendingTimers();
				});
				userEvent.click(screen.getByRole('button', { name: /cancel/i }));
				expect(screen.queryByRole('button', { name: /cancel/i })).not.toBeInTheDocument();
				expect(input).toBeVisible();
				expect(input).toHaveDisplayValue(newDescription);
				expect(screen.getByTestId('icon: SaveOutline')).toBeVisible();
				expect(screen.getByTestId('icon: SaveOutline')).not.toHaveAttribute('disabled', '');
				expect(screen.queryByTestId('icon: Edit2Outline')).not.toBeInTheDocument();
			});

			test('leave anyway closes description input field, continue with navigation and does not save the description', async () => {
				// FIXME: remove console error mock
				const originalConsole = console.error;
				jest.spyOn(console, 'error').mockImplementation((...args) => {
					if (/Can't perform a React state update on an unmounted component/.test(args[0])) {
						// eslint-disable-next-line no-console
						console.log(...args);
					} else {
						originalConsole(...args);
					}
				});
				const node = populateFile();
				node.type = NodeType.Image;
				node.extension = 'png';
				node.mime_type = 'image/png';
				node.permissions.can_write_file = true;
				node.permissions.can_write_folder = true;
				node.permissions.can_share = true;
				node.description = faker.lorem.words();
				const newDescription = faker.lorem.words();
				const mocks = [
					mockGetNode(getNodeVariables(node.id), node),
					mockGetShares(getSharesVariables(node.id), node),
					mockGetNodeLinks({ node_id: node.id }, node)
				];

				render(<Displayer translationKey="No.node" />, {
					initialRouterEntries: [`/?node=${node.id}`],
					mocks
				});

				await screen.findByText(node.description);
				act(() => {
					// possible timers of displayer preview
					jest.runOnlyPendingTimers();
				});
				userEvent.click(screen.getByTestId('icon: Edit2Outline'));
				const input = await screen.findByRole('textbox', {
					name: /maximum length allowed is 4096 characters/i
				});
				userEvent.clear(input);
				userEvent.type(input, newDescription);
				await waitFor(() => expect(input).toHaveDisplayValue(newDescription));
				userEvent.click(screen.getByText(/sharing/i));
				await screen.findByText(/you have unsaved changes/i);
				act(() => {
					// run modal timers
					jest.runOnlyPendingTimers();
				});
				const actionButton = screen.getByRole('button', { name: /leave anyway/i });
				userEvent.click(actionButton);
				act(() => {
					jest.runOnlyPendingTimers();
				});
				// tab is changed
				await screen.findByRole('button', { name: /share/i });
				await waitForNetworkResponse();
				expect(screen.queryByRole('button', { name: /leave anyway/i })).not.toBeInTheDocument();
				expect(
					screen.queryByRole('textbox', { name: /maximum length allowed is 4096 characters/i })
				).not.toBeInTheDocument();
				expect(screen.queryByText(/description/i)).not.toBeInTheDocument();
				// go back to details tab
				userEvent.click(screen.getByText(/details/i));
				await screen.findByText(/description/i);
				expect(screen.getByText(/description/i)).toBeVisible();
				// description input is closed and description has not been updated
				expect(
					screen.queryByRole('textbox', { name: /maximum length allowed is 4096 characters/i })
				).not.toBeInTheDocument();
				expect(screen.queryByTestId('icon: SaveOutline')).not.toBeInTheDocument();
				expect(screen.getByTestId('icon: Edit2Outline')).toBeVisible();
				expect(screen.getByText(node.description)).toBeVisible();
				expect(screen.queryByText(newDescription)).not.toBeInTheDocument();
				expect(screen.queryByText(/you have unsaved changes/i)).not.toBeInTheDocument();
				act(() => {
					// possible timers of displayer preview
					jest.runOnlyPendingTimers();
				});
			});

			test('save and leave closes description input field, continue with navigation and save the description', async () => {
				const node = populateNode();
				node.permissions.can_write_file = true;
				node.permissions.can_write_folder = true;
				node.permissions.can_share = true;
				const newDescription = faker.lorem.words();
				const mocks = [
					mockGetNode(getNodeVariables(node.id), node),
					mockUpdateNodeDescription(
						{ node_id: node.id, description: newDescription },
						{ ...node, description: newDescription }
					),
					mockGetShares(getSharesVariables(node.id), node),
					mockGetNodeLinks({ node_id: node.id }, node)
				];

				render(<Displayer translationKey="No.node" />, {
					initialRouterEntries: [`/?node=${node.id}`],
					mocks
				});
				await screen.findByText(node.description);
				act(() => {
					// possible timers of displayer preview
					jest.runOnlyPendingTimers();
				});
				userEvent.click(
					within(screen.getByTestId('displayer-content')).getByTestId('icon: Edit2Outline')
				);
				const input = await screen.findByRole('textbox', {
					name: /maximum length allowed is 4096 characters/i
				});
				userEvent.clear(input);
				userEvent.type(input, newDescription);
				await waitFor(() => expect(input).toHaveDisplayValue(newDescription));
				userEvent.click(screen.getByText(/sharing/i));
				await screen.findByText(/you have unsaved changes/i);
				userEvent.click(screen.getByRole('button', { name: /save and leave/i }));
				// tab is changed
				await screen.findByRole('button', { name: /share/i });
				expect(screen.queryByRole('button', { name: /save and leave/i })).not.toBeInTheDocument();
				expect(
					screen.queryByRole('textbox', { name: /maximum length allowed is 4096 characters/i })
				).not.toBeInTheDocument();
				expect(screen.queryByText(/description/i)).not.toBeInTheDocument();
				// go back to details tab
				userEvent.click(screen.getByText(/details/i));
				await screen.findByText(/description/i);
				act(() => {
					// run possible timers of preview
					jest.runOnlyPendingTimers();
				});
				expect(screen.getByText(/description/i)).toBeVisible();
				// description input is closed and description has not been updated
				expect(
					screen.queryByRole('textbox', { name: /maximum length allowed is 4096 characters/i })
				).not.toBeInTheDocument();
				expect(screen.queryByTestId('icon: SaveOutline')).not.toBeInTheDocument();
				expect(
					within(screen.getByTestId('displayer-content')).getByTestId('icon: Edit2Outline')
				).toBeVisible();
				expect(screen.getByText(newDescription)).toBeVisible();
				expect(screen.queryByText(node.description)).not.toBeInTheDocument();
				expect(screen.queryByText(/you have unsaved changes/i)).not.toBeInTheDocument();
			});

			test('save and leave with error keeps description input field open and valued and navigation is kept on details tab', async () => {
				const node = populateNode();
				node.permissions.can_write_file = true;
				node.permissions.can_write_folder = true;
				node.permissions.can_share = true;
				const newDescription = faker.lorem.words();
				const mocks = [
					mockGetNode(getNodeVariables(node.id), node),
					mockUpdateNodeDescriptionError(
						{ node_id: node.id, description: newDescription },
						new ApolloError({ graphQLErrors: [generateError('update error')] })
					)
				];

				render(<Displayer translationKey="No.node" />, {
					initialRouterEntries: [`/?node=${node.id}`],
					mocks
				});
				await screen.findByText(node.description);
				act(() => {
					// possible timers of displayer preview
					jest.runOnlyPendingTimers();
				});
				userEvent.click(screen.getByTestId('icon: Edit2Outline'));
				const input = await screen.findByRole('textbox', {
					name: /maximum length allowed is 4096 characters/i
				});
				userEvent.clear(input);
				userEvent.type(input, newDescription);
				await waitFor(() => expect(input).toHaveDisplayValue(newDescription));
				userEvent.click(screen.getByText(/sharing/i));
				await screen.findByText(/you have unsaved changes/i);
				userEvent.click(screen.getByRole('button', { name: /save and leave/i }));
				// snackbar of the error is shown
				const snackbar = await screen.findByText(/update error/i);
				await waitForElementToBeRemoved(snackbar);
				// navigation is kept on details tab, with description input field open and valued with new description
				expect(screen.queryByRole('button', { name: /share/i })).not.toBeInTheDocument();
				expect(screen.getByText(/description/i)).toBeVisible();
				// description input is closed and description has not been updated
				expect(
					screen.getByRole('textbox', {
						name: /maximum length allowed is 4096 characters/i
					})
				).toBeVisible();
				expect(
					screen.getByRole('textbox', {
						name: /maximum length allowed is 4096 characters/i
					})
				).toHaveDisplayValue(newDescription);
				expect(screen.queryByText(node.description)).not.toBeInTheDocument();
				expect(screen.getByTestId('icon: SaveOutline')).toBeVisible();
				expect(screen.getByTestId('icon: SaveOutline')).not.toHaveAttribute('disabled', '');
				expect(screen.queryByTestId('icon: Edit2Outline')).not.toBeInTheDocument();
				// modal of unsaved changes is closed
				expect(screen.queryByText(/you have unsaved changes/i)).not.toBeInTheDocument();
			});
		});

		describe('on edit share chip', () => {
			test('click on other tab show dialog to warn user about unsaved changes', async () => {
				const node = populateNode();
				const share = populateShare(node, 'share1');
				share.permission = SharePermission.ReadOnly;
				node.shares = [share];
				node.permissions.can_share = true;
				node.permissions.can_write_folder = true;
				node.permissions.can_write_file = true;
				const mocks = [
					mockGetNode(getNodeVariables(node.id), node),
					mockGetShares(getSharesVariables(node.id), node),
					mockGetNodeLinks({ node_id: node.id }, node)
				];

				render(<Displayer translationKey="No.node" />, {
					initialRouterEntries: [`/?node=${node.id}&tab=${DISPLAYER_TABS.sharing}`],
					mocks
				});

				await screen.findByText(getChipLabel(share.share_target));
				expect(screen.getByTestId('icon: EyeOutline')).toBeVisible();
				userEvent.click(screen.getByTestId('icon: EyeOutline'));
				await screen.findByText(/viewer/i);
				act(() => {
					// run popover timers
					jest.runOnlyPendingTimers();
				});
				userEvent.click(screen.getByText(/editor/i));
				await waitFor(() =>
					expect(screen.getByRole('button', { name: /save/i })).not.toHaveAttribute('disabled', '')
				);
				act(() => {
					userEvent.click(screen.getByText(/details/i));
				});
				await screen.findByText(/you have unsaved changes/i);
				act(() => {
					// run modal timers
					jest.runOnlyPendingTimers();
				});
				expect(screen.getByText(/you have unsaved changes/i)).toBeVisible();
				expect(screen.getByText(/Do you want to leave the page without saving\?/i)).toBeVisible();
				expect(screen.getByText(/All unsaved changes will be lost/i)).toBeVisible();
				expect(screen.getByRole('button', { name: /cancel/i })).toBeVisible();
				expect(screen.getByRole('button', { name: /leave anyway/i })).toBeVisible();
				expect(screen.getByRole('button', { name: /save and leave/i })).toBeVisible();
				// popover of the chip is closed
				expect(screen.queryByText(/viewer/i)).not.toBeInTheDocument();
				expect(screen.queryByRole('button', { name: /^save$/i })).not.toBeInTheDocument();
			});

			test('cancel action leaves permissions unsaved and navigation is kept on sharing tab', async () => {
				const node = populateNode();
				const share = populateShare(node, 'share1');
				share.permission = SharePermission.ReadOnly;
				node.shares = [share];
				node.permissions.can_share = true;
				node.permissions.can_write_folder = true;
				node.permissions.can_write_file = true;
				const mocks = [
					mockGetNode(getNodeVariables(node.id), node),
					mockGetShares(getSharesVariables(node.id), node),
					mockGetNodeLinks({ node_id: node.id }, node)
				];

				render(<Displayer translationKey="No.node" />, {
					initialRouterEntries: [`/?node=${node.id}&tab=${DISPLAYER_TABS.sharing}`],
					mocks
				});

				await screen.findByText(getChipLabel(share.share_target));
				userEvent.click(screen.getByTestId('icon: EyeOutline'));
				await screen.findByText(/viewer/i);
				act(() => {
					// run popover timers
					jest.runOnlyPendingTimers();
				});
				userEvent.click(screen.getByText(/editor/i));
				await waitFor(() =>
					expect(screen.getByRole('button', { name: /save/i })).not.toHaveAttribute('disabled', '')
				);
				act(() => {
					userEvent.click(screen.getByText(/details/i));
				});
				await screen.findByText(/you have unsaved changes/i);
				act(() => {
					// run modal timers
					jest.runOnlyPendingTimers();
				});
				expect(screen.getByText(/you have unsaved changes/i)).toBeVisible();
				expect(screen.getByRole('button', { name: /cancel/i })).toBeVisible();
				// popover of the chip is closed
				expect(screen.queryByText(/viewer/i)).not.toBeInTheDocument();
				expect(screen.queryByRole('button', { name: /^save$/i })).not.toBeInTheDocument();
				userEvent.click(screen.getByRole('button', { name: /cancel/i }));
				// modal is closed, unsaved changes are still present inside the popover
				expect(screen.queryByRole('button', { name: /cancel/i })).not.toBeInTheDocument();
				expect(screen.getByText(getChipLabel(share.share_target))).toBeVisible();
				userEvent.click(screen.getByTestId('icon: EyeOutline'));
				await screen.findByText(/viewer/i);
				act(() => {
					// run popover timers
					jest.runOnlyPendingTimers();
				});
				expect(screen.getByRole('button', { name: /save/i })).not.toHaveAttribute('disabled', '');
			});

			test('leave anyway continue with navigation and does not save the permissions', async () => {
				const node = populateNode();
				const share = populateShare(node, 'share1');
				share.permission = SharePermission.ReadOnly;
				node.shares = [share];
				node.permissions.can_share = true;
				node.permissions.can_write_folder = true;
				node.permissions.can_write_file = true;
				const mocks = [
					mockGetNode(getNodeVariables(node.id), node),
					mockGetShares(getSharesVariables(node.id), node),
					mockGetNodeLinks({ node_id: node.id }, node)
				];

				render(<Displayer translationKey="No.node" />, {
					initialRouterEntries: [`/?node=${node.id}&tab=${DISPLAYER_TABS.sharing}`],
					mocks
				});

				await screen.findByText(getChipLabel(share.share_target));
				userEvent.click(screen.getByTestId('icon: EyeOutline'));
				await screen.findByText(/viewer/i);
				act(() => {
					// run popover timers
					jest.runOnlyPendingTimers();
				});
				userEvent.click(screen.getByText(/editor/i));
				await waitFor(() =>
					expect(screen.getByRole('button', { name: /save/i })).not.toHaveAttribute('disabled', '')
				);
				act(() => {
					userEvent.click(screen.getByText(/details/i));
				});
				await screen.findByText(/you have unsaved changes/i);
				act(() => {
					// run modal timers
					jest.runOnlyPendingTimers();
				});
				expect(screen.getByText(/you have unsaved changes/i)).toBeVisible();
				expect(screen.getByRole('button', { name: /leave anyway/i })).toBeVisible();
				// popover of the chip is closed
				expect(screen.queryByText(/viewer/i)).not.toBeInTheDocument();
				expect(screen.queryByRole('button', { name: /^save$/i })).not.toBeInTheDocument();
				userEvent.click(screen.getByRole('button', { name: /leave anyway/i }));
				act(() => {
					jest.runOnlyPendingTimers();
				});
				// tab is changed, modal is closed
				await screen.findByText(/description/i);
				expect(screen.queryByRole('button', { name: /leave anyway/i })).not.toBeInTheDocument();
				expect(screen.queryByText(getChipLabel(share.share_target))).not.toBeInTheDocument();
				userEvent.click(screen.getByText(/sharing/i));
				await screen.findByText(getChipLabel(share.share_target));
				// chip permissions are not changed
				expect(screen.getByTestId('icon: EyeOutline')).toBeVisible();
				userEvent.click(screen.getByTestId('icon: EyeOutline'));
				await screen.findByText(/viewer/i);
				act(() => {
					// run popover timers
					jest.runOnlyPendingTimers();
				});
				// save button is disabled because permissions are reset
				expect(screen.getByRole('button', { name: /save/i })).toHaveAttribute('disabled', '');
			});

			test('save and leave continue with navigation and save the new permissions', async () => {
				const node = populateNode();
				const shareTarget = populateUser();
				const share = populateShare(node, 'share1', shareTarget);
				share.permission = SharePermission.ReadOnly;
				node.shares = [share];
				node.permissions.can_share = true;
				node.permissions.can_write_folder = true;
				node.permissions.can_write_file = true;
				const mocks = [
					mockGetNode(getNodeVariables(node.id), node),
					mockGetShares(getSharesVariables(node.id), node),
					mockGetNodeLinks({ node_id: node.id }, node),
					mockUpdateShare(
						{
							node_id: node.id,
							share_target_id: shareTarget.id,
							permission: SharePermission.ReadAndWrite
						},
						{ ...share, permission: SharePermission.ReadAndWrite }
					)
				];

				render(<Displayer translationKey="No.node" />, {
					initialRouterEntries: [`/?node=${node.id}&tab=${DISPLAYER_TABS.sharing}`],
					mocks
				});

				await screen.findByText(getChipLabel(share.share_target));
				userEvent.click(screen.getByTestId('icon: EyeOutline'));
				await screen.findByText(/viewer/i);
				act(() => {
					// run popover timers
					jest.runOnlyPendingTimers();
				});
				userEvent.click(screen.getByText(/editor/i));
				await waitFor(() =>
					expect(screen.getByRole('button', { name: /save/i })).not.toHaveAttribute('disabled', '')
				);
				act(() => {
					userEvent.click(screen.getByText(/details/i));
				});
				await screen.findByText(/you have unsaved changes/i);
				act(() => {
					// run modal timers
					jest.runOnlyPendingTimers();
				});
				expect(screen.getByText(/you have unsaved changes/i)).toBeVisible();
				expect(screen.getByRole('button', { name: /save and leave/i })).toBeVisible();
				// popover of the chip is closed
				expect(screen.queryByText(/viewer/i)).not.toBeInTheDocument();
				expect(screen.queryByRole('button', { name: /^save$/i })).not.toBeInTheDocument();
				userEvent.click(screen.getByRole('button', { name: /save and leave/i }));
				// tab is changed, modal is closed
				await screen.findByText(/description/i);
				expect(screen.queryByRole('button', { name: /save and leave/i })).not.toBeInTheDocument();
				expect(screen.queryByText(getChipLabel(share.share_target))).not.toBeInTheDocument();
				userEvent.click(screen.getByText(/sharing/i));
				await screen.findByText(getChipLabel(share.share_target));
				// chip permissions are changed
				expect(screen.getByTestId('icon: Edit2Outline')).toBeVisible();
				userEvent.click(screen.getByTestId('icon: Edit2Outline'));
				await screen.findByText(/viewer/i);
				act(() => {
					// run popover timers
					jest.runOnlyPendingTimers();
				});
				// save button is disabled because permissions are updated and saved
				expect(screen.getByRole('button', { name: /save/i })).toHaveAttribute('disabled', '');
			});

			test('save and leave with error keeps navigation on sharing tab', async () => {
				const node = populateNode();
				const shareTarget = populateUser();
				const share = populateShare(node, 'share1', shareTarget);
				share.permission = SharePermission.ReadOnly;
				node.shares = [share];
				node.permissions.can_share = true;
				node.permissions.can_write_folder = true;
				node.permissions.can_write_file = true;
				const mocks = [
					mockGetNode(getNodeVariables(node.id), node),
					mockGetShares(getSharesVariables(node.id), node),
					mockGetNodeLinks({ node_id: node.id }, node),
					mockUpdateShareError(
						{
							node_id: node.id,
							share_target_id: shareTarget.id,
							permission: SharePermission.ReadAndWrite
						},
						new ApolloError({ graphQLErrors: [generateError('update error')] })
					)
				];

				render(<Displayer translationKey="No.node" />, {
					initialRouterEntries: [`/?node=${node.id}&tab=${DISPLAYER_TABS.sharing}`],
					mocks
				});

				await screen.findByText(getChipLabel(share.share_target));
				userEvent.click(screen.getByTestId('icon: EyeOutline'));
				await screen.findByText(/viewer/i);
				act(() => {
					// run popover timers
					jest.runOnlyPendingTimers();
				});
				userEvent.click(screen.getByText(/editor/i));
				await waitFor(() =>
					expect(screen.getByRole('button', { name: /save/i })).not.toHaveAttribute('disabled', '')
				);
				act(() => {
					userEvent.click(screen.getByText(/details/i));
				});
				await screen.findByText(/you have unsaved changes/i);
				act(() => {
					// run modal timers
					jest.runOnlyPendingTimers();
				});
				expect(screen.getByText(/you have unsaved changes/i)).toBeVisible();
				expect(screen.getByRole('button', { name: /save and leave/i })).toBeVisible();
				// popover of the chip is closed
				expect(screen.queryByText(/viewer/i)).not.toBeInTheDocument();
				expect(screen.queryByRole('button', { name: /^save$/i })).not.toBeInTheDocument();
				userEvent.click(screen.getByRole('button', { name: /save and leave/i }));
				// error snackbar is shown
				const snackbar = await screen.findByText(/update error/i);
				await waitForElementToBeRemoved(snackbar);
				// modal is closed, sharing tab is kept open, unsaved changes are still present inside the popover
				expect(screen.queryByRole('button', { name: /save and leave/i })).not.toBeInTheDocument();
				expect(screen.queryByText(/description/i)).not.toBeInTheDocument();
				expect(screen.getByText(getChipLabel(share.share_target))).toBeVisible();
				expect(screen.getByTestId('icon: EyeOutline')).toBeVisible();
				const displayer = screen.getByTestId('displayer-content');
				expect(within(displayer).queryByTestId('icon: Edit2Outline')).not.toBeInTheDocument();
				userEvent.click(screen.getByTestId('icon: EyeOutline'));
				await screen.findByText(/viewer/i);
				act(() => {
					// run popover timers
					jest.runOnlyPendingTimers();
				});
				expect(screen.getByRole('button', { name: /save/i })).not.toHaveAttribute('disabled', '');
			});
		});

		describe.skip('On add share', () => {
			test('on chip input field, click on other tab show dialog to warn user about unsaved changes', async () => {
				const node = populateNode();
				node.permissions.can_share = true;
				node.permissions.can_write_folder = true;
				node.permissions.can_write_file = true;
				const userAccount = populateUser();
				// set email to lowercase to be compatible with the contacts regexp
				userAccount.email = userAccount.email.toLowerCase();
				// mock soap fetch implementation
				mockedSoapFetch.mockReturnValue({
					match: [populateGalContact(userAccount.full_name, userAccount.email)]
				});
				const mocks = [
					mockGetNode(getNodeVariables(node.id), node),
					mockGetShares(getSharesVariables(node.id), node),
					mockGetNodeLinks({ node_id: node.id }, node),
					mockGetAccountByEmail({ email: userAccount.email }, userAccount)
				];

				render(<Displayer translationKey="No.node" />, {
					initialRouterEntries: [`/?node=${node.id}&tab=${DISPLAYER_TABS.sharing}`],
					mocks
				});

				const chipInput = await screen.findByText(/add new people or group/i);
				userEvent.type(chipInput, userAccount.full_name[0]);
				await screen.findByText(userAccount.email);
				act(() => {
					// run dropdown timers
					jest.runOnlyPendingTimers();
				});
				userEvent.click(screen.getByText(userAccount.email));
				await waitForNetworkResponse();
				await screen.findByTestId('icon: EyeOutline');
				expect(screen.queryByText(userAccount.email)).not.toBeInTheDocument();
				act(() => {
					userEvent.click(screen.getByText(/details/i));
				});
				await screen.findByText(/you have unsaved changes/i);
				act(() => {
					// run modal timers
					jest.runOnlyPendingTimers();
				});
				expect(screen.getByText(/you have unsaved changes/i)).toBeVisible();
				expect(screen.getByText(/Do you want to leave the page without saving\?/i)).toBeVisible();
				expect(screen.getByText(/All unsaved changes will be lost/i)).toBeVisible();
				expect(screen.getByRole('button', { name: /cancel/i })).toBeVisible();
				expect(screen.getByRole('button', { name: /leave anyway/i })).toBeVisible();
				expect(screen.getByRole('button', { name: /save and leave/i })).toBeVisible();
			});

			test('on custom message field, click on other tab show dialog to warn user about unsaved changes not savable', async () => {
				const node = populateNode();
				node.permissions.can_share = true;
				node.permissions.can_write_folder = true;
				node.permissions.can_write_file = true;
				const customText = faker.lorem.words();
				const mocks = [
					mockGetNode(getNodeVariables(node.id), node),
					mockGetShares(getSharesVariables(node.id), node),
					mockGetNodeLinks({ node_id: node.id }, node)
				];

				render(<Displayer translationKey="No.node" />, {
					initialRouterEntries: [`/?node=${node.id}&tab=${DISPLAYER_TABS.sharing}`],
					mocks
				});

				const input = await screen.findByRole('textbox', {
					name: /add a custom message to this notification/i
				});
				await waitForNetworkResponse();
				userEvent.type(input, customText);
				act(() => {
					userEvent.click(screen.getByText(/details/i));
				});
				await screen.findByText(/some changes cannot be saved/i);
				act(() => {
					// run modal timers
					jest.runOnlyPendingTimers();
				});
				expect(screen.getByText(/some changes cannot be saved/i)).toBeVisible();
				expect(screen.getByText(/Do you want to leave the page without saving\?/i)).toBeVisible();
				expect(screen.getByText(/All unsaved changes will be lost/i)).toBeVisible();
				expect(screen.getByRole('button', { name: /cancel/i })).toBeVisible();
				expect(screen.getByRole('button', { name: /leave anyway/i })).toBeVisible();
				expect(screen.queryByRole('button', { name: /save and leave/i })).not.toBeInTheDocument();
			});

			test('with both fields valued, click on other tab show dialog to warn user about unsaved changes', async () => {
				const node = populateNode();
				node.permissions.can_share = true;
				node.permissions.can_write_folder = true;
				node.permissions.can_write_file = true;
				const customText = faker.lorem.words();
				const userAccount = populateUser();
				// set email to lowercase to be compatible with the contacts regexp
				userAccount.email = userAccount.email.toLowerCase();
				// mock soap fetch implementation
				mockedSoapFetch.mockReturnValue({
					match: [populateGalContact(userAccount.full_name, userAccount.email)]
				});
				const mocks = [
					mockGetNode(getNodeVariables(node.id), node),
					mockGetShares(getSharesVariables(node.id), node),
					mockGetNodeLinks({ node_id: node.id }, node),
					mockGetAccountByEmail({ email: userAccount.email }, userAccount)
				];

				render(<Displayer translationKey="No.node" />, {
					initialRouterEntries: [`/?node=${node.id}&tab=${DISPLAYER_TABS.sharing}`],
					mocks
				});

				const chipInput = await screen.findByText(/add new people or group/i);
				userEvent.type(chipInput, userAccount.full_name[0]);
				await screen.findByText(userAccount.email);
				userEvent.click(screen.getByText(userAccount.email));
				await waitForNetworkResponse();
				await screen.findByTestId('icon: EyeOutline');
				expect(screen.queryByText(userAccount.email)).not.toBeInTheDocument();
				userEvent.type(
					screen.getByRole('textbox', { name: /add a custom message to this notification/i }),
					customText
				);
				act(() => {
					userEvent.click(screen.getByText(/details/i));
				});
				await screen.findByText(/you have unsaved changes/i);
				act(() => {
					// run modal timers
					jest.runOnlyPendingTimers();
				});
				expect(screen.getByText(/you have unsaved changes/i)).toBeVisible();
				expect(screen.getByText(/Do you want to leave the page without saving\?/i)).toBeVisible();
				expect(screen.getByText(/All unsaved changes will be lost/i)).toBeVisible();
				expect(screen.getByRole('button', { name: /cancel/i })).toBeVisible();
				expect(screen.getByRole('button', { name: /leave anyway/i })).toBeVisible();
				expect(screen.getByRole('button', { name: /save and leave/i })).toBeVisible();
			});

			test('cancel action leaves fields valued and navigation is kept on sharing tab', async () => {
				const node = populateNode();
				node.permissions.can_share = true;
				node.permissions.can_write_folder = true;
				node.permissions.can_write_file = true;
				const customText = faker.lorem.words();
				const userAccount = populateUser();
				// set email to lowercase to be compatible with the contacts regexp
				userAccount.email = userAccount.email.toLowerCase();
				// mock soap fetch implementation
				mockedSoapFetch.mockReturnValue({
					match: [populateGalContact(userAccount.full_name, userAccount.email)]
				});
				const mocks = [
					mockGetNode(getNodeVariables(node.id), node),
					mockGetShares(getSharesVariables(node.id), node),
					mockGetNodeLinks({ node_id: node.id }, node),
					mockGetAccountByEmail({ email: userAccount.email }, userAccount)
				];

				render(<Displayer translationKey="No.node" />, {
					initialRouterEntries: [`/?node=${node.id}&tab=${DISPLAYER_TABS.sharing}`],
					mocks
				});

				const chipInput = await screen.findByText(/add new people or group/i);
				userEvent.type(chipInput, userAccount.full_name[0]);
				await screen.findByText(userAccount.email);
				userEvent.click(screen.getByText(userAccount.email));
				await waitForNetworkResponse();
				await screen.findByTestId('icon: EyeOutline');
				expect(screen.queryByText(userAccount.email)).not.toBeInTheDocument();
				userEvent.type(
					screen.getByRole('textbox', { name: /add a custom message to this notification/i }),
					customText
				);
				act(() => {
					userEvent.click(screen.getByText(/details/i));
				});
				await screen.findByText(/you have unsaved changes/i);
				act(() => {
					// run modal timers
					jest.runOnlyPendingTimers();
				});
				const actionButton = screen.getByRole('button', { name: /cancel/i });
				expect(actionButton).toBeVisible();
				userEvent.click(actionButton);
				expect(actionButton).not.toBeInTheDocument();
				expect(screen.getByText(userAccount.full_name)).toBeVisible();
				expect(screen.getByTestId('icon: EyeOutline')).toBeVisible();
				expect(
					screen.getByRole('textbox', { name: /add a custom message to this notification/i })
				).toHaveDisplayValue(customText);
				expect(screen.getByRole('button', { name: /share/i })).not.toHaveAttribute('disabled', '');
			});

			test('leave anyway action reset fields and continue navigation', async () => {
				const node = populateNode();
				node.permissions.can_share = true;
				node.permissions.can_write_folder = true;
				node.permissions.can_write_file = true;
				const customText = faker.lorem.words();
				const userAccount = populateUser();
				// set email to lowercase to be compatible with the contacts regexp
				userAccount.email = userAccount.email.toLowerCase();
				// mock soap fetch implementation
				mockedSoapFetch.mockReturnValue({
					match: [populateGalContact(userAccount.full_name, userAccount.email)]
				});
				const mocks = [
					mockGetNode(getNodeVariables(node.id), node),
					mockGetShares(getSharesVariables(node.id), node),
					mockGetNodeLinks({ node_id: node.id }, node),
					mockGetAccountByEmail({ email: userAccount.email }, userAccount)
				];

				render(<Displayer translationKey="No.node" />, {
					initialRouterEntries: [`/?node=${node.id}&tab=${DISPLAYER_TABS.sharing}`],
					mocks
				});

				const chipInput = await screen.findByText(/add new people or group/i);
				userEvent.type(chipInput, userAccount.full_name[0]);
				await screen.findByText(userAccount.email);
				userEvent.click(screen.getByText(userAccount.email));
				await waitForNetworkResponse();
				await screen.findByTestId('icon: EyeOutline');
				expect(screen.queryByText(userAccount.email)).not.toBeInTheDocument();
				userEvent.type(
					screen.getByRole('textbox', { name: /add a custom message to this notification/i }),
					customText
				);
				act(() => {
					userEvent.click(screen.getByText(/details/i));
				});
				await screen.findByText(/you have unsaved changes/i);
				act(() => {
					// run modal timers
					jest.runOnlyPendingTimers();
				});
				const actionButton = screen.getByRole('button', { name: /leave anyway/i });
				expect(actionButton).toBeVisible();
				userEvent.click(actionButton);
				act(() => {
					jest.runOnlyPendingTimers();
				});
				// tab is changed
				await screen.findByText(/description/i);
				expect(screen.queryByRole('button', { name: /share/i })).not.toBeInTheDocument();
				// modal is closed
				expect(actionButton).not.toBeInTheDocument();
				// going back to sharing tab, fields are empty
				userEvent.click(screen.getByText(/sharing/i));
				await screen.findByRole('button', { name: /share/i });
				expect(screen.queryByText(userAccount.full_name)).not.toBeInTheDocument();
				expect(screen.queryByTestId('icon: EyeOutline')).not.toBeInTheDocument();
				expect(
					screen.queryByRole('textbox', { name: /add a custom message to this notification/i })
				).not.toHaveDisplayValue(customText);
				expect(screen.getByRole('button', { name: /share/i })).toHaveAttribute('disabled', '');
				act(() => {
					// possible timers of displayer preview
					jest.runOnlyPendingTimers();
				});
			});

			test('save and leave action create shares and continue navigation', async () => {
				const node = populateNode();
				node.permissions.can_share = true;
				node.permissions.can_write_folder = true;
				node.permissions.can_write_file = true;
				const customText = faker.lorem.words();
				const userAccount = populateUser();
				// set email to lowercase to be compatible with the contacts regexp
				userAccount.email = userAccount.email.toLowerCase();
				const share = populateShare(node, 'share1', userAccount);
				share.permission = SharePermission.ReadOnly;
				// mock soap fetch implementation
				mockedSoapFetch.mockReturnValue({
					match: [populateGalContact(userAccount.full_name, userAccount.email)]
				});
				const mocks = [
					mockGetNode(getNodeVariables(node.id), node),
					mockGetShares(getSharesVariables(node.id), node),
					mockGetNodeLinks({ node_id: node.id }, node),
					mockGetAccountByEmail({ email: userAccount.email }, userAccount),
					mockCreateShare(
						{
							node_id: node.id,
							share_target_id: userAccount.id,
							permission: SharePermission.ReadOnly,
							custom_message: customText
						},
						share
					)
				];

				render(<Displayer translationKey="No.node" />, {
					initialRouterEntries: [`/?node=${node.id}&tab=${DISPLAYER_TABS.sharing}`],
					mocks
				});

				const chipInput = await screen.findByText(/add new people or group/i);
				userEvent.type(chipInput, userAccount.full_name[0]);
				await screen.findByText(userAccount.email);
				userEvent.click(screen.getByText(userAccount.email));
				await waitForNetworkResponse();
				await screen.findByTestId('icon: EyeOutline');
				expect(screen.queryByText(userAccount.email)).not.toBeInTheDocument();
				userEvent.type(
					screen.getByRole('textbox', { name: /add a custom message to this notification/i }),
					customText
				);
				act(() => {
					userEvent.click(screen.getByText(/details/i));
				});
				await screen.findByText(/you have unsaved changes/i);
				act(() => {
					// run modal timers
					jest.runOnlyPendingTimers();
				});
				const actionButton = screen.getByRole('button', { name: /save and leave/i });
				expect(actionButton).toBeVisible();
				userEvent.click(actionButton);
				// tab is changed
				await screen.findByText(/description/i);
				expect(screen.queryByRole('button', { name: /share/i })).not.toBeInTheDocument();
				// modal is closed
				expect(actionButton).not.toBeInTheDocument();
				// going back to sharing tab, fields are empty and the new share is created
				userEvent.click(screen.getByText(/sharing/i));
				await screen.findByRole('button', { name: /share/i });
				expect(screen.getByText(userAccount.full_name)).toBeVisible();
				const addSharesContainer = screen.getByTestId('add-shares-input-container');
				expect(screen.getByTestId('icon: EyeOutline')).toBeVisible();
				expect(
					within(addSharesContainer).queryByText(userAccount.full_name)
				).not.toBeInTheDocument();
				expect(
					within(addSharesContainer).queryByTestId('icon: EyeOutline')
				).not.toBeInTheDocument();
				expect(
					screen.queryByRole('textbox', { name: /add a custom message to this notification/i })
				).not.toHaveDisplayValue(customText);
				expect(screen.getByRole('button', { name: /share/i })).toHaveAttribute('disabled', '');
			});

			test('save and leave action with errors leaves fields valued with only shares that went in error and navigation is kept on sharing tab', async () => {
				const node = populateNode();
				node.permissions.can_share = true;
				node.permissions.can_write_folder = true;
				node.permissions.can_write_file = true;
				node.shares = [];
				const customText = faker.lorem.words();
				const userAccount1 = populateUser();
				// set email to lowercase to be compatible with the contacts regexp
				userAccount1.email = userAccount1.email.toLowerCase();
				const share1 = populateShare(node, 'share1', userAccount1);
				const userAccount2 = populateUser();
				userAccount2.email = userAccount2.email.toLowerCase();
				// mock soap fetch implementation
				mockedSoapFetch
					.mockReturnValueOnce({
						match: [populateGalContact(userAccount1.full_name, userAccount1.email)]
					})
					.mockReturnValueOnce({
						match: [populateGalContact(userAccount2.full_name, userAccount2.email)]
					});
				const mocks = [
					mockGetNode(getNodeVariables(node.id), node),
					mockGetShares(getSharesVariables(node.id), node),
					mockGetNodeLinks({ node_id: node.id }, node),
					mockGetAccountByEmail({ email: userAccount1.email }, userAccount1),
					mockGetAccountByEmail({ email: userAccount2.email }, userAccount2),
					mockCreateShare(
						{
							node_id: node.id,
							permission: SharePermission.ReadAndWrite,
							share_target_id: userAccount1.id,
							custom_message: customText
						},
						share1
					),
					mockCreateShareError(
						{
							node_id: node.id,
							permission: SharePermission.ReadOnly,
							share_target_id: userAccount2.id,
							custom_message: customText
						},
						new ApolloError({ graphQLErrors: [generateError('create error')] })
					)
				];

				render(<Displayer translationKey="No.node" />, {
					initialRouterEntries: [`/?node=${node.id}&tab=${DISPLAYER_TABS.sharing}`],
					mocks
				});

				const chipInput = await screen.findByText(/add new people or group/i);
				// add first share
				userEvent.type(chipInput, userAccount1.full_name[0]);
				await screen.findByText(userAccount1.email);
				userEvent.click(screen.getByText(userAccount1.email));
				await waitForNetworkResponse();
				await screen.findByTestId('icon: EyeOutline');
				expect(screen.queryByText(userAccount1.email)).not.toBeInTheDocument();
				// change to edit permission to be fully distinguishable
				userEvent.click(screen.getByTestId('icon: EyeOutline'));
				await screen.findByText(/editor/i);
				act(() => {
					// run popover timers
					jest.runOnlyPendingTimers();
				});
				const nodeSharingArea = screen.getByTestId('node-sharing');
				userEvent.click(screen.getByText(/editor/i));
				await within(nodeSharingArea).findByTestId('icon: Edit2Outline');
				// close popover by clicking on the chip label
				act(() => {
					userEvent.click(screen.getByText(userAccount1.full_name));
				});
				expect(screen.queryByTestId('icon: Eye2Outline')).not.toBeInTheDocument();
				// add second share
				userEvent.type(chipInput, userAccount2.full_name[0]);
				await screen.findByText(userAccount2.email);
				userEvent.click(screen.getByText(userAccount2.email));
				await waitForNetworkResponse();
				await screen.findByTestId('icon: EyeOutline');
				expect(screen.queryByText(userAccount2.email)).not.toBeInTheDocument();
				userEvent.type(
					screen.getByRole('textbox', { name: /add a custom message to this notification/i }),
					customText
				);
				act(() => {
					userEvent.click(screen.getByText(/details/i));
				});
				await screen.findByText(/you have unsaved changes/i);
				act(() => {
					// run modal timers
					jest.runOnlyPendingTimers();
				});
				const actionButton = screen.getByRole('button', { name: /save and leave/i });
				expect(actionButton).toBeVisible();
				userEvent.click(actionButton);
				// error snackbar is shown
				const snackbar = await screen.findByText(/create error/i);
				await waitForElementToBeRemoved(snackbar);
				// modal is closed
				expect(actionButton).not.toBeInTheDocument();
				// navigation is kept on sharing tab
				expect(screen.getByRole('button', { name: /share/i })).toBeVisible();
				const addSharesContainer = screen.getByTestId('add-shares-input-container');
				// share 1 has been created
				expect(screen.getByText(userAccount1.full_name)).toBeVisible();
				expect(screen.getByTestId('icon: Edit2Outline')).toBeVisible();
				expect(
					within(addSharesContainer).queryByText(userAccount1.full_name)
				).not.toBeInTheDocument();
				expect(
					within(addSharesContainer).queryByTestId('icon: Edit2Outline')
				).not.toBeInTheDocument();
				// share 2 is still inside add share chip input
				expect(within(addSharesContainer).getByText(userAccount2.full_name)).toBeVisible();
				expect(within(addSharesContainer).getByTestId('icon: EyeOutline')).toBeVisible();
				// custom message input field is valued with the custom text
				expect(
					screen.getByRole('textbox', { name: /add a custom message to this notification/i })
				).toHaveDisplayValue(customText);
				// share button is enabled
				expect(screen.getByRole('button', { name: /share/i })).not.toHaveAttribute('disabled', '');
			});
		});

		describe.skip('On add link', () => {
			test('on description input, click on other tab show dialog to warn user about unsaved changes', async () => {
				const node = populateFile();
				node.permissions.can_share = true;
				node.permissions.can_write_folder = true;
				node.permissions.can_write_file = true;
				const description = faker.lorem.words();
				const mocks = [
					mockGetNode(getNodeVariables(node.id), node),
					mockGetShares(getSharesVariables(node.id), node),
					mockGetNodeLinks({ node_id: node.id }, node)
				];

				render(<Displayer translationKey="No.node" />, {
					initialRouterEntries: [`/?node=${node.id}&tab=${DISPLAYER_TABS.sharing}`],
					mocks
				});

				await screen.findByText(/public link/i);
				await waitForNetworkResponse();
				userEvent.click(screen.getByRole('button', { name: /add link/i }));
				const descriptionInput = await screen.findByRole('textbox', {
					name: /link's description/i
				});
				userEvent.type(descriptionInput, description);
				act(() => {
					userEvent.click(screen.getByText(/details/i));
				});
				await screen.findByText(/you have unsaved changes/i);
				act(() => {
					// run modal timers
					jest.runOnlyPendingTimers();
				});
				expect(screen.getByText(/you have unsaved changes/i)).toBeVisible();
				expect(screen.getByText(/Do you want to leave the page without saving\?/i)).toBeVisible();
				expect(screen.getByText(/All unsaved changes will be lost/i)).toBeVisible();
				expect(screen.getByRole('button', { name: /cancel/i })).toBeVisible();
				expect(screen.getByRole('button', { name: /leave anyway/i })).toBeVisible();
				expect(screen.getByRole('button', { name: /save and leave/i })).toBeVisible();
			});

			test('on expiration date input, click on other tab show dialog to warn user about unsaved changes', async () => {
				const node = populateFile();
				node.permissions.can_share = true;
				node.permissions.can_write_folder = true;
				node.permissions.can_write_file = true;
				const mocks = [
					mockGetNode(getNodeVariables(node.id), node),
					mockGetShares(getSharesVariables(node.id), node),
					mockGetNodeLinks({ node_id: node.id }, node)
				];

				render(<Displayer translationKey="No.node" />, {
					initialRouterEntries: [`/?node=${node.id}&tab=${DISPLAYER_TABS.sharing}`],
					mocks
				});

				await screen.findByText(/public link/i);
				await waitForNetworkResponse();
				userEvent.click(screen.getByRole('button', { name: /add link/i }));
				userEvent.click(screen.getByTestId('icon: CalendarOutline'));
				const nextMonthButton = await screen.findByRole('button', { name: /next month/i });
				userEvent.click(nextMonthButton);
				// chosen date is the 1st of next month
				const chosenDate = getFirstOfNextMonth();
				// always click on first 1 visible on the date picker
				userEvent.click(screen.getAllByText('1')[0]);
				await screen.findByText(formatDate(chosenDate, 'DD/MM/YYYY'));
				act(() => {
					userEvent.click(screen.getByText(/details/i));
				});
				await screen.findByText(/you have unsaved changes/i);
				act(() => {
					// run modal timers
					jest.runOnlyPendingTimers();
				});
				expect(screen.getByText(/you have unsaved changes/i)).toBeVisible();
				expect(screen.getByText(/Do you want to leave the page without saving\?/i)).toBeVisible();
				expect(screen.getByText(/All unsaved changes will be lost/i)).toBeVisible();
				expect(screen.getByRole('button', { name: /cancel/i })).toBeVisible();
				expect(screen.getByRole('button', { name: /leave anyway/i })).toBeVisible();
				expect(screen.getByRole('button', { name: /save and leave/i })).toBeVisible();
			}, 60000);

			test('cancel action leaves fields valued and navigation is kept on sharing tab', async () => {
				const node = populateFile();
				node.permissions.can_share = true;
				node.permissions.can_write_folder = true;
				node.permissions.can_write_file = true;
				const description = faker.lorem.words();
				const mocks = [
					mockGetNode(getNodeVariables(node.id), node),
					mockGetShares(getSharesVariables(node.id), node),
					mockGetNodeLinks({ node_id: node.id }, node)
				];

				render(<Displayer translationKey="No.node" />, {
					initialRouterEntries: [`/?node=${node.id}&tab=${DISPLAYER_TABS.sharing}`],
					mocks
				});

				await screen.findByText(/public link/i);
				await waitForNetworkResponse();
				userEvent.click(screen.getByRole('button', { name: /add link/i }));
				const descriptionInput = await screen.findByRole('textbox', {
					name: /link's description/i
				});
				userEvent.type(descriptionInput, description);
				userEvent.click(screen.getByTestId('icon: CalendarOutline'));
				const nextMonthButton = await screen.findByRole('button', { name: /next month/i });
				userEvent.click(nextMonthButton);
				// chosen date is the 1st of next month
				const chosenDate = formatDate(getFirstOfNextMonth(), 'DD/MM/YYYY');
				// always click on first 1 visible on the date picker
				userEvent.click(screen.getAllByText('1')[0]);
				await screen.findByText(chosenDate);
				act(() => {
					userEvent.click(screen.getByText(/details/i));
				});
				await screen.findByText(/you have unsaved changes/i);
				act(() => {
					// run modal timers
					jest.runOnlyPendingTimers();
				});
				const actionButton = screen.getByRole('button', { name: /cancel/i });
				expect(actionButton).toBeVisible();
				userEvent.click(actionButton);
				expect(actionButton).not.toBeInTheDocument();
				expect(screen.getByRole('textbox', { name: /link's description/i })).toHaveDisplayValue(
					description
				);
				expect(screen.getByText(chosenDate)).toBeVisible();
			}, 60000);

			test('leave anyway action reset fields and continue navigation', async () => {
				const node = populateFile();
				node.permissions.can_share = true;
				node.permissions.can_write_folder = true;
				node.permissions.can_write_file = true;
				const description = faker.lorem.words();
				const mocks = [
					mockGetNode(getNodeVariables(node.id), node),
					mockGetShares(getSharesVariables(node.id), node),
					mockGetNodeLinks({ node_id: node.id }, node)
				];

				render(<Displayer translationKey="No.node" />, {
					initialRouterEntries: [`/?node=${node.id}&tab=${DISPLAYER_TABS.sharing}`],
					mocks
				});

				await screen.findByText(/public link/i);
				await waitForNetworkResponse();
				userEvent.click(screen.getByRole('button', { name: /add link/i }));
				let descriptionInput = await screen.findByRole('textbox', {
					name: /link's description/i
				});
				userEvent.type(descriptionInput, description);
				userEvent.click(screen.getByTestId('icon: CalendarOutline'));
				const nextMonthButton = await screen.findByRole('button', { name: /next month/i });
				userEvent.click(nextMonthButton);
				// chosen date is the 1st of next month
				const chosenDate = formatDate(getFirstOfNextMonth(), 'DD/MM/YYYY');
				// always click on first 1 visible on the date picker
				userEvent.click(screen.getAllByText('1')[0]);
				await screen.findByText(chosenDate);
				act(() => {
					userEvent.click(screen.getByText(/details/i));
				});
				await screen.findByText(/you have unsaved changes/i);
				act(() => {
					// run modal timers
					jest.runOnlyPendingTimers();
				});
				const actionButton = screen.getByRole('button', { name: /leave anyway/i });
				expect(actionButton).toBeVisible();
				userEvent.click(actionButton);
				expect(actionButton).not.toBeInTheDocument();
				await screen.findByText(/description/i);
				act(() => {
					// possible timers of displayer preview
					jest.runOnlyPendingTimers();
				});
				expect(screen.queryByText(/public link/i)).not.toBeInTheDocument();
				// go back to sharing tab
				userEvent.click(screen.getByText(/sharing/i));
				// add link status is reset
				expect(screen.getByRole('button', { name: /add link/i })).toBeVisible();
				expect(
					screen.queryByRole('textbox', { name: /link's description/i })
				).not.toBeInTheDocument();
				expect(screen.queryByText(description)).not.toBeInTheDocument();
				expect(screen.queryByText(chosenDate)).not.toBeInTheDocument();
				// add a new link
				userEvent.click(screen.getByRole('button', { name: /add link/i }));
				descriptionInput = await screen.findByRole('textbox', { name: /link's description/i });
				// new link fields are cleaned
				expect(descriptionInput).not.toHaveDisplayValue(description);
				expect(screen.queryByText(chosenDate)).not.toBeInTheDocument();
			}, 60000);

			test('save and leave action create link and continue navigation', async () => {
				const node = populateFile();
				node.permissions.can_share = true;
				node.permissions.can_write_folder = true;
				node.permissions.can_write_file = true;
				const description = faker.lorem.lines(1);
				const firstOfNextMonth = getFirstOfNextMonth();
				const expiresAt = initExpirationDate(firstOfNextMonth) as Date;
				const link = populateLink(node);
				link.description = description;
				link.expires_at = expiresAt?.getTime();
				const mocks = [
					mockGetNode(getNodeVariables(node.id), node),
					mockGetShares(getSharesVariables(node.id), node),
					mockGetNodeLinks({ node_id: node.id }, node),
					mockCreateLink(
						{ node_id: node.id, description: link.description, expires_at: link.expires_at },
						link
					)
				];

				render(<Displayer translationKey="No.node" />, {
					initialRouterEntries: [`/?node=${node.id}&tab=${DISPLAYER_TABS.sharing}`],
					mocks
				});

				await screen.findByText(/public link/i);
				await waitForNetworkResponse();
				userEvent.click(screen.getByRole('button', { name: /add link/i }));
				let descriptionInput = await screen.findByRole('textbox', {
					name: /link's description/i
				});
				userEvent.type(descriptionInput, description);
				userEvent.click(screen.getByTestId('icon: CalendarOutline'));
				const nextMonthButton = await screen.findByRole('button', { name: /next month/i });
				userEvent.click(nextMonthButton);
				// chosen date is the 1st of next month
				const chosenDate = formatDate(firstOfNextMonth, 'DD/MM/YYYY');
				// always click on first 1 visible on the date picker
				userEvent.click(screen.getAllByText('1')[0]);
				await screen.findByText(chosenDate);
				act(() => {
					userEvent.click(screen.getByText(/details/i));
				});
				await screen.findByText(/you have unsaved changes/i);
				act(() => {
					// run modal timers
					jest.runOnlyPendingTimers();
				});
				const actionButton = screen.getByRole('button', { name: /save and leave/i });
				expect(actionButton).toBeVisible();
				userEvent.click(actionButton);
				const snackbar = await screen.findByText(/New public Link generated/i);
				await waitForElementToBeRemoved(snackbar);
				await screen.findByText(/description/i);
				// go back to sharing tab
				userEvent.click(screen.getByText(/sharing/i));
				await screen.findByText(link.url as string);
				// new link has been created
				expect(screen.getByText(link.description)).toBeVisible();
				const expiresOnDate = formatDate(
					new Date(
						firstOfNextMonth.getFullYear(),
						firstOfNextMonth.getMonth(),
						firstOfNextMonth.getDate(),
						23,
						59
					),
					'DD/MM/YY HH:mm'
				);
				const expiresOnRegexp = RegExp(`expires on: ${expiresOnDate}`, 'i');
				expect(screen.getByText(expiresOnRegexp)).toBeVisible();
				expect(screen.getByRole('button', { name: /revoke/i })).toBeVisible();
				expect(screen.getByRole('button', { name: /edit/i })).toBeVisible();
				// add link status is reset
				expect(screen.getByRole('button', { name: /add link/i })).toBeVisible();
				expect(
					screen.queryByRole('textbox', { name: /link's description/i })
				).not.toBeInTheDocument();
				// add a new link
				userEvent.click(screen.getByRole('button', { name: /add link/i }));
				descriptionInput = await screen.findByRole('textbox', { name: /link's description/i });
				// new link fields are cleaned
				expect(descriptionInput).not.toHaveDisplayValue(description);
				expect(screen.queryByText(chosenDate)).not.toBeInTheDocument();
			}, 90000);

			test('save and leave action with errors leaves fields valued and navigation is kept on sharing tab', async () => {
				const node = populateFile();
				node.permissions.can_share = true;
				node.permissions.can_write_folder = true;
				node.permissions.can_write_file = true;
				const description = faker.lorem.lines(1);
				const firstOfNextMonth = getFirstOfNextMonth();
				const expiresAt = initExpirationDate(firstOfNextMonth) as Date;
				const link = populateLink(node);
				link.description = description;
				link.expires_at = expiresAt?.getTime();
				const mocks = [
					mockGetNode(getNodeVariables(node.id), node),
					mockGetShares(getSharesVariables(node.id), node),
					mockGetNodeLinks({ node_id: node.id }, node),
					mockCreateLinkError(
						{
							node_id: node.id,
							description: link.description,
							expires_at: link.expires_at
						},
						new ApolloError({ graphQLErrors: [generateError('create link error')] })
					)
				];

				render(<Displayer translationKey="No.node" />, {
					initialRouterEntries: [`/?node=${node.id}&tab=${DISPLAYER_TABS.sharing}`],
					mocks
				});

				await screen.findByText(/public link/i);
				await waitForNetworkResponse();
				userEvent.click(screen.getByRole('button', { name: /add link/i }));
				const descriptionInput = await screen.findByRole('textbox', {
					name: /link's description/i
				});
				userEvent.type(descriptionInput, description);
				userEvent.click(screen.getByTestId('icon: CalendarOutline'));
				const nextMonthButton = await screen.findByRole('button', { name: /next month/i });
				userEvent.click(nextMonthButton);
				// chosen date is the 1st of next month
				const chosenDate = formatDate(firstOfNextMonth, 'DD/MM/YYYY');
				// always click on first 1 visible on the date picker
				userEvent.click(screen.getAllByText('1')[0]);
				await screen.findByText(chosenDate);
				act(() => {
					userEvent.click(screen.getByText(/details/i));
				});
				await screen.findByText(/you have unsaved changes/i);
				act(() => {
					// run modal timers
					jest.runOnlyPendingTimers();
				});
				const actionButton = screen.getByRole('button', { name: /save and leave/i });
				expect(actionButton).toBeVisible();
				userEvent.click(actionButton);
				const snackbar = await screen.findByText(/create link error/i);
				await waitForElementToBeRemoved(snackbar);
				expect(actionButton).not.toBeInTheDocument();
				expect(screen.getByRole('textbox', { name: /link's description/i })).toHaveDisplayValue(
					description
				);
				expect(screen.getByText(chosenDate)).toBeVisible();
			}, 90000);
		});

		describe('on edit link', () => {
			test('on description input, click on other tab show dialog to warn user about unsaved changes', async () => {
				const node = populateFile();
				node.permissions.can_share = true;
				node.permissions.can_write_folder = true;
				node.permissions.can_write_file = true;
				const description = faker.lorem.words();
				node.links = populateLinks(node);
				const mocks = [
					mockGetNode(getNodeVariables(node.id), node),
					mockGetShares(getSharesVariables(node.id), node),
					mockGetNodeLinks({ node_id: node.id }, node)
				];

				render(<Displayer translationKey="No.node" />, {
					initialRouterEntries: [`/?node=${node.id}&tab=${DISPLAYER_TABS.sharing}`],
					mocks
				});

				await screen.findByText(/public link/i);
				const link = node.links[0] as Link;
				await screen.findByText(link.url as string);
				userEvent.click(screen.getAllByRole('button', { name: /edit/i })[0]);
				const descriptionInput = await screen.findByRole('textbox', {
					name: /link's description/i
				});
				userEvent.clear(descriptionInput);
				userEvent.type(descriptionInput, description);
				act(() => {
					userEvent.click(screen.getByText(/details/i));
				});
				await screen.findByText(/you have unsaved changes/i);
				act(() => {
					// run modal timers
					jest.runOnlyPendingTimers();
				});
				expect(screen.getByText(/you have unsaved changes/i)).toBeVisible();
				expect(screen.getByText(/Do you want to leave the page without saving\?/i)).toBeVisible();
				expect(screen.getByText(/All unsaved changes will be lost/i)).toBeVisible();
				expect(screen.getByRole('button', { name: /cancel/i })).toBeVisible();
				expect(screen.getByRole('button', { name: /leave anyway/i })).toBeVisible();
				expect(screen.getByRole('button', { name: /save and leave/i })).toBeVisible();
			});

			test('on expiration date input, click on other tab show dialog to warn user about unsaved changes', async () => {
				const node = populateFile();
				node.permissions.can_share = true;
				node.permissions.can_write_folder = true;
				node.permissions.can_write_file = true;
				node.links = populateLinks(node);
				const mocks = [
					mockGetNode(getNodeVariables(node.id), node),
					mockGetShares(getSharesVariables(node.id), node),
					mockGetNodeLinks({ node_id: node.id }, node)
				];

				render(<Displayer translationKey="No.node" />, {
					initialRouterEntries: [`/?node=${node.id}&tab=${DISPLAYER_TABS.sharing}`],
					mocks
				});

				await screen.findByText(/public link/i);
				const link = node.links[0] as Link;
				await screen.findByText(link.url as string);
				userEvent.click(screen.getAllByRole('button', { name: /edit/i })[0]);
				userEvent.click(screen.getByTestId('icon: CalendarOutline'));
				const nextMonthButton = await screen.findByRole('button', { name: /next month/i });
				userEvent.click(nextMonthButton);
				// chosen date is the 1st of next month
				const chosenDate = getFirstOfNextMonth(link.expires_at || undefined);
				// always click on first 1 visible on the date picker
				userEvent.click(screen.getAllByText('1')[0]);
				await screen.findByText(formatDate(chosenDate, 'DD/MM/YYYY'));
				act(() => {
					userEvent.click(screen.getByText(/details/i));
				});
				await screen.findByText(/you have unsaved changes/i);
				act(() => {
					// run modal timers
					jest.runOnlyPendingTimers();
				});
				expect(screen.getByText(/you have unsaved changes/i)).toBeVisible();
				expect(screen.getByText(/Do you want to leave the page without saving\?/i)).toBeVisible();
				expect(screen.getByText(/All unsaved changes will be lost/i)).toBeVisible();
				expect(screen.getByRole('button', { name: /cancel/i })).toBeVisible();
				expect(screen.getByRole('button', { name: /leave anyway/i })).toBeVisible();
				expect(screen.getByRole('button', { name: /save and leave/i })).toBeVisible();
			}, 60000);

			test('cancel action leaves fields valued and navigation is kept on sharing tab', async () => {
				const node = populateFile();
				node.permissions.can_share = true;
				node.permissions.can_write_folder = true;
				node.permissions.can_write_file = true;
				node.links = populateLinks(node);
				const link = node.links[0] as Link;
				const description = faker.lorem.words();
				const mocks = [
					mockGetNode(getNodeVariables(node.id), node),
					mockGetShares(getSharesVariables(node.id), node),
					mockGetNodeLinks({ node_id: node.id }, node)
				];

				render(<Displayer translationKey="No.node" />, {
					initialRouterEntries: [`/?node=${node.id}&tab=${DISPLAYER_TABS.sharing}`],
					mocks
				});

				await screen.findByText(/public link/i);
				await screen.findByText(link.url as string);
				userEvent.click(screen.getAllByRole('button', { name: /edit/i })[0]);
				const descriptionInput = await screen.findByRole('textbox', {
					name: /link's description/i
				});
				userEvent.clear(descriptionInput);
				userEvent.type(descriptionInput, description);
				userEvent.click(screen.getByTestId('icon: CalendarOutline'));
				const nextMonthButton = await screen.findByRole('button', { name: /next month/i });
				userEvent.click(nextMonthButton);
				// chosen date is the 1st of next month
				const chosenDate = formatDate(
					getFirstOfNextMonth(link.expires_at || undefined),
					'DD/MM/YYYY'
				);
				// always click on first 1 visible on the date picker
				userEvent.click(screen.getAllByText('1')[0]);
				await screen.findByText(chosenDate);
				act(() => {
					userEvent.click(screen.getByText(/details/i));
				});
				await screen.findByText(/you have unsaved changes/i);
				act(() => {
					// run modal timers
					jest.runOnlyPendingTimers();
				});
				const actionButton = screen.getByRole('button', { name: /cancel/i });
				expect(actionButton).toBeVisible();
				userEvent.click(actionButton);
				expect(actionButton).not.toBeInTheDocument();
				expect(screen.getByRole('textbox', { name: /link's description/i })).toHaveDisplayValue(
					description
				);
				expect(screen.getByText(chosenDate)).toBeVisible();
			}, 90000);

			test('leave anyway action reset fields and continue navigation', async () => {
				const node = populateFile();
				node.permissions.can_share = true;
				node.permissions.can_write_folder = true;
				node.permissions.can_write_file = true;
				node.links = populateLinks(node);
				const link = node.links[0] as Link;
				link.description = faker.lorem.lines(1);
				link.expires_at = faker.date.soon().getTime();
				const description = faker.lorem.words();
				const mocks = [
					mockGetNode(getNodeVariables(node.id), node),
					mockGetShares(getSharesVariables(node.id), node),
					mockGetNodeLinks({ node_id: node.id }, node)
				];

				render(<Displayer translationKey="No.node" />, {
					initialRouterEntries: [`/?node=${node.id}&tab=${DISPLAYER_TABS.sharing}`],
					mocks
				});

				await screen.findByText(/public link/i);
				await screen.findByText(link.url as string);
				userEvent.click(screen.getAllByRole('button', { name: /edit/i })[0]);
				let descriptionInput = await screen.findByRole('textbox', {
					name: /link's description/i
				});
				userEvent.type(descriptionInput, description);
				userEvent.click(screen.getByTestId('icon: CalendarOutline'));
				const nextMonthButton = await screen.findByRole('button', { name: /next month/i });
				userEvent.click(nextMonthButton);
				// chosen date is the 1st of next month
				const chosenDate = formatDate(getFirstOfNextMonth(link.expires_at), 'DD/MM/YYYY');
				// always click on first 1 visible on the date picker
				userEvent.click(screen.getAllByText('1')[0]);
				await screen.findByText(chosenDate);
				act(() => {
					userEvent.click(screen.getByText(/details/i));
				});
				await screen.findByText(/you have unsaved changes/i);
				act(() => {
					// run modal timers
					jest.runOnlyPendingTimers();
				});
				const actionButton = screen.getByRole('button', { name: /leave anyway/i });
				expect(actionButton).toBeVisible();
				userEvent.click(actionButton);
				expect(actionButton).not.toBeInTheDocument();
				await screen.findByText(/description/i);
				act(() => {
					// possible timers of displayer preview
					jest.runOnlyPendingTimers();
				});
				expect(screen.queryByText(/public link/i)).not.toBeInTheDocument();
				// go back to sharing tab
				userEvent.click(screen.getByText(/sharing/i));
				// add link status is reset
				expect(screen.getAllByRole('button', { name: /edit/i })[0]).toBeVisible();
				expect(
					screen.queryByRole('textbox', { name: /link's description/i })
				).not.toBeInTheDocument();
				expect(screen.queryByText(description)).not.toBeInTheDocument();
				expect(screen.queryByText(chosenDate)).not.toBeInTheDocument();
				// re-edit the same link
				userEvent.click(screen.getAllByRole('button', { name: /edit/i })[0]);
				descriptionInput = await screen.findByRole('textbox', { name: /link's description/i });
				// new link fields are cleaned
				expect(descriptionInput).toHaveDisplayValue(link.description);
				expect(screen.queryByText(chosenDate)).not.toBeInTheDocument();
				expect(screen.getByText(formatDate(link.expires_at, 'DD/MM/YYYY'))).toBeVisible();
			}, 90000);

			test('save and leave action update link and continue navigation', async () => {
				const node = populateFile();
				node.permissions.can_share = true;
				node.permissions.can_write_folder = true;
				node.permissions.can_write_file = true;
				node.links = populateLinks(node, 1);
				const link = node.links[0] as Link;
				link.description = faker.lorem.lines(1);
				link.expires_at = faker.date.soon().getTime();
				const newDescription = faker.lorem.words();
				const firstOfNextMonth = getFirstOfNextMonth(link.expires_at);
				const newExpiresAt = initExpirationDate(firstOfNextMonth) as Date;
				const mocks = [
					mockGetNode(getNodeVariables(node.id), node),
					mockGetShares(getSharesVariables(node.id), node),
					mockGetNodeLinks({ node_id: node.id }, node),
					mockUpdateLink(
						{ link_id: link.id, description: newDescription, expires_at: newExpiresAt.getTime() },
						{ ...link, description: newDescription, expires_at: newExpiresAt.getTime() }
					)
				];

				render(<Displayer translationKey="No.node" />, {
					initialRouterEntries: [`/?node=${node.id}&tab=${DISPLAYER_TABS.sharing}`],
					mocks
				});

				await screen.findByText(/public link/i);
				await screen.findByText(link.url as string);
				userEvent.click(screen.getByRole('button', { name: /edit/i }));
				const descriptionInput = await screen.findByRole('textbox', {
					name: /link's description/i
				});
				userEvent.clear(descriptionInput);
				userEvent.type(descriptionInput, newDescription);
				userEvent.click(screen.getByTestId('icon: CalendarOutline'));
				const nextMonthButton = await screen.findByRole('button', { name: /next month/i });
				userEvent.click(nextMonthButton);
				// chosen date is the 1st of next month
				const chosenDate = formatDate(firstOfNextMonth, 'DD/MM/YYYY');
				// always click on first 1 visible on the date picker
				userEvent.click(screen.getAllByText('1')[0]);
				await screen.findByText(chosenDate);
				act(() => {
					userEvent.click(screen.getByText(/details/i));
				});
				await screen.findByText(/you have unsaved changes/i);
				act(() => {
					// run modal timers
					jest.runOnlyPendingTimers();
				});
				const actionButton = screen.getByRole('button', { name: /save and leave/i });
				expect(actionButton).toBeVisible();
				userEvent.click(actionButton);
				const snackbar = await screen.findByText(/public link updated/i);
				await waitForElementToBeRemoved(snackbar);
				await screen.findByText(/description/i);
				// go back to sharing tab
				userEvent.click(screen.getByText(/sharing/i));
				await screen.findByText(link.url as string);
				// link has been updated
				expect(screen.getByText(newDescription)).toBeVisible();
				expect(screen.queryByText(link.description)).not.toBeInTheDocument();
				const expiresOnDate = formatDate(
					new Date(
						firstOfNextMonth.getFullYear(),
						firstOfNextMonth.getMonth(),
						firstOfNextMonth.getDate(),
						23,
						59
					),
					'DD/MM/YY HH:mm'
				);
				const expiresOnRegexp = RegExp(`expires on: ${expiresOnDate}`, 'i');
				expect(screen.getByText(expiresOnRegexp)).toBeVisible();
				// edit link status is reset
				expect(screen.getByRole('button', { name: /revoke/i })).toBeVisible();
				expect(screen.getByRole('button', { name: /edit/i })).toBeVisible();
				expect(
					screen.queryByRole('textbox', { name: /link's description/i })
				).not.toBeInTheDocument();
			}, 90000);

			test('save and leave action with errors leaves fields valued and navigation is kept on sharing tab', async () => {
				const node = populateFile();
				node.permissions.can_share = true;
				node.permissions.can_write_folder = true;
				node.permissions.can_write_file = true;
				node.links = populateLinks(node, 1);
				const link = node.links[0] as Link;
				link.description = faker.lorem.lines(1);
				link.expires_at = faker.date.soon().getTime();
				const newDescription = faker.lorem.words();
				const firstOfNextMonth = getFirstOfNextMonth(link.expires_at);
				const newExpiresAt = initExpirationDate(firstOfNextMonth) as Date;
				const mocks = [
					mockGetNode(getNodeVariables(node.id), node),
					mockGetShares(getSharesVariables(node.id), node),
					mockGetNodeLinks({ node_id: node.id }, node),
					mockUpdateLinkError(
						{ link_id: link.id, description: newDescription, expires_at: newExpiresAt.getTime() },
						new ApolloError({ graphQLErrors: [generateError('update link error')] })
					)
				];

				render(<Displayer translationKey="No.node" />, {
					initialRouterEntries: [`/?node=${node.id}&tab=${DISPLAYER_TABS.sharing}`],
					mocks
				});

				await screen.findByText(/public link/i);
				await screen.findByText(link.url as string);
				userEvent.click(screen.getByRole('button', { name: /edit/i }));
				const descriptionInput = await screen.findByRole('textbox', {
					name: /link's description/i
				});
				userEvent.clear(descriptionInput);
				userEvent.type(descriptionInput, newDescription);
				userEvent.click(screen.getByTestId('icon: CalendarOutline'));
				const nextMonthButton = await screen.findByRole('button', { name: /next month/i });
				userEvent.click(nextMonthButton);
				// chosen date is the 1st of next month
				const chosenDate = formatDate(firstOfNextMonth, 'DD/MM/YYYY');
				// always click on first 1 visible on the date picker
				userEvent.click(screen.getAllByText('1')[0]);
				await screen.findByText(chosenDate);
				act(() => {
					userEvent.click(screen.getByText(/details/i));
				});
				await screen.findByText(/you have unsaved changes/i);
				act(() => {
					// run modal timers
					jest.runOnlyPendingTimers();
				});
				const actionButton = screen.getByRole('button', { name: /save and leave/i });
				expect(actionButton).toBeVisible();
				userEvent.click(actionButton);
				const snackbar = await screen.findByText(/update link error/i);
				await waitForElementToBeRemoved(snackbar);
				expect(actionButton).not.toBeInTheDocument();
				expect(screen.getByRole('textbox', { name: /link's description/i })).toHaveDisplayValue(
					newDescription
				);
				expect(screen.getByText(chosenDate)).toBeVisible();
			}, 90000);
		});
	});
});
