/*
 * SPDX-FileCopyrightText: 2022 Zextras <https://www.zextras.com>
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import React, { DragEventHandler } from 'react';

import { ROOTS } from '../constants';
import {
	ChildFragment,
	File as FilesFile,
	FindNodesQueryVariables,
	Folder,
	GetNodeQuery,
	MakeOptional,
	Maybe,
	Permissions,
	Share
} from './graphql/types';
import { SnakeToCamelCase } from './utils';

export type Node = FilesFile | Folder;

export type PickIdNodeType = Pick<Node, 'id'>;

export type GetNodeParentType = {
	parent?: Maybe<
		| ({ __typename?: 'File' } & Pick<FilesFile, 'id' | 'name'> & {
					permissions: { __typename?: 'Permissions' } & Pick<
						Permissions,
						| 'can_read'
						| 'can_write_file'
						| 'can_write_folder'
						| 'can_delete'
						| 'can_add_version'
						| 'can_read_link'
						| 'can_change_link'
						| 'can_share'
						| 'can_read_share'
						| 'can_change_share'
					>;
				})
		| ({ __typename?: 'Folder' } & Pick<Folder, 'id' | 'name'> & {
					permissions: { __typename?: 'Permissions' } & Pick<
						Permissions,
						| 'can_read'
						| 'can_write_file'
						| 'can_write_folder'
						| 'can_delete'
						| 'can_add_version'
						| 'can_read_link'
						| 'can_change_link'
						| 'can_share'
						| 'can_read_share'
						| 'can_change_share'
					>;
				})
	>;
};

export type Crumb = {
	id: string;
	label: string;
	click?: (event: React.SyntheticEvent) => void;
};

export type CrumbNode = Pick<Node, 'id' | 'name' | 'type'> & {
	parent?: Maybe<
		Pick<Node, 'id' | 'name' | 'type'> & { parent?: Maybe<Pick<Node, 'id' | 'name' | 'type'>> }
	>;
};

export type DroppableCrumb = Crumb & {
	onDragEnter?: DragEventHandler;
	onDragLeave?: DragEventHandler;
	onDragOver?: DragEventHandler;
	onDrop?: DragEventHandler;
};

export enum Role {
	Viewer = 'Viewer',
	Editor = 'Editor'
}

export type NodeListItemType = ChildFragment & {
	disabled?: boolean;
	selectable?: boolean;
	shares?: Array<Pick<Share, '__typename' | 'created_at'> | null | undefined>;
};

export type RootListItemType = Pick<
	NodeListItemType,
	'__typename' | 'id' | 'name' | 'type' | 'disabled' | 'selectable'
>;

export type SortableNode = Pick<Node, 'id' | 'name' | 'updated_at' | 'type'> &
	MakeOptional<Pick<File, 'size'>, 'size'>;

export enum UploadStatus {
	COMPLETED = 'Completed',
	LOADING = 'Loading',
	FAILED = 'Failed'
	// PAUSED: 'Paused'(tentative)
}

export type UploadType = {
	file: File;
	parentId: string;
	status: UploadStatus;
	percentage: number; // (should be rounded down)
	id: string;
	nodeId?: string;
};

export enum DocsType {
	DOCUMENT = 'DOCUMENT',
	SPREADSHEET = 'SPREADSHEET',
	PRESENTATION = 'PRESENTATION'
}

export type CreateDocsFile = GetNodeQuery;

export interface ChipAction {
	background?: string;
	color?: string;
	disabled?: boolean;
	icon: string;
	id: string;
	label?: string;
	onClick?: (event: React.SyntheticEvent) => void;
	type: 'icon' | 'button';
}

export interface ChipProps {
	label?: string | React.ReactElement;
	background?: string;
	color?: string;
	hasAvatar?: boolean;
	error?: boolean;
	avatarPicture?: string;
	closable?: boolean;
	onClose?: (event: React.SyntheticEvent) => void;
	avatarIcon?: string;
	avatarBackground?: string;
	avatarColor?: string;
	avatarLabel?: string;
	onClick?: (event: React.SyntheticEvent) => void;
	size?: string;
	actions?: ChipAction[];
	maxWidth?: string;
}

export type SearchChip = ChipProps;

export enum OrderTrend {
	Ascending = 'Ascending',
	Descending = 'Descending'
}

export enum OrderType {
	Name = 'Name',
	UpdatedAt = 'UpdatedAt',
	Size = 'Size'
}

export type SearchParams = {
	[K in keyof Pick<
		FindNodesQueryVariables,
		| 'flagged'
		| 'shared_by_me'
		| 'shared_with_me'
		| 'folder_id'
		| 'cascade'
		| 'keywords'
		| 'direct_share'
	> as SnakeToCamelCase<K & string>]: FindNodesQueryVariables[K];
};

export type AdvancedFilters = {
	[P in keyof Omit<
		SearchParams,
		'keywords' | 'cascade' | 'sharedWithMe' | 'directShare'
	>]: SearchChip & {
		value: SearchParams[P];
	};
} & {
	[P in keyof Pick<SearchParams, 'keywords'>]: Array<
		SearchChip & {
			value: NonNullable<SearchParams[P]> extends Array<infer U> ? U : unknown;
		}
	>;
} & {
	[P in keyof Pick<SearchParams, 'sharedWithMe' | 'cascade'>]: { value: SearchParams[P] };
};

export type ChipActionsType = {
	background?:
		| string
		| 'currentColor'
		| 'transparent'
		| 'primary'
		| 'secondary'
		| 'header'
		| 'highlight'
		| 'gray0'
		| 'gray1'
		| 'gray2'
		| 'gray3'
		| 'gray4'
		| 'gray5'
		| 'gray6'
		| 'warning'
		| 'error'
		| 'success'
		| 'info'
		| 'text';
	color?:
		| string
		| 'currentColor'
		| 'transparent'
		| 'primary'
		| 'secondary'
		| 'header'
		| 'highlight'
		| 'gray0'
		| 'gray1'
		| 'gray2'
		| 'gray3'
		| 'gray4'
		| 'gray5'
		| 'gray6'
		| 'warning'
		| 'error'
		| 'success'
		| 'info'
		| 'text';
	disabled?: boolean;
	icon: string;
	id: string;
	label?: string;
	onClick?: (event?: React.SyntheticEvent) => void;
	type: 'icon' | 'button';
};

export enum ErrorCode {
	/** Used By:
	 * updateLink
	 * deleteLinks
	 */
	LINK_NOT_FOUND = 'LINK_NOT_FOUND',
	/** Used By:
	 * getNode
	 * updateNode
	 * deleteNodes
	 * createFolder (destination does not exists)
	 * getPath
	 */
	NODE_NOT_FOUND = 'NODE_NOT_FOUND',
	/** Used By:
	 * getUser
	 * getAccountByEmail
	 */
	ACCOUNT_NOT_FOUND = 'ACCOUNT_NOT_FOUND',
	/**
	 * The client requests file version attributes in one of these APIs:
	 * getNode
	 * updateNode
	 * deleteNodes
	 * createFolder (destination does not exists)
	 * getPath
	 * and a specific version is not present in the db
	 */
	FILE_VERSION_NOT_FOUND = 'FILE_VERSION_NOT_FOUND',
	/** Used By:
	 * getShare
	 * updateShare
	 * deleteShare
	 */
	SHARE_NOT_FOUND = 'SHARE_NOT_FOUND',
	/** Used By:
	 * createShare
	 */
	SHARE_CREATION_ERROR = 'SHARE_CREATION_ERROR',
	/**
	 * The client requests distribution list attributes in getAccountByEmail and the system does not find the related
	 * distribution list
	 */
	MISSING_FIELD = 'MISSING_FIELD',
	/** Used By:
	 * trashNode
	 * restoreNodes
	 * moveNodes (no permission to move a node)
	 * copyNodes (no permission to copy a node)
	 */
	NODE_WRITE_ERROR = 'NODE_WRITE_ERROR'
}

export enum PublicLinkRowStatus {
	OPEN,
	CLOSED,
	DISABLED
}

export interface Contact {
	id?: string;
	firstName?: string;
	middleName?: string;
	lastName?: string;
	fullName?: string;
	// eslint-disable-next-line camelcase
	full_name?: string;
	email?: string;
	name?: string;
	company?: string;
}

export type URLParams = {
	filter: 'flagged' | 'myTrash' | 'sharedTrash' | 'sharedByMe' | 'sharedWithMe';
	rootId: typeof ROOTS[keyof typeof ROOTS];
};

export type TargetModule = 'MAILS' | 'CONTACTS' | 'CALENDARS' | 'CHATS';
