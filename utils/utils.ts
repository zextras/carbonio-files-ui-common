/*
 * SPDX-FileCopyrightText: 2022 Zextras <https://www.zextras.com>
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { ApolloError } from '@apollo/client';
import { Location } from 'history';
import { chain } from 'lodash';
import debounce from 'lodash/debounce';
import findIndex from 'lodash/findIndex';
import first from 'lodash/first';
import map from 'lodash/map';
import size from 'lodash/size';
import toLower from 'lodash/toLower';
import trim from 'lodash/trim';
import moment, { Moment } from 'moment-timezone';
import { TFunction } from 'react-i18next';

import { searchParamsVar } from '../apollo/searchVar';
import {
	DOCS_ENDPOINT,
	DOWNLOAD_PATH,
	OPEN_FILE_PATH,
	PREVIEW,
	REST_ENDPOINT,
	ROOTS
} from '../constants';
import { Crumb, CrumbNode, OrderTrend, OrderType, Role, SortableNode } from '../types/common';
import { Maybe, Node, NodeSort, NodeType, SharePermission } from '../types/graphql/types';

/**
 * Format a size in byte as human readable
 */
export const humanFileSize = (inputSize: number): string => {
	if (inputSize === 0) {
		return '0 B';
	}
	const i = Math.floor(Math.log(inputSize) / Math.log(1024));
	return `${(inputSize / 1024 ** i).toFixed(2).toString()} ${['B', 'KB', 'MB', 'GB', 'TB'][i]}`;
};

/**
 * Given a file type returns the DS icon name
 */
export const getIconByFileType = (type: NodeType, subType?: Maybe<string>): string => {
	switch (type) {
		case NodeType.Folder:
			return 'Folder';
		case NodeType.Text:
			return 'FileText';
		case NodeType.Video:
			return 'Video';
		case NodeType.Audio:
			return 'Music';
		case NodeType.Image:
			return 'Image';
		case NodeType.Message:
			return 'Email';
		case NodeType.Presentation:
			return 'FilePresentation';
		case NodeType.Spreadsheet:
			return 'FileCalc';
		case NodeType.Application:
			return 'Code';
		case NodeType.Root: {
			switch (subType) {
				case ROOTS.LOCAL_ROOT:
					return 'Home';
				case ROOTS.TRASH:
					return 'Trash2';
				case ROOTS.SHARED_WITH_ME:
					return 'Share';
				default:
					return 'File';
			}
		}
		default:
			return 'File';
	}
};

const buildCrumbsRecursive = (
	node: CrumbNode,
	clickHandler?: (id: string) => void,
	t?: TFunction,
	nodeClickCondition: (node: Pick<Node, 'id' | 'name' | 'type'>) => boolean = (): boolean => true
): Crumb[] => {
	let result: Crumb[] = [];
	if (node.parent) {
		result = buildCrumbsRecursive(node.parent, clickHandler, t);
	}

	let handlerFunction;
	if (clickHandler && node && nodeClickCondition(node)) {
		handlerFunction = (): void => clickHandler(node.id);
	}
	if (node.name) {
		result.push({
			id: node.id,
			// be careful: the following key is not parsed by i18next-extract purposely
			/* i18next-extract-disable-next-line */
			label: (t && t('node.alias.name', node.name, { context: node.id })) || node.name,
			click: handlerFunction
		});
	}
	return result;
};

/**
 * Build the crumbs for a node formatted as required by @zextras/carbonio-design-system Breadcrumb.
 * @param nodes - each node should contain properties id, name and parent (optional, not considered if nodes is an array)
 * @param clickHandler - callback that handles the click on the breadcrumb item. It receives the node id as a param
 * @param t - translation function
 * @param nodeClickCondition - validation click function
 */
export const buildCrumbs = (
	nodes: CrumbNode | Array<Maybe<Pick<Node, 'id' | 'name' | 'type'>> | undefined>,
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	clickHandler?: (id: string, ...args: any[]) => void,
	t?: TFunction,
	nodeClickCondition: (node: Pick<Node, 'id' | 'name' | 'type'>) => boolean = (): boolean => true
): Crumb[] => {
	if (nodes instanceof Array) {
		// the array can contain null if path is requested for a node with no accessible parent
		return chain(nodes)
			.filter((node) => !!node)
			.map((node) => {
				const $node = node as Node;
				return {
					id: $node.id,
					// be careful: the following key is not parsed by i18next-extract purposely
					/* i18next-extract-disable-next-line */
					label: (t && t('node.alias.name', $node.name, { context: $node.id })) || $node.name,
					click:
						node && clickHandler && nodeClickCondition(node)
							? (): void => clickHandler($node.id)
							: undefined
				};
			})
			.value();
	}

	return nodes ? buildCrumbsRecursive(nodes, clickHandler, t, nodeClickCondition) : [];
};

