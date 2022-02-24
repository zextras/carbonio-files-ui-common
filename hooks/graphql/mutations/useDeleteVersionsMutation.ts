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

import DELETE_VERSIONS from '../../../graphql/mutations/deleteVersions.graphql';
import {
	DeleteVersionsMutation,
	DeleteVersionsMutationVariables,
	File
} from '../../../types/graphql/types';
import { useErrorHandler } from '../../useErrorHandler';

export type DeleteVersionsType = (
	nodeId: string,
	versions?: Array<number>
) => Promise<FetchResult<DeleteVersionsMutation>>;

/**
 * Can return error: TODO
 */
export function useDeleteVersionsMutation(): DeleteVersionsType {
	const [deleteVersionsMutation, { error: deleteVersionsError }] = useMutation<
		DeleteVersionsMutation,
		DeleteVersionsMutationVariables
	>(DELETE_VERSIONS);

	const deleteVersions: DeleteVersionsType = useCallback(
		(nodeId: string, versions?: Array<number>) => {
			return deleteVersionsMutation({
				variables: {
					node_id: nodeId,
					versions
				},
				optimisticResponse: {
					__typename: 'Mutation',
					deleteVersions: versions || []
				},
				update(cache, { data }) {
					if (data?.deleteVersions) {
						cache.modify({
							fields: {
								// TODO: think about another strategy because this way is impossible to detect during refactors
								[`getVersions({"node_id":"${nodeId}"})`](existingVersions) {
									return filter(existingVersions, (fileVersion: File) => {
										return !includes(data.deleteVersions, fileVersion.version);
									});
								}
							}
						});
					}
				}
			});
		},
		[deleteVersionsMutation]
	);
	useErrorHandler(deleteVersionsError, 'DELETE_VERSIONS');

	return deleteVersions;
}
