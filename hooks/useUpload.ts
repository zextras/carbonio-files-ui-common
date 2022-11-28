/*
 * SPDX-FileCopyrightText: 2022 Zextras <https://www.zextras.com>
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { useCallback, useMemo } from 'react';

import { ApolloClient, NormalizedCacheObject } from '@apollo/client';
import { useSnackbar } from '@zextras/carbonio-design-system';
import filter from 'lodash/filter';
import find from 'lodash/find';
import forEach from 'lodash/forEach';
import head from 'lodash/head';
import includes from 'lodash/includes';
import keyBy from 'lodash/keyBy';
import map from 'lodash/map';
import noop from 'lodash/noop';
import partition from 'lodash/partition';
import pullAt from 'lodash/pullAt';
import reduce from 'lodash/reduce';
import remove from 'lodash/remove';
import size from 'lodash/size';
import { useTranslation } from 'react-i18next';

import buildClient from '../apollo';
import { nodeSortVar } from '../apollo/nodeSortVar';
import { UploadFunctions, uploadFunctionsVar, UploadRecord, uploadVar } from '../apollo/uploadVar';
import { REST_ENDPOINT, UPLOAD_PATH, UPLOAD_QUEUE_LIMIT, UPLOAD_VERSION_PATH } from '../constants';
import GET_CHILD from '../graphql/queries/getChild.graphql';
import GET_CHILDREN from '../graphql/queries/getChildren.graphql';
import GET_VERSIONS from '../graphql/queries/getVersions.graphql';
import { UploadStatus, UploadType } from '../types/common';
import {
	File as FilesFile,
	Folder,
	GetChildQuery,
	GetChildQueryVariables,
	GetChildrenQuery,
	GetChildrenQueryVariables,
	GetVersionsQuery,
	GetVersionsQueryVariables,
	NodeSort
} from '../types/graphql/types';
import { DeepPick } from '../types/utils';
import { isFolder } from '../utils/ActionsFactory';
import { encodeBase64, flat, isFileSystemDirectoryEntry, scan } from '../utils/utils';
import {
	CreateFolderType,
	CreateFolderWithoutUpdateType,
	useCreateFolderMutation
} from './graphql/mutations/useCreateFolderMutation';
import { UpdateFolderContentType, useUpdateFolderContent } from './graphql/useUpdateFolderContent';
import { useMoreInfoModal } from './modals/useMoreInfoModal';

// KNOWN ISSUE: Since that folders are actually files, this is the only way to distinguish them from another kind of file.
// Although this method doesn't give you absolute certainty that a file is a folder:
// it might be a file without extension and with a size of 0 or exactly N x 4096B.
// https://stackoverflow.com/a/25095250/17280436
const isMaybeFolder = (file: File): boolean => !file.type && file.size % 4096 === 0;

const waitingQueue: Array<string> = [];
const loadingQueue: Array<string> = [];

type UploadAction =
	| { type: 'add'; value: UploadRecord }
	| { type: 'remove'; value: string[] }
	| { type: 'update'; value: { id: string } & Partial<UploadType> };

function uploadVarReducer(action: UploadAction): UploadRecord {
	switch (action.type) {
		case 'add':
			uploadVar({ ...uploadVar(), ...action.value });
			return uploadVar();
		case 'update':
			if (uploadVar()[action.value.id]) {
				uploadVar({
					...uploadVar(),
					[action.value.id]: { ...uploadVar()[action.value.id], ...action.value }
				});
			}
			return uploadVar();
		case 'remove':
			uploadVar(
				reduce<UploadRecord, UploadRecord>(
					uploadVar(),
					(result, item, key) => {
						if (!action.value.includes(item.id)) {
							result[key] = item;
						}
						return result;
					},
					{}
				)
			);
			return uploadVar();
		default:
			return uploadVar();
	}
}

const addVersionToCache = (
	apolloClient: ApolloClient<NormalizedCacheObject>,
	nodeId: string
): void => {
	apolloClient.query<GetVersionsQuery, GetVersionsQueryVariables>({
		query: GET_VERSIONS,
		fetchPolicy: 'network-only',
		variables: {
			node_id: nodeId
		}
	});
};
const updateProgress = (ev: ProgressEvent, fileEnriched: UploadType): void => {
	if (ev.lengthComputable) {
		const updatedValue = {
			...fileEnriched,
			percentage: Math.floor((ev.loaded / ev.total) * 100)
		};

		uploadVarReducer({ type: 'update', value: updatedValue });
	}
};

const singleRetry = (id: string): void => {
	const retryFile = find(uploadVar(), (item) => item.id === id);
	if (retryFile == null) {
		throw new Error('unable to retry missing file');
	}
	if (retryFile.status !== UploadStatus.FAILED && retryFile.status !== UploadStatus.QUEUED) {
		throw new Error('unable to retry, upload must be Failed');
	}

	uploadVarReducer({ type: 'update', value: { id, status: UploadStatus.LOADING, percentage: 0 } });

	const newRetryFile = find(uploadVar(), (item) => item.id === id);
	if (newRetryFile) {
		const itemFunctions = uploadFunctionsVar()[newRetryFile.id];
		const abortFunction = itemFunctions.retry(newRetryFile);
		uploadFunctionsVar({
			...uploadFunctionsVar(),
			[newRetryFile.id]: { ...itemFunctions, abort: abortFunction }
		});
	}
};

const uploadCompleted = (
	xhr: XMLHttpRequest,
	fileEnriched: UploadType,
	apolloClient: ApolloClient<NormalizedCacheObject>,
	nodeSort: NodeSort,
	addNodeToFolder: UpdateFolderContentType['addNodeToFolder'],
	isUploadVersion: boolean
): void => {
	if (xhr.readyState === XMLHttpRequest.DONE && xhr.status === 200) {
		const response = JSON.parse(xhr.response);
		const { nodeId } = response;
		if (isUploadVersion) {
			addVersionToCache(apolloClient, nodeId);
		}

		uploadVarReducer({
			type: 'update',
			value: { id: fileEnriched.id, status: UploadStatus.COMPLETED, percentage: 100, nodeId }
		});

		apolloClient
			.query<GetChildQuery, GetChildQueryVariables>({
				query: GET_CHILD,
				fetchPolicy: 'no-cache',
				variables: {
					node_id: nodeId as string
				}
			})
			.then((result) => {
				if (result?.data?.getNode?.parent) {
					const parentId = result.data.getNode.parent.id;
					const parentFolder = apolloClient.cache.readQuery<
						GetChildrenQuery,
						GetChildrenQueryVariables
					>({
						query: GET_CHILDREN,
						variables: {
							node_id: parentId,
							// load all cached children
							children_limit: Number.MAX_SAFE_INTEGER,
							sort: nodeSort
						}
					});
					if (parentFolder?.getNode && isFolder(parentFolder.getNode)) {
						const parentNode = parentFolder.getNode;
						addNodeToFolder(parentNode, result.data.getNode);
					}
				}
			})
			.catch((err) => {
				console.error(err);
			});
	} else {
		/*
		 * Handled Statuses
		 * 405: upload-version error should happen only when number of versions is
		 * 			strictly greater than max number of version config value (config changed)
		 * 413:
		 * 500: name already exists
		 * 0: aborted
		 */
		uploadVarReducer({
			type: 'update',
			value: { id: fileEnriched.id, status: UploadStatus.FAILED }
		});
		const handledStatuses = [405, 413, 500, 0];
		if (xhr.readyState !== XMLHttpRequest.UNSENT && !handledStatuses.includes(xhr.status)) {
			console.error('upload error: unhandled status', xhr.status);
		}
	}

	if (includes(loadingQueue, fileEnriched.id)) {
		remove(loadingQueue, (item) => item === fileEnriched.id);
		if (size(waitingQueue) > 0) {
			const next = head(pullAt(waitingQueue, [0]));
			loadingQueue.push(next as string);
			singleRetry(next as string);
		}
	}
};

