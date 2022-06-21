/*
 * SPDX-FileCopyrightText: 2022 Zextras <https://www.zextras.com>
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

/* eslint-disable jsx-a11y/no-static-element-interactions */
import React, { useState, useEffect, useRef, useReducer, useCallback, useMemo } from 'react';

import { Container, Divider, Text, useCombinedRefs } from '@zextras/carbonio-design-system';
import filter from 'lodash/filter';
import findIndex from 'lodash/findIndex';
import map from 'lodash/map';
import noop from 'lodash/noop';
import slice from 'lodash/slice';
import styled, { css } from 'styled-components';

import { AddShareChip } from '../views/components/sharing/AddShareChip';
import { useKeyboard, getKeyboardPreset } from './useKeyboard';

const Placeholder = styled(Text)`
	position: absolute;
	top: 50%;
	left: 0;
	transform: translateY(-50%);
	transition: transform 150ms ease-out, font-size 150ms ease-out, top 150ms ease-out;
	font-size: ${(props) => props.theme.sizes.font.medium};
	color: ${({ theme }) => theme.palette.secondary.regular};
	user-select: none;
`;
const ChipInputContainer = styled.div`
	background-color: ${({ theme }) => theme.palette.gray5.regular};
	width: 100%;
	padding: ${(props) =>
		`${props.theme.sizes.padding.extrasmall} ${props.theme.sizes.padding.large}`};
	box-sizing: border-box;
	cursor: text;

	&:focus {
		outline: 1px solid #eee;
	}
	${({ theme, active }) =>
		active &&
		css`
			${Placeholder} {
				top: 3px;
				transform: translateY(0);
				font-size: ${theme.sizes.font.small};
			}
		`};
	${(props) =>
		props.hasFocus &&
		css`
			${Placeholder} {
				color: ${({ theme }) => theme.palette.primary.regular};
			}
		`};
`;
const ChipInputWrapper = styled.div`
	position: relative;
	display: flex;
	align-items: center;
	flex-wrap: wrap;
	padding: ${(props) => props.theme.sizes.avatar.small.diameter} 0 0;

	> div {
		margin: calc(${(props) => props.theme.sizes.padding.extrasmall} / 2);
		margin-left: 0;
	}
`;
const InputContainer = styled.div`
	flex-grow: 1;
	min-width: 10px;
	max-width: 100%;
	font-family: 'Roboto', sans-serif;
	color: ${({ theme }) => theme.palette.text.regular};
	overflow: hidden;

	> div {
		min-height: ${({ theme }) =>
			`calc(${theme.sizes.avatar.small.diameter} + ${theme.sizes.padding.extrasmall} * 2)`};
		font-size: ${({ theme }) => theme.sizes.font.medium};
		line-height: ${({ theme }) =>
			`calc(${theme.sizes.avatar.small.diameter} + ${theme.sizes.padding.extrasmall} * 2)`};

		&:focus {
			outline: none;
		}
	}
`;

function reducer(state, action) {
	switch (action.type) {
		case 'push':
			return [...state, action.contact];
		case 'pop':
			return filter(state, (value, index) => action.index !== index);
		case 'popLast':
			return slice(state, 0, state.length - 1);
		case 'reset':
			return action.value;
		case 'update': {
			const idx = findIndex(state, (item) => item.id === action.id);
			state[idx] = { ...state[idx], ...action.updatedFields };
			return [...state];
		}
		default:
			throw new Error();
	}
}

