/*
 * SPDX-FileCopyrightText: 2022 Zextras <https://www.zextras.com>
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

/* eslint-disable arrow-body-style */
import { useCallback } from 'react';

import { FetchResult, useMutation } from '@apollo/client';

import UPDATE_LINK from '../../../graphql/mutations/updateLink.graphql';
import { UpdateLinkMutation, UpdateLinkMutationVariables } from '../../../types/graphql/types';
import { useErrorHandler } from '../../useErrorHandler';

export type UpdateLinkType = (
	id: string,
	description?: string,
	expiresAt?: number
) => Promise<FetchResult<UpdateLinkMutation>>;

/**
 * Can return error: ErrorCode.LINK_NOT_FOUND
 */
export function useUpdateLinkMutation(): UpdateLinkType {
	const [updateLinkMutation, { error: updateLinkError }] = useMutation<
		UpdateLinkMutation,
		UpdateLinkMutationVariables
	>(UPDATE_LINK);

	const updateLink: UpdateLinkType = useCallback(
		(id: string, description?: string, expiresAt?: number) => {
			return updateLinkMutation({
				variables: {
					link_id: id,
					description,
					expires_at: expiresAt
				}
			});
		},
		[updateLinkMutation]
	);
	useErrorHandler(updateLinkError, 'UPDATE_LINK');

	return updateLink;
}
