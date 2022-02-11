/*
 * SPDX-FileCopyrightText: 2022 Zextras <https://www.zextras.com>
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import React from 'react';

export function invokeWithin(
	firstFunction: (event: React.SyntheticEvent) => void,
	secondFunction: (event: React.SyntheticEvent) => void,
	executeSecondWithinMilliseconds: number
): (event: React.SyntheticEvent) => void {
	let timeoutID: number;
	let timeoutIDValid = false;

	return (event): void => {
		if (timeoutIDValid) {
			clearInterval(timeoutID);
			secondFunction(event);
			timeoutIDValid = false;
		} else {
			timeoutID = window.setTimeout(() => {
				timeoutIDValid = false;
				firstFunction(event);
			}, executeSecondWithinMilliseconds);
			timeoutIDValid = true;
		}
	};
}
