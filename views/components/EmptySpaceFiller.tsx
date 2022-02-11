/*
 * SPDX-FileCopyrightText: 2022 Zextras <https://www.zextras.com>
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import React from 'react';

import { Container } from '@zextras/carbonio-design-system';
import noop from 'lodash/noop';
import styled from 'styled-components';

import { ActionItem } from '../../utils/ActionsFactory';
import { ContextualMenu } from './ContextualMenu';

const FlexContainer = styled(Container)`
	flex-grow: ${({ flexGrow }): number => flexGrow || 1};
`;

interface EmptySpaceFillerProps {
	actions: Array<ActionItem>;
}

export const EmptySpaceFiller: React.FC<EmptySpaceFillerProps> = ({ actions, children }) => (
	<FlexContainer height="unset">
		<ContextualMenu actions={actions} onClose={noop} onOpen={noop} disableRestoreFocus>
			{children}
		</ContextualMenu>
	</FlexContainer>
);
