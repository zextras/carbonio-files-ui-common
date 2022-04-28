/*
 * SPDX-FileCopyrightText: 2022 Zextras <https://www.zextras.com>
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

/* eslint-disable jsx-a11y/no-autofocus */
import React, { useCallback, useEffect, useRef, useState } from 'react';

import { FetchResult } from '@apollo/client';
import { Input, Row, Text } from '@zextras/carbonio-design-system';
import trim from 'lodash/trim';
import { useTranslation } from 'react-i18next';

import { CreateDocsFile } from '../../types/common';
import { CreateFolderMutation, UpdateNodeMutation } from '../../types/graphql/types';
import { decodeError } from '../../utils/utils';
import { ModalFooter } from './ModalFooter';

type UpdateNameMutation = UpdateNodeMutation | CreateFolderMutation | CreateDocsFile;

interface UpdateNodeNameModalProps<T extends UpdateNameMutation> {
	nodeId: string;
	nodeName: string;
	inputLabel: string;
	confirmLabel: string;
	confirmAction: (nodeId: string, newName: string) => Promise<FetchResult<T>>;
	closeAction?: () => void;
}

export const UpdateNodeNameModalContent = <T extends UpdateNameMutation>({
	nodeId,
	nodeName,
	inputLabel,
	confirmLabel,
	confirmAction,
	closeAction
}: UpdateNodeNameModalProps<T>): JSX.Element => {
	const [t] = useTranslation();
	const [newName, setNewName] = useState(nodeName || '');
	const [errorMsg, setErrorMsg] = useState<string>();
	const inputRef = useRef<HTMLInputElement>();

	useEffect(() => {
		const timer = window.setTimeout(() => {
			inputRef.current && inputRef.current.focus();
		}, 1);

		return (): void => {
			clearTimeout(timer);
		};
	}, []);

	const changeName = useCallback<React.ChangeEventHandler<HTMLInputElement>>(
		({ target: { value } }) => {
			if (trim(value).length === 0) {
				setNewName('');
			} else {
				setNewName(value);
			}
		},
		[]
	);

	const [pendingRequest, setPendingRequest] = useState(false);

	const confirmHandler = useCallback(() => {
		if (!pendingRequest) {
			setPendingRequest(true);
			confirmAction(nodeId, trim(newName))
				.then(() => {
					setPendingRequest(false);
					closeAction && closeAction();
				})
				.catch((err) => {
					setPendingRequest(false);
					setErrorMsg(decodeError(err, t) || 'something went wrong');
				});
		}
	}, [closeAction, confirmAction, newName, nodeId, pendingRequest, t]);

	const keyUpHandler = useCallback<React.KeyboardEventHandler<HTMLInputElement>>(
		(event) => {
			if (event.key === 'Enter') {
				confirmHandler();
			}
		},
		[confirmHandler]
	);

	return (
		<>
			<Input
				value={newName}
				onChange={changeName}
				label={inputLabel}
				data-testid="input-name"
				inputRef={inputRef}
				onKeyUp={keyUpHandler}
			/>
			{/* TODO: remove this error in favor of the input one */}
			{errorMsg && (
				<Row padding={{ top: 'small' }}>
					<Text color="error" overflow="break-word" size="small">
						{errorMsg}
					</Text>
				</Row>
			)}
			<ModalFooter
				confirmLabel={confirmLabel}
				confirmHandler={confirmHandler}
				confirmDisabled={!newName || newName === nodeName || pendingRequest}
			/>
		</>
	);
};
