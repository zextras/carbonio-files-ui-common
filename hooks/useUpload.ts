/*
 * SPDX-FileCopyrightText: 2022 Zextras <https://www.zextras.com>
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { useCallback, useMemo } from 'react';

import { ApolloClient, NormalizedCacheObject } from '@apollo/client';
import filter from 'lodash/filter';
import find from 'lodash/find';
import forEach from 'lodash/forEach';
import head from 'lodash/head';
import includes from 'lodash/includes';
import keyBy from 'lodash/keyBy';
import noop from 'lodash/noop';
import partition from 'lodash/partition';
import pullAt from 'lodash/pullAt';
import remove from 'lodash/remove';
import size from 'lodash/size';
import { useTranslation } from 'react-i18next';

import buildClient from '../apollo';
import { nodeSortVar } from '../apollo/nodeSortVar';
import { UploadFunctions, uploadFunctionsVar, uploadVar } from '../apollo/uploadVar';
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
import { encodeBase64 } from '../utils/utils';
import { UpdateFolderContentType, useUpdateFolderContent } from './graphql/useUpdateFolderContent';
import { useMoreInfoModal } from './modals/useMoreInfoModal';
import { useCreateSnackbar } from './useCreateSnackbar';

// KNOWN ISSUE: Since that folders are actually files, this is the only way to distinguish them from another kind of file.
// Although this method doesn't give you absolute certainty that a file is a folder:
// it might be a file without extension and with a size of 0 or exactly N x 4096B.
// https://stackoverflow.com/a/25095250/17280436
const isMaybeFolder = (file: File): boolean => !file.type && file.size % 4096 === 0;

const waitingQueue: Array<string> = [];
const loadingQueue: Array<string> = [];
// window.waitingQueue = waitingQueue;
// window.loadingQueue = loadingQueue;

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

		const state = uploadVar();
		state[fileEnriched.id] = updatedValue;
		uploadVar({ ...state });
	}
};

const singleRetry = (id: string): void => {
	const state = uploadVar();
	const retryFile = find(state, (item) => item.id === id);
	if (retryFile == null) {
		throw new Error('unable to retry missing file');
	}
	if (retryFile.status !== UploadStatus.FAILED && retryFile.status !== UploadStatus.QUEUED) {
		throw new Error('unable to retry, upload must be Failed');
	}

	state[id] = {
		...state[id],
		status: UploadStatus.LOADING,
		percentage: 0
	};
	uploadVar({ ...state });
	const newRetryFile = find(state, (item) => item.id === id);
	if (newRetryFile) {
		const prevState = uploadFunctionsVar();
		const itemFunctions = prevState[newRetryFile.id];

		const abortFunction = itemFunctions.retry(newRetryFile);
		uploadFunctionsVar({
			...prevState,
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
	function updateStatus(uploadItem: UploadType, status: UploadStatus): void {
		const state = uploadVar();
		state[uploadItem.id] = {
			...uploadItem,
			status
		};
		uploadVar({ ...state });
	}

	if (xhr.readyState === XMLHttpRequest.DONE && xhr.status === 200) {
		const response = JSON.parse(xhr.response);
		const { nodeId } = response;
		if (isUploadVersion) {
			addVersionToCache(apolloClient, nodeId);
		}

		const state = uploadVar();
		state[fileEnriched.id] = {
			...fileEnriched,
			status: UploadStatus.COMPLETED,
			percentage: 100,
			nodeId
		};
		uploadVar({ ...state });

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
		updateStatus(fileEnriched, UploadStatus.FAILED);
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
	add: (files: FileList, parentId: string, checkForFolders?: boolean) => void;
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

	const [t] = useTranslation();
	const createSnackbar = useCreateSnackbar();
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
			const state = uploadVar();
			state[folder.id] = {
				...state[folder.id],
				status: UploadStatus.FAILED,
				percentage: 0
			};
			uploadVar({ ...state });
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

			uploadVar({ ...uploadVar(), ...filesEnriched });
			uploadFunctionsVar({ ...uploadFunctionsVar(), ...uploadFunctions });
		},
		[addNodeToFolder, apolloClient, createSnackbarForUploadError, t, uploadFolder]
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
			uploadVar({ ...uploadVar(), ...{ [fileEnriched.id]: fileEnriched } });
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
			const state = uploadVar();
			forEach(ids, (id) => {
				if (state[id].status === UploadStatus.LOADING) {
					abort(id);
				}
				delete state[id];
			});
			uploadVar({ ...state });
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
			uploadVar(keyBy(notRemovedNodes, 'id'));
		}
	}, []);

	const removeAllCompleted = useCallback(() => {
		const state = uploadVar();
		const completedItems = filter(state, (item) => item.status === UploadStatus.COMPLETED);
		forEach(completedItems, (item) => {
			delete state[item.id];
		});
		uploadVar({ ...state });
	}, []);

	const retryById = useCallback((ids: Array<string>) => {
		forEach(ids, (id) => {
			singleRetry(id);
		});
	}, []);

	return { add, update, removeById, removeAllCompleted, retryById, removeByNodeId };
};