export const formatDate = (
	date?: Moment | Date | string | number,
	format?: string,
	zimbraPrefTimeZoneId?: string
): string => {
	if (!date) {
		return '';
	}
	// TODO manage locale
	let $format = format;
	if (!$format) {
		$format = 'DD/MM/YY';
	}
	if (zimbraPrefTimeZoneId) {
		return moment(date).tz(zimbraPrefTimeZoneId).format($format);
	}
	return moment(date).format($format);
};

export const formatTime = (
	date: Moment | Date | string | number,
	zimbraPrefTimeZoneId?: string
): string => {
	if (zimbraPrefTimeZoneId) {
		return moment(date).tz(zimbraPrefTimeZoneId).format('HH.mm A');
	}
	// TODO manage locale
	return moment(date).format('HH.mm A');
};

/**
 * Decode an Apollo Error in a string message
 */
export const decodeError = (error: ApolloError, t: TFunction): string | null => {
	if (error) {
		let errorMsg;
		if (error.graphQLErrors && size(error.graphQLErrors) > 0) {
			const err = first(error.graphQLErrors);
			if (err?.extensions?.errorCode) {
				return t('errorCode.code', 'Something went wrong', { context: err.extensions.errorCode });
			}
			if (err?.message) {
				errorMsg = err?.message;
			}
		}
		if (error.networkError && 'result' in error.networkError) {
			const netError = map(
				error.networkError.result,
				(err) => err.extensions?.code || err.message
			).join('\n');
			errorMsg = errorMsg ? errorMsg + netError : netError;
		}
		return errorMsg || (error.message ? error.message : '');
	}
	return null;
};

export const getChipLabel = (
	contact?: {
		firstName?: string;
		middleName?: string;
		lastName?: string;
		fullName?: string;
		// eslint-disable-next-line camelcase
		full_name?: string;
		email?: string;
		name?: string;
	} | null
): string => {
	if (!contact) {
		return '';
	}
	if (contact.firstName || contact.middleName || contact.lastName) {
		return trim(`${contact.firstName ?? ''} ${contact.middleName ?? ''} ${contact.lastName ?? ''}`);
	}
	return contact.full_name || contact.fullName || contact.email || contact.name || '';
};

/**
 * Utility to copy text to clipboard
 */
export const copyToClipboard = (text: string): Promise<void> => {
	if (!window.parent.navigator.clipboard) {
		const textArea = window.parent.document.createElement('textarea');
		window.parent.document.body.appendChild(textArea);
		textArea.value = text;
		textArea.select();
		const success = window.parent.document.execCommand('copy');
		window.parent.document.body.removeChild(textArea);
		return new Promise<void>((resolve, reject) => {
			success ? resolve() : reject();
		});
	}

	return window.parent.navigator.clipboard.writeText(text);
};

export const downloadNode = (id: string, version?: number): void => {
	if (id) {
		const url = `${REST_ENDPOINT}${DOWNLOAD_PATH}/${encodeURIComponent(id)}${
			version ? `/${version}` : ''
		}`;
		const a = document.createElement('a');
		if (a) {
			a.download = url;
			a.href = url;
			a.target = '_blank';
			a.type = 'hidden';
			a.click();
		}
	}
};

const docsTabMap: { [url: string]: Window } = {};

/**
 * Open with docs
 */
export const openNodeWithDocs = (id: string, version?: number): void => {
	if (id) {
		const url = `${DOCS_ENDPOINT}${OPEN_FILE_PATH}/${encodeURIComponent(id)}${
			version ? `/${version}` : ''
		}`;
		if (docsTabMap[url] == null || (docsTabMap[url] != null && docsTabMap[url].closed)) {
			docsTabMap[url] = window.open(url, url) as Window;
		} else {
			docsTabMap[url].focus();
		}
	}
};

export const inputElement = ((): HTMLInputElement => {
	const input = document.createElement('input');
	if (input) {
		input.type = 'file';
		input.multiple = true;
		input.hidden = true;
	}
	return input;
})();

export const scrollToNodeItem = debounce((nodeId: string, isLast = false) => {
	if (nodeId) {
		const element = window.document.getElementById(nodeId);
		if (element) {
			let options: ScrollIntoViewOptions = { block: 'center' };
			// if last element, leave it at the end of the screen to not trigger loadMore
			if (isLast) {
				options = { ...options, block: 'end' };
			}
			element.scrollIntoView(options);
		}
	}
}, 500);

