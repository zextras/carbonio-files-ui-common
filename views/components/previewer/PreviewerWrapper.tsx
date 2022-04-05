/*
 * SPDX-FileCopyrightText: 2022 Zextras <https://www.zextras.com>
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */
import React from 'react';

import ImagePreviewer, { ImagePreviewerProps } from './ImagePreviewer';
import PdfPreviewer, { PdfPreviewerProps } from './PdfPreviewer';

type PreviewersProps = ImagePreviewerProps | PdfPreviewerProps;

export type PreviewerWrapperProps = PreviewersProps & {
	previewerType: 'pdf' | 'image';
};

export const PreviewerWrapper: React.VFC<PreviewerWrapperProps> = ({ previewerType, ...props }) =>
	previewerType === 'pdf' ? <PdfPreviewer {...props} /> : <ImagePreviewer {...props} />;
