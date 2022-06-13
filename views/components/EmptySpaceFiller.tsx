/*
 * SPDX-FileCopyrightText: 2022 Zextras <https://www.zextras.com>
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import React from 'react';

import noop from 'lodash/noop';

import { ActionItem } from '../../utils/ActionsFactory';
import { ContextualMenu } from './ContextualMenu';
import { FlexContainer } from './StyledComponents';

interface EmptySpaceFillerProps {
	actions: Array<ActionItem>;
}

export const EmptySpaceFiller: React.FC<EmptySpaceFillerProps> = ({ actions, children }) => (
	<FlexContainer height="unset" $flexGrow={1}>
		<ContextualMenu actions={actions} onClose={noop} onOpen={noop} disableRestoreFocus>
			{children}
		</ContextualMenu>
	</FlexContainer>
);
