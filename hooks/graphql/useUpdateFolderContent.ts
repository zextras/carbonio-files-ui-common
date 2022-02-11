/*
 * SPDX-FileCopyrightText: 2022 Zextras <https://www.zextras.com>
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { useCallback } from 'react';

import {
	ApolloCache,
	ApolloClient,
	NormalizedCacheObject,
	useApolloClient,
	useReactiveVar
} from '@apollo/client';
import filter from 'lodash/filter';
import findIndex from 'lodash/findIndex';
import last from 'lodash/last';

import { nodeListCursorVar } from '../../apollo/nodeListCursorVar';
import { nodeSortVar } from '../../apollo/nodeSortVar';
import CHILD from '../../graphql/fragments/child.graphql';
import { NodesListCachedObject } from '../../types/apollo';
import { ChildFragment, Folder, Maybe, NodeSort } from '../../types/graphql/types';
import { addNodeInSortedList } from '../../utils/utils';

type CachedFolder = Pick<Folder, 'id' | '__typename'> & {
	children: Array<Maybe<Partial<File | Folder> & ChildFragment> | undefined>;
};

export type UpdateFolderContentType = {
	addNodeToFolder: (folder: CachedFolder, newNode: ChildFragment) => number;
	removeNodesFromFolder: (
		folder: Pick<CachedFolder, 'id' | '__typename'>,
		nodeIdsToRemove: string[]
	) => void;
};

export const useUpdateFolderContent = (
	apolloClientArg?: ApolloClient<NormalizedCacheObject>
): UpdateFolderContentType => {
	// TODO remove apolloClientArg when useApolloClient is safe(provider moved up)
	// eslint-disable-next-line react-hooks/rules-of-hooks
	const apolloClient = apolloClientArg || useApolloClient();
	const nodeSort = useReactiveVar(nodeSortVar);

	/**
	 * Add a node in cached children, positioning it at the given index.
	 * <li>If index is greater or equal to ordered list length but there are also unordered items,
	 * the node is added in the unordered list</li>
	 * <li>If index is invalid, the node is added to the unordered list and will be moved in the ordered
	 * once the page that contains it is loaded</li>
	 */
	const addNodeInCachedChildren = useCallback(
		(
			cache: ApolloCache<unknown>,
			newNode: ChildFragment,
			folder: Pick<Folder, '__typename' | 'id'>,
			index: number,
			currentNodeSort: NodeSort
		): boolean =>
			// using the cache modify function allows to override the cache data skipping the merge function
			cache.modify({
				id: cache.identify(folder),
				fields: {
					// existingChildrenRefs is the data of the cache (array of references)
					children(
						existingChildrenRefs: NodesListCachedObject,
						{ readField, storeFieldName, DELETE }
					): NodesListCachedObject {
						const children = JSON.parse(storeFieldName.replace(`children:`, ''));
						const sortArg = children.sort;
						if (currentNodeSort !== sortArg) {
							return DELETE;
						}

						const newNodeRef = cache.writeFragment({
							fragment: CHILD,
							fragmentName: 'Child',
							data: newNode
						});

						const newOrdered = [...existingChildrenRefs.ordered];
						const newUnOrdered = [...existingChildrenRefs.unOrdered];

						let newIndex = index;

						const currentIndexOrdered = findIndex(
							newOrdered,
							(item) => readField('id', item) === readField('id', newNodeRef)
						);
						let currentIndexUnordered = -1;
						if (currentIndexOrdered < 0) {
							currentIndexUnordered = findIndex(
								newUnOrdered,
								(item) => readField('id', item) === readField('id', newNodeRef)
							);
						}

						// if the node was already loaded, remove it from the list before the insert of the new one
						if (currentIndexOrdered > -1) {
							newOrdered.splice(currentIndexOrdered, 1);
							// also, if current position is before the new one, decrease by 1 the new index
							if (currentIndexOrdered < newIndex) {
								newIndex -= 1;
							}
						} else if (currentIndexUnordered > -1) {
							newUnOrdered.splice(currentIndexUnordered, 1);
							// also, if current position is before the new one, decrease by 1 the new index
							if (currentIndexUnordered + newOrdered.length < newIndex) {
								newIndex -= 1;
							}
						}

						if (newNodeRef) {
							if (newIndex < 0 || newIndex > newOrdered.length + newUnOrdered.length) {
								// no valid position, put node as last unordered
								newUnOrdered.push(newNodeRef);
							} else if (newIndex < newOrdered.length) {
								// if newIndex is valid, and it's before last element of the ordered list, put the node in the ordered list
								newOrdered.splice(newIndex, 0, newNodeRef);
							} else {
								// otherwise, add the node in the unordered list
								// calculate the index in the unordered by subtracting the ordered length to the given index
								newIndex = index - newOrdered.length;
								newUnOrdered.splice(newIndex, 0, newNodeRef);
							}
						}

						// update cursor if last ordered node changes
						const currentCursor = nodeListCursorVar()[folder.id];
						const newCursor = last(newOrdered);
						if (currentCursor && currentCursor !== newCursor) {
							// if there is a new last ordered item, use this as new cursor
							nodeListCursorVar({
								...nodeListCursorVar(),
								[folder.id]: newCursor
							});
						}

						return {
							ordered: newOrdered,
							unOrdered: newUnOrdered
						};
					}
				}
			}),
		[]
	);

	const addNodeToFolder = useCallback<UpdateFolderContentType['addNodeToFolder']>(
		(folder, newNode) => {
			// if folder is empty, just write cache
			if (folder.children.length === 0) {
				addNodeInCachedChildren(apolloClient.cache, newNode, folder, 0, nodeSort);
				return 0;
			}
			// else find the position of the node in the loaded list to check
			// if the updated node is an ordered or an unordered node
			const newIndex = addNodeInSortedList(folder.children, newNode, nodeSort);
			addNodeInCachedChildren(apolloClient.cache, newNode, folder, newIndex, nodeSort);

			return newIndex > -1 ? newIndex : folder.children.length;
		},
		[addNodeInCachedChildren, apolloClient, nodeSort]
	);

	const removeNodesFromFolder = useCallback<UpdateFolderContentType['removeNodesFromFolder']>(
		(folder, nodeIdsToRemove) => {
			const { cache } = apolloClient;
			cache.modify({
				id: cache.identify(folder),
				fields: {
					children(
						existingChildrenRefs: NodesListCachedObject,
						{ readField }
					): NodesListCachedObject {
						const newOrdered = filter(existingChildrenRefs.ordered, (ref) => {
							const id = readField<string>('id', ref);
							return !!id && !nodeIdsToRemove.includes(id);
						});

						const newUnOrdered = filter(existingChildrenRefs.unOrdered, (ref) => {
							const id = readField<string>('id', ref);
							return !!id && !nodeIdsToRemove.includes(id);
						});

						const currentCursor = nodeListCursorVar()[folder.id];
						if (currentCursor) {
							// if there is a new page update cursor to fetch next page starting from new last ordered
							// undefined cursor means that there are new pages to load but not a valid cursor to use
							// (so force refetch of first page)
							const newCursor = last(newOrdered);
							if (currentCursor !== newCursor) {
								// if there is a new last ordered item, use this as new cursor
								nodeListCursorVar({
									...nodeListCursorVar(),
									[folder.id]: newCursor
								});
							}
						}

						return {
							ordered: newOrdered,
							unOrdered: newUnOrdered
						};
					}
				}
			});
		},
		[apolloClient]
	);

	return { addNodeToFolder, removeNodesFromFolder };
};
