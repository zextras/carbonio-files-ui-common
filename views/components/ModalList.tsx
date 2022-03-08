/*
 * SPDX-FileCopyrightText: 2022 Zextras <https://www.zextras.com>
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import React, { useLayoutEffect, useMemo, useRef } from 'react';

import { ApolloError, useQuery } from '@apollo/client';
import { Container, Row } from '@zextras/carbonio-design-system';
import takeRightWhile from 'lodash/takeRightWhile';
import { useTranslation } from 'react-i18next';
import styled from 'styled-components';

import { ROOTS } from '../../constants';
import { Breadcrumbs } from '../../design_system_fork/Breadcrumbs';
import GET_PATH from '../../graphql/queries/getPath.graphql';
import { NodeListItemType } from '../../types/common';
import { GetPathQuery, GetPathQueryVariables, Node } from '../../types/graphql/types';
import { canBeWriteNodeDestination } from '../../utils/ActionsFactory';
import { buildCrumbs, decodeError } from '../../utils/utils';
import { EmptyFolder } from './EmptyFolder';
import { ListContent } from './ListContent';
import { LoadingIcon } from './LoadingIcon';
import { ScrollContainer } from './StyledComponents';

interface ModalListProps {
	folderId: string;
	nodes: Array<NodeListItemType>;
	activeNode?: string;
	setActiveNode: (
		node: Pick<NodeListItemType, 'id' | 'name' | '__typename' | 'disabled'>,
		event: React.SyntheticEvent
	) => void;
	loadMore: () => void;
	hasMore: boolean;
	navigateTo: (id: string, event?: React.SyntheticEvent) => void;
	error?: ApolloError;
	loading: boolean;
	writingFile?: boolean;
	writingFolder?: boolean;
	limitNavigation?: boolean;
	allowRootNavigation?: boolean;
}

const ModalContainer = styled(Container)`
	flex: 1 1 auto;
`;

export const ModalList: React.VFC<ModalListProps> = ({
	folderId,
	nodes,
	activeNode,
	setActiveNode,
	loadMore,
	hasMore,
	navigateTo,
	error,
	loading,
	writingFile = false,
	writingFolder = false,
	limitNavigation = false,
	allowRootNavigation = false
}) => {
	const [t] = useTranslation();
	const listRef = useRef<HTMLDivElement | null>(null);

	useLayoutEffect(() => {
		// scroll list container to top when folderId changes
		listRef.current && listRef.current.scrollTo(0, 0);
	}, [folderId]);

	// const [filter, setFilter] = useState<string>();

	// use a useQuery to load full path only when required so that operations like move that cleanup cache trigger a refetch
	const { data: pathData, loading: loadingPath } = useQuery<GetPathQuery, GetPathQueryVariables>(
		GET_PATH,
		{
			variables: {
				node_id: folderId
			},
			skip: !folderId,
			onError(err) {
				console.error(err);
			}
		}
	);

	// for shared with me nodes, build the breadcrumb from the leave to the highest ancestor that has right permissions.
	// to be valid an ancestor must have can_write_file if moving files, can_write_folder if moving folders,
	// can_write_file and can_write_folder if moving both files and folders
	const crumbs = useMemo(() => {
		const $crumbs = [];
		if (allowRootNavigation) {
			$crumbs.push({
				id: ROOTS.ENTRY_POINT,
				label: t('modal.roots.rootsList', 'Files'),
				click: (event: React.MouseEvent) => {
					navigateTo('', event);
				}
			});
		}
		const validParents = limitNavigation
			? takeRightWhile(
					pathData?.getPath,
					(parent: Pick<Node, 'id' | 'name' | 'permissions' | 'type'> | undefined | null) =>
						parent && canBeWriteNodeDestination(parent, writingFile, writingFolder)
			  )
			: pathData?.getPath;
		if (validParents) {
			$crumbs.push(...buildCrumbs(validParents, navigateTo, t));
		}
		return $crumbs;
	}, [
		allowRootNavigation,
		limitNavigation,
		pathData?.getPath,
		navigateTo,
		t,
		writingFile,
		writingFolder
	]);

	/*
	// TODO uncomment when filter inside modal is implemented
	const filterChangeHandler = useCallback(
		({ target: { value } }: React.ChangeEvent<HTMLInputElement>) => {
			setFilter(value);
		},
		[]
	); */

	const stopPropagationClickHandler = (event: React.MouseEvent): void => {
		event.stopPropagation();
	};

	return (
		<ModalContainer
			mainAlignment="flex-start"
			crossAlignment="flex-start"
			data-testid={`modal-list-${folderId}`}
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
				{crumbs && <Breadcrumbs crumbs={crumbs} />}
				{(loading || loadingPath) && (
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
			<Container mainAlignment="flex-start" minHeight="0">
				{nodes.length > 0 ? (
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
						<ScrollContainer mainAlignment="flex-start">
							<EmptyFolder
								message={t('empty.folder.hint', "It looks like there's nothing here.")}
							/>
						</ScrollContainer>
					)
				)}
			</Container>
		</ModalContainer>
	);
};
