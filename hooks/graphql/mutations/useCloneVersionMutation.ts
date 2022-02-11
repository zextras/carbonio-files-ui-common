/*
 * SPDX-FileCopyrightText: 2022 Zextras <https://www.zextras.com>
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

/* eslint-disable arrow-body-style */
import { useCallback } from 'react';

import { FetchResult, useMutation } from '@apollo/client';

import CLONE_VERSION from '../../../graphql/mutations/cloneVersion.graphql';
import { CloneVersionMutation, CloneVersionMutationVariables } from '../../../types/graphql/types';
import { useErrorHandler } from '../../useErrorHandler';

export type CloneVersionType = (
	nodeId: string,
	version: number
) => Promise<FetchResult<CloneVersionMutation>>;

/**
 * Can return error: TODO
 */
export function useCloneVersionMutation(): CloneVersionType {
	const [cloneVersionMutation, { error: cloneVersionError }] = useMutation<
		CloneVersionMutation,
		CloneVersionMutationVariables
	>(CLONE_VERSION);

	const cloneVersion: CloneVersionType = useCallback(
		(nodeId: string, version: number) => {
			return cloneVersionMutation({
				variables: {
					id: nodeId,
					version
				},
				update(cache, { data }) {
					if (data?.cloneVersion) {
						cache.modify({
							fields: {
								[`getVersions({"id":"${nodeId}"})`](existingVersions) {
									return [data.cloneVersion, ...existingVersions];
								}
							}
						});
					}
				}
			});
		},
		[cloneVersionMutation]
	);
	useErrorHandler(cloneVersionError, 'KEEP_VERSIONS');

	return cloneVersion;
}
