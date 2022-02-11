/*
 * SPDX-FileCopyrightText: 2022 Zextras <https://www.zextras.com>
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import React from 'react';

import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ActionItem } from '../../utils/ActionsFactory';
import { render } from '../../utils/testUtils';
import { NodeHoverBar } from './NodeHoverBar';

describe('Node Hover Bar', () => {
	test('render nothing if no actions are provided', () => {
		const { container } = render(<NodeHoverBar actions={[]} />);
		expect(container).toBeEmptyDOMElement();
	});

	test('render all actions icons', () => {
		const action1Fn = jest.fn();
		const action2Fn = jest.fn();

		const actions: ActionItem[] = [
			{
				id: 'action1',
				label: 'action1',
				icon: 'action1Icon',
				click: action1Fn
			},
			{
				id: 'action2',
				label: 'action2',
				icon: 'action2Icon',
				click: action2Fn
			}
		];

		render(<NodeHoverBar actions={actions} />);
		expect(screen.getByTestId('icon: action1Icon')).toBeInTheDocument();
		expect(screen.getByTestId('icon: action1Icon')).toBeVisible();
		expect(screen.getByTestId('icon: action2Icon')).toBeInTheDocument();
		expect(screen.getByTestId('icon: action2Icon')).toBeVisible();
		userEvent.click(screen.getByTestId('icon: action1Icon'));
		expect(action1Fn).toHaveBeenCalledTimes(1);
		expect(action2Fn).not.toHaveBeenCalled();
		userEvent.click(screen.getByTestId('icon: action2Icon'));
		expect(action1Fn).toHaveBeenCalledTimes(1);
		expect(action2Fn).toHaveBeenCalledTimes(1);
	});
});
