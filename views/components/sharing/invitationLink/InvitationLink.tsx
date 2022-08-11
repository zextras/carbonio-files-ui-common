/*
 * SPDX-FileCopyrightText: 2022 Zextras <https://www.zextras.com>
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

/* eslint-disable no-nested-ternary */
import React, { useCallback, useMemo } from 'react';

import {
	Button,
	Chip,
	Container,
	Icon,
	Padding,
	Text,
	Tooltip,
	useModal
} from '@zextras/carbonio-design-system';
import find from 'lodash/find';
import { useTranslation } from 'react-i18next';
import styled from 'styled-components';

import { useCreateInvitationLinkMutation } from '../../../../hooks/graphql/mutations/useCreateInvitationLinkMutation';
import { useDeleteInvitationLinksMutation } from '../../../../hooks/graphql/mutations/useDeleteInvitationLinksMutation';
import { useGetNodeInvitationLinksQuery } from '../../../../hooks/graphql/queries/useGetNodeInvitationLinksQuery';
import { useCreateSnackbar } from '../../../../hooks/useCreateSnackbar';
import { SharePermission } from '../../../../types/graphql/types';
import { copyToClipboard } from '../../../../utils/utils';
import { FlexContainer, TextWithLineHeight } from '../../StyledComponents';

const CustomButton = styled(Button)`
	margin-left: auto;
`;

interface InvitationLinkProps {
	nodeTypename: 'File' | 'Folder' | undefined;
	nodeId: string;
	canWrite: boolean;
	nodeName: string;
}

