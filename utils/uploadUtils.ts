/*
 * SPDX-FileCopyrightText: 2022 Zextras <https://www.zextras.com>
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */
// KNOWN ISSUE: Since that folders are actually files, this is the only way to distinguish them from another kind of file.
// Although this method doesn't give you absolute certainty that a file is a folder:
// it might be a file without extension and with a size of 0 or exactly N x 4096B.
// https://stackoverflow.com/a/25095250/17280436
import { ApolloClient, NormalizedCacheObject } from '@apollo/client';
import find from 'lodash/find';
import forEach from 'lodash/forEach';
import head from 'lodash/head';
import includes from 'lodash/includes';
import pullAt from 'lodash/pullAt';
import reduce from 'lodash/reduce';
import remove from 'lodash/remove';
import size from 'lodash/size';

import { UploadFunctions, uploadFunctionsVar, UploadRecord, uploadVar } from '../apollo/uploadVar';
import { REST_ENDPOINT, UPLOAD_PATH, UPLOAD_VERSION_PATH } from '../constants';
import GET_CHILD from '../graphql/queries/getChild.graphql';
import GET_CHILDREN from '../graphql/queries/getChildren.graphql';
import GET_VERSIONS from '../graphql/queries/getVersions.graphql';
import { UpdateFolderContentType } from '../hooks/graphql/useUpdateFolderContent';
import { UploadFolderItem, UploadItem, UploadStatus } from '../types/common';
import {
	GetChildQuery,
	GetChildQueryVariables,
	GetChildrenQuery,
	GetChildrenQueryVariables,
	GetVersionsQuery,
	GetVersionsQueryVariables,
	NodeSort,
	NodeType
} from '../types/graphql/types';
import { isFolder } from './ActionsFactory';
import { encodeBase64 } from './utils';

export type UploadAddType = { file: File; fileSystemEntry?: FileSystemEntry | null };

export const waitingQueue: Array<string> = [];
export const loadingQueue: Array<string> = [];

type UploadAction =
	| { type: 'add'; value: UploadRecord }
	| { type: 'remove'; value: string[] }
	| { type: 'update'; value: { id: string; path?: [] } & Partial<UploadItem> };

export function uploadVarReducer(action: UploadAction): UploadRecord {
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

export function addVersionToCache(
	apolloClient: ApolloClient<NormalizedCacheObject>,
	nodeId: string
): void {
	apolloClient.query<GetVersionsQuery, GetVersionsQueryVariables>({
		query: GET_VERSIONS,
		fetchPolicy: 'network-only',
		variables: {
			node_id: nodeId
		}
	});
}

export function updateProgress(ev: ProgressEvent, fileEnriched: UploadItem): void {
	if (ev.lengthComputable) {
		const updatedValue = {
			...fileEnriched,
			percentage: Math.floor((ev.loaded / ev.total) * 100)
		};

		uploadVarReducer({ type: 'update', value: updatedValue });
	}
}

export function singleRetry(id: string): void {
	const retryFile = find(uploadVar(), (item) => item.id === id);
	if (retryFile == null) {
		throw new Error('unable to retry missing file');
	}
	if (retryFile.status !== UploadStatus.FAILED && retryFile.status !== UploadStatus.QUEUED) {
		throw new Error('unable to retry, upload must be Failed');
	}

	uploadVarReducer({ type: 'update', value: { id, status: UploadStatus.LOADING, progress: 0 } });

	const newRetryFile = find(uploadVar(), (item) => item.id === id);
	if (newRetryFile) {
		const itemFunctions = uploadFunctionsVar()[newRetryFile.id];
		const abortFunction = itemFunctions.retry(newRetryFile);
		uploadFunctionsVar({
			...uploadFunctionsVar(),
			[newRetryFile.id]: { ...itemFunctions, abort: abortFunction }
		});
	}
}

export function uploadCompleted(
	xhr: XMLHttpRequest,
	fileEnriched: UploadItem,
	apolloClient: ApolloClient<NormalizedCacheObject>,
	nodeSort: NodeSort,
	addNodeToFolder: UpdateFolderContentType['addNodeToFolder'],
	isUploadVersion: boolean
): void {
	if (xhr.readyState === XMLHttpRequest.DONE && xhr.status === 200) {
		const response = JSON.parse(xhr.response);
		const { nodeId } = response;
		if (isUploadVersion) {
			addVersionToCache(apolloClient, nodeId);
		}

		uploadVarReducer({
			type: 'update',
			value: { id: fileEnriched.id, status: UploadStatus.COMPLETED, progress: 100, nodeId }
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
}

export function upload(
	fileEnriched: UploadItem,
	apolloClient: ApolloClient<NormalizedCacheObject>,
	nodeSort: NodeSort,
	addNodeToFolder: UpdateFolderContentType['addNodeToFolder']
): UploadFunctions['abort'] {
	if (fileEnriched.file === null || fileEnriched.parentNodeId === null) {
		throw new Error('cannot upload without a file or a parentNodeId');
	}
	const xhr = new XMLHttpRequest();
	const url = `${REST_ENDPOINT}${UPLOAD_PATH}`;
	xhr.open('POST', url, true);

	xhr.setRequestHeader('Filename', encodeBase64(fileEnriched.file.name));
	xhr.setRequestHeader('ParentId', fileEnriched.parentNodeId);

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

	return Promise.resolve(xhr.abort);
}

export function uploadVersion(
	fileEnriched: UploadItem,
	apolloClient: ApolloClient<NormalizedCacheObject>,
	nodeSort: NodeSort,
	addNodeToFolder: UpdateFolderContentType['addNodeToFolder'],
	overwriteVersion = false
): UploadFunctions['abort'] {
	if (fileEnriched.nodeId === null || fileEnriched.file === null) {
		throw new Error('cannot upload a version without file or nodeId');
	}
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

	return Promise.resolve(xhr.abort);
}

export function getUploadAddType(dataTransfer: DataTransfer): UploadAddType[] {
	const fileEntries: UploadAddType[] = [];
	forEach(dataTransfer.items, (droppedItem, index) => {
		const item: FileSystemEntry | null = droppedItem.webkitGetAsEntry();
		if (item?.name !== dataTransfer.files[index].name) {
			console.error('dataTransfer items and files mismatch');
		}
		fileEntries.push({ fileSystemEntry: item, file: dataTransfer.files[index] });
	});
	return fileEntries;
}

export function isUploadFolderItem(item: Partial<UploadItem>): item is UploadFolderItem {
	return typeof (item as UploadFolderItem).children !== 'undefined';
}

export function getUploadNodeType(item: Partial<UploadItem>): NodeType {
	return isUploadFolderItem(item) ? NodeType.Folder : NodeType.Other;
}
