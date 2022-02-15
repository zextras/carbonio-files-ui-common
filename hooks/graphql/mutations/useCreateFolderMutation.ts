/*
 * SPDX-FileCopyrightText: 2022 Zextras <https://www.zextras.com>
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

/* eslint-disable arrow-body-style */
import { useCallback } from 'react';

import { ApolloError, FetchResult, useMutation } from '@apollo/client';

import CREATE_FOLDER from '../../../graphql/mutations/createFolder.graphql';
import {
	CreateFolderMutation,
	CreateFolderMutationVariables,
	Folder
} from '../../../types/graphql/types';
import { scrollToNodeItem } from '../../../utils/utils';
import { useErrorHandler } from '../../useErrorHandler';
import { useUpdateFolderContent } from '../useUpdateFolderContent';

export type CreateFolderType = (
	parentFolder: Folder,
	name: string
) => Promise<FetchResult<CreateFolderMutation>>;

/**
 * Can return error: ErrorCode.FILE_VERSION_NOT_FOUND, ErrorCode.NODE_NOT_FOUND
 */
export function useCreateFolderMutation(): [
	createFolder: CreateFolderType,
	createFolderError: ApolloError | undefined
] {
	const [createFolderMutation, { error: createFolderError }] = useMutation<
		CreateFolderMutation,
		CreateFolderMutationVariables
	>(CREATE_FOLDER);
	const { addNodeToFolder } = useUpdateFolderContent();

	const createFolder: CreateFolderType = useCallback(
		(parentFolder: Pick<Folder, '__typename' | 'id' | 'children'>, name: string) => {
			return createFolderMutation({
				variables: {
					destination_id: parentFolder.id,
					name
				},
				// after the mutation returns a response, check if next neighbor is already loaded.
				// If so, write the folder in cache,
				// otherwise this new folder will be loaded with next fetchMore calls
				update(cache, { data }) {
					if (data?.createFolder) {
						const newPosition = addNodeToFolder(parentFolder, data.createFolder);
						scrollToNodeItem(data.createFolder.id, newPosition === parentFolder.children.length);
					}
				}
			});
		},
		[createFolderMutation, addNodeToFolder]
	);
	useErrorHandler(createFolderError, 'CREATE_FOLDER');

	return [createFolder, createFolderError];
}
