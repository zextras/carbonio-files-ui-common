/*
 * SPDX-FileCopyrightText: 2022 Zextras <https://www.zextras.com>
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

/* eslint-disable no-else-return */
import React from 'react';

import difference from 'lodash/difference';
import every from 'lodash/every';
import find from 'lodash/find';
import forEach from 'lodash/forEach';
import includes from 'lodash/includes';
import isBoolean from 'lodash/isBoolean';
import reduce from 'lodash/reduce';
import size from 'lodash/size';
import some from 'lodash/some';

import { ROOTS } from '../constants';
import { GetNodeParentType, Node, UploadStatus, UploadType } from '../types/common';
import { File as FilesFile, File, Folder, MakeOptional, Root } from '../types/graphql/types';
import { OneOrMany } from '../types/utils';
import { docsHandledMimeTypes } from './utils';

export enum Action {
	Rename = 'RENAME',
	Flag = 'FLAG',
	UnFlag = 'UNFLAG',
	// CreateFolder = 'CREATE_FOLDER',
	MarkForDeletion = 'MARK_FOR_DELETION',
	Move = 'MOVE',
	Copy = 'COPY',
	Restore = 'RESTORE',
	UpsertDescription = 'UPSERT_DESCRIPTION',
	DeletePermanently = 'DELETE_PERMANENTLY',
	Download = 'DOWNLOAD',
	removeUpload = 'REMOVE_UPLOAD',
	RetryUpload = 'RETRY_UPLOAD',
	GoToFolder = 'GO_TO_FOLDER',
	OpenWithDocs = 'OPEN_WITH_DOCS',
	SendViaMail = 'SEND_VIA_MAIL'
}

export interface ActionItem {
	id: string;
	label: string;
	icon: string;
	click?: (event: React.SyntheticEvent | KeyboardEvent, ...args: unknown[]) => unknown;
	selected?: boolean;
	customComponent?: React.ReactNode;
	disabled?: boolean;
}

export type ActionsFactoryNodeType = Pick<
	Node,
	'permissions' | 'flagged' | 'type' | 'owner' | 'id' | 'rootId'
> &
	GetNodeParentType &
	(Pick<FilesFile, '__typename'> | Pick<Folder, '__typename'>) &
	MakeOptional<Pick<FilesFile, 'mime_type'>, 'mime_type'>;

export type ActionsFactoryUploadType = Pick<UploadType, 'status' | 'parentId'>;

export type ActionsFactoryGlobalType = ActionsFactoryNodeType | ActionsFactoryUploadType;

export type ActionsFactoryChecker = (nodes: ActionsFactoryGlobalType[]) => boolean;

export type ActionsFactoryCheckerMap = Partial<Record<Action, ActionsFactoryChecker>>;

export type ActionMap = Partial<Record<Action, boolean>>;

const selectionModePrimaryActions: Action[] = [
	Action.MarkForDeletion,
	Action.Restore,
	Action.DeletePermanently
];

const previewPanelPrimaryActions: Action[] = [
	Action.MarkForDeletion,
	Action.Restore,
	Action.DeletePermanently
];

const selectionModeSecondaryActions: Action[] = [
	Action.OpenWithDocs,
	Action.Rename,
	Action.Flag,
	Action.UnFlag,
	Action.Copy,
	Action.Move,
	Action.Download,
	Action.SendViaMail
];

const previewPanelSecondaryActions: Action[] = [
	Action.OpenWithDocs,
	Action.Rename,
	Action.Flag,
	Action.UnFlag,
	Action.Copy,
	Action.Move,
	Action.Download,
	Action.SendViaMail
];

const hoverBarActions: Action[] = [
	Action.Download,
	Action.Flag,
	Action.UnFlag,
	Action.Restore,
	Action.DeletePermanently
];

const contextualMenuActions: Action[] = [
	Action.OpenWithDocs,
	Action.Rename,
	Action.Flag,
	Action.UnFlag,
	Action.MarkForDeletion,
	Action.Move,
	Action.Copy,
	Action.Restore,
	Action.DeletePermanently,
	Action.Download,
	Action.SendViaMail
];

