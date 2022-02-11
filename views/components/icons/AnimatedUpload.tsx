/*
 * SPDX-FileCopyrightText: 2022 Zextras <https://www.zextras.com>
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import React from 'react';

import animatedUpload from '../../../assets/images/animated-upload.svg';

export const AnimatedUpload: React.VFC = (props) => (
	<object type="image/svg+xml" data={animatedUpload} {...props}>
		animated-loader
	</object>
);
