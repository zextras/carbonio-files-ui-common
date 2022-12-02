/*
 * SPDX-FileCopyrightText: 2022 Zextras <https://www.zextras.com>
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { useCallback, useMemo } from 'react';

import filter from 'lodash/filter';
import forEach from 'lodash/forEach';
import includes from 'lodash/includes';
import map from 'lodash/map';
import noop from 'lodash/noop';
import partition from 'lodash/partition';
import remove from 'lodash/remove';
import { v4 as uuidv4 } from 'uuid';

import buildClient from '../apollo';
import { nodeSortVar } from '../apollo/nodeSortVar';
import { UploadFunctions, uploadFunctionsVar, uploadVar } from '../apollo/uploadVar';
import { UploadFolderItem, UploadItem, UploadStatus } from '../types/common';
import { File as FilesFile } from '../types/graphql/types';
import { DeepPick } from '../types/utils';
import {
	deepMapTreeNodes,
	incrementAllParents,
	isUploadFolderItem,
	loadingQueue,
	singleRetry,
	tickQueues,
	upload,
	UploadAddType,
	uploadVarReducer,
	uploadVersion,
	waitingQueue
} from '../utils/uploadUtils';
import { isFileSystemDirectoryEntry, isFolder, scan } from '../utils/utils';
import { useCreateFolderMutation } from './graphql/mutations/useCreateFolderMutation';
import { useUpdateFolderContent } from './graphql/useUpdateFolderContent';

type UploadVarObject = {
	filesEnriched: { [id: string]: UploadItem };
	uploadFunctions: { [id: string]: UploadFunctions };
};

export type UseUploadHook = () => {
	add: (files: Array<UploadAddType>, destinationId: string) => void;
	update: (
		node: Pick<FilesFile, '__typename' | 'id'> & DeepPick<FilesFile, 'parent', 'id'>,
		file: File,
		overwriteVersion?: boolean
	) => void;
	removeById: (ids: Array<string>) => void;
	removeByNodeId: (nodeIds: Array<string>) => void;
	removeAllCompleted: () => void;
	retryById: (ids: Array<string>) => void;
};

export const useUpload: UseUploadHook = () => {
	// TODO use useApolloClient when apollo provider will be moved up in tha app
	// const apolloClient = useApolloClient();
	const apolloClient = useMemo(() => buildClient(), []);

	const { addNodeToFolder } = useUpdateFolderContent(apolloClient);

	const { createFolder } = useCreateFolderMutation({
		showSnackbar: false,
		client: apolloClient
	});

	const uploadFolder = useCallback<(folder: UploadFolderItem) => UploadFunctions['abort']>(
		(uploadFolderItem) => {
			if (uploadFolderItem.parentNodeId) {
				const updatedFolder: UploadFolderItem = {
					...uploadFolderItem,
					status: UploadStatus.LOADING,
					progress: 0
				};
				uploadVarReducer({
					type: 'update',
					value: updatedFolder
				});

				createFolder({ id: uploadFolderItem.parentNodeId }, uploadFolderItem.name)
					.then((createFolderFunctionResult) => {
						if (
							createFolderFunctionResult.data?.createFolder &&
							isFolder(createFolderFunctionResult.data.createFolder)
						) {
							return createFolderFunctionResult.data?.createFolder;
						}
						return null;
					})
					.then((parentFolderNode) => {
						if (parentFolderNode) {
							uploadVarReducer({
								type: 'update',
								value: {
									...uploadFolderItem,
									nodeId: parentFolderNode.id,
									status: UploadStatus.COMPLETED,
									progress: uploadVar()[uploadFolderItem.id].progress + 1
								}
							});
							incrementAllParents(uploadFolderItem);

							forEach(uploadFolderItem.children, (child) => {
								uploadVarReducer({
									type: 'update',
									value: {
										id: child,
										parentNodeId: parentFolderNode.id
									}
								});
							});

							if (includes(loadingQueue, uploadFolderItem.id)) {
								remove(loadingQueue, (item) => item === uploadFolderItem.id);
								tickQueues();
							}
						}
					});
			}
			return null;
		},
		[createFolder]
	);

	const startUploadAndGetAbortFunction = useCallback(
		(fileToUpload: UploadItem): UploadFunctions['abort'] => {
			if (isUploadFolderItem(fileToUpload)) {
				return uploadFolder(fileToUpload);
			}
			if (fileToUpload.file !== null && fileToUpload.parentNodeId !== null) {
				return upload(fileToUpload, apolloClient, nodeSortVar(), addNodeToFolder);
			}
			return Promise.resolve(noop);
		},
		[addNodeToFolder, apolloClient, uploadFolder]
	);

	const prepareItem = useCallback<
		(
			itemToAdd: UploadAddType,
			destinationId: string
		) => { item: UploadItem; functions: UploadFunctions }
	>(
		(itemToAdd, destinationId) => {
			const fileEnriched: UploadItem = {
				file: itemToAdd.file,
				parentId: null,
				parentNodeId: destinationId,
				progress: 0,
				status: UploadStatus.QUEUED,
				id: `upload-${uuidv4()}`,
				nodeId: null,
				fullPath: itemToAdd.file.webkitRelativePath,
				name: itemToAdd.file.name
			};

			const retryFunction: UploadFunctions['retry'] = (newFile) =>
				startUploadAndGetAbortFunction(newFile);

			return {
				item: fileEnriched,
				functions: { abort: null, retry: retryFunction }
			};
		},
		[startUploadAndGetAbortFunction]
	);

	const prepareFolderItem = useCallback<
		(
			fileEnriched: UploadItem,
			fileSystemEntry: FileSystemDirectoryEntry
		) => Promise<Array<{ item: UploadItem; functions: UploadFunctions }>>
	>(
		async (fileEnriched, fileSystemEntry) => {
			const treeRoot = await scan(fileSystemEntry);
			const uploadItemFlatList: UploadItem[] = [];
			if (isFileSystemDirectoryEntry(treeRoot)) {
				const folderEnriched: UploadFolderItem = { ...fileEnriched, children: [], contentCount: 0 };
				uploadItemFlatList.push(folderEnriched);
				const { flatChildrenList, directChildrenIds } = await deepMapTreeNodes(
					treeRoot.children,
					folderEnriched.id
				);
				folderEnriched.children = directChildrenIds;
				// consider also the folder itself in the count
				folderEnriched.contentCount = flatChildrenList.length + 1;
				uploadItemFlatList.push(...flatChildrenList);
			}
			return map(uploadItemFlatList, (uploadItem) => ({
				item: uploadItem,
				functions: {
					abort: null,
					retry: (newFile) => startUploadAndGetAbortFunction(newFile)
				}
			}));
		},
		[startUploadAndGetAbortFunction]
	);

	const prepareReactiveVar = useCallback<
		(items: Array<UploadAddType>, destinationId: string) => Promise<UploadVarObject>
	>(
		async (items, destinationId) => {
			const accumulator: UploadVarObject = { filesEnriched: {}, uploadFunctions: {} };
			for (let i = 0; i < items.length; i += 1) {
				const item = items[i];
				const itemEnriched = prepareItem(item, destinationId);
				if (item.fileSystemEntry && isFileSystemDirectoryEntry(item.fileSystemEntry)) {
					// eslint-disable-next-line no-await-in-loop
					const folderWithChildren = await prepareFolderItem(
						itemEnriched.item,
						item.fileSystemEntry
					);
					for (let j = 0; j < folderWithChildren.length; j += 1) {
						const folderWithChildrenItem = folderWithChildren[j];
						waitingQueue.push(folderWithChildrenItem.item.id);
						accumulator.filesEnriched[folderWithChildrenItem.item.id] = folderWithChildrenItem.item;
						accumulator.uploadFunctions[folderWithChildrenItem.item.id] =
							folderWithChildrenItem.functions;
					}
				} else {
					waitingQueue.push(itemEnriched.item.id);
					accumulator.filesEnriched[itemEnriched.item.id] = itemEnriched.item;
					accumulator.uploadFunctions[itemEnriched.item.id] = itemEnriched.functions;
				}
			}
			return accumulator;
		},
		[prepareFolderItem, prepareItem]
	);

	const add = useCallback<ReturnType<UseUploadHook>['add']>(
		(itemsToAdd, destinationId) => {
			prepareReactiveVar(itemsToAdd, destinationId).then((uploadVarObject) => {
				uploadVarReducer({ type: 'add', value: uploadVarObject.filesEnriched });
				uploadFunctionsVar({ ...uploadFunctionsVar(), ...uploadVarObject.uploadFunctions });
				tickQueues();
			});
		},
		[prepareReactiveVar]
	);

	const update = useCallback<ReturnType<UseUploadHook>['update']>(
		(node, file, overwriteVersion) => {
			const fileEnriched: UploadItem = {
				file,
				progress: 0,
				status: UploadStatus.LOADING,
				id: `upload-${uuidv4()}`,
				nodeId: node.id,
				parentNodeId: node.parent?.id || null,
				parentId: null,
				fullPath: node.parent?.name || '',
				name: file.name
			};
			uploadVarReducer({ type: 'add', value: { [fileEnriched.id]: fileEnriched } });

			function startUploadVersionAndGetAbortFunction(
				fileToUpload: UploadItem
			): UploadFunctions['abort'] {
				return uploadVersion(
					fileToUpload,
					apolloClient,
					nodeSortVar(),
					addNodeToFolder,
					overwriteVersion
				);
			}

			const abortFunction: UploadFunctions['abort'] =
				startUploadVersionAndGetAbortFunction(fileEnriched);
			const retryFunction: UploadFunctions['retry'] = (newFile) =>
				startUploadAndGetAbortFunction(newFile);
			uploadFunctionsVar({
				...uploadFunctionsVar(),
				[fileEnriched.id]: { abort: abortFunction, retry: retryFunction }
			});
		},
		[addNodeToFolder, apolloClient, startUploadAndGetAbortFunction]
	);

	const abort = useCallback((id: string) => {
		const uploadFunctions = uploadFunctionsVar();
		const abortFn = uploadFunctions[id].abort;
		if (abortFn) {
			abortFn.then((abortFunction) => {
				abortFunction();
				delete uploadFunctions[id];
				uploadFunctionsVar(uploadFunctions);
			});
		}
	}, []);

	const removeById = useCallback(
		(ids: Array<string>) => {
			forEach(ids, (id) => {
				const itemToRemove = uploadVar()[id];
				if (itemToRemove.status === UploadStatus.LOADING) {
					abort(id);
				}
				if (itemToRemove.parentId !== null) {
					const parentItem = uploadVar()[itemToRemove.parentId];
					if (isUploadFolderItem(parentItem)) {
						// TODO: if itemToRemove is a folder, abort all the children recursively
						const updatedParent: Partial<UploadFolderItem> & Pick<UploadFolderItem, 'id'> = {
							id: parentItem.id,
							children: filter(parentItem.children, (childId) => childId !== id),
							// TODO: if itemToRemove is a folder, decrease by itemToRemove.contentCount
							contentCount: parentItem.contentCount - 1
						};
						uploadVarReducer({
							type: 'update',
							value: updatedParent
						});
					}
				}
			});
			uploadVarReducer({ type: 'remove', value: ids });
		},
		[abort]
	);

	const removeByNodeId = useCallback((nodeIds: Array<string>) => {
		const oldState = uploadVar();
		const partitions = partition(oldState, (item) => includes(nodeIds, item.nodeId));
		const removedNodes = map(partitions[0], (item) => item.id);
		// update reactive var only if there are removed nodes
		if (removedNodes.length > 0) {
			uploadVarReducer({ type: 'remove', value: removedNodes });
		}
	}, []);

	const removeAllCompleted = useCallback(() => {
		const state = uploadVar();
		const completedItems = map(
			filter(state, (item) => item.status === UploadStatus.COMPLETED),
			(item) => item.id
		);
		uploadVarReducer({ type: 'remove', value: completedItems });
	}, []);

	const retryById = useCallback((ids: Array<string>) => {
		forEach(ids, (id) => {
			singleRetry(id);
		});
	}, []);

	return { add, update, removeById, removeAllCompleted, retryById, removeByNodeId };
};