const uploadActions: Action[] = [Action.removeUpload, Action.RetryUpload, Action.GoToFolder];

export const trashedNodeActions: Action[] = [Action.Restore, Action.DeletePermanently];

export function isFile(node: { __typename?: string }): node is File {
	return node.__typename === 'File';
}

export function isFolder(node: { __typename?: string }): node is Folder {
	return node.__typename === 'Folder';
}

export function isRoot(node: { __typename?: string }): node is Root {
	return node.__typename === 'Root';
}

export function hasWritePermission(
	nodes: OneOrMany<ActionsFactoryNodeType>,
	actionName: string
): boolean {
	if (!(nodes instanceof Array)) {
		if (isFile(nodes)) {
			if (!isBoolean(nodes.permissions.can_write_file)) {
				throw Error('can_write_file not defined');
			}
			return nodes.permissions.can_write_file;
		} else if (isFolder(nodes)) {
			if (!isBoolean(nodes.permissions.can_write_folder)) {
				throw Error('can_write_folder not defined');
			}
			return nodes.permissions.can_write_folder;
		} else {
			throw Error(`cannot evaluate ${actionName} on UnknownType`);
		}
	} else {
		let result = true;
		// eslint-disable-next-line consistent-return
		forEach(nodes, (node: ActionsFactoryNodeType) => {
			const partial = hasWritePermission(node, actionName);
			if (!partial) {
				result = false;
				return false;
			}
		});
		return result;
	}
}

export function canRename(nodes: OneOrMany<ActionsFactoryGlobalType>): boolean {
	if (!(nodes instanceof Array)) {
		throw Error('cannot evaluate canRename on Node type');
	}
	const $nodes = nodes as ActionsFactoryNodeType[];
	if (size($nodes) === 0) {
		throw Error('cannot evaluate canRename on empty nodes array');
	}
	if (size($nodes) > 1) {
		// cannot rename more than one node
		return false;
	}
	// so size(nodes) is 1
	return hasWritePermission($nodes, 'canRename') && $nodes[0].rootId !== ROOTS.TRASH;
}

export function canFlag(nodes: OneOrMany<ActionsFactoryGlobalType>): boolean {
	if (!(nodes instanceof Array)) {
		throw Error('cannot evaluate canFlag on Node type');
	}
	if (size(nodes) === 0) {
		throw Error('cannot evaluate canFlag on empty nodes array');
	}
	const $nodes = nodes as ActionsFactoryNodeType[];
	if (size($nodes) > 1) {
		// can flag if there is at least 1 unflagged node
		return find($nodes, (node) => !node.flagged) !== undefined;
	}
	// so size(nodes) is 1
	return !$nodes[0].flagged;
}

export function canUnFlag(nodes: OneOrMany<ActionsFactoryGlobalType>): boolean {
	if (!(nodes instanceof Array)) {
		throw Error('cannot evaluate canUnFlag on Node type');
	}
	if (size(nodes) === 0) {
		throw Error('cannot evaluate canUnFlag on empty nodes array');
	}
	const $nodes = nodes as ActionsFactoryNodeType[];
	if (size($nodes) > 1) {
		// can unflag if there is at least 1 flagged node
		return find($nodes, (node) => node.flagged) !== undefined;
	}
	// so size(nodes) is 1
	return $nodes[0].flagged;
}

export function canCreateFolder(
	destinationNode: Pick<ActionsFactoryNodeType, '__typename' | 'permissions'>
): boolean {
	if (isFile(destinationNode)) {
		throw Error('destinationNode must be a Folder');
	}
	if (!isBoolean(destinationNode.permissions.can_write_folder)) {
		throw Error('can_write_folder not defined');
	}
	return destinationNode.permissions.can_write_folder;
}

export function canUploadFile(
	destinationNode: Pick<ActionsFactoryNodeType, '__typename' | 'permissions'>
): boolean {
	if (isFile(destinationNode)) {
		throw Error('destinationNode must be a Folder');
	}
	if (!isBoolean(destinationNode.permissions.can_write_file)) {
		throw Error('can_write_file not defined');
	}
	return destinationNode.permissions.can_write_file;
}

