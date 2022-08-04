/*
 * SPDX-FileCopyrightText: 2022 Zextras <https://www.zextras.com>
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

/* eslint-disable arrow-body-style */
import { useCallback } from 'react';

import { FetchResult, useMutation } from '@apollo/client';

import INVITATION_LINK from '../../../graphql/fragments/invitationLink.graphql';
import CREATE_INVITATION_LINK from '../../../graphql/mutations/createInvitationLink.graphql';
import {
	CreateInvitationLinkMutation,
	CreateInvitationLinkMutationVariables,
	InvitationLinkFragment,
	SharePermission
} from '../../../types/graphql/types';
import { useErrorHandler } from '../../useErrorHandler';

export type CreateInvitationLinkType = (
	permission: SharePermission
) => Promise<FetchResult<CreateInvitationLinkMutation>>;

export function useCreateInvitationLinkMutation(nodeId: string): {
	createInvitationLink: CreateInvitationLinkType;
	loading: boolean;
} {
	const [createInvitationLinkMutation, { error: createInvitationLinkError, loading }] = useMutation<
		CreateInvitationLinkMutation,
		CreateInvitationLinkMutationVariables
	>(CREATE_INVITATION_LINK);

	const createInvitationLink: CreateInvitationLinkType = useCallback(
		(permission) => {
			return createInvitationLinkMutation({
				variables: {
					node_id: nodeId,
					permission
				},
				update(cache, { data }) {
					if (data?.createInvitationLink) {
						cache.modify({
							id: cache.identify(data.createInvitationLink.node),
							fields: {
								invitation_links(existingInvitationLinks) {
									const newLinkRef = cache.writeFragment<InvitationLinkFragment>({
										data: data.createInvitationLink,
										fragment: INVITATION_LINK
									});
									return [newLinkRef, ...existingInvitationLinks];
								}
							}
						});
					}
				}
			});
		},
		[createInvitationLinkMutation, nodeId]
	);
	useErrorHandler(createInvitationLinkError, 'CREATE_INVITATION_LINK');
	return { createInvitationLink, loading };
}
