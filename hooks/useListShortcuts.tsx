/*
 * SPDX-FileCopyrightText: 2022 Zextras <https://www.zextras.com>
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */
import React, { useCallback, useEffect } from 'react';

import find from 'lodash/find';

export const useListShortcuts = (listRef: React.RefObject<HTMLElement>): void => {
	const getFocusableElement = useCallback(
		(
			focusedElement: HTMLElement,
			direction: 'previousElementSibling' | 'nextElementSibling'
		): HTMLElement | null => {
			const siblingElement = focusedElement[direction] as HTMLElement | null;
			if (!siblingElement) {
				return null;
			}
			if (siblingElement.tabIndex >= 0) {
				return focusedElement[direction] as HTMLElement;
			}
			const innerFocusable = siblingElement.querySelector('[tabindex]');
			if (innerFocusable) {
				return innerFocusable as HTMLElement;
			}
			return getFocusableElement(siblingElement, direction);
		},
		[]
	);

	const handleArrowUp = useCallback(() => {
		const listElement = listRef.current;
		if (listElement) {
			const focusedElement = document.activeElement as HTMLElement | null;
			const childWithFocus =
				focusedElement &&
				(find(listElement.children, (child) => child.contains(focusedElement)) as
					| HTMLElement
					| undefined);

			if (childWithFocus) {
				const prevEl = getFocusableElement(childWithFocus, 'previousElementSibling');
				if (prevEl) {
					prevEl.focus();
				} else {
					const listFocusableChildren = listElement.querySelectorAll<HTMLElement>('[tabindex]');
					listFocusableChildren &&
						listFocusableChildren.length > 0 &&
						listFocusableChildren[listFocusableChildren.length - 1].focus();
				}
			} else {
				const listFocusableChildren = listElement.querySelectorAll<HTMLElement>('[tabindex]');
				listFocusableChildren &&
					listFocusableChildren.length > 0 &&
					listFocusableChildren[0].focus();
			}
		}
	}, [getFocusableElement, listRef]);

	const handleArrowDown = useCallback(() => {
		const listElement = listRef.current;
		if (listElement) {
			const focusedElement = document.activeElement as HTMLElement | null;
			const childWithFocus =
				focusedElement &&
				(find(listElement.children, (child) => child.contains(focusedElement)) as
					| HTMLElement
					| undefined);
			if (childWithFocus) {
				const nextEl = getFocusableElement(childWithFocus, 'nextElementSibling');
				if (nextEl) {
					nextEl.focus();
				} else {
					const listFocusableChildren = listElement.querySelectorAll<HTMLElement>('[tabindex]');
					listFocusableChildren &&
						listFocusableChildren.length > 0 &&
						listFocusableChildren[0].focus();
				}
			} else {
				const listFocusableChildren = listElement.querySelectorAll<HTMLElement>('[tabindex]');
				listFocusableChildren &&
					listFocusableChildren.length > 0 &&
					listFocusableChildren[0].focus();
			}
		}
	}, [getFocusableElement, listRef]);

	const handleKeyboard = useCallback(
		(e: KeyboardEvent) => {
			if (e.key === 'ArrowUp') {
				return handleArrowUp();
			}
			if (e.key === 'ArrowDown') {
				return handleArrowDown();
			}
			return null;
		},
		[handleArrowDown, handleArrowUp]
	);

	useEffect(() => {
		const listElement = listRef.current;

		if (listElement) {
			listElement.addEventListener('keydown', handleKeyboard);
		}

		return (): void => {
			if (listElement) {
				listElement.removeEventListener('keydown', handleKeyboard);
			}
		};
	}, [handleKeyboard, listRef]);
};
