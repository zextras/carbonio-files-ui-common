/*
 * SPDX-FileCopyrightText: 2022 Zextras <https://www.zextras.com>
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { useCallback, useMemo } from 'react';

import filter from 'lodash/filter';
import forEach from 'lodash/forEach';
import includes from 'lodash/includes';
import keyBy from 'lodash/keyBy';
import map from 'lodash/map';
import noop from 'lodash/noop';
import partition from 'lodash/partition';
import size from 'lodash/size';

import buildClient from '../apollo';
import { nodeSortVar } from '../apollo/nodeSortVar';
import { UploadFunctions, uploadFunctionsVar, uploadVar } from '../apollo/uploadVar';
import { REST_ENDPOINT, UPLOAD_PATH, UPLOAD_QUEUE_LIMIT } from '../constants';
import GET_CHILDREN from '../graphql/queries/getChildren.graphql';
import { UploadStatus, UploadType } from '../types/common';
import {
	File as FilesFile,
	Folder,
	GetChildrenQuery,
	GetChildrenQueryVariables
} from '../types/graphql/types';
import { DeepPick, MakeOptional, MakeRequired } from '../types/utils';
import { isFolder } from '../utils/ActionsFactory';
import {
	loadingQueue,
	singleRetry,
	upload,
	UploadAddType,
	uploadVarReducer,
	uploadVersion,
	waitingQueue
} from '../utils/uploadUtils';
import { encodeBase64, flat, isFileSystemDirectoryEntry, scan, TreeNode } from '../utils/utils';
import {
	CreateFolderType,
	useCreateFolderMutation
} from './graphql/mutations/useCreateFolderMutation';
import { useUpdateFolderContent } from './graphql/useUpdateFolderContent';
import { ApolloClient } from "@apollo/client";

type FullPathMap = Record<
	string,
	{ key: string; value: Pick<Folder, '__typename' | 'id'> | undefined }
>;

export type UseUploadHook = () => {
	add: (files: UploadAddType, parentId: string) => void;
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

function isRoot(fullPath: string): boolean {
	return (fullPath.match(/\//g) || []).length === 1;
}

function getParentFullPath(fullPath: string): string {
	const lastIndex = fullPath.lastIndexOf('/');
	return fullPath.substring(0, lastIndex);
}

function getFolder(id: string, apolloClient: ApolloClient<object>): Folder | undefined {
	const cachedFolder = apolloClient.cache.readQuery<GetChildrenQuery, GetChildrenQueryVariables>({
		query: GET_CHILDREN,
		variables: {
			node_id: id,
			children_limit: Number.MAX_SAFE_INTEGER,
			sort: nodeSortVar()
		}
	});

	if (cachedFolder && cachedFolder.getNode && isFolder(cachedFolder.getNode)) {
		return cachedFolder.getNode;
	}
	return undefined;
}

function getParentId(entry: FileSystemEntry, fullPathParentIdMap: FullPathMap): string | undefined {
	if (isRoot(entry.fullPath)) {
		return fullPathParentIdMap['/'].value?.id;
	}
	return fullPathParentIdMap[getParentFullPath(entry.fullPath)]?.value?.id;
}

function getCreateFolderArgs(
	entry: FileSystemDirectoryEntry,
	fullPathParentIdMap: FullPathMap,
	apolloClient: ApolloClient<object>
): {
	parentFolder: Folder | undefined;
	name: string;
	parentId: string;
} {
	const entryParentId = getParentId(entry, fullPathParentIdMap);
	if (entryParentId) {
		return {
			name: entry.name,
			parentFolder: getFolder(entryParentId, apolloClient),
			parentId: entryParentId
		};
	}
	throw new Error('');
}

function createFolderNode(
	entry: FileSystemDirectoryEntry,
	createFolderFunction: CreateFolderType,
	{ parentFolder, name, parentId: entryParentId }: ReturnType<typeof getCreateFolderArgs>
): Promise<FullPathMap[string]['value']> {
	return createFolderFunction(
		parentFolder ?? { __typename: 'Folder', id: entryParentId },
		name
	).then((createFolderFunctionResult) => {
		if (
			createFolderFunctionResult.data?.createFolder &&
			isFolder(createFolderFunctionResult.data.createFolder)
		) {
			return createFolderFunctionResult.data?.createFolder;
		}
		return undefined;
	});
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

	const uploadFolder = useCallback<(folder: UploadType) => UploadFunctions['abort']>(
		async (folder) => {
			if (folder.fileSystemEntry) {
				const result = await scan(folder.fileSystemEntry);
				const flatResult = flat(result);

				const fullPathParentIdMap = keyBy<{
					key: string;
					value: Pick<Folder, '__typename' | 'id'> | undefined;
				}>(
					map(flatResult, (fr) => ({ key: fr.fullPath, value: undefined })),
					'key'
				);
				fullPathParentIdMap['/'] = {
					key: '/',
					value: { __typename: 'Folder', id: folder.parentId }
				};

				const childrenEnriched = map<TreeNode, MakeOptional<UploadType, 'file' | 'parentId'>>(
					flatResult,
					(entry, index) => ({
						file: undefined,
						parentId: fullPathParentIdMap[entry.fullPath].value?.id,
						percentage: 0,
						status: UploadStatus.LOADING,
						id: `${index}-${new Date().getTime()}`,
						fileSystemEntry: entry
					})
				);
				uploadVarReducer({
					type: 'update',
					value: {
						id: folder.id,
						status: UploadStatus.LOADING,
						percentage: 0,
						children: childrenEnriched
					}
				});

				const [directoriesPartition, filesPartition] = partition<
					FileSystemEntry,
					FileSystemDirectoryEntry
				>(flatResult, isFileSystemDirectoryEntry);

				for (let i = 0; i < directoriesPartition.length; i += 1) {
					// eslint-disable-next-line no-await-in-loop
					fullPathParentIdMap[directoriesPartition[i].fullPath].value = await createFolderNode(
						directoriesPartition[i],
						createFolder,
						getCreateFolderArgs(directoriesPartition[i], fullPathParentIdMap, apolloClient)
					);
				}

				for (let i = 0; i < filesPartition.length; i += 1) {
					const resParentId = getParentId(filesPartition[i], fullPathParentIdMap);
					if (resParentId) {
						const xhr = new XMLHttpRequest();
						const url = `${REST_ENDPOINT}${UPLOAD_PATH}`;
						xhr.open('POST', url, true);

						xhr.setRequestHeader('Filename', encodeBase64(filesPartition[i].name));
						xhr.setRequestHeader('ParentId', resParentId);
						(filesPartition[i] as FileSystemFileEntry).file((file) => {
							xhr.send(file);
						});
					}
				}
			}

			return noop;
		},
		[createFolder]
	);

	const add = useCallback<ReturnType<UseUploadHook>['add']>(
		(files, parentId) => {
			// Upload only valid files
			const filesEnriched: { [id: string]: UploadType } = {};
			const uploadFunctions: { [id: string]: UploadFunctions } = {};

			forEach(files, (file, index) => {
				const canBeLoaded = size(loadingQueue) < UPLOAD_QUEUE_LIMIT;

				const fileEnriched: UploadType = {
					file: file.file,
					fileSystemEntry: file.fileSystemEntry,
					parentId,
					percentage: 0,
					status:
						size(loadingQueue) < UPLOAD_QUEUE_LIMIT ? UploadStatus.LOADING : UploadStatus.QUEUED,
					id: `${index}-${new Date().getTime()}`
				};

				function startUploadAndGetAbortFunction(
					fileToUpload: UploadType
				): UploadFunctions['abort'] {
					if (canBeLoaded) {
						if (
							fileToUpload.fileSystemEntry &&
							isFileSystemDirectoryEntry(fileToUpload.fileSystemEntry)
						) {
							return uploadFolder(fileToUpload);
						}
						return upload(fileToUpload, apolloClient, nodeSortVar(), addNodeToFolder);
					}
					return Promise.resolve(noop);
				}

				const abortFunction: UploadFunctions['abort'] =
					startUploadAndGetAbortFunction(fileEnriched);
				const retryFunction: UploadFunctions['retry'] = (newFile) =>
					startUploadAndGetAbortFunction(newFile);
				filesEnriched[fileEnriched.id] = fileEnriched;
				uploadFunctions[fileEnriched.id] = { abort: abortFunction, retry: retryFunction };
				if (canBeLoaded) {
					loadingQueue.push(fileEnriched.id);
				} else {
					waitingQueue.push(fileEnriched.id);
				}
			});

			uploadVarReducer({ type: 'add', value: filesEnriched });
			uploadFunctionsVar({ ...uploadFunctionsVar(), ...uploadFunctions });
		},
		[addNodeToFolder, apolloClient, uploadFolder]
	);

	const update = useCallback<ReturnType<UseUploadHook>['update']>(
		(node, file, overwriteVersion) => {
			const fileEnriched: MakeRequired<UploadType, 'nodeId'> = {
				file,
				percentage: 0,
				status: UploadStatus.LOADING,
				id: `${node.id}-${new Date().getTime()}`,
				nodeId: node.id,
				parentId: (node.parent as Folder).id
			};
			uploadVarReducer({ type: 'add', value: { [fileEnriched.id]: fileEnriched } });

			function startUploadAndGetAbortFunction(fileToUpload: UploadType): UploadFunctions['abort'] {
				return uploadVersion(
					{ nodeId: node.id, ...fileToUpload },
					apolloClient,
					nodeSortVar(),
					addNodeToFolder,
					overwriteVersion
				);
			}

			const abortFunction: UploadFunctions['abort'] = startUploadAndGetAbortFunction(fileEnriched);
			const retryFunction: UploadFunctions['retry'] = (newFile) =>
				startUploadAndGetAbortFunction(newFile);
			uploadFunctionsVar({
				...uploadFunctionsVar(),
				[fileEnriched.id]: { abort: abortFunction, retry: retryFunction }
			});
		},
		[addNodeToFolder, apolloClient]
	);

	const abort = useCallback((id: string) => {
		const uploadFunctions = uploadFunctionsVar();
		uploadFunctions[id].abort.then((abortFunction) => {
			abortFunction();
			delete uploadFunctions[id];
			uploadFunctionsVar(uploadFunctions);
		});
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