const upload = (
	fileEnriched: UploadType,
	apolloClient: ApolloClient<NormalizedCacheObject>,
	nodeSort: NodeSort,
	addNodeToFolder: UpdateFolderContentType['addNodeToFolder']
): (() => void) => {
	const xhr = new XMLHttpRequest();
	const url = `${REST_ENDPOINT}${UPLOAD_PATH}`;
	xhr.open('POST', url, true);

	xhr.setRequestHeader('Filename', encodeBase64(fileEnriched.file.name));
	xhr.setRequestHeader('ParentId', fileEnriched.parentId);

	// FIXME: fix in order to be able to test the upload with msw
	//   see https://github.com/mswjs/interceptors/issues/187
	if (xhr.upload?.addEventListener) {
		xhr.upload.addEventListener('progress', (ev: ProgressEvent) =>
			updateProgress(ev, fileEnriched)
		);
	}
	xhr.addEventListener('load', () =>
		uploadCompleted(xhr, fileEnriched, apolloClient, nodeSort, addNodeToFolder, false)
	);
	xhr.addEventListener('error', () =>
		uploadCompleted(xhr, fileEnriched, apolloClient, nodeSort, addNodeToFolder, false)
	);
	xhr.addEventListener('abort', () =>
		uploadCompleted(xhr, fileEnriched, apolloClient, nodeSort, addNodeToFolder, false)
	);
	xhr.send(fileEnriched.file);

	return (): void => {
		xhr.abort();
	};
};

