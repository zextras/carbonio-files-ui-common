/*
 * SPDX-FileCopyrightText: 2022 Zextras <https://www.zextras.com>
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */
import React, { useCallback } from 'react';

import { Portal, useCombinedRefs } from '@zextras/carbonio-design-system';
import styled from 'styled-components';

import Document from './Document';
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
	max-width: 90vw;
	max-height: calc(100vh - ${({ $paddingVertical }): string => $paddingVertical} * 2);
	flex-direction: column;
	gap: ${({ $gap }): string => $gap};
	justify-content: center;
	align-items: center;
	overflow: auto;
	padding: ${({ $paddingVertical, $paddingHorizontal }): string =>
		`${$paddingVertical} ${$paddingHorizontal}`};
	outline: none;
	& > .react-pdf__Document {
		overflow: auto;
		height: 100%;
		width: 100%;
	}
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
						<Document url={src} />
					</PreviewerContainer>
				</FocusWithin>
			</Overlay>
		</Portal>
	);
});

export default PreviewerBase;