export function propertyComparator<T extends SortableNode[keyof SortableNode]>(
	a: Maybe<SortableNode> | undefined,
	b: Maybe<SortableNode> | undefined,
	property: keyof SortableNode,
	{
		defaultIfNull,
		propertyModifier
	}: {
		defaultIfNull?: T;
		propertyModifier?: (p: T) => T;
	} = {}
): number {
	let propA = (a == null || a[property] == null ? defaultIfNull : (a[property] as T)) || null;
	let propB = (b == null || b[property] == null ? defaultIfNull : (b[property] as T)) || null;
	if (propA === propB) {
		return 0;
	}
	if (propA === null) {
		return -1;
	}
	if (propB === null) {
		return 1;
	}
	if (propertyModifier) {
		propA = propertyModifier(propA);
		propB = propertyModifier(propB);
		// check again equality after modifier
		if (propA === propB) {
			return 0;
		}
	}
	return propA < propB ? -1 : 1;
}

export function nodeSortComparator(
	a: Maybe<SortableNode> | undefined,
	b: Maybe<SortableNode> | undefined,
	sortsList: NodeSort[]
): number {
	let sortIndex = 0;
	let comparatorResult = 0;
	while (comparatorResult === 0 && sortIndex < sortsList.length) {
		switch (sortsList[sortIndex]) {
			case NodeSort.NameAsc:
				comparatorResult = propertyComparator<string>(a, b, 'name', { propertyModifier: toLower });
				break;
			case NodeSort.NameDesc:
				comparatorResult = propertyComparator<string>(b, a, 'name', { propertyModifier: toLower });
				break;
			case NodeSort.TypeAsc:
				if ((!a || !a.type) && (!b || !b.type)) {
					comparatorResult = 0;
				} else if (!a || !a.type) {
					comparatorResult = -1;
				} else if (!b || !b.type) {
					comparatorResult = 1;
				} else if (a.type === NodeType.Folder && b.type !== NodeType.Folder) {
					comparatorResult = -1;
				} else if (a.type !== NodeType.Folder && b.type === NodeType.Folder) {
					comparatorResult = 1;
				} else {
					comparatorResult = 0;
				}
				break;
			case NodeSort.TypeDesc:
				if ((!a || !a.type) && (!b || !b.type)) {
					comparatorResult = 0;
				} else if (!a || !a.type) {
					comparatorResult = 1;
				} else if (!b || !b.type) {
					comparatorResult = -1;
				} else if (a.type === NodeType.Folder && b.type !== NodeType.Folder) {
					comparatorResult = 1;
				} else if (a.type !== NodeType.Folder && b.type === NodeType.Folder) {
					comparatorResult = -1;
				} else {
					comparatorResult = 0;
				}
				break;
			case NodeSort.UpdatedAtAsc:
				comparatorResult = propertyComparator<number>(a, b, 'updated_at');
				break;
			case NodeSort.UpdatedAtDesc:
				comparatorResult = propertyComparator<number>(b, a, 'updated_at');
				break;
			case NodeSort.SizeAsc:
				comparatorResult = propertyComparator<number>(a, b, 'size', { defaultIfNull: 0 });
				break;
			case NodeSort.SizeDesc:
				comparatorResult = propertyComparator<number>(b, a, 'size', { defaultIfNull: 0 });
				break;
			default:
				comparatorResult = propertyComparator<string>(a, b, 'name', { propertyModifier: toLower });
				break;
		}
		sortIndex += 1;
	}
	return comparatorResult;
}

export function addNodeInSortedList(
	nodes: Array<Maybe<SortableNode> | undefined>,
	node: Maybe<SortableNode>,
	sort: NodeSort
): number {
	const sortsList =
		sort === NodeSort.SizeAsc || sort === NodeSort.SizeDesc ? [sort] : [NodeSort.TypeAsc, sort];
	return findIndex(nodes, (listNode) => nodeSortComparator(node, listNode, sortsList) < 0);
}

export function isSearchView(location: Location): boolean {
	return location.pathname.includes('/search');
}

export function isTrashView(params: { filter?: string }): boolean {
	return params.filter === 'myTrash' || params.filter === 'sharedTrash';
}

export function isTrashedVisible(params: { filter?: string }, location: Location): boolean {
	const searchParams = searchParamsVar();
	return (
		isTrashView(params) ||
		(isSearchView(location) &&
			(!searchParams.folderId?.value || searchParams.folderId.value === ROOTS.TRASH))
	);
}

