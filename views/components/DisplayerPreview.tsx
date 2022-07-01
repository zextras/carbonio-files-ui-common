/*
 * SPDX-FileCopyrightText: 2022 Zextras <https://www.zextras.com>
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */
import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { Button, Container, Icon, Text } from '@zextras/carbonio-design-system';
import { PreviewsManagerContext } from '@zextras/carbonio-ui-preview';
import debounce from 'lodash/debounce';
import { useTranslation } from 'react-i18next';
import styled from 'styled-components';

import { useActiveNode } from '../../../hooks/useActiveNode';
import { DISPLAYER_TABS, PREVIEW_MAX_SIZE, PREVIEW_TYPE } from '../../constants';
import { Node } from '../../types/common';
import { NodeType } from '../../types/graphql/types';
import { canOpenWithDocs } from '../../utils/ActionsFactory';
import {
	downloadNode,
	getDocumentPreviewSrc,
	getIconByFileType,
	getImgPreviewSrc,
	getPdfPreviewSrc,
	getPreviewThumbnailSrc,
	humanFileSize,
	openNodeWithDocs
} from '../../utils/utils';
import { FlexContainer } from './StyledComponents';

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
	const previewContainerRef = useRef<HTMLDivElement>(null);
	const { createPreview } = useContext(PreviewsManagerContext);
	const { setActiveNode } = useActiveNode();
	const [t] = useTranslation();
	const previewHeight = useMemo(() => Math.ceil(window.innerHeight / 3), []);
	const [loading, setLoading] = useState(true);
	const imgRef = useRef<HTMLImageElement>(null);
	const [previewSrc, setPreviewSrc] = useState<string | undefined>(undefined);
	const lastSuccessfulSrcRef = useRef<string | undefined>(undefined);
	const currentSrcRef = useRef<string | undefined>(undefined);
	const [error, setError] = useState(false);

	useEffect(() => {
		// reset states on id change
		setLoading(true);
		setPreviewSrc(undefined);
		setError(false);
		currentSrcRef.current = undefined;
		lastSuccessfulSrcRef.current = undefined;
	}, [id]);

	const openPreview = useCallback(() => {
		const actions = [
			{
				icon: 'ShareOutline',
				id: 'ShareOutline',
				tooltipLabel: t('preview.actions.tooltip.manageShares', 'Manage Shares'),
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
				useFallback: size !== undefined && size > PREVIEW_MAX_SIZE,
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

	const buildPreviewSrc = useCallback(() => {
		if (previewContainerRef.current) {
			const src = getPreviewThumbnailSrc(
				id,
				version,
				type,
				mimeType,
				previewContainerRef.current.clientWidth,
				previewHeight,
				'rectangular',
				'high',
				'jpeg'
			);
			setPreviewSrc(src);
			currentSrcRef.current = src;
		}
	}, [id, mimeType, previewHeight, type, version]);

	const handleResize = useMemo(
		() =>
			debounce(
				() => {
					setError(false);
					buildPreviewSrc();
				},
				150,
				{ leading: false, trailing: true }
			),
		[buildPreviewSrc]
	);

	useEffect(() => {
		window.addEventListener('resize', handleResize);
		// init state
		handleResize();

		return () => {
			handleResize.cancel();
			window.removeEventListener('resize', handleResize);
		};
	}, [handleResize]);

	const onLoadHandler = useCallback(() => {
		setLoading(false);
		setError(false);
		lastSuccessfulSrcRef.current = currentSrcRef.current;
	}, []);

	const onLoadErrorHandler = useCallback(() => {
		setLoading(false);
		// reset preview to last valid src
		currentSrcRef.current = lastSuccessfulSrcRef.current;
		setPreviewSrc(lastSuccessfulSrcRef.current);
		setError(lastSuccessfulSrcRef.current === undefined);
	}, []);

	useEffect(() => {
		const imgElement = imgRef.current;
		if (previewSrc && imgElement) {
			imgElement.addEventListener('load', onLoadHandler);
			imgElement.addEventListener('error', onLoadErrorHandler);
		}
		return () => {
			if (imgElement) {
				imgElement.removeEventListener('load', onLoadHandler);
				imgElement.removeEventListener('error', onLoadErrorHandler);
			}
		};
	}, [previewSrc, onLoadHandler, onLoadErrorHandler]);

	const reloadPreview = useCallback(() => {
		setLoading(true);
		buildPreviewSrc();
	}, [buildPreviewSrc]);

	return (
		<ImgContainer ref={previewContainerRef} maxWidth="100%" height={`${previewHeight}px`}>
			{loading && !error && (
				<FlexContainer orientation="vertical" gap="8px">
					<Icon icon="AnimatedLoader" size="large" />
					<Text size="extrasmall" overflow="break-word">
						{t('preview.loading.file', 'Loading file preview, please wait...')}
					</Text>
				</FlexContainer>
			)}
			{previewSrc && (!error || loading) && (
				<Img ref={imgRef} src={previewSrc} alt="" onDoubleClick={openPreview} />
			)}
			{error && (
				<FlexContainer orientation="vertical" gap="8px">
					<Icon icon={getIconByFileType(type, mimeType)} size="large" color="secondary" />
					<Text size="extrasmall" overflow="break-word">
						{loading
							? t('preview.loading.retrying', 'Trying loading of preview...')
							: t(
									'preview.loading.error',
									'An error occurred while loading the preview. Try again.'
							  )}
					</Text>
					{!loading && (
						<Button
							size="extrasmall"
							label={t('preview.button.refresh', 'Refresh preview')}
							onClick={reloadPreview}
						/>
					)}
					{loading && <Icon icon="AnimatedLoader" size="large" />}
				</FlexContainer>
			)}
		</ImgContainer>
	);
};
