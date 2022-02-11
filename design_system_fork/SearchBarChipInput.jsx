/*
 * SPDX-FileCopyrightText: 2022 Zextras <https://www.zextras.com>
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import React, { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';

import { Chip, Dropdown, Text, Tooltip, useCombinedRefs } from '@zextras/carbonio-design-system';
import debounce from 'lodash/debounce';
import filter from 'lodash/filter';
import isEmpty from 'lodash/isEmpty';
import map from 'lodash/map';
import slice from 'lodash/slice';
import styled from 'styled-components';

import { getKeyboardPreset, useKeyboard } from './useKeyboard';

const InputDiv = styled.div``;
const InputContainer = styled.div`
	flex-grow: 1;
	min-width: 10px;
	max-width: 100%;
	font-family: 'Roboto', sans-serif;
	color: ${({ theme }) => theme.palette.text.regular};
	overflow: hidden;

	> ${InputDiv} {
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
const Placeholder = styled(Text)`
	position: absolute;
	top: 50%;
	left: ${({ theme }) => theme.sizes.padding.large};
	transform: translateY(-50%);
	transition: transform 150ms ease-out, font-size 150ms ease-out, top 150ms ease-out;
	font-size: ${(props) => props.theme.sizes.font.medium};
	color: ${({ theme }) => theme.palette.secondary.regular};
	user-select: none;

	${InputDiv}:focus + &,
  ${InputDiv}:active + &,
  ${InputDiv}:not(:empty) + &,
  ${InputContainer}:not(:first-child) > & {
		top: ${({ theme }) => theme.sizes.padding.small};
		transform: translateY(0);
		font-size: ${({ theme }) => theme.sizes.font.small};
	}

	${InputDiv}:focus + &,
  ${InputDiv}:active + & {
		color: ${({ theme }) => theme.palette.primary.regular};
	}

	// files custom
	max-width: calc(100% - (${({ theme }) => theme.sizes.padding.large} * 2));
`;
const ChipInputContainer = styled.div`
	position: relative;
	width: 100%;
	padding: ${({ theme }) => `${theme.sizes.padding.extrasmall} ${theme.sizes.padding.large}`};
	background: ${({ theme, background }) => theme.palette[background].regular};
	border-radius: ${({ theme }) => theme.borderRadius};
	box-sizing: border-box;
	cursor: text;
`;
const ChipInputWrapper = styled.div`
	display: flex;
	align-items: center;
	flex-wrap: wrap;
	padding: ${({ theme }) => theme.sizes.avatar.small.diameter} 0 0;

	> div {
		margin: calc(${({ theme }) => theme.sizes.padding.extrasmall} / 2);
		margin-left: 0;
	}
`;

function reducer(state, action) {
	switch (action.type) {
		case 'push':
			return [...state, action.item];
		case 'pop':
			return filter(state, (value, index) => action.index !== index);
		case 'popLast':
			return slice(state, 0, state.length - 1);
		case 'reset':
			return action.value;
		default:
			throw new Error();
	}
}

function DefaultOnAdd(valueToAdd) {
	return {
		label: valueToAdd
	};
}

export const SearchBarChipInput = React.forwardRef(function ChipInputFn(
	{
		/** ref to the input element */
		inputRef,
		/** Input's Placeholder */
		placeholder,
		/** Input's value */
		value,
		/** Input's default value */
		defaultValue,
		/** Callback to call when Input's value changes */
		onChange,
		/** Dropdown items */
		options = [],
		/** Callback to call when Input typing occurs
		 * - returns the keyup event object with an additional textContent value
		 * - the event is debounced using the debounce function from lodash */
		onInputType,
		/** Debounce value in ms to which debounce the 'onInputType' callback */
		onInputTypeDebounce = 300,
		/** Callback to be called when a value is added in the Chip Input, should return the configuration for the Chip */
		onAdd = DefaultOnAdd,
		/** ChipInput backgroundColor */
		background = 'gray6',
		/** Set the current input text as a Chip when it loses focus */
		confirmChipOnBlur = true,

		/** FILES CUSTOM PROPS */
		createChipKeyEvents,

		...rest
	},
	ref
) {
	const [items, dispatch] = useReducer(reducer, defaultValue ?? value);
	const itemsRef = useRef(items);

	const innerRef = useRef(undefined);
	const contentEditableInput = useCombinedRefs(inputRef, innerRef);

	const [showDropdown, setShowDropdown] = useState(false);
	const [dropdownItems, setDropdownItems] = useState(options);
	const uncontrolledMode = useMemo(() => typeof value === 'undefined', [value]);

	const setFocus = useCallback(() => contentEditableInput.current.focus(), [contentEditableInput]);

	const saveValue = useCallback(
		(valueToSave) => {
			const item = onAdd(valueToSave);
			uncontrolledMode && dispatch({ type: 'push', item });
			onChange && onChange([...itemsRef.current, item]);
			contentEditableInput.current.innerHTML = '';
		},
		[contentEditableInput, onAdd, uncontrolledMode, onChange]
	);
	const saveCurrentValue = useCallback(() => {
		const inputValue = contentEditableInput.current.textContent;
		inputValue.length && saveValue(inputValue);
	}, [contentEditableInput, saveValue]);
	const saveCurrentEvent = useMemo(
		() =>
			(createChipKeyEvents && createChipKeyEvents(saveCurrentValue)) ||
			getKeyboardPreset('chipInput', saveCurrentValue),
		[createChipKeyEvents, saveCurrentValue]
	);
	useKeyboard(contentEditableInput, saveCurrentEvent);

	const onBackspace = useCallback(
		(e) => {
			const cursorPosition = window.getSelection().getRangeAt(0).startOffset;
			if (cursorPosition === 0) {
				e.preventDefault();
				uncontrolledMode && dispatch({ type: 'popLast' });
				onChange && onChange(slice(itemsRef.current, 0, itemsRef.current.length - 1));
				return false;
			}
			return true;
		},
		[uncontrolledMode, onChange]
	);
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

	const onChipClose = useCallback(
		(index) => {
			uncontrolledMode && dispatch({ type: 'pop', index });
			onChange && onChange(filter(itemsRef.current, (item, i) => index !== i));
			contentEditableInput.current.focus();
		},
		[contentEditableInput, onChange, uncontrolledMode]
	);

	const onBlur = useCallback(() => {
		confirmChipOnBlur && !options && saveCurrentValue();
	}, [confirmChipOnBlur, options, saveCurrentValue]);

	// eslint-disable-next-line react-hooks/exhaustive-deps
	const onKeyUp = useCallback(
		debounce((ev) => {
			onInputType({
				...ev,
				textContent: contentEditableInput.current && contentEditableInput.current.textContent
			});
		}, onInputTypeDebounce),
		[contentEditableInput, onInputType]
	);

	const onOptionClick = useCallback(
		(valueToAdd) => {
			saveValue(valueToAdd);
			setFocus();
		},
		[saveValue, setFocus]
	);

	useEffect(() => {
		!uncontrolledMode && dispatch({ type: 'reset', value });
	}, [uncontrolledMode, value]);

	useEffect(() => {
		setShowDropdown(!isEmpty(options));
		setDropdownItems(map(options, (o) => ({ ...o, click: () => onOptionClick(o.value) })));
	}, [onOptionClick, options]);

	useEffect(() => {
		itemsRef.current = items;
	}, [items]);

	return (
		<Dropdown
			items={dropdownItems}
			display="block"
			width="100%"
			disableAutoFocus
			disableRestoreFocus
			forceOpen={showDropdown}
			onClose={() => setShowDropdown(false)}
			disabled
		>
			<ChipInputContainer
				ref={ref}
				tabindex={0}
				background={background}
				onClick={setFocus}
				{...rest}
			>
				<ChipInputWrapper>
					{map(items, (item, index) => (
						<Chip
							key={`${index}-${item.value}`}
							{...item}
							closable
							onClose={() => onChipClose(index)}
						/>
					))}
					<InputContainer>
						<InputDiv
							ref={contentEditableInput}
							onBlur={onBlur}
							onKeyUp={onInputType && onKeyUp}
							contentEditable
							data-testid="search-bar-chip-input"
						/>
						<Tooltip label={placeholder} placement="top" maxWidth="unset">
							<Placeholder>{placeholder}</Placeholder>
						</Tooltip>
					</InputContainer>
				</ChipInputWrapper>
			</ChipInputContainer>
		</Dropdown>
	);
});
