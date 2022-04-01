/*
 * SPDX-FileCopyrightText: 2022 Zextras <https://www.zextras.com>
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { NodeSort } from '../types/graphql/types';

export const NODES_LOAD_LIMIT = 25;
export const NODES_SORT_DEFAULT = NodeSort.NameAsc;
export const LIST_ITEM_HEIGHT = 64;
export const LIST_ITEM_HEIGHT_COMPACT = 52;
export const LIST_ITEM_HEIGHT_DETAILS = 52;
export const LIST_ITEM_AVATAR_HEIGHT = 42;
export const LIST_ITEM_AVATAR_HEIGHT_COMPACT = 32;
export const LIST_ITEM_AVATAR_ICON_HEIGHT = 24;
export const LIST_ITEM_AVATAR_ICON_HEIGHT_COMPACT = 16;
export const LIST_WIDTH = '40%';
export const DISPLAYER_WIDTH = '60%';
export const FULL_SHARES_LOAD_LIMIT = 100;
export const SHARES_LOAD_LIMIT = 6;
export const DISPLAYER_TABS = {
	details: 'details',
	sharing: 'sharing',
	// TODO: uncomment each tab when implemented
	// activities: 'activities',
	versioning: 'versioning'
} as const;
export const ROOTS = {
	ENTRY_POINT: 'ROOTS_ENTRY_POINT',
	LOCAL_ROOT: 'LOCAL_ROOT',
	LOCAL_CHAT_ROOT: 'LOCAL_CHAT_ROOT',
	TRASH: 'TRASH_ROOT',
	TRASH_MY_ELEMENTS: 'TRASH_ROOT_MY_ELEMENTS',
	TRASH_SHARED_ELEMENTS: 'TRASH_ROOT_SHARED_ELEMENTS',
	SHARED_WITH_ME: 'SHARED_WITH_ME_ROOT'
} as const;
export const DRAG_TYPES = {
	upload: 'Files',
	move: 'files-drag-move',
	markForDeletion: 'files-drag-markfordeletion'
};
export const SHARE_CHIP_SIZE = 'small';

// endpoint
// keep endpoint without trailing slash
export const GRAPHQL_ENDPOINT = '/services/files/graphql';
export const REST_ENDPOINT = '/services/files';
export const DOCS_ENDPOINT = '/services/docs';
// add leading slash in path
export const OPEN_FILE_PATH = '/files/open';
export const DOWNLOAD_PATH = '/download';
export const UPLOAD_PATH = '/upload';
export const UPLOAD_VERSION_PATH = '/upload-version';
export const CREATE_FILE_PATH = '/files/create';
export const PREVIEW = '/preview';

export const FILES_ROUTE = 'files';
export const FILES_APP_ID = 'carbonio-files-ui';