export function canCreateFile(
	destinationNode: Pick<ActionsFactoryNodeType, '__typename' | 'permissions'>
): boolean {
	if (isFile(destinationNode)) {
		throw Error('destinationNode must be a Folder');
	}
	if (!isBoolean(destinationNode.permissions.can_write_file)) {
		throw Error('can_write_file not defined');
	}
	return destinationNode.permissions.can_write_file;
}

export function canBeWriteNodeDestination(
	destinationNode: Pick<ActionsFactoryNodeType, '__typename' | 'permissions'>,
	writingFile: boolean,
	writingFolder: boolean
): boolean {
	// a node can be the destination of a write action if and only if
	// - is a folder
	// - has can_write_file permission if user is writing at least one file
	// - has can_write_folder permission if user is writing at least one folder

	return (
		isFolder(destinationNode) &&
		!(writingFile && !canCreateFile(destinationNode)) &&
		!(writingFolder && !canCreateFolder(destinationNode))
	);
}

export function canBeMoveDestination(
	destinationNode: Pick<ActionsFactoryNodeType, '__typename' | 'permissions' | 'id' | 'owner'>,
	nodesToMove: Array<Pick<ActionsFactoryNodeType, '__typename' | 'id' | 'owner'>>,
	loggedUserId: string
): boolean {
	const movingFile = find(nodesToMove, (node) => isFile(node)) !== undefined;
	const movingFolder = find(nodesToMove, (node) => isFolder(node)) !== undefined;
	// a node can be de destination of a move action if and only if
	// - has permission to write nodes in it
	// - is not one of the moving nodes (cannot move a folder inside itself)
	// - has the same owner of the files that are written (workspace concept)
	const destinationOwnerId = destinationNode.owner?.id || loggedUserId;
	const isSameOwner = !some(nodesToMove, (node) => node.owner.id !== destinationOwnerId);
	return (
		canBeWriteNodeDestination(destinationNode, movingFile, movingFolder) &&
		find(nodesToMove, ['id', destinationNode.id]) === undefined &&
		isSameOwner
	);
}

export function canBeCopyDestination(
	destinationNode: Pick<ActionsFactoryNodeType, '__typename' | 'permissions' | 'id'>,
	nodesToCopy: Array<Pick<ActionsFactoryNodeType, '__typename'>>
): boolean {
	const copyingFile = find(nodesToCopy, (node) => isFile(node)) !== undefined;
	const copyingFolder = find(nodesToCopy, (node) => isFolder(node)) !== undefined;
	// a node can be de destination of a copy action if and only if
	// - has permission to write nodes in it
	// - is not one of the copying nodes (cannot copy a folder inside itself)
	return (
		canBeWriteNodeDestination(destinationNode, copyingFile, copyingFolder) &&
		find(nodesToCopy, ['id', destinationNode.id]) === undefined
	);
}

export function canRestore(nodes: OneOrMany<ActionsFactoryGlobalType>): boolean {
	let someNotTrashed: boolean;
	const $nodes = nodes as OneOrMany<ActionsFactoryNodeType>;
	if ($nodes instanceof Array) {
		someNotTrashed = some($nodes, (node) => node.rootId !== ROOTS.TRASH);
	} else {
		someNotTrashed = $nodes.rootId === ROOTS.TRASH;
	}
	return hasWritePermission($nodes, 'canRestore') && !someNotTrashed;
}

export function canMarkForDeletion(nodes: OneOrMany<ActionsFactoryGlobalType>): boolean {
	let someTrashed: boolean;
	const $nodes = nodes as OneOrMany<ActionsFactoryNodeType>;
	if ($nodes instanceof Array) {
		someTrashed = some($nodes, (node) => node.rootId === ROOTS.TRASH);
	} else {
		someTrashed = $nodes.rootId === ROOTS.TRASH;
	}
	return hasWritePermission($nodes, 'canMarkForDeletion') && !someTrashed;
}

export function canUpsertDescription(nodes: OneOrMany<ActionsFactoryGlobalType>): boolean {
	const $nodes = nodes as ActionsFactoryNodeType[];
	return hasWritePermission($nodes, 'canUpsertDescription');
}

