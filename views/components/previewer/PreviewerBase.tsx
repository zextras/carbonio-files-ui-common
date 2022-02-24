/*
 * SPDX-FileCopyrightText: 2022 Zextras <https://www.zextras.com>
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Portal, useCombinedRefs } from '@zextras/carbonio-design-system';
import throttle from 'lodash/throttle';
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

const PreviewerContainer = styled.div.attrs({
	$paddingVertical: '32px',
	$paddingHorizontal: '16px',
	$gap: '8px'
})`
	display: flex;
	max-width: 100%;
	max-height: calc(100vh - ${({ $paddingVertical }): string => $paddingVertical} * 2);
	flex-direction: column;
	gap: ${({ $gap }): string => $gap};
	justify-content: center;
	align-items: center;
	overflow: hidden;
	padding: ${({ $paddingVertical, $paddingHorizontal }): string =>
		`${$paddingVertical} ${$paddingHorizontal}`};
	outline: none;
`;

const Header = styled.div<{ imageWidth?: number }>`
	width: ${({ imageWidth }): string => (imageWidth ? `${imageWidth}px` : '100%')};
`;

const Footer = styled.div<{ imageWidth?: number }>`
	width: ${({ imageWidth }): string => (imageWidth ? `${imageWidth}px` : '100%')};
`;

const Image = styled.img`
	max-height: 100%;
	max-width: 100%;
	min-height: 0;
	min-width: 0;
	align-self: center;
	filter: drop-shadow(0px 5px 14px rgba(0, 0, 0, 0.35));
	border-radius: 4px;
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

const PreviewerBase = React.forwardRef<HTMLDivElement, PreviewerBaseProps>(function PreviewerBaseFn(
	{ src, footer, header, show = false, container, disablePortal = false, alt, onClose },
	ref
) {
	const previewerRef: React.MutableRefObject<HTMLDivElement | null> = useCombinedRefs(ref);
	const imageRef = useRef<HTMLImageElement | null>(null);
	const headerRef = useRef<HTMLDivElement | null>(null);
	const footerRef = useRef<HTMLDivElement | null>(null);
	const [imageWidth, setImageWidth] = useState<number | undefined>(undefined);

	const escapeEvent = useCallback<(e: KeyboardEvent) => void>(
		(event) => {
			if (event.key === 'Escape') {
				onClose(event);
			}
		},
		[onClose]
	);

	const calcImageWidth = useMemo(
		() =>
			throttle(
				() => {
					if (imageRef.current) {
						const imgWidth = imageRef.current.width;
						const windowWidth = window.innerWidth;
						setImageWidth(imgWidth > windowWidth ? undefined : imgWidth);
					}
				},
				0,
				{ leading: true, trailing: true }
			),
		[]
	);

	useEffect(() => {
		const imageElement = imageRef.current;
		if (show) {
			if (imageElement) {
				window.addEventListener('resize', calcImageWidth);
			}
			document.addEventListener('keyup', escapeEvent);
		}

		return (): void => {
			window.removeEventListener('resize', calcImageWidth);
			document.removeEventListener('keyup', escapeEvent);
		};
	}, [calcImageWidth, escapeEvent, show]);

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

	return (
		<Portal show={show} disablePortal={disablePortal} container={container}>
			<Overlay onClick={onOverlayClick}>
				<FocusWithin>
					<PreviewerContainer ref={previewerRef}>
						<Header ref={headerRef} imageWidth={imageWidth}>
							{header}
						</Header>
						<Image
							alt={alt}
							src={src}
							onLoad={calcImageWidth}
							onError={(): void => console.log('TODO handle error')}
							ref={imageRef}
						/>
						<Footer ref={footerRef} imageWidth={imageWidth}>
							{footer}
						</Footer>
					</PreviewerContainer>
				</FocusWithin>
			</Overlay>
		</Portal>
	);
});

export default PreviewerBase;