const uploadVersion = (
	fileEnriched: Required<UploadType>,
	apolloClient: ApolloClient<NormalizedCacheObject>,
	nodeSort: NodeSort,
	addNodeToFolder: UpdateFolderContentType['addNodeToFolder'],
	overwriteVersion = false
): (() => void) => {
	const xhr = new XMLHttpRequest();
	const url = `${REST_ENDPOINT}${UPLOAD_VERSION_PATH}`;
	xhr.open('POST', url, true);

	xhr.setRequestHeader('NodeId', fileEnriched.nodeId);
	xhr.setRequestHeader('Filename', encodeBase64(fileEnriched.file.name));
	xhr.setRequestHeader('OverwriteVersion', `${overwriteVersion}`);

	// FIXME: fix in order to be able to test the upload with msw
	//   see https://github.com/mswjs/interceptors/issues/187
	if (xhr.upload?.addEventListener) {
		xhr.upload.addEventListener('progress', (ev: ProgressEvent) =>
			updateProgress(ev, fileEnriched)
		);
	}
	xhr.addEventListener('load', () =>
		uploadCompleted(xhr, fileEnriched, apolloClient, nodeSort, addNodeToFolder, true)
	);
	xhr.addEventListener('error', () =>
		uploadCompleted(xhr, fileEnriched, apolloClient, nodeSort, addNodeToFolder, true)
	);
	xhr.addEventListener('abort', () =>
		uploadCompleted(xhr, fileEnriched, apolloClient, nodeSort, addNodeToFolder, true)
	);
	xhr.send(fileEnriched.file);

	return (): void => {
		xhr.abort();
	};
};

