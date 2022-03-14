/*
 * SPDX-FileCopyrightText: 2022 Zextras <https://www.zextras.com>
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import React, { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';

import { Container, Row } from '@zextras/carbonio-design-system';
import isEmpty from 'lodash/isEmpty';
import reduce from 'lodash/reduce';
import { useTranslation } from 'react-i18next';
import styled from 'styled-components';

import { ROOTS } from '../../constants';
import { useFindNodesQuery } from '../../hooks/graphql/queries/useFindNodesQuery';
import { Crumb, NodeListItemType, RootListItemType } from '../../types/common';
import { NodeType } from '../../types/graphql/types';
import { MakeRequired } from '../../types/utils';
import { decodeError } from '../../utils/utils';
import { InteractiveBreadcrumbs } from '../InteractiveBreadcrumbs';
import { EmptyFolder } from './EmptyFolder';
import { ListContent } from './ListContent';
import { LoadingIcon } from './LoadingIcon';
import { ScrollContainer } from './ScrollContainer';

interface RootsListProps {
	activeNode?: string;
	setActiveNode: (node: NodeListItemType | RootListItemType, event: React.SyntheticEvent) => void;
	navigateTo: (id: string, event?: React.SyntheticEvent | Event) => void;
	showTrash?: boolean;
	checkDisabled: (node: NodeListItemType) => boolean;
}

const ModalContainer = styled(Container)`
	flex: 1 1 auto;
`;

export const ModalRootsList: React.VFC<RootsListProps> = ({
	activeNode,
	setActiveNode,
	navigateTo,
	showTrash = false,
	checkDisabled
}) => {
	const [t] = useTranslation();
	// const [filter, setFilter] = useState<string>();
	const [filterQueryParams, setFilterQueryParam] = useState<
		Pick<
			Parameters<typeof useFindNodesQuery>[0],
			'flagged' | 'sharedWithMe' | 'folderId' | 'cascade'
		>
	>({});
	const {
		data: findNodesData,
		loading,
		error,
		loadMore,
		hasMore
	} = useFindNodesQuery(filterQueryParams);

	const listRef = useRef<HTMLDivElement | null>(null);

	useLayoutEffect(() => {
		// scroll list container to top when folderId changes
		listRef.current && listRef.current.scrollTo(0, 0);
	}, [filterQueryParams]);

	const crumbs = useMemo<Crumb[]>(() => {
		const $crumbs: Crumb[] = [];
		$crumbs.push({
			id: ROOTS.ENTRY_POINT,
			label: t('modal.roots.rootsList', 'Files'),
			click: (event: React.SyntheticEvent) => {
				setFilterQueryParam({});
				navigateTo('', event);
			}
		});
		if (!isEmpty(filterQueryParams)) {
			const { sharedWithMe } = filterQueryParams;
			if (sharedWithMe) {
				$crumbs.push({
					id: 'sharedWithMe',
					label: t('modal.roots.sharedWitMe', 'Shared with me'),
					click: (event: React.SyntheticEvent) => {
						setFilterQueryParam({ sharedWithMe: true, folderId: ROOTS.LOCAL_ROOT, cascade: false });
						setActiveNode(
							{
								__typename: 'Root',
								id: ROOTS.SHARED_WITH_ME,
								name: t('modal.roots.sharedWitMe', 'Shared with me')
							},
							event
						);
					}
				});
			}
		}
		// remove click action from last crumb
		if ($crumbs.length > 0) {
			delete $crumbs[$crumbs.length - 1].click;
		}
		return $crumbs;
	}, [filterQueryParams, navigateTo, setActiveNode, t]);

	const nodes = useMemo(() => {
		if (!isEmpty(filterQueryParams) && findNodesData?.findNodes) {
			return reduce(
				findNodesData?.findNodes.nodes,
				(result: NodeListItemType[], node) => {
					if (node) {
						result.push({
							...node,
							disabled: checkDisabled(node)
						});
					}
					return result;
				},
				[]
			);
		}
		return undefined;
	}, [checkDisabled, filterQueryParams, findNodesData]);

	const rootNodes = useMemo<NodeListItemType[]>(() => {
		const roots: Array<MakeRequired<NodeListItemType, 'id' | 'name' | 'type'>> = [];
		roots.push(
			{
				id: ROOTS.LOCAL_ROOT,
				name: t('modal.roots.filesHome', 'Home'),
				type: NodeType.Root,
				__typename: 'Folder' // trick to make local root a valid destination
			},
			{
				id: ROOTS.SHARED_WITH_ME,
				name: t('modal.roots.sharedWitMe', 'Shared with me'),
				type: NodeType.Root
			}
		);
		if (showTrash) {
			roots.push({
				id: ROOTS.TRASH,
				name: t('modal.roots.trash.trash', 'Trash'),
				type: NodeType.Root
			});
		}
		return roots as NodeListItemType[];
	}, [showTrash, t]);

	const rootNavigationHandler = useCallback<typeof navigateTo>(
		(id, event) => {
			switch (id) {
				case ROOTS.LOCAL_ROOT:
					setFilterQueryParam({});
					navigateTo(id, event);
					break;
				case ROOTS.SHARED_WITH_ME:
					setFilterQueryParam({ sharedWithMe: true, folderId: ROOTS.LOCAL_ROOT, cascade: false });
					break;
				default:
					break;
			}
		},
		[navigateTo]
	);

	// const filterChangeHandler = useCallback(
	// 	({ target: { value } }: React.ChangeEvent<HTMLInputElement>) => {
	// 		setFilter(value);
	// 	},
	// 	[]
	// );

	const stopPropagationClickHandler = (event: React.MouseEvent): void => {
		event.stopPropagation();
	};

	return (
		<ModalContainer
			mainAlignment="flex-start"
			crossAlignment="flex-start"
			data-testid="modal-list-roots"
			maxHeight="100%"
			minHeight={0}
		>
			<Row
				width="fill"
				wrap="nowrap"
				height={48}
				onClick={stopPropagationClickHandler}
				mainAlignment="flex-start"
				flexShrink={0}
			>
				{crumbs && <InteractiveBreadcrumbs crumbs={crumbs} />}
				{loading && (
					<Row mainAlignment="flex-end" wrap="nowrap" flexGrow={1}>
						<LoadingIcon icon="Refresh" color="primary" />
					</Row>
				)}
			</Row>
			{/*
			// TODO uncomment when filter inside modal is implemented
			<Input
				label={t('node.move.modal.input.filter', 'Filter folders')}
				backgroundColor="gray5"
				value={filter}
				onChange={filterChangeHandler}
				onClick={stopPropagationClickHandler}
			/> */}
			{error && <p>Error: {decodeError(error, t)}</p>}
			<Container mainAlignment="flex-start" minHeight="0" height="40vh">
				{nodes &&
					(nodes.length > 0 ? (
						<ListContent
							nodes={nodes}
							activeNode={activeNode}
							setActiveNode={setActiveNode}
							compact
							navigateTo={navigateTo}
							loading={loading}
							hasMore={hasMore}
							loadMore={loadMore}
							ref={listRef}
						/>
					) : (
						!loading && (
							<ScrollContainer>
								<EmptyFolder
									message={t('empty.filter.hint', "It looks like there's nothing here.")}
								/>
							</ScrollContainer>
						)
					))}
				{!loading &&
					!nodes &&
					rootNodes &&
					(rootNodes.length > 0 ? (
						<ListContent
							nodes={rootNodes}
							compact
							navigateTo={rootNavigationHandler}
							activeNode={activeNode}
							setActiveNode={setActiveNode}
							ref={listRef}
						/>
					) : (
						<ScrollContainer>
							<EmptyFolder
								message={t('empty.filter.hint', "It looks like there's nothing here.")}
							/>
						</ScrollContainer>
					))}
			</Container>
		</ModalContainer>
	);
};