export const InvitationLink: React.FC<InvitationLinkProps> = ({
	nodeId,
	nodeTypename,
	canWrite,
	nodeName
}) => {
	const [t] = useTranslation();
	const createSnackbar = useCreateSnackbar();
	const createModal = useModal();

	const { data: getInvitationLinksQueryData, loading } = useGetNodeInvitationLinksQuery(nodeId);

	const readAndShareInvitationLink = useMemo(() => {
		if (getInvitationLinksQueryData?.getNode?.invitation_links) {
			return find(
				getInvitationLinksQueryData?.getNode?.invitation_links,
				(link) => link?.permission === SharePermission.ReadAndShare
			);
		}
		return undefined;
	}, [getInvitationLinksQueryData]);

	const readWriteAndShareInvitationLink = useMemo(() => {
		if (getInvitationLinksQueryData?.getNode?.invitation_links) {
			return find(
				getInvitationLinksQueryData?.getNode?.invitation_links,
				(link) => link?.permission === SharePermission.ReadWriteAndShare
			);
		}
		return undefined;
	}, [getInvitationLinksQueryData]);

	/** Mutation to create invitation link */
	const { createInvitationLink, loading: createInvitationLinkLoading } =
		useCreateInvitationLinkMutation(nodeId);

	/** Mutation to delete invitation link */
	const deleteInvitationsLinks = useDeleteInvitationLinksMutation({
		id: nodeId,
		__typename: nodeTypename
	});

	const copyLinkToClipboard = useCallback(
		(link: string) => {
			copyToClipboard(link).then(() => {
				createSnackbar({
					key: new Date().toLocaleString(),
					type: 'info',
					label: t('snackbar.invitationLink.copyInvitationLink', 'Invitation link copied'),
					replace: true,
					hideButton: true
				});
			});
		},
		[createSnackbar, t]
	);

	const createCallback = useCallback(
		({ data }) => {
			if (data) {
				createSnackbar({
					key: new Date().toLocaleString(),
					type: 'info',
					label: t(
						'snackbar.invitationLink.newInvitationLinkGenerated.label',
						'New Invitation Link generated'
					),
					replace: true,
					onActionClick: () => {
						copyLinkToClipboard(data.createInvitationLink.url);
					},
					actionLabel: t('snackbar.invitationLink.actionLabel.copyLink', 'Copy Link')
				});
			}
		},
		[copyLinkToClipboard, createSnackbar, t]
	);

	const createReadAndShareInvitationLinkCallback = useCallback(() => {
		createInvitationLink(SharePermission.ReadAndShare).then(createCallback);
	}, [createCallback, createInvitationLink]);

	const createReadWriteAndShareInvitationLinkCallback = useCallback(() => {
		createInvitationLink(SharePermission.ReadWriteAndShare).then(createCallback);
	}, [createCallback, createInvitationLink]);

	const copyInvitationUrl = useCallback(
		(event) => {
			copyLinkToClipboard(event.target.textContent);
		},
		[copyLinkToClipboard]
	);

	const openDeleteModal = useCallback(
		(linkId: string) => {
			const closeModal = createModal({
				title: t('modal.revokeInvitationLink.header', 'Revoke {{nodeName}} invitation link', {
					replace: { nodeName }
				}),
				confirmLabel: t('modal.revokeInvitationLink.button.confirm', 'Revoke'),
				confirmColor: 'error',
				onConfirm: () => {
					deleteInvitationsLinks([linkId]).then(({ data }) => {
						if (data) {
							closeModal();
						}
					});
				},
				showCloseIcon: true,
				onClose: () => {
					closeModal();
				},
				children: (
					<Container padding={{ vertical: 'large' }}>
						<Text overflow="break-word" size="small">
							{t(
								'modal.revokeInvitationLink.body',
								'By revoking this link, you are blocking access to {{nodeName}} for anyone who tries to use the link to access the file',
								{
									replace: { nodeName }
								}
							)}
						</Text>
					</Container>
				)
			});
		},
		[createModal, deleteInvitationsLinks, nodeName, t]
	);

	const deleteReadAndShareInvitationLinkCallback = useCallback(() => {
		if (readAndShareInvitationLink) {
			openDeleteModal(readAndShareInvitationLink.id);
		}
	}, [openDeleteModal, readAndShareInvitationLink]);

	const deleteReadWriteAndShareInvitationLinkCallback = useCallback(() => {
		if (readWriteAndShareInvitationLink) {
			openDeleteModal(readWriteAndShareInvitationLink.id);
		}
	}, [openDeleteModal, readWriteAndShareInvitationLink]);

	return (
		<Container
			mainAlignment="flex-start"
			crossAlignment="flex-start"
			height="fit"
			padding={{ all: 'large' }}
			background="gray6"
			data-testid="invitation-link-container"
		>
			<Container
				mainAlignment="flex-start"
				crossAlignment="flex-start"
				height="fit"
				background="gray6"
			>
				<TextWithLineHeight size="medium">
					{t('invitationLink.title', 'Invitation Link')}
				</TextWithLineHeight>
				<TextWithLineHeight size="extrasmall" color="secondary" overflow="break-word">
					{t(
						'invitationLink.description',
						'Internal users will receive the permissions by opening the link. You can always modify granted permissions once the users has clicked on the link.'
					)}
				</TextWithLineHeight>
			</Container>
			<Padding vertical="small" />
			<FlexContainer
				orientation="horizontal"
				mainAlignment="flex-start"
				crossAlignment="flex-start"
				gap="8px"
				padding={{ all: 'small' }}
				data-testid="read-share-invitation-link-container"
			>
				<Icon icon="EyeOutline" size="medium" />
				<Container crossAlignment="flex-start" width="fit">
					<TextWithLineHeight size="small">
						{t('invitationLink.row.title.ReadAndShare', 'Read and Share')}
					</TextWithLineHeight>
					{readAndShareInvitationLink ? (
						<Chip
							label={
								<Tooltip
									label={t('invitationLink.link.urlChip.tooltip.copy', 'Copy invitation link')}
									maxWidth="unset"
									placement="top"
								>
									<Text size="small" weight="light">
										{readAndShareInvitationLink.url}
									</Text>
								</Tooltip>
							}
							hasAvatar={false}
							minWidth={0}
							onClick={copyInvitationUrl}
						/>
					) : (
						<TextWithLineHeight size="extrasmall" color="secondary">
							{t('invitationLink.row.placeholder', 'Create a link in order to share it')}
						</TextWithLineHeight>
					)}
				</Container>
				{readAndShareInvitationLink ? (
					<CustomButton
						isSmall
						type="outlined"
						color="error"
						label={t('invitationLink.button.revoke', 'Revoke')}
						onClick={deleteReadAndShareInvitationLinkCallback}
						icon={'SlashOutline'}
					/>
				) : (
					<CustomButton
						isSmall
						type="outlined"
						label={t('invitationLink.button.generateLink', 'Generate Link')}
						onClick={createReadAndShareInvitationLinkCallback}
						disabled={loading}
					/>
				)}
			</FlexContainer>
			<Padding vertical="extrasmall" />
			{canWrite && (
				<FlexContainer
					orientation="horizontal"
					mainAlignment="flex-start"
					crossAlignment="flex-start"
					gap="8px"
					padding={{ all: 'small' }}
					data-testid="read-write-share-invitation-link-container"
				>
					<Icon icon="Edit2Outline" size="medium" />
					<Container crossAlignment="flex-start" width="fit">
						<TextWithLineHeight size="small">
							{t('invitationLink.row.title.writeAndShare', 'Write and Share')}
						</TextWithLineHeight>
						{readWriteAndShareInvitationLink ? (
							<Chip
								label={
									<Tooltip
										label={t('invitationLink.link.urlChip.tooltip.copy', 'Copy invitation link')}
										maxWidth="unset"
										placement="top"
									>
										<Text size="small" weight="light">
											{readWriteAndShareInvitationLink.url}
										</Text>
									</Tooltip>
								}
								hasAvatar={false}
								minWidth={0}
								onClick={copyInvitationUrl}
							/>
						) : (
							<TextWithLineHeight size="extrasmall" color="secondary">
								{t('invitationLink.row.placeholder', 'Create a link in order to share it')}
							</TextWithLineHeight>
						)}
					</Container>
					{readWriteAndShareInvitationLink ? (
						<CustomButton
							isSmall
							type="outlined"
							color="error"
							label={t('invitationLink.button.revoke', 'Revoke')}
							onClick={deleteReadWriteAndShareInvitationLinkCallback}
							icon={'SlashOutline'}
						/>
					) : (
						<CustomButton
							isSmall
							type="outlined"
							label={t('invitationLink.button.generateLink', 'Generate Link')}
							onClick={createReadWriteAndShareInvitationLinkCallback}
							disabled={loading}
						/>
					)}
				</FlexContainer>
			)}
		</Container>
	);
};
