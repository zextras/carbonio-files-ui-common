/*
 * SPDX-FileCopyrightText: 2021 Zextras <https://www.zextras.com>
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import React, { useCallback, createContext, useReducer, useContext } from 'react';

import { PreviewWrapper, PreviewWrapperProps } from './PreviewWrapper';

const PreviewsManagerContext = createContext<{
	createPreview: (args: PreviewWrapperProps) => void;
}>({
	createPreview: () => console.log('')
});

const PreviewManager: React.FC = ({ children }) => {
	const [previews, dispatchPreviews] = useReducer(
		(state: Array<React.ReactElement>, action: any) => {
			switch (action.type) {
				case 'set': {
					return [...state, action.value];
				}
				case 'empty': {
					return [];
				}
				default: {
					return state;
				}
			}
		},
		[]
	);

	const createPreview = useCallback(
		({ onClose, ...props }) => {
			const closePreview = (): void => {
				if (onClose) onClose();
				dispatchPreviews({ type: 'empty' });
			};

			const preview = <PreviewWrapper {...props} show onClose={closePreview} />;

			dispatchPreviews({
				type: 'set',
				value: preview
			});
		},
		[dispatchPreviews]
	);

	return (
		<>
			<PreviewsManagerContext.Provider value={{ createPreview }}>
				{children}
			</PreviewsManagerContext.Provider>
			{previews}
		</>
	);
};

const usePreview: any = () => useContext(PreviewsManagerContext);

export { PreviewsManagerContext, PreviewManager, usePreview };