export function canDeletePermanently(nodes: OneOrMany<ActionsFactoryGlobalType>): boolean {
	const $nodes = nodes as OneOrMany<ActionsFactoryNodeType>;
	if (!($nodes instanceof Array)) {
		if (isFile($nodes) || isFolder($nodes)) {
			if (!isBoolean($nodes.permissions.can_delete)) {
				throw Error('can_delete not defined');
			}
			return $nodes.permissions.can_delete && $nodes.rootId === ROOTS.TRASH;
		} else {
			throw Error(`cannot evaluate DeletePermanently on UnknownType`);
		}
	} else {
		return every($nodes, (node) => canDeletePermanently(node));
	}
}

export function canMove(
	nodes: OneOrMany<ActionsFactoryGlobalType>,
	loggedUserId?: string
): boolean {
	if (!(nodes instanceof Array)) {
		throw Error('cannot evaluate canMove on Node type');
	}
	if (size(nodes) === 0) {
		throw Error('cannot evaluate canMove on empty nodes array');
	}
	const $nodes = nodes as ActionsFactoryNodeType[];
	return every($nodes, (node) => {
		let canMoveResult = false;
		if (isFile(node)) {
			if (!isBoolean(node.permissions.can_write_file)) {
				throw Error('can_write_file not defined');
			}
			// a file can be moved if it has can_write_file permission, and it has a parent which has can_write_file permission.
			// If a node is shared with me and its parent is the LOCAL_ROOT, then the node cannot be moved (it's a direct share)
			canMoveResult =
				node.permissions.can_write_file &&
				!!node.parent &&
				// TODO: REMOVE CHECK ON ROOT WHEN BE WILL NOT RETURN LOCAL_ROOT AS PARENT FOR SHARED NODES
				(node.parent.id !== ROOTS.LOCAL_ROOT || node.owner.id === loggedUserId) &&
				!!node.parent.permissions.can_write_file &&
				node.rootId !== ROOTS.TRASH;
		} else if (isFolder(node)) {
			if (!isBoolean(node.permissions.can_write_folder)) {
				throw Error('can_write_folder not defined');
			}
			// a folder can be moved if it has can_write_folder permission and it has a parent which has can_write_folder permission
			canMoveResult =
				node.permissions.can_write_folder &&
				!!node.parent &&
				// TODO: REMOVE CHECK ON ROOT WHEN BE WILL NOT RETURN LOCAL_ROOT AS PARENT FOR SHARED NODES
				(node.parent.id !== ROOTS.LOCAL_ROOT || node.owner.id === loggedUserId) &&
				!!node.parent?.permissions.can_write_folder &&
				node.rootId !== ROOTS.TRASH;
		} else {
			throw Error('cannot evaluate canMove on UnknownType');
		}
		return canMoveResult;
	});
}

export function canCopy(nodes: OneOrMany<ActionsFactoryGlobalType>): boolean {
	if (!(nodes instanceof Array)) {
		throw Error('cannot evaluate canCopy on Node type');
	}
	if (size(nodes) === 0) {
		throw Error('cannot evaluate canCopy on empty nodes array');
	}
	const $nodes = nodes as ActionsFactoryNodeType[];
	return every($nodes, (node) => node.rootId !== ROOTS.TRASH);
}

export function canDownload(nodes: OneOrMany<ActionsFactoryGlobalType>): boolean {
	if (!(nodes instanceof Array)) {
		throw Error('cannot evaluate canDownload on Node type');
	}
	if (size(nodes) === 0) {
		throw Error('cannot evaluate canDownload on empty nodes array');
	}
	const $nodes = nodes as ActionsFactoryNodeType[];
	// TODO: evaluate when batch will be enabled
	// TODO: remove file check when download will be implemented also for folders
	return size($nodes) === 1 && isFile($nodes[0]);
}

export function canOpenWithDocs(nodes: OneOrMany<ActionsFactoryGlobalType>): boolean {
	if (!(nodes instanceof Array)) {
		throw Error('cannot evaluate canOpenWithDocs on Node type');
	}
	if (size(nodes) === 0) {
		throw Error('cannot evaluate canOpenWithDocs on empty nodes array');
	}
	const $nodes = nodes as ActionsFactoryNodeType[];
	return (
		size($nodes) === 1 &&
		isFile($nodes[0]) &&
		includes(docsHandledMimeTypes, $nodes[0].mime_type) &&
		$nodes[0].rootId !== ROOTS.TRASH
	);
}

