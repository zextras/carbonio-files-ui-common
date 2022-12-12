/*
 * SPDX-FileCopyrightText: 2022 Zextras <https://www.zextras.com>
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */
import find from 'lodash/find';
import pull from 'lodash/pull';

import { uploadVar } from '../apollo/uploadVar';
import { singleRetry } from './uploadUtils';

export function canBeProcessed(id: string): boolean {
	return uploadVar()[id].parentNodeId !== null;
}
/**
 * UploadQueue Singleton
 */
export const UploadQueue = ((): {
	LIMIT: number;
	start: (id: string) => void;
	startAll: () => void;
	add: (...ids: string[]) => void;
	removeAndStartNext: (...ids: string[]) => string[];
} => {
	const LIMIT = 3;

	const waitingList: string[] = [];

	const loadingList: string[] = [];

	function getFirstReadyWaitingItemId(): string | undefined {
		return find(waitingList, (id) => canBeProcessed(id));
	}

	function canLoadMore(): boolean {
		return loadingList.length < LIMIT && waitingList.length > 0;
	}

	function start(id: string): void {
		pull(waitingList, id);
		loadingList.push(id);
		singleRetry(id);
	}

	function startAll(): void {
		while (canLoadMore() && getFirstReadyWaitingItemId()) {
			const itemId = getFirstReadyWaitingItemId();
			if (itemId) {
				start(itemId);
			}
		}
	}

	function add(...ids: string[]): void {
		waitingList.push(...ids);
	}

	function removeAndStartNext(...ids: string[]): string[] {
		const loadingIds = pull(loadingList, ...ids);
		const waitingIds = pull(waitingList, ...ids);
		startAll();
		return [...loadingIds, ...waitingIds];
	}

	return {
		LIMIT,
		start,
		startAll,
		add,
		removeAndStartNext
	};
})();
