/*
 * SPDX-FileCopyrightText: 2022 Zextras <https://www.zextras.com>
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import React, { useCallback, useMemo } from 'react';

import { Container, Padding, Text, Button } from '@zextras/carbonio-design-system';
import drop from 'lodash/drop';
import filter from 'lodash/filter';
import keyBy from 'lodash/keyBy';
import map from 'lodash/map';
import partition from 'lodash/partition';
import take from 'lodash/take';
import moment from 'moment-timezone';
import { useTranslation } from 'react-i18next';
import styled from 'styled-components';

import useUserInfo from '../../../../hooks/useUserInfo';
import { useCloneVersionMutation } from '../../../hooks/graphql/mutations/useCloneVersionMutation';
import { useDeleteVersionsMutation } from '../../../hooks/graphql/mutations/useDeleteVersionsMutation';
import { useKeepVersionsMutation } from '../../../hooks/graphql/mutations/useKeepVersionsMutation';
import { useGetVersionsQuery } from '../../../hooks/graphql/queries/useGetVersionsQuery';
import { NonNullableList } from '../../../types/utils';
import { ActionsFactoryNodeType, canOpenVersionWithDocs } from '../../../utils/ActionsFactory';
import { getChipLabel } from '../../../utils/utils';
import { GridContainer } from './GridElements';
import UploadVersionButton, { UploadVersionButtonProps } from './UploadVersionButton';
import { SectionRow, VersionRow } from './VersionRow';

const MainContainer = styled(Container)`
	gap: ${({ theme }): string => theme.sizes.padding.small};
	overflow-y: auto;
`;

interface VersioningProps {
	node: ActionsFactoryNodeType;
}

export const Versioning: React.VFC<VersioningProps> = ({ node }) => {
	const [t] = useTranslation();
	const { zimbraPrefTimeZoneId } = useUserInfo();

	const deleteVersions = useDeleteVersionsMutation();
	const keepVersions = useKeepVersionsMutation();
	const cloneVersion = useCloneVersionMutation();

	const purgeAllVersions = useCallback(() => {
		deleteVersions(node.id);
	}, [deleteVersions, node.id]);

	const { data: getVersionsQueryData } = useGetVersionsQuery(node.id);

	const versions = useMemo(() => {
		if (getVersionsQueryData?.getVersions) {
			return getVersionsQueryData.getVersions;
		}
		return [];
	}, [getVersionsQueryData]);

	const filteredVersions = useMemo(
		() => filter(versions, (version) => version != null) as NonNullableList<typeof versions>,
		[versions]
	);

	const mappedVersions = useMemo(() => keyBy(filteredVersions, 'version'), [filteredVersions]);

	const lastVersion = take(filteredVersions);
	const othersVersions = drop(filteredVersions);

	const now = moment().tz(zimbraPrefTimeZoneId);

	const partitions = partition(othersVersions, (version) => {
		const versionDate = moment.tz(version.updated_at, zimbraPrefTimeZoneId);
		return now.diff(versionDate, 'days') <= 7;
	});

	const lastWeekVersions = partitions[0];
	const olderVersions = partitions[1];

	const lastVersionComponent = map(lastVersion, (version) => (
		<VersionRow
			key={`version${version.version}`}
			background={'gray6'}
			canCloneVersion={node.permissions.can_write_file}
			canDelete={false}
			canKeepVersion={node.permissions.can_write_file}
			canOpenWithDocs={canOpenVersionWithDocs([node])}
			clonedFromVersion={version.cloned_from_version || undefined}
			cloneUpdatedAt={
				version.cloned_from_version
					? mappedVersions[version.cloned_from_version]?.updated_at
					: undefined
			}
			cloneVersion={cloneVersion}
			deleteVersions={deleteVersions}
			keepVersions={keepVersions}
			keepVersionValue={version.keep_forever}
			lastEditor={getChipLabel(version.last_editor)}
			nodeId={node.id}
			rowNumber={2}
			size={version.size}
			updatedAt={version.updated_at}
			version={version.version}
			zimbraPrefTimeZoneId={zimbraPrefTimeZoneId}
		/>
	));

	const lastWeekVersionsComponent = map(lastWeekVersions, (version, idx) => (
		<VersionRow
			key={`version${version.version}`}
			background={'gray6'}
			canCloneVersion={node.permissions.can_write_file}
			canDelete={!version.keep_forever && node.permissions.can_write_file}
			canKeepVersion={node.permissions.can_write_file}
			canOpenWithDocs={canOpenVersionWithDocs([node])}
			clonedFromVersion={version.cloned_from_version || undefined}
			cloneUpdatedAt={
				version.cloned_from_version
					? mappedVersions[version.cloned_from_version]?.updated_at
					: undefined
			}
			cloneVersion={cloneVersion}
			deleteVersions={deleteVersions}
			keepVersions={keepVersions}
			keepVersionValue={version.keep_forever}
			lastEditor={getChipLabel(version.last_editor)}
			nodeId={node.id}
			rowNumber={
				idx +
				// last version row
				lastVersion.length +
				// last version header
				1 +
				// last week versions header
				1 +
				// required off-set
				1
			}
			size={version.size}
			updatedAt={version.updated_at}
			version={version.version}
			zimbraPrefTimeZoneId={zimbraPrefTimeZoneId}
		/>
	));

	const olderVersionsComponent = map(olderVersions, (version, idx) => (
		<VersionRow
			key={`version${version.version}`}
			background={'gray6'}
			canCloneVersion={node.permissions.can_write_file}
			canDelete={!version.keep_forever && node.permissions.can_write_file}
			canKeepVersion={node.permissions.can_write_file}
			canOpenWithDocs={canOpenVersionWithDocs([node])}
			clonedFromVersion={version.cloned_from_version || undefined}
			cloneUpdatedAt={
				version.cloned_from_version
					? mappedVersions[version.cloned_from_version]?.updated_at
					: undefined
			}
			cloneVersion={cloneVersion}
			deleteVersions={deleteVersions}
			keepVersions={keepVersions}
			keepVersionValue={version.keep_forever}
			lastEditor={getChipLabel(version.last_editor)}
			nodeId={node.id}
			rowNumber={
				idx +
				lastVersion.length +
				// last version header
				1 +
				// older version header
				1 +
				// required off-set
				1 +
				// lastWeek versions and related header
				(lastWeekVersions.length > 0 ? lastWeekVersions.length + 1 : 0)
			}
			size={version.size}
			updatedAt={version.updated_at}
			version={version.version}
			zimbraPrefTimeZoneId={zimbraPrefTimeZoneId}
		/>
	));

	return (
		<MainContainer mainAlignment="flex-start" background="gray5" height="calc(100% - 50px)">
			<Container height="fit" background="gray6" crossAlignment="flex-start">
				<Padding left="large" top="large">
					<Text style={{ lineHeight: '21px' }} weight="light" overflow="break-word" size="small">
						{t(
							'displayer.version.mainHint',
							'You can manually delete any file version or restore one as the current version. Select one or more versions that you want to keep forever.'
						)}
					</Text>
				</Padding>
				<Container
					mainAlignment="flex-end"
					padding={{ bottom: 'large', right: 'large', top: 'large' }}
					orientation="horizontal"
					height="fit"
				>
					<UploadVersionButton
						node={node as UploadVersionButtonProps['node']}
						disabled={!node.permissions.can_write_file}
					/>
					<Padding right="small" />
					<Button
						type="outlined"
						color="error"
						label={t('displayer.version.button.purgeAllVersions', 'Purge all Versions')}
						style={{ overflowX: 'hidden' }}
						onClick={purgeAllVersions}
						disabled={!node.permissions.can_write_file}
					/>
				</Container>
			</Container>
			<GridContainer
				sectionsRows={[lastVersion.length, lastWeekVersions.length, olderVersions.length]}
			>
				{lastVersion.length > 0 && (
					<>
						<SectionRow rowNumber={1}>
							<Text size={'small'}>
								{t('displayer.version.rowHeaders.currentVersion', 'Current version')}
							</Text>
						</SectionRow>
						{lastVersionComponent}
					</>
				)}
				{lastWeekVersions.length > 0 && (
					<>
						<SectionRow rowNumber={3}>
							<Text size={'small'}>{t('displayer.version.rowHeaders.lastWeek', 'Last week')}</Text>
						</SectionRow>
						{lastWeekVersionsComponent}
					</>
				)}
				{olderVersions.length > 0 && (
					<>
						<SectionRow
							rowNumber={3 + (lastWeekVersions.length > 0 ? lastWeekVersions.length + 1 : 0)}
						>
							<Text size={'small'}>
								{t('displayer.version.rowHeaders.olderVersions', 'Older versions')}
							</Text>
						</SectionRow>
						{olderVersionsComponent}
					</>
				)}
			</GridContainer>
		</MainContainer>
	);
};
