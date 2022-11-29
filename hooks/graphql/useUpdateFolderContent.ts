/*
 * SPDX-FileCopyrightText: 2022 Zextras <https://www.zextras.com>
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { useCallback } from 'react';

import { ApolloClient, useApolloClient } from '@apollo/client';

import { addNodeInCachedChildren, removeNodesFromFolder } from '../../apollo/cacheUtils';
import { nodeSortVar } from '../../apollo/nodeSortVar';
import { ChildFragment, Folder, Maybe } from '../../types/graphql/types';
import { addNodeInSortedList } from '../../utils/utils';

export type CachedFolder = Pick<Folder, 'id' | '__typename'> & {
	children: { nodes: Array<Maybe<Partial<File | Folder> & ChildFragment> | undefined> };
};

export type UpdateFolderContentType = {
	addNodeToFolder: (folder: CachedFolder, newNode: ChildFragment) => number;
	removeNodesFromFolder: (
		folder: Pick<CachedFolder, 'id' | '__typename'>,
		nodeIdsToRemove: string[]
	) => void;
};

export const useUpdateFolderContent = (
	apolloClientArg?: ApolloClient<object>
): UpdateFolderContentType => {
	// TODO remove apolloClientArg when useApolloClient is safe(provider moved up)
	// eslint-disable-next-line react-hooks/rules-of-hooks
	const apolloClient = apolloClientArg || useApolloClient();

	const addNodeToFolder = useCallback<UpdateFolderContentType['addNodeToFolder']>(
		(folder, newNode) => {
			// if folder is empty, just write cache
			if (folder.children.nodes.length === 0) {
				addNodeInCachedChildren(apolloClient.cache, newNode, folder.id, 0);
				return 0;
			}
			// else find the position of the node in the loaded list to check
			// if the updated node is an ordered or an unordered node
			const newIndex = addNodeInSortedList(folder.children.nodes, newNode, nodeSortVar());
			addNodeInCachedChildren(apolloClient.cache, newNode, folder.id, newIndex);

			return newIndex > -1 ? newIndex : folder.children.nodes.length;
		},
		[apolloClient]
	);

	const removeNodesFromFolderCallback = useCallback<
		UpdateFolderContentType['removeNodesFromFolder']
	>(
		(folder, nodeIdsToRemove) => {
			removeNodesFromFolder(apolloClient.cache, folder.id, nodeIdsToRemove);
		},
		[apolloClient]
	);

	return { addNodeToFolder, removeNodesFromFolder: removeNodesFromFolderCallback };
};