export function canRemoveUpload(nodes: OneOrMany<ActionsFactoryGlobalType>): boolean {
	if (!(nodes instanceof Array)) {
		throw Error('cannot evaluate canRemoveUpload on Node type');
	}
	if (size(nodes) === 0) {
		throw Error('cannot evaluate canRemoveUpload on empty nodes array');
	}
	return true;
}

export function canRetryUpload(nodes: OneOrMany<ActionsFactoryGlobalType>): boolean {
	if (!(nodes instanceof Array)) {
		throw Error('cannot evaluate canRetryUpload on Node type');
	}
	if (size(nodes) === 0) {
		throw Error('cannot evaluate canRetryUpload on empty nodes array');
	}
	const $nodes = nodes as ActionsFactoryUploadType[];
	// can retry only if all selected nodes are failed
	return find($nodes, (node) => node.status !== UploadStatus.FAILED) === undefined;
}

export function canGoToFolder(nodes: OneOrMany<ActionsFactoryGlobalType>): boolean {
	if (!(nodes instanceof Array)) {
		throw Error('cannot evaluate canGoToFolder on Node type');
	}
	if (size(nodes) === 0) {
		throw Error('cannot evaluate canGoToFolder on empty nodes array');
	}
	const $nodes = nodes as ActionsFactoryUploadType[];
	// can go to folder only if all selected nodes have the same parent
	return every(
		$nodes,
		(node, index, array) =>
			node.parentId && array[0].parentId && node.parentId === array[0].parentId
	);
}

export function canSendViaMail(nodes: OneOrMany<ActionsFactoryGlobalType>): boolean {
	if (!(nodes instanceof Array)) {
		throw Error('cannot evaluate canSendViaMail on Node type');
	}
	if (size(nodes) === 0) {
		throw Error('cannot evaluate canSendViaMail on empty nodes array');
	}
	const $nodes = nodes as ActionsFactoryNodeType[];
	// TODO: evaluate when batch will be enabled
	// TODO: remove file check when canSendViaMail will be implemented also for folders
	return size($nodes) === 1 && isFile($nodes[0]);
}

const actionsCheckMap: {
	[key in Action]: (nodes: OneOrMany<ActionsFactoryGlobalType>, loggedUserId?: string) => boolean;
} = {
	[Action.Rename]: canRename,
	[Action.Flag]: canFlag,
	[Action.UnFlag]: canUnFlag,
	// [Actions.CreateFolder]: canCreateFolder,
	[Action.MarkForDeletion]: canMarkForDeletion,
	[Action.Move]: canMove,
	[Action.Restore]: canRestore,
	[Action.UpsertDescription]: canUpsertDescription,
	[Action.DeletePermanently]: canDeletePermanently,
	[Action.Copy]: canCopy,
	[Action.Download]: canDownload,
	[Action.removeUpload]: canRemoveUpload,
	[Action.RetryUpload]: canRetryUpload,
	[Action.GoToFolder]: canGoToFolder,
	[Action.OpenWithDocs]: canOpenWithDocs,
	[Action.SendViaMail]: canSendViaMail
};

export function getPermittedActions(
	nodes: ActionsFactoryGlobalType[],
	actions: Action[],
	// TODO: REMOVE CHECK ON ROOT WHEN BE WILL NOT RETURN LOCAL_ROOT AS PARENT FOR SHARED NODES
	loggedUserId?: string,
	customCheckers?: ActionsFactoryCheckerMap
): ActionMap {
	return reduce(
		actions,
		(accumulator: ActionMap, action: Action) => {
			if (size(nodes) === 0) {
				accumulator[action] = false;
			} else {
				let externalCheckerResult = true;
				const externalChecker = customCheckers && customCheckers[action];
				if (externalChecker) {
					externalCheckerResult = externalChecker(nodes);
				}
				accumulator[action] = actionsCheckMap[action](nodes, loggedUserId) && externalCheckerResult;
			}
			return accumulator;
		},
		{}
	);
}

