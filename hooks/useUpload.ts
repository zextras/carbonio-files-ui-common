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
import { isFileSystemDirectoryEntry, isFolder, scan, TreeNode } from '../utils/utils';
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

function getFileSystemFileEntryFile(fileSystemEntry: FileSystemFileEntry): Promise<File> {
	return new Promise((resolve, reject) => {
		fileSystemEntry.file((file) => {
			resolve(file);
		}, reject);
	});
}

async function deepMapTreeNodes(
	treeNodes: TreeNode[] | undefined,
	parentId: string,
	uploadItemFlatList: Array<UploadItem>
): Promise<string[]> {
	const childrenIds: string[] = [];
	for (let i = 0; treeNodes && i < treeNodes.length; i += 1) {
		const treeNode = treeNodes[i];
		const fileEnriched: UploadItem = {
			file: null,
			parentId,
			progress: 0,
			status: UploadStatus.QUEUED,
			id: `upload-${uuidv4()}`,
			nodeId: null,
			parentNodeId: null,
			fullPath: treeNode.fullPath,
			name: treeNode.name
		};
		childrenIds.push(fileEnriched.id);
		if (isFileSystemDirectoryEntry(treeNode)) {
			const folderEnriched: UploadFolderItem = { ...fileEnriched, children: [] };
			uploadItemFlatList.push(folderEnriched);

			// eslint-disable-next-line no-await-in-loop
			folderEnriched.children = await deepMapTreeNodes(
				treeNode.children,
				fileEnriched.id,
				uploadItemFlatList
			);
		} else {
			// eslint-disable-next-line no-await-in-loop
			fileEnriched.file = await getFileSystemFileEntryFile(treeNode);
			uploadItemFlatList.push(fileEnriched);
		}
	}
	return childrenIds;
}

export const useUpload: UseUploadHook = () => {
	// TODO use useApolloClient when apollo provider will be moved up in tha app
	// const apolloClient = useApolloClient();
	const apolloClient = useMemo(() => buildClient(), []);

	const { addNodeToFolder } = useUpdateFolderContent(apolloClient);

	const { createFolder } = useCreateFolderMutation({
		showSnackbar: false,
		client: apolloClient
	});

	// const createFolderWithChildren = useCallback(
	// 	(fileEnriched: MakeOptional<UploadItem, 'file'>, parentFolder: Pick<Folder, 'id'>) => {
	// 		if (fileEnriched.fileSystemEntry) {
	// 			const { fileSystemEntry } = fileEnriched;
	// 			if (isFileSystemDirectoryEntry(fileSystemEntry)) {
	// 				createFolder(parentFolder, fileSystemEntry.name)
	// 					.then((createFolderFunctionResult) => {
	// 						if (
	// 							createFolderFunctionResult.data?.createFolder &&
	// 							isFolder(createFolderFunctionResult.data.createFolder)
	// 						) {
	// 							return createFolderFunctionResult.data?.createFolder;
	// 						}
	// 						return undefined;
	// 					})
	// 					.then((parentFolderNode) => {
	// 						if (parentFolderNode) {
	// 							// TODO: update progress of parent folder
	// 							// TODO: update children with new info (parentId)
	// 							// fullPathParentIdMapRef.current[fileSystemEntry.fullPath].value = parentFolderNode;
	// 							forEach(fileEnriched.children, (childEntry) => {
	// 								createFolderWithChildren(
	// 									{ ...childEntry, parentId: parentFolderNode.id },
	// 									parentFolderNode
	// 								);
	// 							});
	// 						}
	// 						return parentFolderNode;
	// 					});
	// 			} else if (isFileSystemFileEntry(fileSystemEntry)) {
	// 				fileSystemEntry.file((file) => {
	// 					// upload(
	// 					// 	{ ...fileEnriched, file, parentId: parentFolder.id },
	// 					// 	apolloClient,
	// 					// 	nodeSortVar(),
	// 					// 	addNodeToFolder
	// 					// );
	// 					const xhr = new XMLHttpRequest();
	// 					const url = `${REST_ENDPOINT}${UPLOAD_PATH}`;
	// 					xhr.open('POST', url, true);
	//
	// 					xhr.setRequestHeader('Filename', encodeBase64(file.name));
	// 					xhr.setRequestHeader('ParentId', parentFolder.id);
	//
	// 					const fileEnrichedWithFile = { ...fileEnriched, file };
	// 					if (xhr.upload?.addEventListener) {
	// 						xhr.upload.addEventListener('progress', (ev: ProgressEvent) =>
	// 							updateProgress(ev, fileEnrichedWithFile)
	// 						);
	// 					}
	// 					xhr.addEventListener('load', () =>
	// 						uploadCompleted(
	// 							xhr,
	// 							fileEnrichedWithFile,
	// 							apolloClient,
	// 							nodeSortVar(),
	// 							addNodeToFolder,
	// 							false
	// 						)
	// 					);
	// 					xhr.addEventListener('error', () =>
	// 						uploadCompleted(
	// 							xhr,
	// 							fileEnrichedWithFile,
	// 							apolloClient,
	// 							nodeSortVar(),
	// 							addNodeToFolder,
	// 							false
	// 						)
	// 					);
	// 					xhr.addEventListener('abort', () =>
	// 						uploadCompleted(
	// 							xhr,
	// 							fileEnrichedWithFile,
	// 							apolloClient,
	// 							nodeSortVar(),
	// 							addNodeToFolder,
	// 							false
	// 						)
	// 					);
	//
	// 					xhr.send(file);
	//
	// 					// TODO: add listener (onProgress) to update progress of child
	//
	// 					// TODO: update and use upload util
	// 					// TODO: update progress of parent folder
	// 					// TODO: update children with new info (file)
	// 				});
	// 			}
	// 		}
	// 	},
	// 	[createFolder]
	// );

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
									progress: 100
								}
							});
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
				const folderEnriched: UploadFolderItem = { ...fileEnriched, children: [] };
				uploadItemFlatList.push(folderEnriched);
				folderEnriched.children = await deepMapTreeNodes(
					treeRoot.children,
					folderEnriched.id,
					uploadItemFlatList
				);
			}
			return map(uploadItemFlatList, (uploadItem) => ({
				item: uploadItem,
				// TODO: implement functions
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
				if (uploadVar()[id].status === UploadStatus.LOADING) {
					abort(id);
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
