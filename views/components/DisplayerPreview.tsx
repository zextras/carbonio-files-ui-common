/*
 * SPDX-FileCopyrightText: 2022 Zextras <https://www.zextras.com>
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */
import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { Container } from '@zextras/carbonio-design-system';
import { PreviewsManagerContext } from '@zextras/carbonio-ui-preview';
import debounce from 'lodash/debounce';
import { useTranslation } from 'react-i18next';
import styled from 'styled-components';

import { useActiveNode } from '../../../hooks/useActiveNode';
import { DISPLAYER_TABS, PREVIEW_TYPE } from '../../constants';
import { Node } from '../../types/common';
import { NodeType } from '../../types/graphql/types';
import { canOpenWithDocs } from '../../utils/ActionsFactory';
import {
	downloadNode,
	getDocumentPreviewSrc,
	getImgPreviewSrc,
	getPdfPreviewSrc,
	getPreviewThumbnailSrc,
	humanFileSize,
	openNodeWithDocs
} from '../../utils/utils';

const ImgContainer = styled(Container)`
	overflow: hidden;
`;

const Img = styled.img`
	cursor: pointer;
	border-radius: 2px;
`;

interface DisplayerPreviewProps {
	typeName: Node['__typename'];
	id: string;
	type: NodeType;
	mimeType: string | undefined;
	version: number | undefined;
	name?: string;
	extension?: string | undefined;
	size?: number | undefined;
	previewType: typeof PREVIEW_TYPE[keyof typeof PREVIEW_TYPE];
}

export const DisplayerPreview: React.VFC<DisplayerPreviewProps> = ({
	typeName,
	id,
	type,
	mimeType,
	version,
	name,
	extension,
	size,
	previewType
}) => {
	const [previewSize, setPreviewSize] = useState<{
		height: number;
		width: number;
	}>();
	const previewContainerRef = useRef<HTMLDivElement>(null);
	const { createPreview } = useContext(PreviewsManagerContext);
	const { setActiveNode } = useActiveNode();
	const [t] = useTranslation();

	const openPreview = useCallback(() => {
		const actions = [
			{
				icon: 'DriveOutline',
				id: 'DriveOutline',
				tooltipLabel: t('preview.actions.tooltip.addCollaborator', 'Add collaborator'),
				onClick: (): void => setActiveNode(id, DISPLAYER_TABS.sharing)
			},
			{
				icon: 'DownloadOutline',
				tooltipLabel: t('preview.actions.tooltip.download', 'Download'),
				id: 'DownloadOutline',
				onClick: (): void => downloadNode(id)
			}
		];
		const closeAction = {
			id: 'close-action',
			icon: 'ArrowBackOutline',
			tooltipLabel: t('preview.close.tooltip', 'Close')
		};
		if (previewType === PREVIEW_TYPE.IMAGE) {
			createPreview({
				previewType: 'image',
				filename: name,
				extension: extension || undefined,
				size: (size && humanFileSize(size)) || undefined,
				actions,
				closeAction,
				src: version ? getImgPreviewSrc(id, version, 0, 0, 'high') : ''
			});
		} else {
			// if supported, open document with preview
			const src =
				(version &&
					((previewType === PREVIEW_TYPE.PDF && getPdfPreviewSrc(id, version)) ||
						(previewType === PREVIEW_TYPE.DOCUMENT && getDocumentPreviewSrc(id, version)))) ||
				'';

			// FIXME: improve to remove cast
			if (canOpenWithDocs([{ __typename: typeName, id, type } as Node])) {
				actions.unshift({
					id: 'OpenWithDocs',
					icon: 'BookOpenOutline',
					tooltipLabel: t('actions.openWithDocs', 'Open document'),
					onClick: (): void => openNodeWithDocs(id)
				});
			}
			createPreview({
				previewType: 'pdf',
				filename: name,
				extension: extension || undefined,
				size: (size && humanFileSize(size)) || undefined,
				useFallback: !!size && size > 20971520,
				actions,
				closeAction,
				src
			});
		}
	}, [
		t,
		previewType,
		setActiveNode,
		id,
		createPreview,
		name,
		extension,
		size,
		version,
		typeName,
		type
	]);

	const handleResize = useMemo(
		() =>
			debounce(
				() => {
					if (previewContainerRef.current) {
						setPreviewSize({
							width: previewContainerRef.current.clientWidth,
							height: Math.ceil(window.innerHeight / 3)
						});
					}
				},
				150,
				{ leading: false, trailing: true }
			),
		[]
	);

	useEffect(() => {
		window.addEventListener('resize', handleResize);
		// call handler to init state
		handleResize();

		return () => {
			handleResize.cancel();
			window.removeEventListener('resize', handleResize);
		};
	}, [handleResize]);

	const previewSrc = useMemo(
		() =>
			previewSize &&
			getPreviewThumbnailSrc(
				id,
				version,
				type,
				mimeType,
				previewSize.width,
				previewSize.height,
				'rectangular',
				'high',
				'jpeg'
			),
		[id, mimeType, previewSize, type, version]
	);

	return (
		<ImgContainer ref={previewContainerRef} maxWidth="100%" height="auto">
			{previewSrc && <Img src={previewSrc} alt="" onDoubleClick={openPreview} />}
		</ImgContainer>
	);
};
