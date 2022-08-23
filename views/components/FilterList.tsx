/*
 * SPDX-FileCopyrightText: 2022 Zextras <https://www.zextras.com>
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import React, { useMemo } from 'react';

import filter from 'lodash/filter';
import { useTranslation } from 'react-i18next';

import { ROOTS } from '../../constants';
import { useFindNodesQuery } from '../../hooks/graphql/queries/useFindNodesQuery';
import { Crumb, NodeListItemType, SearchParams } from '../../types/common';
import { NonNullableListItem, Unwrap } from '../../types/utils';
import { List } from './List';

interface FilterListProps extends Omit<SearchParams, 'keywords'> {
	canUploadFile?: boolean;
}

const FilterList: React.VFC<FilterListProps> = ({
	flagged,
	sharedByMe,
	sharedWithMe,
	folderId,
	canUploadFile,
	cascade,
	directShare
}) => {
	const {
		data: findNodesResult,
		loading,
		hasMore,
		loadMore
	} = useFindNodesQuery({
		flagged,
		sharedByMe,
		sharedWithMe,
		folderId,
		cascade,
		directShare
	});

	const trashed = useMemo(() => folderId === ROOTS.TRASH, [folderId]);

	const [t] = useTranslation();

	const nodes = useMemo<NodeListItemType[]>(() => {
		if (findNodesResult?.findNodes?.nodes && findNodesResult.findNodes.nodes.length > 0) {
			const $nodes = findNodesResult.findNodes.nodes;
			return filter<Unwrap<typeof $nodes>, NonNullableListItem<typeof $nodes>>(
				$nodes,
				(node): node is NonNullableListItem<typeof $nodes> => !!node
			);
		}
		return [];
	}, [findNodesResult]);

	const crumbs = useMemo<Crumb[]>(() => {
		const _crumbs = [];
		if (flagged) {
			_crumbs.push({
				id: 'filterCrumbs',
				label: t('secondaryBar.filtersList.flagged', 'Flagged')
			});
		} else if (trashed) {
			_crumbs.push({
				id: 'trash',
				label: t('secondaryBar.filtersList.trash', 'Trash')
			});
			if (sharedWithMe) {
				_crumbs.push({
					id: 'trashSharedWithMe',
					label: t('secondaryBar.filtersList.sharedElements', 'Shared elements')
				});
			} else {
				_crumbs.push({
					id: 'trashSharedByMe',
					label: t('secondaryBar.filtersList.myElements', 'My Elements')
				});
			}
		} else if (sharedByMe) {
			_crumbs.push({
				id: 'sharedByMe',
				label: t('secondaryBar.filtersList.sharedByMe', 'Shared by me')
			});
		} else if (sharedWithMe) {
			_crumbs.push({
				id: 'sharedWithMe',
				label: t('secondaryBar.filtersList.sharedWithMe', 'Shared with me')
			});
		}
		return _crumbs;
	}, [flagged, trashed, sharedByMe, sharedWithMe, t]);

	const emptyListMessage = useMemo(() => {
		if (flagged) {
			return t('empty.filter.flagged', 'There are no flagged items.');
		}
		if (trashed) {
			return t('empty.filter.trash', 'The trash is empty.');
		}
		if (sharedByMe) {
			return t(
				'empty.filter.sharedByMe',
				"You haven't shared any item with your collaborators yet. "
			);
		}
		if (sharedWithMe) {
			return t('empty.filter.sharedWithMe', 'There are no items shared with you yet.');
		}
		return t('empty.filter.hint', "It looks like there's nothing here.");
	}, [flagged, sharedByMe, sharedWithMe, t, trashed]);

	return (
		<List
			nodes={nodes}
			loading={loading}
			hasMore={hasMore}
			loadMore={loadMore}
			crumbs={crumbs}
			canUpload={canUploadFile}
			mainList={false}
			emptyListMessage={emptyListMessage}
		/>
	);
};

export default FilterList;
