/*
 * SPDX-FileCopyrightText: 2022 Zextras <https://www.zextras.com>
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import React, { PropsWithRef, useMemo } from 'react';

import { Dropdown, getColor, Text } from '@zextras/carbonio-design-system';
import map from 'lodash/map';
import styled from 'styled-components';

import { Breadcrumbs } from '../design_system_fork/Breadcrumbs';
import { Crumb } from '../types/common';

const CustomBreadcrumbs = styled(Breadcrumbs)`
	.breadcrumbCrumb {
		border-radius: 2px;
		cursor: pointer;
		&:hover {
			background-color: ${getColor('gray5.hover')};
		}
		&.currentCrumb {
			cursor: default;
			&:hover {
				background-color: inherit;
			}
		}
	}

	.breadcrumbCollapser {
		border-radius: 2px;
		&:active,
		&.active {
			background-color: ${getColor('gray4.active')};
		}
		&:hover {
			background-color: ${getColor('gray4.hover')};
		}
	}
`;

// TODO: replace with DS types
interface InteractiveBreadcrumbs {
	crumbs: Array<Crumb & Partial<typeof Text>>;
	collapserProps?: Partial<PropsWithRef<HTMLElement>>;
	dropdownProps?: Partial<PropsWithRef<typeof Dropdown>>;
}

export const InteractiveBreadcrumbs: React.VFC<InteractiveBreadcrumbs> = ({ crumbs, ...props }) => {
	const interactiveCrumbs = useMemo(
		() =>
			map(crumbs, (crumb) => ({
				...crumb,
				className: `${crumb.className ? crumb.className : ''} breadcrumbCrumb ${
					!crumb.click ? 'currentCrumb' : ''
				}`
			})),
		[crumbs]
	);
	return <CustomBreadcrumbs crumbs={interactiveCrumbs} {...props} />;
};
