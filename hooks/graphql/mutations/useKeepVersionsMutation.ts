/*
 * SPDX-FileCopyrightText: 2022 Zextras <https://www.zextras.com>
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

/* eslint-disable arrow-body-style */
import { useCallback } from 'react';

import { FetchResult, useMutation } from '@apollo/client';
import includes from 'lodash/includes';
import map from 'lodash/map';

import KEEP_VERSIONS from '../../../graphql/mutations/keepVersions.graphql';
import {
	File,
	KeepVersionsMutation,
	KeepVersionsMutationVariables
} from '../../../types/graphql/types';
import { useErrorHandler } from '../../useErrorHandler';

export type KeepVersionsType = (
	nodeId: string,
	versions: Array<number>,
	keepForever: boolean
) => Promise<FetchResult<KeepVersionsMutation>>;

/**
 * Can return error: TODO
 */
export function useKeepVersionsMutation(): KeepVersionsType {
	const [keepVersionsMutation, { error: keepVersionsError }] = useMutation<
		KeepVersionsMutation,
		KeepVersionsMutationVariables
	>(KEEP_VERSIONS);

	const keepVersions: KeepVersionsType = useCallback(
		(nodeId: string, versions: Array<number>, keepForever: boolean) => {
			return keepVersionsMutation({
				variables: {
					node_id: nodeId,
					versions,
					keep_forever: keepForever
				},
				optimisticResponse: {
					__typename: 'Mutation',
					keepVersions: versions
				},
				update(cache, { data }) {
					if (data?.keepVersions) {
						cache.modify({
							fields: {
								// TODO: think about another strategy because this way is impossible to detect during refactors
								[`getVersions({"node_id":"${nodeId}"})`](existingVersions) {
									return map(existingVersions, (fileVersion: File) =>
										includes(data.keepVersions, fileVersion.version)
											? { ...fileVersion, keep_forever: keepForever }
											: fileVersion
									);
								}
							}
						});
					}
				}
			});
		},
		[keepVersionsMutation]
	);
	useErrorHandler(keepVersionsError, 'KEEP_VERSIONS');

	return keepVersions;
}
