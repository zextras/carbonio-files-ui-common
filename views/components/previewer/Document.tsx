/*
 * SPDX-FileCopyrightText: 2022 Zextras <https://www.zextras.com>
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */
import React, { useEffect, useRef, useState } from 'react';

import { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist';
import * as pdfjsLib from 'pdfjs-dist/webpack';

interface AppProps {
	url: string;
}

const Document: React.VFC<AppProps> = ({ url }) => {
	const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
	const [page, setPage] = useState<PDFPageProxy | null>(null);

	const canvasRef = useRef<HTMLCanvasElement | null>(null);

	useEffect(() => {
		const loadingTask = pdfjsLib.getDocument(url);
		loadingTask.promise.then((document: PDFDocumentProxy) => {
			setDoc(document);
		});
	}, [url]);

	useEffect(() => {
		if (doc != null) {
			doc.getPage(1).then((_page) => {
				setPage(_page);
			});
		}
	}, [doc]);

	useEffect(() => {
		if (page != null && canvasRef.current != null) {
			const viewport = page.getViewport({ scale: 1 });
			const vw = Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0);
			const availableWidth = (vw / 100) * 90;
			if (viewport.width > availableWidth) {
				const scale = availableWidth / viewport.width;
				const scaledViewport = page.getViewport({ scale });
				const context = canvasRef.current.getContext('2d');
				canvasRef.current.height = scaledViewport.height;
				canvasRef.current.width = scaledViewport.width;
				if (context) {
					const renderContext = {
						canvasContext: context,
						viewport: scaledViewport
					};
					page.render(renderContext);
				}
			} else {
				const context = canvasRef.current.getContext('2d');
				canvasRef.current.height = viewport.height;
				canvasRef.current.width = viewport.width;
				if (context) {
					const renderContext = {
						canvasContext: context,
						viewport
					};
					page.render(renderContext);
				}
			}
		}
	}, [page]);

	return <canvas ref={canvasRef} />;
};

export default Document;
