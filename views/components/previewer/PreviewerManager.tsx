/*
 * SPDX-FileCopyrightText: 2021 Zextras <https://www.zextras.com>
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import React, { useCallback, createContext, useReducer, useContext } from 'react';

import { PreviewerWrapper, PreviewerWrapperProps } from './PreviewerWrapper';

const PreviewersManagerContext = createContext<{
	createPreviewer: (args: PreviewerWrapperProps) => void;
}>({
	createPreviewer: () => console.log('')
});

const PreviewerManager: React.FC = ({ children }) => {
	const [previewers, dispatchPreviewers] = useReducer(
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

	const createPreviewer = useCallback(
		({ onClose, ...props }) => {
			const closePreviewer = (): void => {
				if (onClose) onClose();
				dispatchPreviewers({ type: 'empty' });
			};

			const previewer = <PreviewerWrapper {...props} show onClose={closePreviewer} />;

			dispatchPreviewers({
				type: 'set',
				value: previewer
			});
		},
		[dispatchPreviewers]
	);

	return (
		<>
			<PreviewersManagerContext.Provider value={{ createPreviewer }}>
				{children}
			</PreviewersManagerContext.Provider>
			{previewers}
		</>
	);
};

const usePreviewer: any = () => useContext(PreviewersManagerContext);

export { PreviewersManagerContext, PreviewerManager, usePreviewer };
