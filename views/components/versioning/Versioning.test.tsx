/*
 * SPDX-FileCopyrightText: 2022 Zextras <https://www.zextras.com>
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */
import React from 'react';

import { screen, waitFor, waitForElementToBeRemoved, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { graphql, rest } from 'msw';

import server from '../../../../mocks/server';
import { REST_ENDPOINT, UPLOAD_VERSION_PATH } from '../../../constants';
import {
	UploadRequestBody,
	UploadVersionRequestParams,
	UploadVersionResponse
} from '../../../mocks/handleUploadVersionRequest';
import { getVersionFromFile, incrementVersion, populateFile } from '../../../mocks/mockUtils';
import {
	File as FilesFile,
	GetVersionsQuery,
	GetVersionsQueryVariables
} from '../../../types/graphql/types';
import {
	mockCloneVersion,
	mockDeleteVersions,
	mockGetVersions,
	mockKeepVersions
} from '../../../utils/mockUtils';
import { render, waitForNetworkResponse } from '../../../utils/testUtils';
import { getChipLabel } from '../../../utils/utils';
import * as moduleUtils from '../../../utils/utils';
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
			await waitFor(() => expect(screen.getAllByText(/Version [0-9]+/)).toHaveLength(4));
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

			await waitFor(() => expect(screen.getAllByText(/Version [0-9]+/)).toHaveLength(2));
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

		expect(screen.getAllByText(/Version [0-9]+/)).toHaveLength(2);

		const versions2Icons = screen.getByTestId('version2-icons');
		const versions2MoreButton = within(versions2Icons).getByTestId('icon: MoreVerticalOutline');
		userEvent.click(versions2MoreButton);

		const cloneAsCurrentItem = await screen.findByText(/clone as current/i);
		userEvent.click(cloneAsCurrentItem);

		const snackbar = await screen.findByText(/Version cloned as the current one/i);
		await waitForElementToBeRemoved(snackbar);
		expect(screen.getAllByText(/Version [0-9]+/)).toHaveLength(3);
	});

	test('download version', async () => {
		const downloadSpy = jest.spyOn(moduleUtils, 'downloadNode');

		const fileVersion1 = populateFile();
		fileVersion1.permissions.can_write_file = true;

		const version1 = getVersionFromFile(fileVersion1);

		const mocks = [mockGetVersions({ node_id: fileVersion1.id }, [version1 as FilesFile])];

		render(<Versioning node={fileVersion1} />, { mocks });
		await screen.findByText(getChipLabel(fileVersion1.last_editor));

		const version1LastEditor = screen.getByText(getChipLabel(version1.last_editor));
		expect(version1LastEditor).toBeVisible();

		expect(screen.getByText('Current version')).toBeVisible();

		expect(screen.getByText(/Version [0-9]+/)).toBeInTheDocument();

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

		const mocks = [mockGetVersions({ node_id: fileVersion1.id }, [version1 as FilesFile])];

		render(<Versioning node={fileVersion1} />, { mocks });
		await screen.findByText(getChipLabel(fileVersion1.last_editor));

		const version1LastEditor = screen.getByText(getChipLabel(version1.last_editor));
		expect(version1LastEditor).toBeVisible();

		expect(screen.getByText('Current version')).toBeVisible();

		expect(screen.getByText(/Version [0-9]+/)).toBeInTheDocument();

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

		const mocks = [
			mockGetVersions({ node_id: fileVersion4.id }, [
				version4 as FilesFile,
				version3 as FilesFile,
				version2 as FilesFile,
				version1 as FilesFile
			]),
			mockGetVersions({ node_id: fileVersion4.id, versions: [5] }, [version5 as FilesFile])
		];

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
				res(ctx.data({ getVersions: [version5] }))
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
		expect(screen.getAllByText(/Version [0-9]+/)).toHaveLength(4);

		const uploadButton = await screen.findByRole('button', { name: /upload version/i });
		userEvent.click(uploadButton);

		const file = new File(['(⌐□_□)'], fileVersion5.name, { type: fileVersion5.mime_type });
		const input = await screen.findByAltText(/Hidden file input/i);
		userEvent.upload(input, file);

		await waitFor(() => expect(screen.getAllByText(/Version [0-9]+/)).toHaveLength(5));
		const version5LastEditor = screen.getByText(getChipLabel(version5.last_editor));
		expect(version5LastEditor).toBeVisible();
	});
});
