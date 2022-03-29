/*
 * SPDX-FileCopyrightText: 2022 Zextras <https://www.zextras.com>
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */
import React, { useCallback, useMemo, useState } from 'react';

import {
	IconButton,
	Container,
	Padding,
	Portal,
	useCombinedRefs
} from '@zextras/carbonio-design-system';
import { Document, Page } from 'react-pdf/dist/esm/entry.webpack';
import styled from 'styled-components';

import FocusWithin from './FocusWithin';
import Header, { HeaderProps } from './Header';
import { PreviewCriteriaAlternativeContent } from './PreviewCriteriaAlternativeContent';
import map from "lodash/map";

const Overlay = styled.div`
	height: 100vh;
	max-height: 100vh;
	width: 100%;
	max-width: 100%;
	position: fixed;
	top: 0;
	left: 0;
	background-color: rgba(0, 0, 0, 0.8);
	display: flex;
	justify-content: center;
	align-items: center;
	z-index: 3;
`;

const MiddleContainer = styled(Container)`
	flex-grow: 1;
`;

const ExternalContainer = styled.div`
	height: 100vh;
	max-height: 100vh;
	width: 100vw;
	max-width: 100vw;
	display: flex;
	flex-direction: column;
`;

const PreviewerContainer = styled.div`
	display: flex;
	flex-grow: 1;
	flex-direction: column;
	justify-content: center;
	align-items: center;
	overflow: hidden;
	outline: none;
	& > .react-pdf__Document {
		padding-right: 17px;
		padding-bottom: 16px;
		overflow: auto;
		display: flex;
		gap: 16px;
		flex-direction: column;
		&::-webkit-scrollbar {
			width: 7px;
		}

		&::-webkit-scrollbar-track {
			background-color: transparent;
		}

		&::-webkit-scrollbar-thumb {
			background-color: ${({ theme }): string => theme.palette.gray3.regular};
			border-radius: 4px;
		}
	}
`;

type PdfPreviewerProps = Partial<HeaderProps> & {
	/**
	 * HTML node where to insert the Portal's children.
	 * The default value is 'window.top.document'.
	 * */
	container?: React.RefObject<HTMLElement>;
	/** Flag to disable the Portal implementation */
	disablePortal?: boolean;
	/** Flag to show or hide Portal's content */
	show: boolean;
	/** previewer img source */
	src: string;
	/** Callback to hide the previewer */
	onClose: (e: React.SyntheticEvent | KeyboardEvent) => void;
	useFallback?: boolean;
	/** CustomContent */
	customContent?: React.ReactElement;
};

const PdfPreviewer = React.forwardRef<HTMLDivElement, PdfPreviewerProps>(function PreviewerFn(
	{
		src,
		show,
		container,
		disablePortal,
		extension = '',
		filename = '',
		size = '',
		actions = [],
		onClose,
		useFallback = false,
		customContent,
		leftAction
	},
	ref
) {
	const previewerRef: React.MutableRefObject<HTMLDivElement | null> = useCombinedRefs(ref);

	const onOverlayClick = useCallback<React.ReactEventHandler>(
		(event) => {
			// TODO: stop propagation or not?
			event.stopPropagation();
			previewerRef.current &&
				!event.isDefaultPrevented() &&
				(previewerRef.current === event.target ||
					!previewerRef.current.contains(event.target as Node)) &&
				onClose(event);
		},
		[onClose, previewerRef]
	);

	const [numPages, setNumPages] = useState(null);
	const [scale, setScale] = useState(1);

	const pageElements = useMemo(() => {
		if (numPages) {
			const a = new Array(numPages);
			// eslint-disable-next-line arrow-body-style
			const mapped = map(a, (el, index, sasso) => {
				return <Page scale={scale} key={`page_${index + 1}`} pageNumber={index + 1} />;
			});
			return mapped;
		}
		return [];
	}, [numPages, scale]);

	const onDocumentLoadSuccess = useCallback((args) => {
		setNumPages(args.numPages);
	}, []);

	const $customContent = useMemo(() => {
		if (useFallback) {
			return customContent || <PreviewCriteriaAlternativeContent downloadSrc={src} openSrc={src} />;
		}
		return undefined;
	}, [customContent, src, useFallback]);

	return (
		<Portal show={show} disablePortal={disablePortal} container={container}>
			<Overlay onClick={onOverlayClick}>
				<FocusWithin>
					<ExternalContainer>
						<Header
							actions={actions}
							filename={filename}
							extension={extension}
							size={size}
							leftAction={leftAction}
						/>
						<MiddleContainer orientation="horizontal" crossAlignment="unset" minHeight={0}>
							<Container width="fit">
								<Padding left="small" right="small">
									<IconButton
										icon="ArrowBackOutline"
										size="medium"
										backgroundColor="gray0"
										iconColor="gray6"
										borderRadius="round"
									/>
								</Padding>
							</Container>
							<PreviewerContainer ref={previewerRef}>
								{!$customContent ? (
									<Document file={src} onLoadSuccess={onDocumentLoadSuccess}>
										{/*{Array.from(new Array(numPages), (el, index) => (*/}
										{/*	<Page scale={scale} key={`page_${index + 1}`} pageNumber={index + 1} />*/}
										{/*))}*/}
										{pageElements}
									</Document>
								) : (
									$customContent
								)}
							</PreviewerContainer>
							<Container width="fit">
								<Padding left="small" right="small">
									<IconButton
										icon="ArrowForwardOutline"
										size="medium"
										backgroundColor="gray0"
										iconColor="gray6"
										borderRadius="round"
									/>
								</Padding>
							</Container>
						</MiddleContainer>
					</ExternalContainer>
				</FocusWithin>
			</Overlay>
		</Portal>
	);
});

export default PdfPreviewer;
