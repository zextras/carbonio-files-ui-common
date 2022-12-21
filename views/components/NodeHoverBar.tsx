/*
 * SPDX-FileCopyrightText: 2022 Zextras <https://www.zextras.com>
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import React, { useMemo } from 'react';

import { Action as DSAction, CollapsingActions, Padding } from '@zextras/carbonio-design-system';
import map from 'lodash/map';

interface NodeHoverBarProps {
	actions?: DSAction[];
}

export const NodeHoverBar = ({ actions }: NodeHoverBarProps): JSX.Element => {
	const actionsMapped = useMemo(
		() =>
			map(actions, (action) => ({
				...action,
				onClick: (event: Parameters<DSAction['onClick']>[0]): ReturnType<DSAction['onClick']> => {
					event.stopPropagation();
					action.onClick(event);
				}
			})),
		[actions]
	);

	return (
		<Padding top={'0.5rem'} right={'0.5rem'}>
			<CollapsingActions actions={actionsMapped} color={'text'} size={'small'} gap={'0.5rem'} />
		</Padding>
	);
};
