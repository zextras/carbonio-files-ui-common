/*
 * SPDX-FileCopyrightText: 2022 Zextras <https://www.zextras.com>
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

/* eslint-disable arrow-body-style */
import { useCallback } from 'react';

import { FetchResult, gql, useMutation } from '@apollo/client';
import { useSnackbar } from '@zextras/carbonio-design-system';
import filter from 'lodash/filter';
import size from 'lodash/size';
import { useTranslation } from 'react-i18next';

import useUserInfo from '../../../../hooks/useUserInfo';
import PARENT_ID from '../../../graphql/fragments/parentId.graphql';
import DELETE_SHARE from '../../../graphql/mutations/deleteShare.graphql';
import { FindNodesCachedObject } from '../../../types/apollo';
import { PickIdNodeType } from '../../../types/common';
import {
	DeleteShareMutation,
	DeleteShareMutationVariables,
	DistributionList,
	Folder,
	ParentIdFragment,
	Share,
	User
} from '../../../types/graphql/types';
import { useErrorHandler } from '../../useErrorHandler';
import { useUpdateFolderContent } from '../useUpdateFolderContent';

/**
 * Mutation to delete share.
 * Can return error: ErrorCode.SHARE_NOT_FOUND
 */
export function useDeleteShareMutation(): (
	node: PickIdNodeType,
	shareTargetId: string
) => Promise<FetchResult<DeleteShareMutation>> {
	const createSnackbar = useSnackbar();
	const { removeNodesFromFolder } = useUpdateFolderContent();
	const [t] = useTranslation();
	const { me } = useUserInfo();

	const [deleteShareMutation, { error }] = useMutation<
		DeleteShareMutation,
		DeleteShareMutationVariables
	>(DELETE_SHARE);

	useErrorHandler(error, 'DELETE_SHARE');

	const deleteShare: (
		node: PickIdNodeType,
		shareTargetId: string
	) => Promise<FetchResult<DeleteShareMutation>> = useCallback(
		(node: PickIdNodeType, shareTargetId: string) => {
			return deleteShareMutation({
				variables: {
					node_id: node.id,
					share_target_id: shareTargetId
				},
				optimisticResponse: {
					__typename: 'Mutation',
					deleteShare: true
				},
				errorPolicy: 'all',
				update(cache, { data }) {
					if (data?.deleteShare) {
						cache.modify({
							id: cache.identify(node),
							fields: {
								shares(existingShareRefs: Share[]) {
									const updatedShares = filter(existingShareRefs, (existingShareRef) => {
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
										return !(sharedTarget && sharedTarget.id === shareTargetId);
									});
									return updatedShares;
								}
							}
						});
						// remove node from shared with me
						if (shareTargetId === me) {
							cache.modify({
								fields: {
									findNodes(
										existingNodesRefs: FindNodesCachedObject | undefined,
										{ readField, DELETE }
									): FindNodesCachedObject | undefined {
										if (existingNodesRefs?.args?.shared_with_me) {
											const ordered = filter(
												existingNodesRefs.nodes?.ordered,
												(orderedNode) => node.id !== readField('id', orderedNode)
											);
											const unOrdered = filter(
												existingNodesRefs.nodes?.unOrdered,
												(unOrderedNode) => node.id !== readField('id', unOrderedNode)
											);

											if (
												existingNodesRefs.page_token &&
												size(ordered) === 0 &&
												size(unOrdered) === 0
											) {
												return DELETE;
											}

											return {
												args: existingNodesRefs.args,
												page_token: existingNodesRefs.page_token,
												nodes: {
													ordered,
													unOrdered
												}
											};
										}
										// if no update is needed, return existing data (new requests are handled with navigation)
										return existingNodesRefs;
									}
								}
							});

							const parentFolder = cache.readFragment<ParentIdFragment>({
								id: cache.identify(node),
								fragment: PARENT_ID
							});
							if (parentFolder?.parent) {
								removeNodesFromFolder(parentFolder.parent as Pick<Folder, '__typename' | 'id'>, [
									node.id
								]);
							}
						}
					}
				}
			}).then((result) => {
				if (result.data?.deleteShare) {
					createSnackbar({
						key: new Date().toLocaleString(),
						type: 'info',
						label: t('snackbar.deleteShare.success', 'Success'),
						replace: true,
						hideButton: true
					});
				}
				return result;
			});
		},
		[createSnackbar, deleteShareMutation, me, removeNodesFromFolder, t]
	);

	return deleteShare;
}
