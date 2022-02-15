/*
 * SPDX-FileCopyrightText: 2022 Zextras <https://www.zextras.com>
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { ApolloError, useQuery } from '@apollo/client';
import { Avatar, Container, Padding, Row, Text, Tooltip } from '@zextras/carbonio-design-system';
import reduce from 'lodash/reduce';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import styled from 'styled-components';

import { NodeDetailsUserRow } from '../../../components/NodeDetailsUserRow';
import { useActiveNode } from '../../../hooks/useActiveNode';
import { useInternalLink } from '../../../hooks/useInternalLink';
import { useNavigation } from '../../../hooks/useNavigation';
import { DISPLAYER_TABS, ROOTS } from '../../constants';
import GET_PATH from '../../graphql/queries/getPath.graphql';
import { useCreateSnackbar } from '../../hooks/useCreateSnackbar';
import useQueryParam from '../../hooks/useQueryParam';
import { HoverSwitchComponent } from '../../HoverSwitchComponent';
import { Crumb, URLParams } from '../../types/common';
import {
	ChildFragment,
	DistributionList,
	GetPathQuery,
	GetPathQueryVariables,
	Maybe,
	Node,
	NodeType,
	Share,
	User
} from '../../types/graphql/types';
import { buildCrumbs, copyToClipboard, getChipLabel, humanFileSize } from '../../utils/utils';
import { InteractiveBreadcrumbs } from '../InteractiveBreadcrumbs';
import { EmptyFolder } from './EmptyFolder';
import { NodeDetailsDescription } from './NodeDetailsDescription';
import { NodeDetailsList } from './NodeDetailsList';
import { DisplayerContentContainer, RoundedButton } from './StyledComponents';

interface NodeDetailsProps {
	id: string;
	name: string;
	owner: Partial<User>;
	creator: Partial<User>;
	lastEditor?: Maybe<Partial<User>>;
	size?: number;
	createdAt: number;
	updatedAt: number;
	description: string;
	canUpsertDescription: boolean;
	downloads?: number;
	nodes?: Array<Maybe<ChildFragment> | undefined>;
	hasMore?: boolean;
	loadMore: () => void;
	loading: boolean;
	error?: ApolloError;
	shares: Array<
		| Maybe<
				Pick<Share, 'created_at'> & {
					// eslint-disable-next-line camelcase
					share_target?: Maybe<User | Partial<DistributionList>>;
				}
		  >
		| undefined
	>;
	type: NodeType;
	rootId?: string;
}

const MainContainer = styled(Container)`
	gap: ${({ theme }): string => theme.sizes.padding.medium};
`;

const Label: React.FC = ({ children }) => (
	<Padding bottom="small">
		<Text color="secondary" size="small">
			{children}
		</Text>
	</Padding>
);

const CustomAvatar = styled(Avatar)`
	margin-right: -4px;
	cursor: pointer;
`;

export const NodeDetails: React.VFC<NodeDetailsProps> = ({
	id,
	name,
	owner,
	creator,
	lastEditor,
	size,
	createdAt,
	updatedAt,
	description,
	canUpsertDescription,
	downloads,
	nodes,
	hasMore,
	loadMore,
	loading,
	shares,
	type,
	rootId
}) => {
	const [t] = useTranslation();
	const loadMoreRef = useRef<Element>();
	const loadMoreObserverRef = useRef<IntersectionObserver | null>(null);
	const scrollContainerRef = useRef<Element>();

	const { internalLink } = useInternalLink(id, type);

	useEffect(() => {
		// init the observer that let to load more items when scroll reaches bottom
		const options = {
			// root element is the scrollable container
			root: scrollContainerRef.current,
			// call action when entire element is visible
			threshold: 0.5
		};
		loadMoreObserverRef.current = new IntersectionObserver(async (entries) => {
			const entry = entries[0];
			if (entry.isIntersecting) {
				await loadMore();
			}
		}, options);

		return (): void => {
			// disconnect all observed element because current the observer is going to be recreated
			loadMoreObserverRef.current && loadMoreObserverRef.current.disconnect();
		};
	}, [loadMore]);

	useEffect(() => {
		// attach the observer to the element that is going to trigger the action
		if (hasMore) {
			if (loadMoreRef.current && loadMoreObserverRef.current) {
				loadMoreObserverRef.current.observe(loadMoreRef.current);
			}
		}

		return (): void => {
			loadMoreObserverRef.current && loadMoreObserverRef.current.disconnect();
		};
	}, [hasMore, loadMore]);

	const activeFolderId = useQueryParam('folder');
	const { rootId: activeRootId } = useParams<URLParams>();
	const { activeNodeId, setActiveNode } = useActiveNode();

	const openShareTab = useCallback(() => {
		if (activeNodeId) {
			setActiveNode(activeNodeId, DISPLAYER_TABS.sharing);
		}
	}, [activeNodeId, setActiveNode]);

	const collaborators = useMemo(() => {
		const collaboratorsToShow = 5;
		return reduce(
			shares,
			(avatars: JSX.Element[], share, index) => {
				// show first 5 collaborators avatar
				if (share?.share_target && index < collaboratorsToShow) {
					const label = getChipLabel(share.share_target);
					avatars.push(
						<Tooltip
							key={`${share.share_target.id}-tip`}
							label={t('displayer.details.collaboratorsTooltip', 'See the list of collaborators')}
						>
							<CustomAvatar key={share.share_target.id} label={label} onClick={openShareTab} />
						</Tooltip>
					);
				} else if (index === collaboratorsToShow) {
					// if there is a 6th collaborator, then show a special avatar to let user know there are more
					avatars.push(
						<Tooltip
							key="showMoreAvatar-tip"
							label={t('displayer.details.collaboratorsTooltip', 'See the list of collaborators')}
						>
							<CustomAvatar
								key="showMoreAvatar"
								label="..."
								icon="MoreHorizontalOutline"
								background="primary"
								onClick={openShareTab}
							/>
						</Tooltip>
					);
				}
				return avatars;
			},
			[]
		);
	}, [openShareTab, shares, t]);

	const { navigateToFolder } = useNavigation();

	const isCrumbNavigable = useCallback(
		(node: Pick<Node, 'id' | 'type'>) =>
			(node.type === NodeType.Folder || node.type === NodeType.Root) &&
			// disable navigation for folder currently visible in list
			node.id !== activeFolderId &&
			node.id !== activeRootId &&
			// disable navigation if node is trashed
			rootId !== ROOTS.TRASH,
		[activeFolderId, activeRootId, rootId]
	);

	const [crumbs, setCrumbs] = useState<Crumb[]>(
		buildCrumbs(
			[{ name, id, type }],
			navigateToFolder,
			t,
			(node: Pick<Node, 'id' | 'name' | 'type'>) => isCrumbNavigable(node)
		)
	);
	const [crumbsRequested, setCrumbsRequested] = useState<boolean>(false);
	const createSnackbar = useCreateSnackbar();

	// TODO: investigate if this can be requested with lazy query or move into custom hook to better handle error
	// use a useQuery to load full path only when required so that operations like move that cleanup cache trigger a refetch
	const { data } = useQuery<GetPathQuery, GetPathQueryVariables>(GET_PATH, {
		variables: {
			id
		},
		skip: !id || !crumbsRequested,
		onError(err) {
			console.error(err);
			setCrumbsRequested(false);
		}
	});

	useEffect(() => {
		if (crumbsRequested && data?.getPath) {
			setCrumbs(
				buildCrumbs(data.getPath, navigateToFolder, t, (node: Pick<Node, 'id' | 'type'>) =>
					isCrumbNavigable(node)
				)
			);
		} else {
			setCrumbs(
				buildCrumbs(
					[{ name, id, type }],
					navigateToFolder,
					t,
					(node: Pick<Node, 'id' | 'name' | 'type'>) => isCrumbNavigable(node)
				)
			);
		}
	}, [
		crumbsRequested,
		data?.getPath,
		id,
		name,
		type,
		navigateToFolder,
		t,
		activeFolderId,
		activeRootId,
		rootId,
		isCrumbNavigable
	]);

	const loadPath = useCallback(() => {
		setCrumbsRequested(true);
	}, []);

	const copyShortcut = useCallback(
		(_event) => {
			copyToClipboard(internalLink).then(() => {
				createSnackbar({
					key: new Date().toLocaleString(),
					type: 'info',
					label: t('snackbar.clipboard.itemShortcutCopied', 'Item shortcut copied'),
					replace: true,
					hideButton: true
				});
			});
		},
		[createSnackbar, internalLink, t]
	);

	return (
		<MainContainer mainAlignment="flex-start" background="gray5" height="auto">
			<DisplayerContentContainer
				mainAlignment="flex-start"
				crossAlignment="flex-start"
				height="fit"
				padding={{ all: 'large' }}
				background="gray6"
			>
				<Container
					orientation="horizontal"
					mainAlignment="space-between"
					width="fill"
					padding={{ vertical: 'small' }}
				>
					<Row mainAlignment="flex-start">
						{shares && shares.length > 0 && (
							<>
								<Text weight="bold" size="small">
									{t('displayer.details.collaborators', 'Collaborators')}
								</Text>
								<Row padding={{ horizontal: 'small' }}>{collaborators}</Row>
							</>
						)}
					</Row>
					<HoverSwitchComponent
						visibleToHiddenComponent={
							<RoundedButton
								label={t('displayer.details.copyShortcut', "copy item's shortcut")}
								type="outlined"
								icon="CopyOutline"
								onClick={copyShortcut}
							/>
						}
						hiddenToVisibleComponent={
							<RoundedButton
								label={t('displayer.details.copyShortcut', "copy item's shortcut")}
								type="outlined"
								icon="Copy"
								onClick={copyShortcut}
							/>
						}
					/>
				</Container>
				{size != null && (
					<Row orientation="vertical" crossAlignment="flex-start" padding={{ vertical: 'small' }}>
						<Label>{t('displayer.details.size', 'Size')}</Label>
						<Text size="large">{humanFileSize(size)}</Text>
					</Row>
				)}
				<Row
					orientation="vertical"
					crossAlignment="flex-start"
					width="fill"
					padding={{ vertical: 'small' }}
				>
					<Label>{t('displayer.details.position', 'Position')}</Label>
					<Row width="fill" mainAlignment="flex-start">
						<Row minWidth="0">
							<InteractiveBreadcrumbs crumbs={crumbs} />
						</Row>
						{!crumbsRequested && (
							<RoundedButton
								label={t('displayer.details.showPath', 'Show path')}
								type="outlined"
								color="secondary"
								onClick={loadPath}
							/>
						)}
					</Row>
				</Row>
				<NodeDetailsUserRow
					key={'NodeDetailsUserRow-Owner'}
					label={t('displayer.details.owner', 'Owner')}
					user={owner}
				/>
				{creator && (
					<NodeDetailsUserRow
						key={'NodeDetailsUserRow-Creator'}
						label={t('displayer.details.createdBy', 'Created by')}
						user={creator}
						dateTime={createdAt}
					/>
				)}
				{lastEditor && (
					<NodeDetailsUserRow
						key={'NodeDetailsUserRow-LastEditor'}
						label={t('displayer.details.lastEdit', 'Last edit')}
						user={lastEditor}
						dateTime={updatedAt}
					/>
				)}
				<NodeDetailsDescription
					canUpsertDescription={canUpsertDescription}
					description={description}
					id={id}
					key={`NodeDetailsDescription${id}`}
				/>
				{downloads && (
					<Row orientation="vertical" crossAlignment="flex-start" padding={{ vertical: 'small' }}>
						<Label>{t('displayer.details.downloads', 'Downloads by public link')}</Label>
						<Text>{downloads}</Text>
					</Row>
				)}
			</DisplayerContentContainer>
			{nodes && (
				<DisplayerContentContainer
					mainAlignment="flex-start"
					crossAlignment="flex-start"
					minHeight={nodes.length > 7 ? 400 : 0}
					data-testid={`details-list-${id || ''}`}
					background="gray6"
					padding={{ all: 'large' }}
					height="fit"
					maxHeight={400}
				>
					<Padding bottom="large">
						<Text>{t('displayer.details.content', 'Content')}</Text>
					</Padding>
					{nodes.length > 0 ? (
						<NodeDetailsList
							nodes={nodes}
							loading={loading}
							hasMore={hasMore}
							loadMore={loadMore}
						/>
					) : (
						!loading && (
							<EmptyFolder
								message={t('empty.folder.displayerContent', 'This folder has no content')}
								size="extrasmall"
								weight="regular"
							/>
						)
					)}
				</DisplayerContentContainer>
			)}
		</MainContainer>
	);
};
