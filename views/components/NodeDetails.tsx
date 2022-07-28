/*
 * SPDX-FileCopyrightText: 2022 Zextras <https://www.zextras.com>
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { ApolloError, useLazyQuery } from '@apollo/client';
import {
	Avatar,
	Button,
	Container,
	Padding,
	Row,
	Shimmer,Text,
	Tooltip,
	useSnackbar
} from '@zextras/carbonio-design-system';
import reduce from 'lodash/reduce';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import styled from 'styled-components';

import { NodeDetailsUserRow } from '../../../components/NodeDetailsUserRow';
import { useActiveNode } from '../../../hooks/useActiveNode';
import { useInternalLink } from '../../../hooks/useInternalLink';
import { useNavigation } from '../../../hooks/useNavigation';
import { DISPLAYER_TABS, LIST_ITEM_HEIGHT_DETAILS, ROOTS } from '../../constants';
import GET_PATH from '../../graphql/queries/getPath.graphql';
import useQueryParam from '../../hooks/useQueryParam';
import { HoverSwitchComponent } from '../../HoverSwitchComponent';
import { Crumb, Node, URLParams } from '../../types/common';
import {
	ChildFragment,
	DistributionList,
	GetPathQuery,
	GetPathQueryVariables,
	Maybe,
	NodeType,
	Share,
	User
} from '../../types/graphql/types';
import { NonNullableListItem } from '../../types/utils';
import { isFile, isFolder } from '../../utils/ActionsFactory';
import {
	buildCrumbs,
	copyToClipboard,
	getChipLabel,
	humanFileSize,
	isSupportedByPreview
} from '../../utils/utils';
import { InteractiveBreadcrumbs } from '../InteractiveBreadcrumbs';
import { DisplayerPreview } from './DisplayerPreview';
import { EmptyFolder } from './EmptyFolder';
import { NodeDetailsDescription } from './NodeDetailsDescription';
import { NodeDetailsList } from './NodeDetailsList';
import { DisplayerContentContainer, ShimmerText } from './StyledComponents';

interface NodeDetailsProps {
	typeName: Node['__typename'];
	id: string;
	name: string;
	owner: Partial<User>;
	creator: Partial<User>;
	lastEditor?: Maybe<Partial<User>>;
	size?: number;
	createdAt: number;
	updatedAt: number;
	description: string | undefined;
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
	version?: number;
	mimeType?: string;
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

interface TextRowProps extends React.ComponentPropsWithRef<typeof Row> {
	loading: boolean;
	label: string;
	content: string | number | null | undefined;
	shimmerWidth?: string;
}

const TextRowWithShim = ({
	loading,
	label,
	content,
	shimmerWidth,
	...rest
}: TextRowProps): JSX.Element | null =>
	((loading || (content !== undefined && content !== null)) && (
		<Row
			orientation="vertical"
			crossAlignment="flex-start"
			padding={{ vertical: 'small' }}
			{...rest}
		>
			<Label>{label}</Label>
			{(loading && <ShimmerText $size="medium" width={shimmerWidth} />) ||
				(content !== undefined && content !== null && <Text size="medium">{content}</Text>)}
		</Row>
	)) ||
	null;

const ShimmerNodeDetailsItem = (): JSX.Element => (
	<Container
		orientation="horizontal"
		mainAlignment="flex-start"
		width="fill"
		height={LIST_ITEM_HEIGHT_DETAILS}
		padding={{ all: 'small' }}
	>
		<Container width="fit" height="fit">
			<Shimmer.Avatar size="medium" radius="8px" />
		</Container>
		<Padding horizontal="small">
			<ShimmerText $size="small" width="150px" />
		</Padding>
		<FlexContainer orientation="horizontal" mainAlignment="flex-end">
			<ShimmerText $size="small" width="60px" />
		</FlexContainer>
	</Container>
);

const CustomAvatar = styled(Avatar)`
	margin-right: -4px;
	cursor: pointer;
`;

export const NodeDetails: React.VFC<NodeDetailsProps> = ({
	typeName,
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
	nodes,
	hasMore,
	loadMore,
	loading,
	shares,
	type,
	rootId,
	version,
	mimeType
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
		return reduce<NonNullableListItem<typeof shares> | null | undefined, JSX.Element[]>(
			shares,
			(avatars, share, index) => {
				if (share) {
					// show first 5 collaborators avatar
					if (share.share_target && index < collaboratorsToShow) {
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
					} else if (loading) {
						avatars.push(
							<Shimmer.Avatar
								key={`avatar-shim-${index}`}
								data-testid="shimmer-avatar"
								size="medium"
							/>
						);
					}
				}
				return avatars;
			},
			[]
		);
	}, [loading, openShareTab, shares, t]);

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
	const createSnackbar = useSnackbar();

	// use a lazy query to load full path only when requested
	const [getPathQuery, { data: getPathData }] = useLazyQuery<GetPathQuery, GetPathQueryVariables>(
		GET_PATH,
		{
			notifyOnNetworkStatusChange: true
		}
	);

	useEffect(() => {
		// when node changes, check if getPath is already in cache
		// if so, show full path
		// otherwise, show collapsed crumbs (by default show collapsed crumbs)
		setCrumbsRequested(false);
		setCrumbs(
			buildCrumbs(
				[{ name, id, type }],
				navigateToFolder,
				t,
				(node: Pick<Node, 'id' | 'name' | 'type'>) => isCrumbNavigable(node)
			)
		);
		getPathQuery({
			variables: {
				node_id: id
			},
			fetchPolicy: 'cache-only'
		});
	}, [getPathQuery, id, isCrumbNavigable, name, navigateToFolder, t, type]);

	useEffect(() => {
		// use an effect on data returned by lazy query to update the crumbs in order to trigger rerender of the UI
		// when lazy query reload following an eviction of the cache
		if (getPathData?.getPath) {
			setCrumbs(
				buildCrumbs(getPathData.getPath, navigateToFolder, t, (node: Pick<Node, 'id' | 'type'>) =>
					isCrumbNavigable(node)
				)
			);
			setCrumbsRequested(true);
		}
	}, [getPathData, isCrumbNavigable, navigateToFolder, t]);

	const loadPath = useCallback(() => {
		getPathQuery({
			variables: {
				node_id: id
			}
		});
	}, [getPathQuery, id]);

	const copyShortcut = useCallback(
		(_event) => {
			if (internalLink) {
				copyToClipboard(internalLink).then(() => {
					createSnackbar({
						key: new Date().toLocaleString(),
						type: 'info',
						label: t('snackbar.clipboard.itemShortcutCopied', 'Item shortcut copied'),
						replace: true,
						hideButton: true
					});
				});
			}
		},
		[createSnackbar, internalLink, t]
	);

	const [$isSupportedByPreview, previewType] = useMemo(
		() => isSupportedByPreview(mimeType),
		[mimeType]
	);

	const nodeIsFile = useMemo(() => isFile({ __typename: typeName }), [typeName]);
	const nodeIsFolder = useMemo(() => isFolder({ __typename: typeName }), [typeName]);

	return (
		<MainContainer mainAlignment="flex-start" background="gray5" height="auto">
			<Container background="gray6" height="auto">
				{$isSupportedByPreview && previewType && (
					<Container padding={{ all: 'small' }} height="auto">
						<DisplayerPreview
							typeName={typeName}
							id={id}
							version={version}
							type={type}
							mimeType={mimeType}
							previewType={previewType}
						/>
					</Container>
				)}
				<DisplayerContentContainer
					mainAlignment="flex-start"
					crossAlignment="flex-start"
					height="fit"
					padding={{ all: 'large' }}
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
						{internalLink && (
							<HoverSwitchComponent
								visibleToHiddenComponent={
									<Button
										label={t('displayer.details.copyShortcut', "copy item's shortcut")}
										type="outlined"
										icon="CopyOutline"
										onClick={copyShortcut}
										shape="round"
									/>
								}
								hiddenToVisibleComponent={
									<Button
										label={t('displayer.details.copyShortcut', "copy item's shortcut")}
										type="outlined"
										icon="Copy"
										onClick={copyShortcut}
										shape="round"
									/>
								}
							/>
						)}
					</Container>
					{nodeIsFile && (
						<TextRowWithShim
							loading={loading}
							label={t('displayer.details.size', 'Size')}
							content={(size && humanFileSize(size)) || undefined}
							shimmerWidth="5em"
						/>
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
								<Button
									label={t('displayer.details.showPath', 'Show path')}
									type="outlined"
									color="secondary"
									onClick={loadPath}
									shape="round"
								/>
							)}
						</Row>
					</Row>
					<NodeDetailsUserRow
						key={'NodeDetailsUserRow-Owner'}
						label={t('displayer.details.owner', 'Owner')}
						user={owner}
						loading={loading && owner === undefined}
					/>
					<NodeDetailsUserRow
						key={'NodeDetailsUserRow-Creator'}
						label={t('displayer.details.createdBy', 'Created by')}
						user={creator}
						dateTime={createdAt}
						loading={loading && creator === undefined}
					/>
					<NodeDetailsUserRow
						key={'NodeDetailsUserRow-LastEditor'}
						label={t('displayer.details.lastEdit', 'Last edit')}
						user={lastEditor}
						dateTime={updatedAt}
						loading={loading && lastEditor === undefined}
					/>
					<NodeDetailsDescription
						canUpsertDescription={canUpsertDescription}
						description={description}
						id={id}
						key={`NodeDetailsDescription${id}`}
						loading={loading && description === undefined}
					/>
					{/*
					TODO: download count is not implemented yet
					{nodeIsFile && (
						<TextRowWithShim
							loading={loading}
							label={t('displayer.details.downloads', 'Downloads by public link')}
							content={downloads}
							shimmerWidth="3em"
						/>
					)} */}
				</DisplayerContentContainer>
			</Container>
			{nodeIsFolder && (nodes || loading) && (
				<DisplayerContentContainer
					mainAlignment="flex-start"
					crossAlignment="flex-start"
					minHeight={nodes && nodes.length > 7 ? 400 : 0}
					data-testid={`details-list-${id || ''}`}
					background="gray6"
					padding={{ all: 'large' }}
					height="fit"
					maxHeight={400}
				>
					<Padding bottom="large">
						<Text>{t('displayer.details.content', 'Content')}</Text>
					</Padding>
					{nodes && nodes.length > 0 && (
						<NodeDetailsList
							nodes={nodes}
							loading={loading}
							hasMore={hasMore}
							loadMore={loadMore}
						/>
					)}
					{!loading && nodes && nodes.length === 0 && (
						<EmptyFolder
							message={t('empty.folder.displayerContent', 'This folder has no content')}
							size="extrasmall"
							weight="regular"
						/>
					)}
					{loading && !nodes && <ShimmerNodeDetailsItem />}
				</DisplayerContentContainer>
			)}
		</MainContainer>
	);
};