export const ShareChipInput = React.forwardRef(function ChipInputFn(
	{
		/** Input's Placeholder */
		placeholder = '',
		/** Input's value */
		value = [],
		/** Callback to call when Input's value changes */
		onChange = undefined,
		/** Chip label getter, receives the single value item as prop */
		getChipLabel = (item) => item.value,
		/** name of the field to use as value */
		valueKey,
		/** Input's default value */
		defaultValue,
		/** Callback to call when Input typing occurs (returns the keyup event object with an additional textContent value) */
		onInputType,
		/** ref to the input element */
		inputRef,
		/** Set the current input text as a Chip when it loses focus */
		confirmChipOnBlur = true,
		hasError,
		dividerColor: $dividerColor = 'gray5',
		...rest
	},
	ref
) {
	const [contacts, dispatch] = useReducer(reducer, defaultValue ?? value);
	const [active, setActive] = useState(false);
	const [hasFocus, setHasFocus] = useState(false);
	const innerRef = useRef(undefined);
	const contentEditableInput = useCombinedRefs(inputRef, innerRef);

	const saveCurrentValue = useCallback(() => {
		const inputValue = contentEditableInput.current.textContent;
		if (inputValue.length) {
			dispatch({
				type: 'push',
				contact: valueKey ? { [valueKey]: inputValue } : { value: inputValue }
			});
			contentEditableInput.current.innerHTML = '';
		}
	}, [contentEditableInput, valueKey]);

	const onBackspace = useCallback((e) => {
		const cursorPosition = window.getSelection().getRangeAt(0).startOffset;
		if (cursorPosition === 0) {
			e.preventDefault();
			dispatch({ type: 'popLast' });
			return false;
		}
		return true;
	}, []);

	const checkIfSetActive = useCallback(() => {
		setActive(
			contacts.length ||
				document.activeElement === contentEditableInput.current ||
				contentEditableInput.current.textContent.length
		);
	}, [contacts, setActive, contentEditableInput]);

	const onFocus = useCallback(() => {
		checkIfSetActive();
		setHasFocus(true);
	}, [checkIfSetActive, setHasFocus]);

	const onBlur = useCallback(() => {
		checkIfSetActive();
		if (confirmChipOnBlur) {
			saveCurrentValue();
		}
		setHasFocus(false);
	}, [checkIfSetActive, confirmChipOnBlur, saveCurrentValue, setHasFocus]);

	const onChipUpdate = useCallback((id, updatedFields) => {
		dispatch({ type: 'update', id, updatedFields });
	}, []);

	const onChipClose = useCallback(
		(index, ev) => {
			ev.stopPropagation();
			dispatch({ type: 'pop', index });
			contentEditableInput.current.focus();
		},
		[contentEditableInput]
	);

	/** TODO change when want to accept enter callback
	const saveCurrentEvent = useMemo(() => getKeyboardPreset('button', saveCurrentValue), [
		saveCurrentValue
	]);
	 */
	const saveCurrentEvent = useMemo(() => getKeyboardPreset('button', noop), []);
	useKeyboard(contentEditableInput, saveCurrentEvent);

	const backspaceEvent = useMemo(
		() => [
			{
				type: 'keydown',
				callback: onBackspace,
				keys: ['Backspace'],
				haveToPreventDefault: false
			}
		],
		[onBackspace]
	);
	useKeyboard(contentEditableInput, backspaceEvent);

	useEffect(() => {
		if (value && !defaultValue) {
			dispatch({ type: 'reset', value });
		}
	}, [defaultValue, value]);

	useEffect(() => {
		checkIfSetActive();
		onChange(contacts);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [contacts]);

	const labels = useMemo(() => map(contacts, getChipLabel), [contacts, getChipLabel]);
	const setFocus = useCallback(() => contentEditableInput.current.focus(), [contentEditableInput]);
	const onKeyUp = useCallback(
		(ev) => {
			if (onInputType) {
				onInputType({
					...ev,
					textContent: contentEditableInput.current && contentEditableInput.current.textContent
				});
			}
		},
		[contentEditableInput, onInputType]
	);

	const dividerColor = useMemo(
		() => (hasError && 'error') || (hasFocus && 'primary') || $dividerColor,
		[hasError, hasFocus, $dividerColor]
	);

	return (
		<Container mainAlignment="flex-start" crossAlignment="baseline">
			<Container
				crossAlignment="baseline"
				mainAlignment="space-between"
				orientation="horizontal"
				width="100%"
			>
				<ChipInputContainer
					ref={ref}
					tabindex={0}
					active={active}
					hasFocus={hasFocus}
					onClick={setFocus}
					{...rest}
				>
					<ChipInputWrapper>
						<Placeholder>{placeholder}</Placeholder>
						{map(contacts, (item, index) => (
							<AddShareChip
								key={`${index}-${item.id}`}
								label={labels[index]}
								onClose={(ev) => onChipClose(index, ev)}
								onUpdate={onChipUpdate}
								value={item}
								error={item.id === undefined}
							/>
						))}
						<InputContainer>
							<div
								contentEditable
								ref={contentEditableInput}
								onFocus={onFocus}
								onBlur={onBlur}
								onKeyUp={onKeyUp}
							/>
						</InputContainer>
					</ChipInputWrapper>
				</ChipInputContainer>
			</Container>
			<Divider color={dividerColor} />
		</Container>
	);
});
