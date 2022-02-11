/*
 * SPDX-FileCopyrightText: 2022 Zextras <https://www.zextras.com>
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { useEffect, useMemo } from 'react';

import forEach from 'lodash/forEach';
import map from 'lodash/map';

function getFocusableElement(focusedElement, direction) {
	if (!focusedElement[direction]) {
		return null;
	}
	if (focusedElement[direction].tabIndex >= 0) {
		return focusedElement[direction];
	}
	return getFocusableElement(focusedElement[direction], direction);
}

export function getKeyboardPreset(type, callback, ref = undefined) {
	function handleArrowUp() {
		const focusedElement = ref.current.querySelector('[tabindex]:focus');
		if (focusedElement) {
			const prevEl = getFocusableElement(focusedElement, 'previousElementSibling');
			if (prevEl) {
				prevEl.focus();
			} else {
				ref.current.querySelector('[tabindex]:last-child').focus();
			}
		} else {
			ref.current.querySelector('[tabindex]:first-child').focus();
		}
	}
	function handleArrowDown() {
		const focusedElement = ref.current.querySelector('[tabindex]:focus');
		if (focusedElement) {
			const nextEl = getFocusableElement(focusedElement, 'nextElementSibling');
			if (nextEl) {
				nextEl.focus();
			} else {
				ref.current.querySelector('[tabindex]:first-child').focus();
			}
		} else {
			ref.current.querySelector('[tabindex]:first-child').focus();
		}
	}

	const eventsArray = [];
	switch (type) {
		case 'listItem': {
			eventsArray.push({ type: 'keypress', callback, keys: ['Enter', 'NumpadEnter'] });
			break;
		}
		case 'button': {
			eventsArray.push({ type: 'keyup', callback, keys: ['Space'] });
			eventsArray.push({ type: 'keypress', callback: (e) => e.preventDefault(), keys: ['Space'] });
			eventsArray.push({ type: 'keypress', callback, keys: ['Enter', 'NumpadEnter'] });
			break;
		}
		case 'list': {
			eventsArray.push({ type: 'keydown', callback: handleArrowUp, keys: ['ArrowUp'] });
			eventsArray.push({ type: 'keydown', callback: handleArrowDown, keys: ['ArrowDown'] });
			break;
		}
		case 'chipInput': {
			eventsArray.push({ type: 'keyup', callback, keys: ['Space'] });
			eventsArray.push({ type: 'keypress', callback: (e) => e.preventDefault(), keys: ['Space'] });
			eventsArray.push({ type: 'keypress', callback, keys: ['Enter', 'NumpadEnter', 'Comma'] });
			break;
		}
		default: {
			break;
		}
	}
	return eventsArray;
}

export function useKeyboard(ref, events) {
	const keyEvents = useMemo(
		() =>
			map(events, ({ keys, callback, haveToPreventDefault = true }) => (e) => {
				if (!keys.length || keys.includes(e.key) || keys.includes(e.code)) {
					if (haveToPreventDefault) {
						e.preventDefault();
					}
					callback(e);
				}
			}),
		[events]
	);

	useEffect(() => {
		if (ref.current) {
			forEach(keyEvents, (keyEvent, index) => {
				ref.current.addEventListener(events[index].type, keyEvent);
			});
		}
		const refSave = ref.current;
		return () => {
			if (refSave) {
				forEach(keyEvents, (keyEvent, index) => {
					refSave.removeEventListener(events[index].type, keyEvent);
				});
			}
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [events, keyEvents, ref.current]);
}
