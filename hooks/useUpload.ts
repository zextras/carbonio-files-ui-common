/*
 * SPDX-FileCopyrightText: 2022 Zextras <https://www.zextras.com>
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { useCallback, useMemo } from 'react';

import { ApolloClient, NormalizedCacheObject } from '@apollo/client';
import find from 'lodash/find';
import forEach from 'lodash/forEach';
import includes from 'lodash/includes';
import map from 'lodash/map';
import partition from 'lodash/partition';
import remove from 'lodash/remove';

import buildClient from '../apollo';
import { nodeSortVar } from '../apollo/nodeSortVar';
import {
	uploadCounterVar,
	UploadFunctions,
	uploadFunctionsVar,
	uploadVar
} from '../apollo/uploadVar';
import { REST_ENDPOINT, UPLOAD_PATH, UPLOAD_VERSION_PATH } from '../constants';
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
import { encodeBase64 } from '../utils/utils';
import { UpdateFolderContentType, useUpdateFolderContent } from './graphql/useUpdateFolderContent';

const addVersionToCache = (
	apolloClient: ApolloClient<NormalizedCacheObject>,
	nodeId: string,
	version: number
): void => {
	apolloClient
		.query<GetVersionsQuery, GetVersionsQueryVariables>({
			query: GET_VERSIONS,
			fetchPolicy: 'no-cache',
			variables: {
				node_id: nodeId,
				versions: [version]
			}
		})
		.then((result) => {
			if (result.data) {
				apolloClient.cache.updateQuery<GetVersionsQuery, GetVersionsQueryVariables>(
					{ query: GET_VERSIONS, variables: { node_id: nodeId }, overwrite: true },
					(existingVersions) => ({
						getVersions: [result.data.getVersions[0], ...(existingVersions?.getVersions || [])]
					})
				);
			}
		});
};

const uploadCompleted = (
	xhr: XMLHttpRequest,
	fileEnriched: UploadType,
	apolloClient: ApolloClient<NormalizedCacheObject>,
	nodeSort: NodeSort,
	addNodeToFolder: UpdateFolderContentType['addNodeToFolder'],
	isUploadVersion: boolean
): void => {
	switch (xhr.status) {
		case 200: {
			const response = JSON.parse(xhr.response);
			const { nodeId, version } = response;
			if (isUploadVersion) {
				addVersionToCache(apolloClient, nodeId, version);
			}

			const oldState = uploadVar();
			const newState = map(oldState, (item) => {
				if (item.id === fileEnriched.id) {
					return {
						...fileEnriched,
						status: UploadStatus.COMPLETED,
						percentage: 100,
						nodeId
					};
				}
				return item;
			});
			uploadVar(newState);

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

			break;
		}
		case 413: {
			const oldState = uploadVar();
			const newState = map(oldState, (item) => {
				if (item.id === fileEnriched.id) {
					return {
						...fileEnriched,
						status: UploadStatus.FAILED
					};
				}
				return item;
			});
			uploadVar(newState);
			break;
		}
		// name already exists
		case 500: {
			const oldState = uploadVar();
			const newState = map(oldState, (item) => {
				if (item.id === fileEnriched.id) {
					return {
						...fileEnriched,
						status: UploadStatus.FAILED
					};
				}
				return item;
			});
			uploadVar(newState);
			break;
		}
		default: {
			const oldState = uploadVar();
			const newState = map(oldState, (item) => {
				if (item.id === fileEnriched.id) {
					return {
						...fileEnriched,
						status: UploadStatus.FAILED
					};
				}
				return item;
			});
			uploadVar(newState);
			console.error('Unhandled status');
		}
	}
};

const updateProgress = (ev: ProgressEvent, fileEnriched: UploadType): void => {
	if (ev.lengthComputable) {
		const updatedValue = {
			...fileEnriched,
			percentage: Math.floor((ev.loaded / ev.total) * 100)
		};

		const oldState = uploadVar();
		const newState = map(oldState, (item) => {
			if (item.id === fileEnriched.id) {
				return updatedValue;
			}
			return item;
		});
		uploadVar(newState);
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

	if (xhr.upload) {
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
	fileEnriched: UploadType,
	apolloClient: ApolloClient<NormalizedCacheObject>,
	nodeSort: NodeSort,
	addNodeToFolder: UpdateFolderContentType['addNodeToFolder'],
	overwriteVersion = false
): (() => void) => {
	const xhr = new XMLHttpRequest();
	const url = `${REST_ENDPOINT}${UPLOAD_VERSION_PATH}`;
	xhr.open('POST', url, true);

	xhr.setRequestHeader('NodeId', fileEnriched.id);
	xhr.setRequestHeader('Filename', encodeBase64(fileEnriched.file.name));
	xhr.setRequestHeader('OverwriteVersion', `${overwriteVersion}`);

	if (xhr.upload) {
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
	add: (files: FileList, parentId: string) => void;
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

	const add = useCallback<ReturnType<UseUploadHook>['add']>(
		(files, parentId) => {
			const filesEnriched = map<File, UploadType>(files, (file: File, index) => ({
				file,
				parentId,
				percentage: 0,
				status: UploadStatus.LOADING,
				id: (uploadCounterVar() + index).toString()
			}));
			uploadVar([...uploadVar(), ...filesEnriched]);
			uploadCounterVar(uploadCounterVar() + files.length);

			forEach(filesEnriched, (fileEnriched: UploadType) => {
				const abortFunction: UploadFunctions['abort'] = upload(
					fileEnriched,
					apolloClient,
					nodeSortVar(),
					addNodeToFolder
				);
				const retryFunction: UploadFunctions['retry'] = (newFile: UploadType) =>
					upload(newFile, apolloClient, nodeSortVar(), addNodeToFolder);
				uploadFunctionsVar({
					...uploadFunctionsVar(),
					[fileEnriched.id]: { abort: abortFunction, retry: retryFunction }
				});
			});
		},
		[apolloClient, addNodeToFolder]
	);

	const update = useCallback<ReturnType<UseUploadHook>['update']>(
		(node, file, overwriteVersion) => {
			const fileEnriched: UploadType = {
				file,
				percentage: 0,
				status: UploadStatus.LOADING,
				id: node.id,
				nodeId: node.id,
				parentId: (node.parent as Folder).id
			};
			uploadVar([...uploadVar(), fileEnriched]);
			uploadCounterVar(uploadCounterVar() + 1);
			const abortFunction: UploadFunctions['abort'] = uploadVersion(
				fileEnriched,
				apolloClient,
				nodeSortVar(),
				addNodeToFolder,
				overwriteVersion
			);
			const retryFunction: UploadFunctions['retry'] = (newFile) =>
				uploadVersion(newFile, apolloClient, nodeSortVar(), addNodeToFolder, overwriteVersion);
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
			const oldState = uploadVar();
			const newState = remove(oldState, (item) => !includes(ids, item.id));
			forEach(oldState, (item) => {
				if (item.status === UploadStatus.LOADING) {
					abort(item.id);
				}
			});
			uploadVar(newState);
		},
		[abort]
	);

	const removeByNodeId = useCallback((nodeIds: Array<string>) => {
		const oldState = uploadVar();
		const partitions = partition(oldState, (item) => includes(nodeIds, item.nodeId));
		const removedNodes = partitions[0];
		const notRemovedNodes = partitions[1];
		// update reactive var only if there are removed nodes
		if (removedNodes.length > 0) {
			uploadVar(notRemovedNodes);
		}
	}, []);

	const removeAllCompleted = useCallback(() => {
		const newState = remove(uploadVar(), (item) => item.status !== UploadStatus.COMPLETED);
		uploadVar(newState);
	}, []);

	const singleRetry = useCallback((id: string) => {
		const oldState = uploadVar();
		const retryFile = find(oldState, (item) => item.id === id);
		if (retryFile == null) {
			throw new Error('unable to retry missing file');
		}
		if (retryFile.status !== UploadStatus.FAILED) {
			throw new Error('unable to retry, upload must be Failed');
		}

		const newState = map(oldState, (item) => {
			if (item.id === id) {
				return {
					...item,
					status: UploadStatus.LOADING,
					percentage: 0
				};
			}
			return item;
		});
		uploadVar(newState);
		const newRetryFile = find(newState, (item) => item.id === id);
		if (newRetryFile) {
			const prevState = uploadFunctionsVar();
			const itemFunctions = prevState[newRetryFile.id];

			const abortFunction = itemFunctions.retry(newRetryFile);
			uploadFunctionsVar({
				...prevState,
				[newRetryFile.id]: { ...itemFunctions, abort: abortFunction }
			});
		}
	}, []);

	const retryById = useCallback(
		(ids: Array<string>) => {
			forEach(ids, (id) => {
				singleRetry(id);
			});
		},
		[singleRetry]
	);

	return { add, update, removeById, removeAllCompleted, retryById, removeByNodeId };
};
