/*
 * SPDX-FileCopyrightText: 2022 Zextras <https://www.zextras.com>
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

/* eslint-disable arrow-body-style */
import { useCallback } from 'react';

import { ApolloError, FetchResult, gql, useMutation } from '@apollo/client';
import reduce from 'lodash/reduce';

import UPDATE_SHARE from '../../../graphql/mutations/updateShare.graphql';
import { PickIdNodeType } from '../../../types/common';
import {
	DistributionList,
	Share,
	SharePermission,
	UpdateShareMutation,
	UpdateShareMutationVariables,
	User
} from '../../../types/graphql/types';
import { useErrorHandler } from '../../useErrorHandler';

export type UpdateShareType = (
	node: PickIdNodeType,
	shareTargetId: string,
	permission: SharePermission
) => Promise<FetchResult<UpdateShareMutation>>;

/**
 * Can return error: ErrorCode.SHARE_NOT_FOUND
 */
export function useUpdateShareMutation(): [
	updateShare: UpdateShareType,
	updateShareError: ApolloError | undefined
] {
	const [updateShareMutation, { error: updateShareError }] = useMutation<
		UpdateShareMutation,
		UpdateShareMutationVariables
	>(UPDATE_SHARE);

	const updateShare: UpdateShareType = useCallback(
		(node: PickIdNodeType, shareTargetId: string, permission: SharePermission) => {
			return updateShareMutation({
				variables: {
					node_id: node.id,
					share_target_id: shareTargetId,
					permission
				},
				update(cache) {
					cache.modify({
						id: cache.identify(node),
						fields: {
							shares(existingShareRefs: Share[]) {
								const updatedShares = reduce(
									existingShareRefs,
									(accumulator: Share[], existingShareRef: Share) => {
										const sharedTarget: User | DistributionList | null | undefined =
											existingShareRef.share_target &&
											// TODO: move fragment to graphql file and add type
											cache.readFragment({
												id: cache.identify(existingShareRef.share_target),
												fragment: gql`
													fragment SharedTargetId on SharedTarget {
														... on DistributionList {
															id
														}
														... on User {
															id
														}
													}
												`
											});
										if (sharedTarget && sharedTarget.id === shareTargetId) {
											const newExistingShareRef = {
												...existingShareRef,
												permission
											};
											accumulator.push(newExistingShareRef);
											return accumulator;
										}
										accumulator.push(existingShareRef);
										return accumulator;
									},
									[]
								);

								return updatedShares;
							}
						}
					});
				}
			});
		},
		[updateShareMutation]
	);
	useErrorHandler(updateShareError, 'UPDATE_SHARE');

	return [updateShare, updateShareError];
}
