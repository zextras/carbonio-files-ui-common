/*
 * SPDX-FileCopyrightText: 2022 Zextras <https://www.zextras.com>
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

/* eslint-disable arrow-body-style */
import { useCallback } from 'react';

import { FetchResult, MutationResult, useMutation } from '@apollo/client';

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

export type CreateFolderWithoutUpdateType = (
	parentId: string,
	name: string
) => Promise<FetchResult<CreateFolderMutation>>;

type CreateFolderMutationOptions = {
	showSnackbar?: boolean;
};

/**
 * Can return error: ErrorCode.FILE_VERSION_NOT_FOUND, ErrorCode.NODE_NOT_FOUND
 */
export function useCreateFolderMutation(
	{ showSnackbar = true }: CreateFolderMutationOptions = { showSnackbar: true }
): {
	createFolder: CreateFolderType;
	createFolderWithoutUpdate: CreateFolderWithoutUpdateType;
} & Pick<MutationResult<CreateFolderMutation>, 'error' | 'loading' | 'reset'> {
	const [createFolderMutation, { error: createFolderError, loading, reset }] = useMutation<
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
						scrollToNodeItem(
							data.createFolder.id,
							newPosition === parentFolder.children.nodes.length
						);
					}
				}
			});
		},
		[createFolderMutation, addNodeToFolder]
	);

	const createFolderWithoutUpdate: CreateFolderWithoutUpdateType = useCallback(
		(parentId: string, name: string) => {
			return createFolderMutation({
				variables: {
					destination_id: parentId,
					name
				}
			});
		},
		[createFolderMutation]
	);

	useErrorHandler(createFolderError, 'CREATE_FOLDER', { showSnackbar });

	return { createFolder, error: createFolderError, loading, reset, createFolderWithoutUpdate };
}
