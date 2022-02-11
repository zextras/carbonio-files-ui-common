/*
 * SPDX-FileCopyrightText: 2022 Zextras <https://www.zextras.com>
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import faker from 'faker';
import { ResponseResolver, RestContext, RestRequest } from 'msw';

interface UploadResponse {
	nodeId: string;
}

interface UploadRequestParams {
	Filename: string;
	Description?: string;
	ParentId?: string;
}

interface UploadRequestBody {
	file: File;
}

const handleUploadFileRequest: ResponseResolver<
	RestRequest<UploadRequestBody, UploadRequestParams>,
	RestContext,
	UploadResponse
> = (req, res, ctx) =>
	res(
		ctx.json({
			nodeId: faker.datatype.uuid()
		})
	);

export default handleUploadFileRequest;
