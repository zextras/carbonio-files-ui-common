/*
 * SPDX-FileCopyrightText: 2022 Zextras <https://www.zextras.com>
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */
import React, { useMemo } from 'react';

import { Avatar as MuiAvatar, AvatarProps as MuiAvatarProps, Theme, useTheme } from '@mui/material';

const _SPECIAL_CHARS_REGEX = /[&/\\#,+()$~%.'":*?!<>{}@^_`=]/g;
const _WHITESPACE_REGEX = /\s*/g;

function calcCapitals(label: string): string | null {
	const noSpecString = label.replace(_SPECIAL_CHARS_REGEX, '');
	if (noSpecString.replace(_WHITESPACE_REGEX, '').length !== 0) {
		// eslint-disable-next-line no-param-reassign
		label = noSpecString;
	} else {
		return null;
	}

	if (label.length <= 2) {
		return label;
	}
	if (_WHITESPACE_REGEX.test(label)) {
		let words = label.split(' ');
		words = words.filter((word) => word !== '');

		if (words.length < 2) {
			return words[0][0] + words[0][words[0].length - 1];
		}

		return words[0][0] + words[words.length - 1][0];
	}
	return label[0] + label[label.length - 1];
}

function calcColor(label: string): keyof Theme['avatarColors'] {
	let sum = 0;
	for (let i = 0; i < label.length; i += 1) {
		sum += label.charCodeAt(i);
	}
	return `avatar_${(sum % 50) + 1}`;
}

export const Avatar = React.forwardRef<HTMLDivElement, MuiAvatarProps>(function AvatarFn(
	{ children, ...rest },
	ref
) {
	const theme = useTheme();

	const calcProps = useMemo<Partial<MuiAvatarProps>>(
		() =>
			(typeof children === 'string' && {
				sx: { bgcolor: theme.palette[calcColor(children)].main },
				children: calcCapitals(children)
			}) || { children },
		[children, theme.palette]
	);

	return <MuiAvatar {...calcProps} {...rest} ref={ref} />;
});