export function sharePermissionsGetter(role: Role, sharingAllowed: boolean): SharePermission {
	if (role === Role.Viewer && sharingAllowed) {
		return SharePermission.ReadAndShare;
	}
	if (role === Role.Viewer && !sharingAllowed) {
		return SharePermission.ReadOnly;
	}
	if (role === Role.Editor && sharingAllowed) {
		return SharePermission.ReadWriteAndShare;
	}
	if (role === Role.Editor && !sharingAllowed) {
		return SharePermission.ReadAndWrite;
	}
	throw new Error();
}

export function nodeSortGetter(order: OrderTrend, orderType: OrderType): NodeSort {
	if (order === OrderTrend.Ascending && orderType === OrderType.Name) {
		return NodeSort.NameAsc;
	}
	if (order === OrderTrend.Ascending && orderType === OrderType.UpdatedAt) {
		return NodeSort.UpdatedAtAsc;
	}
	if (order === OrderTrend.Ascending && orderType === OrderType.Size) {
		return NodeSort.SizeAsc;
	}
	if (order === OrderTrend.Descending && orderType === OrderType.Name) {
		return NodeSort.NameDesc;
	}
	if (order === OrderTrend.Descending && orderType === OrderType.UpdatedAt) {
		return NodeSort.UpdatedAtDesc;
	}
	if (order === OrderTrend.Descending && orderType === OrderType.Size) {
		return NodeSort.SizeDesc;
	}
	throw new Error();
}

export function getInverseOrder(order: OrderTrend): OrderTrend {
	if (order === OrderTrend.Ascending) {
		return OrderTrend.Descending;
	}
	return OrderTrend.Ascending;
}

export function hexToRGBA(hexColor: string, alpha = 1): string {
	let r = '0';
	let g = '0';
	let b = '0';

	// 3 digits
	if (hexColor.length === 4) {
		r = `0x${hexColor[1]}${hexColor[1]}`;
		g = `0x${hexColor[2]}${hexColor[2]}`;
		b = `0x${hexColor[3]}${hexColor[3]}`;
	} else if (hexColor.length === 7) {
		// 6 digits
		r = `0x${hexColor[1]}${hexColor[2]}`;
		g = `0x${hexColor[3]}${hexColor[4]}`;
		b = `0x${hexColor[5]}${hexColor[6]}`;
	} else {
		return hexColor;
	}

	return `rgba(${+r},${+g},${+b},${+alpha})`;
}

export const docsHandledMimeTypes = [
	'text/rtf',
	'text/plain',
	'application/msword',
	'application/rtf',
	'application/vnd.lotus-wordpro',
	'application/vnd.ms-excel',
	'application/vnd.ms-excel.sheet.binary.macroEnabled.12',
	'application/vnd.ms-excel.sheet.macroEnabled.12',
	'application/vnd.ms-excel.template.macroEnabled.12',
	'application/vnd.ms-powerpoint',
	'application/vnd.ms-powerpoint.presentation.macroEnabled.12',
	'application/vnd.ms-powerpoint.template.macroEnabled.12',
	'application/vnd.ms-word.document.macroEnabled.12',
	'application/vnd.ms-word.template.macroEnabled.12',
	'application/vnd.oasis.opendocument.presentation',
	'application/vnd.oasis.opendocument.presentation-flat-xml',
	'application/vnd.oasis.opendocument.spreadsheet',
	'application/vnd.oasis.opendocument.text',
	'application/vnd.oasis.opendocument.text-flat-xml',
	'application/vnd.oasis.opendocument.text-master',
	'application/vnd.oasis.opendocument.text-master-template',
	'application/vnd.oasis.opendocument.text-template',
	'application/vnd.oasis.opendocument.text-web',
	'application/vnd.openxmlformats-officedocument.presentationml.presentation',
	'application/vnd.openxmlformats-officedocument.presentationml.template',
	'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
	'application/vnd.openxmlformats-officedocument.spreadsheetml.template',
	'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
	'application/vnd.openxmlformats-officedocument.wordprocessingml.template',
	'application/vnd.sun.xml.calc',
	'application/vnd.sun.xml.calc.template',
	'application/vnd.sun.xml.impress',
	'application/vnd.sun.xml.impress.template',
	'application/vnd.sun.xml.writer',
	'application/vnd.sun.xml.writer.global',
	'application/vnd.sun.xml.writer.template'
];

/**
 * Get preview src
 */
export const getPreviewSrc = (
	id: string,
	version: number,
	weight: number,
	height: number,
	quality: 'lowest' | 'low' | 'medium' | 'high' | 'highest' // medium as default if not set
): string =>
	`${REST_ENDPOINT}${PREVIEW}/image/${id}/${version}/${weight}x${height}?quality=${quality}`;
