/*
 * SPDX-FileCopyrightText: 2022 Zextras <https://www.zextras.com>
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Container } from '@zextras/carbonio-design-system';
import reduce from 'lodash/reduce';
import styled, { css, FlattenSimpleInterpolation } from 'styled-components';

export const GridItem = styled(Container)<{
	columnStart: number;
	columnEnd: number;
	rowStart: number;
	rowEnd: number;
}>`
	grid-column-start: ${({ columnStart }): number => columnStart};
	grid-column-end: ${({ columnEnd }): number => columnEnd};
	grid-row-start: ${({ rowStart }): number => rowStart};
	grid-row-end: ${({ rowEnd }): number => rowEnd};
`;

export const GridContainer = styled.div<{ sectionsRows: Array<number> }>`
	display: grid;
	row-gap: 8px;
	justify-items: start;
	width: 100%;
	grid-template-columns: minmax(0, auto) auto minmax(0, auto) minmax(0, auto) 96px;
	${({ sectionsRows }): FlattenSimpleInterpolation => css`
		grid-template-rows: ${reduce(
			sectionsRows,
			(acc, value) => {
				if (value > 0) {
					return `${acc} 21px repeat(${value}, 42px)`;
				}
				return acc;
			},
			''
		)};
	`}
`;
