/*
 * SPDX-FileCopyrightText: 2022 Zextras <https://www.zextras.com>
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

/* eslint-disable arrow-body-style */
import { useCallback } from 'react';

import { FetchResult, useMutation } from '@apollo/client';
import filter from 'lodash/filter';
import includes from 'lodash/includes';

import INVITATION_LINK from '../../../graphql/fragments/invitationLink.graphql';
import DELETE_INVITATION_LINKS from '../../../graphql/mutations/deleteInvitationLinks.graphql';
import { PickIdTypenameNodeType } from '../../../types/common';
import {
	DeleteInvitationLinksMutation,
	DeleteInvitationLinksMutationVariables,
	InvitationLinkFragment
} from '../../../types/graphql/types';
import { useErrorHandler } from '../../useErrorHandler';

export type DeleteInvitationLinksType = (
	invitationLinkIds: Array<string>
) => Promise<FetchResult<DeleteInvitationLinksMutation>>;

/**
 * Can return error: ErrorCode.
 */
export function useDeleteInvitationLinksMutation(
	node: PickIdTypenameNodeType
): DeleteInvitationLinksType {
	const [deleteInvitationLinksMutation, { error: deleteInvitationLinksError }] = useMutation<
		DeleteInvitationLinksMutation,
		DeleteInvitationLinksMutationVariables
	>(DELETE_INVITATION_LINKS);

	const deleteInvitationLinks: DeleteInvitationLinksType = useCallback(
		(invitationLinkIds) => {
			return deleteInvitationLinksMutation({
				variables: {
					invitation_link_ids: invitationLinkIds
				},
				update(cache, { data }) {
					if (data?.deleteInvitationLinks) {
						cache.modify({
							id: cache.identify(node),
							fields: {
								invitation_links(existingInvitationLinks) {
									return filter(existingInvitationLinks, (existingInvitationLink) => {
										const invitationLink = cache.readFragment<InvitationLinkFragment>({
											id: cache.identify(existingInvitationLink),
											fragment: INVITATION_LINK
										});
										return !(
											invitationLink && includes(data.deleteInvitationLinks, invitationLink.id)
										);
									});
								}
							}
						});
					}
				}
			});
		},
		[deleteInvitationLinksMutation, node]
	);
	useErrorHandler(deleteInvitationLinksError, 'DELETE_INVITATION_LINKS');

	return deleteInvitationLinks;
}
