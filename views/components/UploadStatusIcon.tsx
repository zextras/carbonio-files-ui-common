/*
 * SPDX-FileCopyrightText: 2022 Zextras <https://www.zextras.com>
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */
import React from 'react';

import { Icon } from '@zextras/carbonio-design-system';

import { UploadStatus } from '../../types/common';

interface UploadStatusProps {
	status: UploadStatus;
}

export const UploadStatusIcon = ({ status }: UploadStatusProps): JSX.Element => {
	const icon =
		(status === UploadStatus.COMPLETED && 'CheckmarkCircle2') ||
		(status === UploadStatus.LOADING && 'AnimatedLoader') ||
		(status === UploadStatus.FAILED && 'AlertCircle') ||
		'AnimatedLoader';

	const color =
		(status === UploadStatus.COMPLETED && 'success') ||
		(status === UploadStatus.FAILED && 'error') ||
		undefined;

	return <Icon icon={icon} color={color} />;
};
