/*
 * SPDX-FileCopyrightText: 2022 Zextras <https://www.zextras.com>
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import React from 'react';

import animatedLoader from '../../../assets/images/animated-loader.svg';

export const AnimatedLoader: React.VFC = (props) => (
	<object type="image/svg+xml" data={animatedLoader} {...props}>
		animated-loader
	</object>
);
