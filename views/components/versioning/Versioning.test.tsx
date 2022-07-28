/*
 * SPDX-FileCopyrightText: 2022 Zextras <https://www.zextras.com>
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */
import React from 'react';

import { act, screen, waitFor, waitForElementToBeRemoved, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import find from 'lodash/find';
import map from 'lodash/map';
import { graphql, rest } from 'msw';

import server from '../../../../mocks/server';
import { CONFIGS, REST_ENDPOINT, UPLOAD_VERSION_PATH } from '../../../constants';
import {
	UploadRequestBody,
	UploadVersionRequestParams,
	UploadVersionResponse
} from '../../../mocks/handleUploadVersionRequest';
import {
	getVersionFromFile,
	incrementVersion,
	populateConfigs,
	populateFile
} from '../../../mocks/mockUtils';
import {
	File as FilesFile,
	GetVersionsQuery,
	GetVersionsQueryVariables,
	NodeType
} from '../../../types/graphql/types';
import {
	mockCloneVersion,
	mockDeleteVersions,
	mockGetConfigs,
	mockGetVersions,
	mockKeepVersions
} from '../../../utils/mockUtils';
import { render, waitForNetworkResponse } from '../../../utils/testUtils';
import * as moduleUtils from '../../../utils/utils';
import { getChipLabel } from '../../../utils/utils';
import { Versioning } from './Versioning';

describe('Versioning', () => {
	test('versions list split', async () => {
		const fileVersion1 = populateFile();
		fileVersion1.permissions.can_write_file = true;

		const fileVersion2 = incrementVersion(fileVersion1, true);
		const fileVersion3 = incrementVersion(fileVersion2, true);

		const dayOffset = 24 * 60 * 60 * 1000;

		fileVersion3.updated_at = Date.now();
		fileVersion2.updated_at = fileVersion3.updated_at - dayOffset;
		fileVersion1.updated_at = fileVersion2.updated_at - 10 * dayOffset;

		const version1 = getVersionFromFile(fileVersion1);
		const version2 = getVersionFromFile(fileVersion2);
		const version3 = getVersionFromFile(fileVersion3);

		const mocks = [
			mockGetConfigs(),
			mockGetVersions({ node_id: fileVersion3.id }, [
				version3 as FilesFile,
				version2 as FilesFile,
				version1 as FilesFile
			])
		];
		render(<Versioning node={fileVersion3} />, { mocks });

		await screen.findByText(getChipLabel(fileVersion3.last_editor));

		const version3LastEditor = screen.getByText(getChipLabel(version3.last_editor));
		expect(version3LastEditor).toBeVisible();
		const version2LastEditor = screen.getByText(getChipLabel(version2.last_editor));
		expect(version2LastEditor).toBeVisible();
		const version1LastEditor = screen.getByText(getChipLabel(version1.last_editor));
		expect(version1LastEditor).toBeVisible();

		expect(screen.getByText('Current version')).toBeVisible();
		expect(screen.getByText('Last week')).toBeVisible();
		expect(screen.getByText('Older versions')).toBeVisible();
	});

	describe('test delete version', () => {
		test('delete version', async () => {
			const fileVersion1 = populateFile();
			fileVersion1.permissions.can_write_file = true;
			const fileVersion2 = incrementVersion(fileVersion1, true);
			const fileVersion3 = incrementVersion(fileVersion2, true);
			const fileVersion4 = incrementVersion(fileVersion3, true);
			const fileVersion5 = incrementVersion(fileVersion4, true);

			const dayOffset = 24 * 60 * 60 * 1000;
			fileVersion5.updated_at = Date.now();
			fileVersion4.updated_at = fileVersion5.updated_at - dayOffset;
			fileVersion3.updated_at = fileVersion4.updated_at - dayOffset;
			fileVersion2.updated_at = fileVersion3.updated_at - dayOffset;
			fileVersion1.updated_at = fileVersion2.updated_at - dayOffset;

			// must be false to be deletable
			fileVersion2.keep_forever = false;

			const version1 = getVersionFromFile(fileVersion1);
			const version2 = getVersionFromFile(fileVersion2);
			const version3 = getVersionFromFile(fileVersion3);
			const version4 = getVersionFromFile(fileVersion4);
			const version5 = getVersionFromFile(fileVersion5);

			const mocks = [
				mockGetConfigs(),
				mockGetVersions({ node_id: fileVersion5.id }, [
					version5 as FilesFile,
					version4 as FilesFile,
					version3 as FilesFile,
					version2 as FilesFile,
					version1 as FilesFile
				]),
				mockDeleteVersions({ node_id: fileVersion5.id, versions: [version2.version] }, [
					version2.version
				])
			];
			render(<Versioning node={fileVersion5} />, { mocks });
			await screen.findByText(getChipLabel(fileVersion5.last_editor));

			const version5LastEditor = screen.getByText(getChipLabel(version5.last_editor));
			expect(version5LastEditor).toBeVisible();
			const version4LastEditor = screen.getByText(getChipLabel(version4.last_editor));
			expect(version4LastEditor).toBeVisible();
			const version3LastEditor = screen.getByText(getChipLabel(version3.last_editor));
			expect(version3LastEditor).toBeVisible();
			const version2LastEditor = screen.getByText(getChipLabel(version2.last_editor));
			expect(version2LastEditor).toBeVisible();
			const version1LastEditor = screen.getByText(getChipLabel(version1.last_editor));
			expect(version1LastEditor).toBeVisible();

			expect(screen.getByText('Current version')).toBeVisible();
			expect(screen.getByText('Last week')).toBeVisible();

			const versions2Icons = screen.getByTestId('version2-icons');
			const versions2MoreButton = within(versions2Icons).getByTestId('icon: MoreVerticalOutline');
			userEvent.click(versions2MoreButton);

			const deleteVersionItem = await screen.findByText(/delete version/i);
			userEvent.click(deleteVersionItem);
			await waitForNetworkResponse();
			await waitFor(() => expect(screen.getAllByText(/Version \d+/)).toHaveLength(4));
			expect(version2LastEditor).not.toBeInTheDocument();
		});

		test('purge all versions', async () => {
			const fileVersion1 = populateFile();
			fileVersion1.permissions.can_write_file = true;
			const fileVersion2 = incrementVersion(fileVersion1, true);
			const fileVersion3 = incrementVersion(fileVersion2, true);
			const fileVersion4 = incrementVersion(fileVersion3, true);
			const fileVersion5 = incrementVersion(fileVersion4, true);

			const dayOffset = 24 * 60 * 60 * 1000;
			fileVersion5.updated_at = Date.now();
			fileVersion4.updated_at = fileVersion5.updated_at - dayOffset;
			fileVersion3.updated_at = fileVersion4.updated_at - dayOffset;
			fileVersion2.updated_at = fileVersion3.updated_at - dayOffset;
			fileVersion1.updated_at = fileVersion2.updated_at - dayOffset;

			fileVersion5.keep_forever = false;
			fileVersion4.keep_forever = false;
			fileVersion3.keep_forever = false;
			fileVersion2.keep_forever = true;
			fileVersion1.keep_forever = false;

			const version1 = getVersionFromFile(fileVersion1);
			const version2 = getVersionFromFile(fileVersion2);
			const version3 = getVersionFromFile(fileVersion3);
			const version4 = getVersionFromFile(fileVersion4);
			const version5 = getVersionFromFile(fileVersion5);

			const mocks = [
				mockGetConfigs(),
				mockGetVersions({ node_id: fileVersion5.id }, [
					version5 as FilesFile,
					version4 as FilesFile,
					version3 as FilesFile,
					version2 as FilesFile,
					version1 as FilesFile
				]),
				mockDeleteVersions({ node_id: fileVersion5.id }, [
					version4.version,
					version3.version,
					version1.version
				])
			];
			render(<Versioning node={fileVersion5} />, { mocks });
			await screen.findByText(getChipLabel(fileVersion5.last_editor));

			const version5LastEditor = screen.getByText(getChipLabel(version5.last_editor));
			expect(version5LastEditor).toBeVisible();
			const version4LastEditor = screen.getByText(getChipLabel(version4.last_editor));
			expect(version4LastEditor).toBeVisible();
			const version3LastEditor = screen.getByText(getChipLabel(version3.last_editor));
			expect(version3LastEditor).toBeVisible();
			const version2LastEditor = screen.getByText(getChipLabel(version2.last_editor));
			expect(version2LastEditor).toBeVisible();
			const version1LastEditor = screen.getByText(getChipLabel(version1.last_editor));
			expect(version1LastEditor).toBeVisible();

			expect(screen.getByText('Current version')).toBeVisible();
			expect(screen.getByText('Last week')).toBeVisible();

			const purgeButton = await screen.findByRole('button', { name: /purge all versions/i });
			userEvent.click(purgeButton);

			await screen.findByText(
				/All versions that are not marked to be kept forever, except the current one, will be deleted/i
			);

			expect(screen.getAllByRole('button', { name: /purge all versions/i })).toHaveLength(2);
			const modalPurgeAllButton = find(
				screen.getAllByRole('button', { name: /purge all versions/i }),
				(button) => button !== purgeButton
			);

			expect(modalPurgeAllButton).toBeDefined();
			userEvent.click(modalPurgeAllButton as HTMLElement);
			await waitForElementToBeRemoved(modalPurgeAllButton);
			await waitFor(() => expect(screen.getAllByText(/Version \d+/)).toHaveLength(2));
			expect(version3LastEditor).not.toBeInTheDocument();
		});
	});

	test('keep version', async () => {
		const fileVersion1 = populateFile();
		fileVersion1.permissions.can_write_file = true;
		const fileVersion2 = incrementVersion(fileVersion1, true);

		const dayOffset = 24 * 60 * 60 * 1000;
		fileVersion2.updated_at = Date.now();
		fileVersion1.updated_at = fileVersion2.updated_at - dayOffset;

		fileVersion2.keep_forever = false;

		const version1 = getVersionFromFile(fileVersion1);
		const version2 = getVersionFromFile(fileVersion2);

		const mocks = [
			mockGetConfigs(),
			mockGetVersions({ node_id: fileVersion2.id }, [version2 as FilesFile, version1 as FilesFile]),
			mockKeepVersions({ node_id: fileVersion2.id, versions: [2], keep_forever: true }, [2]),
			mockKeepVersions({ node_id: fileVersion2.id, versions: [2], keep_forever: false }, [2])
		];

		render(<Versioning node={fileVersion2} />, { mocks });
		await screen.findByText(getChipLabel(fileVersion2.last_editor));

		const version2LastEditor = screen.getByText(getChipLabel(version2.last_editor));
		expect(version2LastEditor).toBeVisible();
		const version1LastEditor = screen.getByText(getChipLabel(version1.last_editor));
		expect(version1LastEditor).toBeVisible();

		expect(screen.getByText('Current version')).toBeVisible();
		expect(screen.getByText('Last week')).toBeVisible();

		const versions2Icons = screen.getByTestId('version2-icons');
		const versions2MoreButton = within(versions2Icons).getByTestId('icon: MoreVerticalOutline');
		userEvent.click(versions2MoreButton);

		const keepForeverVersionItem = await screen.findByText(/keep this version forever/i);
		userEvent.click(keepForeverVersionItem);

		const snackbar = await screen.findByText(/Version marked as to be kept forever/i);
		await waitForElementToBeRemoved(snackbar);

		await within(versions2Icons).findByTestId('icon: InfinityOutline');
		const keepIcon = within(versions2Icons).getByTestId('icon: InfinityOutline');
		expect(keepIcon).toBeVisible();

		userEvent.click(versions2MoreButton);
		const removeKeepForeverItem = await screen.findByText(/remove keep forever/i);
		userEvent.click(removeKeepForeverItem);

		const snackbar2 = await screen.findByText(/Keep forever removed/i);
		await waitForElementToBeRemoved(snackbar2);

		expect(keepIcon).not.toBeInTheDocument();
	});

	test('clone version', async () => {
		const fileVersion1 = populateFile();
		fileVersion1.permissions.can_write_file = true;
		const fileVersion2 = incrementVersion(fileVersion1, true);

		const fileVersion3 = incrementVersion(fileVersion2, true);

		const dayOffset = 24 * 60 * 60 * 1000;
		const hourOffset = 60 * 60 * 1000;
		fileVersion3.updated_at = Date.now();
		fileVersion2.updated_at = fileVersion3.updated_at - hourOffset;
		fileVersion1.updated_at = fileVersion2.updated_at - dayOffset;

		const version1 = getVersionFromFile(fileVersion1);
		const version2 = getVersionFromFile(fileVersion2);
		const version3 = getVersionFromFile(fileVersion3);

		const mocks = [
			mockGetConfigs(),
			mockGetVersions({ node_id: fileVersion2.id }, [version2 as FilesFile, version1 as FilesFile]),
			mockCloneVersion({ node_id: fileVersion2.id, version: 2 }, version3 as FilesFile)
		];

		render(<Versioning node={fileVersion2} />, { mocks });
		await screen.findByText(getChipLabel(fileVersion2.last_editor));

		const version2LastEditor = screen.getByText(getChipLabel(version2.last_editor));
		expect(version2LastEditor).toBeVisible();
		const version1LastEditor = screen.getByText(getChipLabel(version1.last_editor));
		expect(version1LastEditor).toBeVisible();

		expect(screen.getByText('Current version')).toBeVisible();
		expect(screen.getByText('Last week')).toBeVisible();

		expect(screen.getAllByText(/Version \d+/)).toHaveLength(2);

		const versions2Icons = screen.getByTestId('version2-icons');
		const versions2MoreButton = within(versions2Icons).getByTestId('icon: MoreVerticalOutline');
		userEvent.click(versions2MoreButton);

		const cloneAsCurrentItem = await screen.findByText(/clone as current/i);
		userEvent.click(cloneAsCurrentItem);

		const snackbar = await screen.findByText(/Version cloned as the current one/i);
		await waitForElementToBeRemoved(snackbar);
		expect(screen.getAllByText(/Version \d+/)).toHaveLength(3);
	});

	test('download version', async () => {
		const downloadSpy = jest.spyOn(moduleUtils, 'downloadNode');

		const fileVersion1 = populateFile();
		fileVersion1.permissions.can_write_file = true;

		const version1 = getVersionFromFile(fileVersion1);

		const mocks = [
			mockGetConfigs(),
			mockGetVersions({ node_id: fileVersion1.id }, [version1 as FilesFile])
		];

		render(<Versioning node={fileVersion1} />, { mocks });
		await screen.findByText(getChipLabel(fileVersion1.last_editor));

		const version1LastEditor = screen.getByText(getChipLabel(version1.last_editor));
		expect(version1LastEditor).toBeVisible();

		expect(screen.getByText('Current version')).toBeVisible();

		expect(screen.getByText(/Version \d+/)).toBeInTheDocument();

		const versions2Icons = screen.getByTestId('version1-icons');
		const versions2MoreButton = within(versions2Icons).getByTestId('icon: MoreVerticalOutline');
		userEvent.click(versions2MoreButton);

		const downloadItem = await screen.findByText(/download version/i);
		userEvent.click(downloadItem);

		expect(downloadSpy).toBeCalledWith(fileVersion1.id, fileVersion1.version);
	});

	test('open with docs version', async () => {
		const openNodeWithDocsSpy = jest.fn();
		jest.spyOn(moduleUtils, 'openNodeWithDocs').mockImplementation(openNodeWithDocsSpy);

		const fileVersion1 = populateFile();
		fileVersion1.permissions.can_write_file = true;
		fileVersion1.mime_type = 'text/plain';

		const version1 = getVersionFromFile(fileVersion1);

		const mocks = [
			mockGetConfigs(),
			mockGetVersions({ node_id: fileVersion1.id }, [version1 as FilesFile])
		];

		render(<Versioning node={fileVersion1} />, { mocks });
		await screen.findByText(getChipLabel(fileVersion1.last_editor));

		const version1LastEditor = screen.getByText(getChipLabel(version1.last_editor));
		expect(version1LastEditor).toBeVisible();

		expect(screen.getByText('Current version')).toBeVisible();

		expect(screen.getByText(/Version \d+/)).toBeInTheDocument();

		const versions2Icons = screen.getByTestId('version1-icons');
		const versions2MoreButton = within(versions2Icons).getByTestId('icon: MoreVerticalOutline');
		userEvent.click(versions2MoreButton);

		const openDocumentItem = await screen.findByText(/open document version/i);
		userEvent.click(openDocumentItem);

		expect(openNodeWithDocsSpy).toBeCalledWith(fileVersion1.id, fileVersion1.version);
	});

	test('Upload version', async () => {
		const fileVersion1 = populateFile();
		fileVersion1.permissions.can_write_file = true;
		const fileVersion2 = incrementVersion(fileVersion1, true);
		const fileVersion3 = incrementVersion(fileVersion2, true);
		const fileVersion4 = incrementVersion(fileVersion3, true);
		const fileVersion5 = incrementVersion(fileVersion4, true);

		const dayOffset = 24 * 60 * 60 * 1000;
		fileVersion5.updated_at = Date.now();
		fileVersion4.updated_at = fileVersion5.updated_at - dayOffset;
		fileVersion3.updated_at = fileVersion4.updated_at - dayOffset;
		fileVersion2.updated_at = fileVersion3.updated_at - dayOffset;
		fileVersion1.updated_at = fileVersion2.updated_at - dayOffset;

		fileVersion5.keep_forever = false;
		fileVersion4.keep_forever = false;
		fileVersion3.keep_forever = false;
		fileVersion2.keep_forever = true;
		fileVersion1.keep_forever = false;

		const version1 = getVersionFromFile(fileVersion1);
		const version2 = getVersionFromFile(fileVersion2);
		const version3 = getVersionFromFile(fileVersion3);
		const version4 = getVersionFromFile(fileVersion4);
		const version5 = getVersionFromFile(fileVersion5);

		const versions = [
			version4 as FilesFile,
			version3 as FilesFile,
			version2 as FilesFile,
			version1 as FilesFile
		];

		const mocks = [mockGetConfigs(), mockGetVersions({ node_id: fileVersion4.id }, versions)];

		server.use(
			rest.post<UploadRequestBody, UploadVersionRequestParams, UploadVersionResponse>(
				`${REST_ENDPOINT}${UPLOAD_VERSION_PATH}`,
				(req, res, ctx) =>
					res(
						ctx.json({
							nodeId: fileVersion1.id,
							version: 5
						})
					)
			),
			graphql.query<GetVersionsQuery, GetVersionsQueryVariables>('getVersions', (req, res, ctx) =>
				res(ctx.data({ getVersions: [version5, ...versions] }))
			)
		);

		render(<Versioning node={fileVersion4} />, { mocks });
		await screen.findByText(getChipLabel(fileVersion4.last_editor));

		const version4LastEditor = screen.getByText(getChipLabel(version4.last_editor));
		expect(version4LastEditor).toBeVisible();
		const version3LastEditor = screen.getByText(getChipLabel(version3.last_editor));
		expect(version3LastEditor).toBeVisible();
		const version2LastEditor = screen.getByText(getChipLabel(version2.last_editor));
		expect(version2LastEditor).toBeVisible();
		const version1LastEditor = screen.getByText(getChipLabel(version1.last_editor));
		expect(version1LastEditor).toBeVisible();

		expect(screen.getByText('Current version')).toBeVisible();
		expect(screen.getByText('Last week')).toBeVisible();
		expect(screen.getAllByText(/Version \d+/)).toHaveLength(4);

		const uploadButton = await screen.findByRole('button', { name: /upload version/i });
		userEvent.click(uploadButton);

		const file = new File(['(⌐□_□)'], fileVersion5.name, { type: fileVersion5.mime_type });
		const input = await screen.findByAltText(/Hidden file input/i);
		userEvent.upload(input, file);

		await waitFor(() => expect(screen.getAllByText(/Version \d+/)).toHaveLength(5));
		const version5LastEditor = screen.getByText(getChipLabel(version5.last_editor));
		expect(version5LastEditor).toBeVisible();
	});

	test('clone action is disabled if max number of version is reached', async () => {
		const fileVersions = [];
		const versions = [];
		const configs = populateConfigs();
		const maxVersions = Number(
			find(configs, (config) => config.name === CONFIGS.MAX_VERSIONS)?.value || 0
		);
		const baseFile = populateFile();
		baseFile.permissions.can_write_file = true;
		for (let i = 0; i < maxVersions; i += 1) {
			const fileVersion = { ...baseFile };
			fileVersion.version = i + 1;
			const version = getVersionFromFile(fileVersion);
			fileVersions.unshift(fileVersion);
			versions.unshift(version);
		}

		const mocks = [
			mockGetConfigs(),
			mockGetVersions({ node_id: baseFile.id }, versions as FilesFile[])
		];

		render(<Versioning node={baseFile} />, { mocks });
		await screen.findByText(/Version 1/i);

		expect(screen.getAllByText(/Version \d+/)).toHaveLength(maxVersions);

		const versions1Icons = screen.getByTestId('version1-icons');
		const versions1MoreButton = within(versions1Icons).getByTestId('icon: MoreVerticalOutline');
		userEvent.click(versions1MoreButton);

		const cloneAsCurrentItem = await screen.findByText(/clone as current/i);
		expect(cloneAsCurrentItem).toHaveAttribute('disabled', '');
		userEvent.click(cloneAsCurrentItem);

		await waitForNetworkResponse();
		expect(screen.queryByText(/Version cloned as the current one/i)).not.toBeInTheDocument();
		// number of version is not changed
		expect(screen.getAllByText(/Version \d+/)).toHaveLength(maxVersions);

		// hover on action shows a tooltip
		userEvent.hover(cloneAsCurrentItem);
		const tooltip = await screen.findByText(/you have reached the maximum number of versions/i);
		expect(tooltip).toBeVisible();
		act(() => {
			userEvent.unhover(cloneAsCurrentItem);
		});
		expect(tooltip).not.toBeInTheDocument();
	});

	test('keep forever action is disabled if max number of keep is reached', async () => {
		const fileVersions = [];
		const versions = [];
		const configs = populateConfigs();
		const maxKeepVersions = Number(
			find(configs, (config) => config.name === CONFIGS.MAX_KEEP_VERSIONS)?.value || 0
		);
		const baseFile = populateFile();
		baseFile.permissions.can_write_file = true;
		for (let i = 0; i < maxKeepVersions; i += 1) {
			const fileVersion = { ...baseFile };
			fileVersion.version = i + 1;
			fileVersion.keep_forever = true;
			const version = getVersionFromFile(fileVersion);
			fileVersions.unshift(fileVersion);
			versions.unshift(version);
		}
		// add a version without keep
		const fileVersionWithoutKeep = { ...baseFile };
		fileVersionWithoutKeep.version = maxKeepVersions + 1;
		fileVersionWithoutKeep.keep_forever = false;
		const versionWithoutKeep = getVersionFromFile(fileVersionWithoutKeep);
		fileVersions.unshift(fileVersionWithoutKeep);
		versions.unshift(versionWithoutKeep);

		const mocks = [
			mockGetConfigs(),
			mockGetVersions({ node_id: baseFile.id }, versions as FilesFile[])
		];

		render(<Versioning node={baseFile} />, { mocks });
		await screen.findByText(/Version 1/i);

		expect(screen.getAllByText(/Version \d+/)).toHaveLength(versions.length);
		expect(screen.getAllByTestId('icon: InfinityOutline')).toHaveLength(maxKeepVersions);

		const versionWithoutKeepIcons = screen.getByTestId(
			`version${versionWithoutKeep.version}-icons`
		);
		const versionWithoutKeepMoreButton = within(versionWithoutKeepIcons).getByTestId(
			'icon: MoreVerticalOutline'
		);
		userEvent.click(versionWithoutKeepMoreButton);

		const keepVersionItem = await screen.findByText(/keep this version forever/i);
		expect(keepVersionItem).toHaveAttribute('disabled', '');
		userEvent.click(keepVersionItem);

		await waitForNetworkResponse();

		expect(screen.queryByText(/Version marked as to be kept forever/i)).not.toBeInTheDocument();

		// hover on action shows a tooltip
		userEvent.hover(keepVersionItem);
		const tooltip = await screen.findByText(
			/You have reached the maximum number of versions to keep forever/i
		);
		expect(tooltip).toBeVisible();
		act(() => {
			userEvent.unhover(keepVersionItem);
		});
		expect(tooltip).not.toBeInTheDocument();

		// click outside to close context menu
		act(() => {
			userEvent.click(screen.getByText(RegExp(`version ${versionWithoutKeep.version}`, 'i')));
		});
		expect(screen.queryByText(/keep this version forever/i)).not.toBeInTheDocument();
		expect(screen.getAllByTestId('icon: InfinityOutline')).toHaveLength(maxKeepVersions);
	});

	test('upload version action is enabled if max number of versions is reached', async () => {
		const fileVersions = [];
		const versions = [];
		const configs = populateConfigs();
		const maxVersions = Number(
			find(configs, (config) => config.name === CONFIGS.MAX_VERSIONS)?.value || 0
		);
		const baseFile = populateFile();
		baseFile.permissions.can_write_file = true;
		for (let i = 0; i < maxVersions; i += 1) {
			const fileVersion = { ...baseFile };
			fileVersion.version = i + 1;
			const version = getVersionFromFile(fileVersion);
			fileVersions.unshift(fileVersion);
			versions.unshift(version);
		}

		const fileVersionUpload = { ...baseFile };
		fileVersionUpload.version = maxVersions + 1;
		const versionUpload = getVersionFromFile(fileVersionUpload);

		// remove first version from list to simulate auto-deletion of backend
		const updatedVersions = [versionUpload].concat(versions.slice(0, versions.length - 1));
		const mocks = [
			mockGetConfigs(),
			mockGetVersions({ node_id: baseFile.id }, versions as FilesFile[]),
			mockGetVersions({ node_id: baseFile.id }, updatedVersions as FilesFile[])
		];

		server.use(
			rest.post<UploadRequestBody, UploadVersionRequestParams, UploadVersionResponse>(
				`${REST_ENDPOINT}${UPLOAD_VERSION_PATH}`,
				(req, res, ctx) =>
					res(
						ctx.json({
							nodeId: baseFile.id,
							version: fileVersionUpload.version
						})
					)
			),
			graphql.query<GetVersionsQuery, GetVersionsQueryVariables>('getVersions', (req, res, ctx) =>
				res(ctx.data({ getVersions: updatedVersions }))
			)
		);

		render(<Versioning node={baseFile} />, { mocks });
		await screen.findByText(/Version 1/i);

		expect(screen.getAllByText(/Version \d+/)).toHaveLength(maxVersions);

		const uploadButton = await screen.findByRole('button', { name: /upload version/i });
		expect(uploadButton).toBeVisible();
		expect(uploadButton).not.toHaveAttribute('disabled', '');
		userEvent.click(uploadButton);

		const file = new File(['(⌐□_□)'], fileVersionUpload.name, {
			type: fileVersionUpload.mime_type
		});
		const input = await screen.findByAltText(/Hidden file input/i);
		userEvent.upload(input, file);

		await screen.findByText(RegExp(`version ${versionUpload.version}`, 'i'));
		// uploaded version is visible and first version is removed from list
		expect(screen.getByText(RegExp(`version ${versionUpload.version}`, 'i'))).toBeVisible();
		expect(screen.queryByText(/version 1/i)).not.toBeInTheDocument();
	});

	test('remove keep forever action is enabled if max version of keep is reached', async () => {
		const fileVersions = [];
		const versions = [];
		const configs = populateConfigs();
		const maxKeepVersions = Number(
			find(configs, (config) => config.name === CONFIGS.MAX_KEEP_VERSIONS)?.value || 0
		);
		const baseFile = populateFile();
		baseFile.permissions.can_write_file = true;
		for (let i = 0; i < maxKeepVersions; i += 1) {
			const fileVersion = { ...baseFile };
			fileVersion.version = i + 1;
			fileVersion.keep_forever = true;
			const version = getVersionFromFile(fileVersion);
			fileVersions.unshift(fileVersion);
			versions.unshift(version);
		}

		const mocks = [
			mockGetConfigs(),
			mockGetVersions({ node_id: baseFile.id }, versions as FilesFile[]),
			mockKeepVersions({ node_id: baseFile.id, versions: [1], keep_forever: false }, [1])
		];

		render(<Versioning node={baseFile} />, { mocks });
		await screen.findByText(/Version 1/i);

		expect(screen.getAllByText(/Version \d+/)).toHaveLength(versions.length);
		expect(screen.getAllByTestId('icon: InfinityOutline')).toHaveLength(maxKeepVersions);

		const versionIcons = screen.getByTestId(`version1-icons`);
		expect(within(versionIcons).getByTestId('icon: InfinityOutline')).toBeVisible();
		const versionMoreButton = within(versionIcons).getByTestId('icon: MoreVerticalOutline');
		userEvent.click(versionMoreButton);

		const keepVersionItem = await screen.findByText(/remove keep forever/i);
		expect(keepVersionItem.parentElement).not.toHaveAttribute('disabled', '');
		userEvent.click(keepVersionItem);

		const snackbar = await screen.findByText(/Keep forever removed/i);
		await waitForElementToBeRemoved(snackbar);
		expect(screen.queryByText(/rmeove keep forever/i)).not.toBeInTheDocument();
		expect(within(versionIcons).queryByTestId('icon: InfinityOutline')).not.toBeInTheDocument();
		expect(screen.getAllByTestId('icon: InfinityOutline')).toHaveLength(maxKeepVersions - 1);
	});

	test('delete version is enabled if max number of versions is reached and node is not marked to be kept forever', async () => {
		const fileVersions = [];
		const versions = [];
		const configs = populateConfigs();
		const maxVersions = Number(
			find(configs, (config) => config.name === CONFIGS.MAX_VERSIONS)?.value || 0
		);
		const baseFile = populateFile();
		baseFile.permissions.can_write_file = true;
		for (let i = 0; i < maxVersions; i += 1) {
			const fileVersion = { ...baseFile };
			fileVersion.version = i + 1;
			fileVersion.keep_forever = false;
			const version = getVersionFromFile(fileVersion);
			fileVersions.unshift(fileVersion);
			versions.unshift(version);
		}

		const mocks = [
			mockGetConfigs(),
			mockGetVersions({ node_id: baseFile.id }, versions as FilesFile[]),
			mockDeleteVersions({ node_id: baseFile.id, versions: [1] }, [1])
		];

		render(<Versioning node={baseFile} />, { mocks });
		await screen.findByText(/Version 1/i);

		expect(screen.getAllByText(/Version \d+/)).toHaveLength(maxVersions);

		const version2Icons = screen.getByTestId('version1-icons');
		const version2MoreButton = within(version2Icons).getByTestId('icon: MoreVerticalOutline');
		userEvent.click(version2MoreButton);

		const deleteVersionItem = await screen.findByText(/delete version/i);
		expect(deleteVersionItem).not.toHaveAttribute('disabled', '');
		userEvent.click(deleteVersionItem);
		await waitForNetworkResponse();
		await waitFor(() => expect(screen.getAllByText(/version \d+/i)).toHaveLength(maxVersions - 1));
		expect(screen.getAllByText(/Version \d+/)).toHaveLength(maxVersions - 1);
		expect(screen.queryByText(/version 1/i)).not.toBeInTheDocument();
	});

	test('purge all is enabled if max number of versions is reached', async () => {
		const fileVersions = [];
		const versions = [];
		const configs = populateConfigs();
		const maxVersions = Number(
			find(configs, (config) => config.name === CONFIGS.MAX_VERSIONS)?.value || 0
		);
		const baseFile = populateFile();
		baseFile.permissions.can_write_file = true;
		for (let i = 0; i < maxVersions; i += 1) {
			const fileVersion = { ...baseFile };
			fileVersion.version = i + 1;
			fileVersion.keep_forever = false;
			const version = getVersionFromFile(fileVersion);
			fileVersions.unshift(fileVersion);
			versions.unshift(version);
		}

		const purgedVersions = map(versions.slice(1), (version) => version.version);
		const mocks = [
			mockGetConfigs(),
			mockGetVersions({ node_id: baseFile.id }, versions as FilesFile[]),
			mockDeleteVersions({ node_id: baseFile.id }, purgedVersions)
		];

		render(<Versioning node={baseFile} />, { mocks });
		await screen.findByText(/Version 1/i);

		expect(screen.getAllByText(/Version \d+/)).toHaveLength(maxVersions);

		const purgeAllButton = await screen.findByRole('button', { name: /purge all versions/i });
		expect(purgeAllButton).not.toHaveAttribute('disabled', '');
		userEvent.click(purgeAllButton);
		await screen.findByText(
			/All versions that are not marked to be kept forever, except the current one, will be deleted/i
		);
		const purgeAllButtons = screen.getAllByRole('button', { name: /purge all versions/i });
		expect(purgeAllButtons).toHaveLength(2);
		const purgeAllModalButton = find(purgeAllButtons, (button) => button !== purgeAllButton);
		expect(purgeAllModalButton).toBeDefined();
		userEvent.click(purgeAllModalButton as HTMLElement);
		await screen.findByRole('button', { name: /purge all versions/i });
		// only version 1 is visible
		expect(screen.getByText(/version \d+/i)).toBeVisible();
		expect(screen.getByText(RegExp(`version ${maxVersions}`, 'i'))).toBeVisible();
	});

	test('clone version is disabled and shows a tooltip if user does not have write permissions', async () => {
		const fileVersions = [];
		const versions = [];
		const baseFile = populateFile();
		baseFile.permissions.can_write_file = false;
		const maxVersions = 10;
		for (let i = 0; i < maxVersions - 2; i += 1) {
			const fileVersion = { ...baseFile };
			fileVersion.version = i + 1;
			const version = getVersionFromFile(fileVersion);
			fileVersions.unshift(fileVersion);
			versions.unshift(version);
		}

		const mocks = [
			mockGetConfigs(
				populateConfigs({
					[CONFIGS.MAX_VERSIONS]: `${maxVersions}`
				})
			),
			mockGetVersions({ node_id: baseFile.id }, versions as FilesFile[])
		];

		render(<Versioning node={baseFile} />, { mocks });
		await screen.findByText(/Version 1/i);

		expect(screen.getAllByText(/Version \d+/)).toHaveLength(versions.length);

		const versions1Icons = screen.getByTestId('version1-icons');
		const versions1MoreButton = within(versions1Icons).getByTestId('icon: MoreVerticalOutline');
		userEvent.click(versions1MoreButton);

		const cloneAsCurrentItem = await screen.findByText(/clone as current/i);
		expect(cloneAsCurrentItem).toHaveAttribute('disabled', '');
		userEvent.click(cloneAsCurrentItem);

		await waitForNetworkResponse();
		expect(screen.queryByText(/Version cloned as the current one/i)).not.toBeInTheDocument();
		// number of version is not changed
		expect(screen.getAllByText(/Version \d+/)).toHaveLength(versions.length);

		// hover on action shows a tooltip
		userEvent.hover(cloneAsCurrentItem);
		const tooltip = await screen.findByText(/you don't have the correct permissions/i);
		expect(tooltip).toBeVisible();
		act(() => {
			userEvent.unhover(cloneAsCurrentItem);
		});
		expect(tooltip).not.toBeInTheDocument();
	});

	test('delete version is disabled and shows a tooltip if user does not have write permissions', async () => {
		const fileVersions = [];
		const versions = [];
		const baseFile = populateFile();
		baseFile.permissions.can_write_file = false;
		const maxVersions = 10;
		for (let i = 0; i < maxVersions - 2; i += 1) {
			const fileVersion = { ...baseFile };
			fileVersion.version = i + 1;
			const version = getVersionFromFile(fileVersion);
			fileVersions.unshift(fileVersion);
			versions.unshift(version);
		}

		const mocks = [
			mockGetConfigs(
				populateConfigs({
					[CONFIGS.MAX_VERSIONS]: `${maxVersions}`
				})
			),
			mockGetVersions({ node_id: baseFile.id }, versions as FilesFile[])
		];

		render(<Versioning node={baseFile} />, { mocks });
		await screen.findByText(/Version 1/i);

		expect(screen.getAllByText(/Version \d+/)).toHaveLength(versions.length);

		const versions1Icons = screen.getByTestId('version1-icons');
		const versions1MoreButton = within(versions1Icons).getByTestId('icon: MoreVerticalOutline');
		userEvent.click(versions1MoreButton);

		const deleteVersion = await screen.findByText(/delete version/i);
		expect(deleteVersion).toHaveAttribute('disabled', '');
		userEvent.click(deleteVersion);

		await waitForNetworkResponse();
		expect(screen.getByText(/version 1/i)).toBeVisible();
		// number of version is not changed
		expect(screen.getAllByText(/Version \d+/)).toHaveLength(versions.length);

		// hover on action shows a tooltip
		userEvent.hover(deleteVersion);
		const tooltip = await screen.findByText(/you don't have the correct permissions/i);
		expect(tooltip).toBeVisible();
		act(() => {
			userEvent.unhover(deleteVersion);
		});
		expect(tooltip).not.toBeInTheDocument();
	});

	test('open with docs is disabled and shows a tooltip if file cannot be opened with docs', async () => {
		const baseFile = populateFile();
		baseFile.mime_type = 'image/png';
		baseFile.type = NodeType.Image;
		baseFile.extension = 'png';
		baseFile.permissions.can_write_file = true;
		const version = getVersionFromFile(baseFile);
		const versions = [version];

		const openNodeWithDocsSpy = jest.fn();
		jest.spyOn(moduleUtils, 'openNodeWithDocs').mockImplementation(openNodeWithDocsSpy);

		const mocks = [
			mockGetConfigs(),
			mockGetVersions({ node_id: baseFile.id }, versions as FilesFile[])
		];

		render(<Versioning node={baseFile} />, { mocks });
		await screen.findByText(/Version 1/i);

		expect(screen.getAllByText(/Version \d+/)).toHaveLength(versions.length);

		const versions1Icons = screen.getByTestId('version1-icons');
		const versions1MoreButton = within(versions1Icons).getByTestId('icon: MoreVerticalOutline');
		userEvent.click(versions1MoreButton);

		const openDocumentVersion = await screen.findByText(/open document version/i);
		expect(openDocumentVersion).toHaveAttribute('disabled', '');
		userEvent.click(openDocumentVersion);
		await waitForNetworkResponse();
		expect(openNodeWithDocsSpy).not.toHaveBeenCalled();

		// hover on action shows a tooltip
		userEvent.hover(openDocumentVersion);
		const tooltip = await screen.findByText(/This version cannot be opened by the online editor/i);
		expect(tooltip).toBeVisible();
		act(() => {
			userEvent.unhover(openDocumentVersion);
		});
		expect(tooltip).not.toBeInTheDocument();
	});

	test('keep version forever is disabled and shows a tooltip if user does not have permissions', async () => {
		const baseFile = populateFile();
		baseFile.permissions.can_write_file = false;
		const version = getVersionFromFile(baseFile);
		const versions = [version];

		const mocks = [
			mockGetConfigs(),
			mockGetVersions({ node_id: baseFile.id }, versions as FilesFile[])
		];

		render(<Versioning node={baseFile} />, { mocks });
		await screen.findByText(/Version 1/i);

		expect(screen.getAllByText(/Version \d+/)).toHaveLength(versions.length);

		const versions1Icons = screen.getByTestId('version1-icons');
		const versions1MoreButton = within(versions1Icons).getByTestId('icon: MoreVerticalOutline');
		userEvent.click(versions1MoreButton);

		const keepVersion = await screen.findByText(/(keep this version forever|remove keep forever)/i);
		expect(keepVersion).toHaveAttribute('disabled', '');
		userEvent.click(keepVersion);

		await waitForNetworkResponse();
		expect(screen.queryByText(/version marked as to be kept forever/i)).not.toBeInTheDocument();

		// hover on action shows a tooltip
		userEvent.hover(keepVersion);
		const tooltip = await screen.findByText(/you don't have the correct permissions/i);
		expect(tooltip).toBeVisible();
		act(() => {
			userEvent.unhover(keepVersion);
		});
		expect(tooltip).not.toBeInTheDocument();
	});
});