export function getPermittedSelectionModePrimaryActions(
	nodes: ActionsFactoryNodeType[],
	actionsToRemove?: Action[]
): ActionMap {
	return getPermittedActions(
		nodes as ActionsFactoryGlobalType[],
		actionsToRemove
			? difference(selectionModePrimaryActions, actionsToRemove)
			: selectionModePrimaryActions
	);
}

export function getPermittedSelectionModeSecondaryActions(
	nodes: ActionsFactoryNodeType[],
	actionsToRemove?: Action[],
	// TODO: REMOVE CHECK ON ROOT WHEN BE WILL NOT RETURN LOCAL_ROOT AS PARENT FOR SHARED NODES
	loggedUserId?: string,
	customCheckers?: ActionsFactoryCheckerMap
): ActionMap {
	return getPermittedActions(
		nodes as ActionsFactoryGlobalType[],
		actionsToRemove
			? difference(selectionModeSecondaryActions, actionsToRemove)
			: selectionModeSecondaryActions,
		loggedUserId,
		customCheckers
	);
}

export function getPermittedPreviewPanelPrimaryActions(
	nodes: ActionsFactoryNodeType[],
	actionsToRemove?: Action[]
): ActionMap {
	return getPermittedActions(
		nodes as ActionsFactoryGlobalType[],
		actionsToRemove
			? difference(previewPanelPrimaryActions, actionsToRemove)
			: previewPanelPrimaryActions
	);
}

export function getPermittedPreviewPanelSecondaryActions(
	nodes: ActionsFactoryNodeType[],
	actionsToRemove?: Action[],
	// TODO: REMOVE CHECK ON ROOT WHEN BE WILL NOT RETURN LOCAL_ROOT AS PARENT FOR SHARED NODES
	loggedUserId?: string
): ActionMap {
	return getPermittedActions(
		nodes as ActionsFactoryGlobalType[],
		actionsToRemove
			? difference(previewPanelSecondaryActions, actionsToRemove)
			: previewPanelSecondaryActions,
		loggedUserId
	);
}

export function getPermittedHoverBarActions(
	node: ActionsFactoryNodeType,
	actionsToRemove?: Action[]
): ActionMap {
	const result = getPermittedActions(
		[node as ActionsFactoryGlobalType],
		actionsToRemove ? difference(hoverBarActions, actionsToRemove) : hoverBarActions
	);
	// flag / unflag actions are exclusive for a single node
	if (result[Action.Flag]) {
		delete result[Action.UnFlag];
	} else if (result[Action.UnFlag]) {
		delete result[Action.Flag];
	}
	// hide download hoverBar action for type folder to avoid tooltip on disabled iconButton
	if (isFolder(node) && Action.Download in result) {
		delete result[Action.Download];
	}

	return result;
}

export function getPermittedContextualMenuActions(
	nodes: ActionsFactoryNodeType[],
	actionsToRemove?: Action[],
	loggedUserId?: string
): ActionMap {
	const result = getPermittedActions(
		nodes as ActionsFactoryGlobalType[],
		actionsToRemove ? difference(contextualMenuActions, actionsToRemove) : contextualMenuActions,
		loggedUserId
	);
	if (size(nodes) === 1) {
		// flag / unflag actions are exclusive for a single node
		if (result[Action.Flag]) {
			delete result[Action.UnFlag];
		} else if (result[Action.UnFlag]) {
			delete result[Action.Flag];
		}
	}
	return result;
}

export function getPermittedUploadActions(nodes: ActionsFactoryUploadType[]): ActionMap {
	return getPermittedActions(nodes as ActionsFactoryGlobalType[], uploadActions);
}

export function buildActionItems(
	itemsMap: Partial<Record<Action, ActionItem>>,
	actions: ActionMap = {}
): ActionItem[] {
	return reduce(
		itemsMap,
		(accumulator: ActionItem[], actionItem, key) => {
			if (actionItem) {
				const actionEnabled = actions[key as Action];
				if (actionEnabled !== undefined) {
					accumulator.push({
						...actionItem,
						disabled: !actionEnabled
					});
				}
			}
			return accumulator;
		},
		[]
	);
}
