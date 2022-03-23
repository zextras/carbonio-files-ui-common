/*
 * SPDX-FileCopyrightText: 2022 Zextras <https://www.zextras.com>
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import React from 'react';

import { Container } from '@zextras/carbonio-design-system';
import noop from 'lodash/noop';

import { ActionItem } from '../../utils/ActionsFactory';
import { ContextualMenu } from './ContextualMenu';

interface EmptySpaceFillerProps {
	actions: Array<ActionItem>;
}

export const EmptySpaceFiller: React.VFC<EmptySpaceFillerProps> = ({ actions }) => (
	<Container height="unset" flexGrow={1}>
		<ContextualMenu actions={actions} onClose={noop} onOpen={noop} disableRestoreFocus>
			<></>
		</ContextualMenu>
	</Container>
);
