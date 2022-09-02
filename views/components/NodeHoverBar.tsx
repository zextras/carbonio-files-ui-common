/*
 * SPDX-FileCopyrightText: 2022 Zextras <https://www.zextras.com>
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

/* eslint-disable arrow-body-style */

import React, { useCallback } from 'react';

import { IconButton, Tooltip } from '@zextras/carbonio-design-system';
import map from 'lodash/map';
import styled from 'styled-components';

const ActionIconButton = styled(IconButton)`
	margin-top: ${({ theme }): string => theme.sizes.padding.small};
	margin-right: ${({ theme }): string => theme.sizes.padding.small};
	& svg {
		margin: 0;
	}
`;

import { ActionItem } from '../../utils/ActionsFactory';

interface NodeHoverBarProps {
	actions?: ActionItem[];
}

export const NodeHoverBar: React.VFC<NodeHoverBarProps> = ({ actions }) => {
	const clickHandler = useCallback<
		(clickCallback: ActionItem['click']) => (event: React.MouseEvent | KeyboardEvent) => void
	>(
		(clickCallback) =>
			(event): void => {
				event.stopPropagation();
				clickCallback && clickCallback(event);
			},
		[]
	);

	return actions && actions.length > 0 ? (
		<>
			{map(actions, (action) => {
				return (
					<Tooltip key={action.id} label={action.label}>
						<ActionIconButton
							icon={action.icon}
							onClick={clickHandler(action.click)}
							key={action.id}
							disabled={action.disabled}
							size="small"
						/>
					</Tooltip>
				);
			})}
		</>
	) : (
		<></>
	);
};
