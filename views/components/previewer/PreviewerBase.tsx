/* eslint-disable jsx-a11y/no-noninteractive-tabindex */
/*
 * SPDX-FileCopyrightText: 2022 Zextras <https://www.zextras.com>
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */
import React, { useCallback, useEffect, useRef } from 'react';

import { Portal, useCombinedRefs } from '@zextras/carbonio-design-system';
import styled from 'styled-components';

import FocusWithin from './FocusWithin';

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

const PreviewerContainer = styled.div`
	display: flex;
	max-width: 100%;
	max-height: 100vh;
	flex-direction: column;
	gap: 8px;
	//width: auto;
	//height: auto;
`;

const Header = styled.div`
	align-self: flex-end;
`;

const Footer = styled.div``;

const Content = styled.div`
	max-height: 100%;
	max-width: 100%;
`;

const Image = styled.img`
	max-height: 100%;
	max-width: 100%;
	min-height: 0;
	min-width: 0;
	//flex-basis: auto;
	//object-fit: scale-down;
	align-self: center;
`;

export interface PreviewerBaseProps {
	/**
	 * HTML node where to insert the Portal's children.
	 * The default value is 'window.top.document'.
	 * */
	container?: React.RefObject<HTMLElement>;
	/** Flag to disable the Portal implementation */
	disablePortal?: boolean;
	/** previewer footer */
	footer?: React.ReactElement;
	/** previewer header */
	header?: React.ReactElement;
	/** Flag to show or hide Portal's content */
	show: boolean;
	/** previewer img source */
	src: string;
	/** Alternative text for image */
	alt?: string;
	/** Callback to hide the previewer */
	onClose: (e: React.SyntheticEvent | KeyboardEvent) => void;
}

// TODO: allow usage of blob as data

function getRenderedSize(
	contains: boolean,
	cWidth: number,
	cHeight: number,
	width: number,
	height: number,
	pos: number
): { width: number; height: number; left: number; right: number } {
	const oRatio = width / height;
	const cRatio = cWidth / cHeight;
	const result = {
		width: 0,
		height: 0,
		left: 0,
		right: 0
	};
	if (contains ? oRatio > cRatio : oRatio < cRatio) {
		result.width = cWidth;
		result.height = cWidth / oRatio;
	} else {
		result.width = cHeight * oRatio;
		result.height = cHeight;
	}
	result.left = (cWidth - result.width) * (pos / 100);
	result.right = result.width + result.left;
	return result;
}

function getImgSizeInfo(img: HTMLImageElement): ReturnType<typeof getRenderedSize> {
	const pos = window.getComputedStyle(img).getPropertyValue('object-position').split(' ');
	return getRenderedSize(
		true,
		img.width,
		img.height,
		img.naturalWidth,
		img.naturalHeight,
		parseInt(pos[0], 10)
	);
}

const PreviewerBase = React.forwardRef<HTMLDivElement, PreviewerBaseProps>(function PreviewerBaseFn(
	{ src, footer, header, show = false, container, disablePortal = false, alt, onClose },
	ref
) {
	const previewerRef: React.MutableRefObject<HTMLDivElement | null> = useCombinedRefs(ref);
	const imageRef = useRef<HTMLImageElement | null>(null);

	const escapeEvent = useCallback<(e: KeyboardEvent) => void>(
		(event) => {
			if (event.key === 'Escape') {
				onClose(event);
			}
		},
		[onClose]
	);

	const calcPositions = useCallback(() => {
		if (imageRef.current) {
			console.log('image positions', getImgSizeInfo(imageRef.current));
		}
	}, []);

	useEffect(() => {
		const imageElement = imageRef.current;
		if (show) {
			if (imageElement) {
				imageElement.addEventListener('load', calcPositions);
				imageElement.addEventListener('resize', calcPositions);
			}
			document.addEventListener('keyup', escapeEvent);
		}

		return (): void => {
			if (imageElement) {
				imageElement.removeEventListener('load', calcPositions);
				imageElement.removeEventListener('resize', calcPositions);
			}
			document.removeEventListener('keyup', escapeEvent);
		};
	}, [calcPositions, escapeEvent, show]);

	const onOverlayClick = useCallback<React.ReactEventHandler>(
		(event) => {
			// TODO: stop propagation or not?
			event.stopPropagation();
			previewerRef.current &&
				!event.isDefaultPrevented() &&
				!previewerRef.current.contains(event.target as Node) &&
				onClose(event);
		},
		[onClose, previewerRef]
	);

	return (
		<Portal show={show} disablePortal={disablePortal} container={container}>
			<Overlay onClick={onOverlayClick}>
				<FocusWithin>
					<PreviewerContainer ref={previewerRef}>
						<Header>{header}</Header>
						<Image
							alt={alt}
							src={src}
							onError={(): void => console.log('TODO handle error')}
							ref={imageRef}
						/>
						<Footer>{footer}</Footer>
					</PreviewerContainer>
				</FocusWithin>
			</Overlay>
		</Portal>
	);
});

export default PreviewerBase;