export type UseUploadHook = () => {
	add: (files: FileList, parentId: string, checkForFolders?: boolean) => void;
	addFolders: (
		fileSystemDirectoryEntries: Array<FileSystemDirectoryEntry>,
		parentId: string
	) => void;
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

	const { createFolder, createFolderWithoutUpdate } = useCreateFolderMutation({
		showSnackbar: false
	});

	const [t] = useTranslation();
	const createSnackbar = useSnackbar();
	const { openMoreInfoModal } = useMoreInfoModal();

	const createSnackbarForUploadError = useCallback(
		(label: string) => {
			createSnackbar({
				key: new Date().toLocaleString(),
				type: 'warning',
				label,
				actionLabel: t('snackbar.upload.moreInfo', 'More info'),
				onActionClick: () =>
					openMoreInfoModal(
						t(
							'uploads.error.moreInfo.foldersNotAllowed',
							'Folders cannot be uploaded. Instead, if you are trying to upload a file, the system may not have recognized it. Try again using the "UPLOAD" button.'
						)
					)
			});
		},
		[createSnackbar, openMoreInfoModal, t]
	);

	const uploadFolder = useCallback<(folder: UploadType) => ReturnType<UploadFunctions['retry']>>(
		(folder) => {
			createSnackbarForUploadError(
				t('snackbar.upload.foldersNotAllowed', 'Folders cannot be uploaded')
			);
			uploadVarReducer({
				type: 'update',
				value: { id: folder.id, status: UploadStatus.FAILED, percentage: 0 }
			});
			return noop;
		},
		[createSnackbarForUploadError, t]
	);

	const add = useCallback<ReturnType<UseUploadHook>['add']>(
		(files, parentId, checkForFolders) => {
			// Upload only valid files
			const filesEnriched: { [id: string]: UploadType } = {};
			const uploadFunctions: { [id: string]: UploadFunctions } = {};
			let validFilesCount = 0;

			forEach(files, (file: File, index) => {
				const isItemMaybeFolder = checkForFolders && isMaybeFolder(file);
				const canBeLoaded = !isItemMaybeFolder && size(loadingQueue) < UPLOAD_QUEUE_LIMIT;

				const fileEnriched = {
					file,
					parentId,
					percentage: 0,
					// eslint-disable-next-line no-nested-ternary
					status: isItemMaybeFolder
						? UploadStatus.FAILED
						: size(loadingQueue) < UPLOAD_QUEUE_LIMIT
						? UploadStatus.LOADING
						: UploadStatus.QUEUED,
					id: `${index}-${new Date().getTime()}`
				};
				const abortFunction: UploadFunctions['abort'] = canBeLoaded
					? upload(fileEnriched, apolloClient, nodeSortVar(), addNodeToFolder)
					: noop;
				const retryFunction: UploadFunctions['retry'] = (newFile: UploadType) =>
					isItemMaybeFolder
						? uploadFolder(newFile)
						: upload(newFile, apolloClient, nodeSortVar(), addNodeToFolder);
				filesEnriched[fileEnriched.id] = fileEnriched;
				uploadFunctions[fileEnriched.id] = { abort: abortFunction, retry: retryFunction };
				if (!isItemMaybeFolder) {
					validFilesCount += 1;
				}
				if (canBeLoaded) {
					loadingQueue.push(fileEnriched.id);
				} else if (!isItemMaybeFolder) {
					waitingQueue.push(fileEnriched.id);
				}
			});

			if (validFilesCount < files.length) {
				createSnackbarForUploadError(
					validFilesCount > 0
						? t('snackbar.upload.nodesNotAllowed', 'Some items have not been uploaded')
						: t('snackbar.upload.foldersNotAllowed', 'Folders cannot be uploaded')
				);
			}

			uploadVarReducer({ type: 'add', value: filesEnriched });
			uploadFunctionsVar({ ...uploadFunctionsVar(), ...uploadFunctions });
		},
		[addNodeToFolder, apolloClient, createSnackbarForUploadError, t, uploadFolder]
	);

	const addFolders = useCallback<ReturnType<UseUploadHook>['addFolders']>(
		(fileSystemDirectoryEntries, parentId) => {
			forEach(fileSystemDirectoryEntries, async (fileSystemDirectoryEntry) => {
				const result = await scan(fileSystemDirectoryEntry);
				const flatResult = flat(result);
				// const mapped = keyBy(flatResult, 'fullPath');

				const fullPathParentIdMap = keyBy<{
					key: string;
					value: string | undefined;
				}>(
					map(flatResult, (fr) => ({ key: fr.fullPath, value: undefined })),
					'key'
				);
				fullPathParentIdMap['/'] = { key: '/', value: parentId };

				function isRoot(fullPath: string): boolean {
					return (fullPath.match(/\//g) || []).length === 1;
				}

				function getParentFullPath(fullPath: string): string {
					const lastIndex = fullPath.lastIndexOf('/');
					const result = fullPath.substring(0, lastIndex);
					return result;
				}

				function getParentId(entry: FileSystemEntry): string | undefined {
					if (isRoot(entry.fullPath)) {
						return fullPathParentIdMap['/'].value;
					}
					const a = getParentFullPath(entry.fullPath);
					return fullPathParentIdMap[a]?.value;
				}

				function getFolder(id: string): Folder | undefined {
					const cachedFolder = apolloClient.cache.readQuery<
						GetChildrenQuery,
						GetChildrenQueryVariables
					>({
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

				function getCreateFolderArgs(entry: FileSystemDirectoryEntry): {
					parentFolder: Folder | undefined;
					name: string;
					parentId: string;
				} {
					const parentId = getParentId(entry);
					if (parentId) {
						return { name: entry.name, parentFolder: getFolder(parentId), parentId };
					}
					throw new Error('');
				}

				const [dirs, files] = partition<FileSystemEntry, FileSystemDirectoryEntry>(
					flatResult,
					isFileSystemDirectoryEntry
				);

				function myPromise(
					entry: FileSystemDirectoryEntry,
					createFolderFunction: CreateFolderType,
					createFolderWithoutUpdateFunction: CreateFolderWithoutUpdateType,
					getCreateFolderArgsFunction: (entry: FileSystemDirectoryEntry) => {
						parentFolder: Folder | undefined;
						name: string;
						parentId: string;
					}
				): Promise<any> {
					const { parentFolder, name, parentId } = getCreateFolderArgsFunction(entry);
					if (parentFolder) {
						return createFolderFunction(parentFolder, name).then((createFolderFunctionResult) => {
							fullPathParentIdMap[entry.fullPath].value =
								createFolderFunctionResult.data?.createFolder.id;
						});
					}
					return createFolderWithoutUpdateFunction(parentId, name).then(
						(createFolderFunctionResult) => {
							fullPathParentIdMap[entry.fullPath].value =
								createFolderFunctionResult.data?.createFolder.id;
						}
					);
				}

				for (const res of dirs) {
					await myPromise(res, createFolder, createFolderWithoutUpdate, getCreateFolderArgs);
				}

				for (const res of files) {
					const parentId = getParentId(res);
					if (parentId) {
						const xhr = new XMLHttpRequest();
						const url = `${REST_ENDPOINT}${UPLOAD_PATH}`;
						xhr.open('POST', url, true);

						xhr.setRequestHeader('Filename', encodeBase64(res.name));
						xhr.setRequestHeader('ParentId', parentId);
						(res as FileSystemFileEntry).file((file) => {
							xhr.send(file);
						});
					}
				}
			});
		},
		[apolloClient, createFolder, createFolderWithoutUpdate]
	);

	const update = useCallback<ReturnType<UseUploadHook>['update']>(
		(node, file, overwriteVersion) => {
			const fileEnriched: Required<UploadType> = {
				file,
				percentage: 0,
				status: UploadStatus.LOADING,
				id: `${node.id}-${new Date().getTime()}`,
				nodeId: node.id,
				parentId: (node.parent as Folder).id
			};
			uploadVarReducer({ type: 'add', value: { [fileEnriched.id]: fileEnriched } });
			const abortFunction: UploadFunctions['abort'] = uploadVersion(
				fileEnriched,
				apolloClient,
				nodeSortVar(),
				addNodeToFolder,
				overwriteVersion
			);
			const retryFunction: UploadFunctions['retry'] = (newFile) =>
				uploadVersion(
					// add default node id, but there should be already included in newFile obj
					{ nodeId: node.id, ...newFile },
					apolloClient,
					nodeSortVar(),
					addNodeToFolder,
					overwriteVersion
				);
			uploadFunctionsVar({
				...uploadFunctionsVar(),
				[fileEnriched.id]: { abort: abortFunction, retry: retryFunction }
			});
		},
		[addNodeToFolder, apolloClient]
	);

	const abort = useCallback((id: string) => {
		const uploadFunctions = uploadFunctionsVar();
		const abortFunction = uploadFunctions[id].abort;
		abortFunction();
		delete uploadFunctions[id];
		uploadFunctionsVar(uploadFunctions);
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

	return { add, update, removeById, removeAllCompleted, retryById, removeByNodeId, addFolders };
};
