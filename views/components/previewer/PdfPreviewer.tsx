/*
 * SPDX-FileCopyrightText: 2022 Zextras <https://www.zextras.com>
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */
import React, { useCallback, useMemo, useState } from 'react';

import {
	Container,
	IconButton,
	Padding,
	Portal,
	Tooltip,
	useCombinedRefs
} from '@zextras/carbonio-design-system';
import map from 'lodash/map';
import { Document, Page } from 'react-pdf/dist/esm/entry.webpack';
import styled from 'styled-components';

import FocusWithin from './FocusWithin';
import Header, { HeaderProps } from './Header';
import { PreviewCriteriaAlternativeContent } from './PreviewCriteriaAlternativeContent';

const CustomIconButton = styled(IconButton)`
	& > svg {
		width: 20px;
		height: 20px;
	}
`;

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
	position: relative;
`;

const Navigator = styled.div`
	padding: 8px;
	display: flex;
	position: absolute;
	z-index: 1;
	bottom: 16px;
	background-color: ${({ theme }): string => theme.palette.gray0.regular};
	align-self: center;
`;

const PreviewerContainer = styled.div`
	display: flex;
	flex-direction: column;
	flex-grow: 1;
	//  https://bhch.github.io/posts/2021/04/centring-flex-items-and-allowing-overflow-scroll/
	//justify-content: center;
	//align-items: center;
	// justify-content and align-items conflict with overflow management
	overflow: auto;
	outline: none;

	&::-webkit-scrollbar {
		width: 7px;
		height: 7px;
	}

	&::-webkit-scrollbar-track {
		background-color: transparent;
	}

	&::-webkit-scrollbar-thumb {
		background-color: ${({ theme }): string => theme.palette.gray3.regular};
		border-radius: 4px;
	}

	& > .react-pdf__Document {
		//padding-right: 17px;
		padding-bottom: 16px;
		margin: auto;
		display: flex;
		gap: 16px;
		flex-direction: column;
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

const zoomStep = [800, 1000, 1200, 1400, 1600, 2000, 2400, 3200];

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

	const [currentZoomStep, setCurrentZoomStep] = useState(0);

	const [useFitToWidth, setUseFitToWidth] = useState(false);
	const [currentWidth, setCurrentWidth] = useState(0);

	const increaseOfOneStep = useCallback(
		(ev) => {
			ev.stopPropagation();
			if (zoomStep[currentZoomStep] !== zoomStep[zoomStep.length - 1]) {
				setCurrentZoomStep(currentZoomStep + 1);
				setUseFitToWidth(false);
			}
		},
		[currentZoomStep]
	);

	const fitToWidth = useCallback(
		(ev) => {
			ev.stopPropagation();
			if (previewerRef.current) {
				// console.log(previewerRef.current?.clientWidth);
				// console.log(previewerRef.current?.offsetWidth);
				setCurrentWidth(previewerRef.current?.clientWidth);
				setUseFitToWidth(true);
			}
		},
		[previewerRef]
	);

	const resetWidth = useCallback((ev) => {
		ev.stopPropagation();
		setCurrentZoomStep(0);
		setUseFitToWidth(false);
	}, []);

	const decreaseOfOneStep = useCallback(
		(ev) => {
			ev.stopPropagation();
			if (currentZoomStep > 0) {
				setCurrentZoomStep(currentZoomStep - 1);
				setUseFitToWidth(false);
			}
		},
		[currentZoomStep]
	);

	// could be useful for future implementations
	// const onPageLoadSuccess = useCallback(({ originalHeight, originalWidth, width, height }) => {
	// 	console.log(originalHeight, originalWidth, width, height);
	// }, []);

	const pageElements = useMemo(() => {
		if (numPages) {
			return map(new Array(numPages), (el, index) => (
				<Page
					key={`page_${index + 1}`}
					pageNumber={index + 1}
					// onLoadSuccess={index === 0 ? onPageLoadSuccess : undefined}
					width={useFitToWidth ? currentWidth : zoomStep[currentZoomStep]}
				/>
			));
		}
		return [];
	}, [currentWidth, currentZoomStep, numPages, useFitToWidth]);

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
						{!$customContent && (
							<Navigator>
								<Tooltip
									disabled={currentZoomStep === 0}
									label={'Decrease of one step'}
									key={'Minus'}
								>
									<CustomIconButton
										disabled={currentZoomStep === 0}
										icon="Minus"
										size="small"
										backgroundColor="gray0"
										iconColor="gray6"
										onClick={decreaseOfOneStep}
									/>
								</Tooltip>
								<Tooltip label={useFitToWidth ? 'Reset' : 'Fit to width'} key={'MaximizeOutline'}>
									<CustomIconButton
										icon={useFitToWidth ? 'MinimizeOutline' : 'MaximizeOutline'}
										size="small"
										backgroundColor="gray0"
										iconColor="gray6"
										onClick={useFitToWidth ? resetWidth : fitToWidth}
									/>
								</Tooltip>
								<Tooltip
									label={'Increase of one step'}
									key={'Plus'}
									disabled={currentZoomStep === zoomStep.length - 1}
								>
									<CustomIconButton
										icon="Plus"
										size="small"
										backgroundColor="gray0"
										iconColor="gray6"
										onClick={increaseOfOneStep}
										disabled={currentZoomStep === zoomStep.length - 1}
									/>
								</Tooltip>
							</Navigator>
						)}
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
