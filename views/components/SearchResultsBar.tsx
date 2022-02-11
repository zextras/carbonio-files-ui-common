/*
 * SPDX-FileCopyrightText: 2022 Zextras <https://www.zextras.com>
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import React, { useMemo } from 'react';

import { Chip, Divider, Padding, Row, Text } from '@zextras/carbonio-design-system';
import flatMap from 'lodash/flatMap';
import isArray from 'lodash/isArray';
import { useTranslation } from 'react-i18next';

import { useSearch } from '../../../hooks/useSearch';
import { ChipProps } from '../../types/common';

function buildFilterChip(
	filter: ChipProps | ChipProps[] | undefined,
	key: string
): JSX.Element | JSX.Element[] {
	if (!isArray(filter) && filter?.label) {
		return (
			<Padding key={key} all="extrasmall">
				<Chip {...filter} background="gray2" onClick={undefined} />
			</Padding>
		);
	}
	return flatMap(filter, (filterValue, index) => buildFilterChip(filterValue, `${key}-${index}`));
}

export const SearchResultsBar: React.VFC = () => {
	const [t] = useTranslation();
	const { searchParams } = useSearch();

	const filterItems = useMemo(
		() => flatMap(searchParams, (filter, key) => buildFilterChip(filter, key)),
		[searchParams]
	);

	return (
		<>
			<Row
				width="fill"
				mainAlignment="flex-start"
				background="gray5"
				height="fit"
				minHeight="48px"
				padding={{ horizontal: 'large', vertical: 'medium' }}
			>
				<Text color="secondary">{t('search.resultsFor', 'Results for:')}</Text>
				{filterItems}
			</Row>
			<Divider color="gray3" />
		</>
	);
};
