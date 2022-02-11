/*
 * SPDX-FileCopyrightText: 2022 Zextras <https://www.zextras.com>
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import React from 'react';

import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import faker from 'faker';

import { UseUpdateNodeDescriptionMutationHook } from '../../hooks/graphql/mutations/useUpdateNodeDescriptionMutation';
import { populateFile } from '../../mocks/mockUtils';
import { canUpsertDescription } from '../../utils/ActionsFactory';
import { mockUpdateNodeDescription } from '../../utils/mockUtils';
import { render } from '../../utils/testUtils';
import { NodeDetailsDescription } from './NodeDetailsDescription';

const updateNodeDescriptionMockFun = jest.fn();

const mockedUseUpdateNodeDescriptionMutationHook: ReturnType<UseUpdateNodeDescriptionMutationHook> =
	{
		updateNodeDescription: updateNodeDescriptionMockFun,
		updateNodeDescriptionError: undefined
	};

jest.mock('../../hooks/graphql/mutations/useUpdateNodeDescriptionMutation', () => ({
	useUpdateNodeDescriptionMutation: (): ReturnType<UseUpdateNodeDescriptionMutationHook> =>
		mockedUseUpdateNodeDescriptionMutationHook
}));

describe('NodeDetailsDescription component', () => {
	test('Missing description show missing description label', () => {
		const node = populateFile();
		node.permissions.can_write_file = true;
		node.description = '';
		render(
			<NodeDetailsDescription
				id={node.id}
				description={node.description}
				canUpsertDescription={canUpsertDescription(node)}
			/>,
			{ mocks: [] }
		);
		expect(screen.getByText('Description')).toBeInTheDocument();
		expect(screen.getByText('Click the edit button to add a description')).toBeInTheDocument();
	});

	test('Missing description is not shown if description cannot be edited', () => {
		const node = populateFile();
		node.permissions.can_write_file = false;
		node.description = '';
		render(
			<NodeDetailsDescription
				id={node.id}
				description={node.description}
				canUpsertDescription={canUpsertDescription(node)}
			/>,
			{ mocks: [] }
		);
		expect(screen.getByText('Description')).toBeInTheDocument();
		expect(
			screen.queryByText('Click the edit button to add a description')
		).not.toBeInTheDocument();
	});

	test('Edit icon disabled if can_write_file is false', () => {
		const node = populateFile();
		node.permissions.can_write_file = false;
		render(
			<NodeDetailsDescription
				id={node.id}
				description={node.description}
				canUpsertDescription={canUpsertDescription(node)}
			/>,
			{ mocks: [] }
		);
		expect(screen.getByText('Description')).toBeInTheDocument();

		const editIcon = screen.getByTestId('icon: Edit2Outline');
		expect(editIcon).toBeVisible();
		expect(editIcon.parentNode).toHaveAttribute('disabled', '');
	});

	test('Edit icon not disabled if can_write_file is true', () => {
		const node = populateFile();
		node.permissions.can_write_file = true;
		render(
			<NodeDetailsDescription
				id={node.id}
				description={node.description}
				canUpsertDescription={canUpsertDescription(node)}
			/>,
			{ mocks: [] }
		);
		expect(screen.getByText('Description')).toBeInTheDocument();

		const editIcon = screen.getByTestId('icon: Edit2Outline');
		expect(editIcon).toBeVisible();
		expect(editIcon.parentNode).not.toHaveAttribute('disabled', '');
	});

	test('save button is disabled when description is the same', async () => {
		const node = populateFile();
		node.permissions.can_write_file = true;
		const newDescription = 'newDescription';

		render(
			<NodeDetailsDescription
				id={node.id}
				description={node.description}
				canUpsertDescription={canUpsertDescription(node)}
			/>,
			{ mocks: [] }
		);
		expect(screen.getByText('Description')).toBeInTheDocument();
		expect(screen.getByText(node.description)).toBeInTheDocument();

		const editIcon = screen.getByTestId('icon: Edit2Outline');
		expect(editIcon).toBeVisible();
		expect(editIcon.parentNode).not.toHaveAttribute('disabled', '');
		userEvent.click(editIcon);

		const saveIcon = await screen.findByTestId('icon: SaveOutline');
		expect(saveIcon).toBeVisible();
		expect(saveIcon.parentNode).toHaveAttribute('disabled', '');

		const inputFieldDiv = await screen.findByTestId('input-description');
		const inputField = within(inputFieldDiv).getByRole('textbox');
		userEvent.clear(inputField);
		userEvent.type(inputField, newDescription);

		expect(saveIcon.parentNode).not.toHaveAttribute('disabled', '');

		userEvent.clear(inputField);
		userEvent.type(inputField, node.description);

		expect(saveIcon.parentNode).toHaveAttribute('disabled', '');
	});

	test('save button is disabled when description has more than 4096 characters', async () => {
		const node = populateFile();
		node.permissions.can_write_file = true;
		const newDescription = 'newDescription';
		const moreThan4096Description = faker.datatype.string(5000);

		expect(moreThan4096Description.length).toBeGreaterThan(4096);

		render(
			<NodeDetailsDescription
				id={node.id}
				description={node.description}
				canUpsertDescription={canUpsertDescription(node)}
			/>,
			{ mocks: [] }
		);
		expect(screen.getByText('Description')).toBeInTheDocument();
		expect(screen.getByText(node.description)).toBeInTheDocument();

		const editIcon = screen.getByTestId('icon: Edit2Outline');
		expect(editIcon).toBeVisible();
		expect(editIcon.parentNode).not.toHaveAttribute('disabled', '');
		userEvent.click(editIcon);

		const saveIcon = await screen.findByTestId('icon: SaveOutline');
		expect(saveIcon).toBeVisible();
		expect(saveIcon.parentNode).toHaveAttribute('disabled', '');

		const inputFieldDiv = await screen.findByTestId('input-description');
		const inputField = within(inputFieldDiv).getByRole('textbox');
		userEvent.clear(inputField);
		userEvent.type(inputField, newDescription);

		expect(saveIcon.parentNode).not.toHaveAttribute('disabled', '');

		userEvent.clear(inputField);
		userEvent.paste(inputField, moreThan4096Description);

		expect(saveIcon.parentNode).toHaveAttribute('disabled', '');
	});

	test('close button do not save changes', async () => {
		const node = populateFile();
		node.permissions.can_write_file = true;
		const newDescription = 'newDescription';

		render(
			<NodeDetailsDescription
				id={node.id}
				description={node.description}
				canUpsertDescription={canUpsertDescription(node)}
			/>,
			{ mocks: [] }
		);
		expect(screen.getByText('Description')).toBeInTheDocument();
		expect(screen.getByText(node.description)).toBeInTheDocument();

		let editIcon = screen.getByTestId('icon: Edit2Outline');
		expect(editIcon).toBeVisible();
		expect(editIcon.parentNode).not.toHaveAttribute('disabled', '');
		userEvent.click(editIcon);

		const saveIcon = await screen.findByTestId('icon: SaveOutline');
		expect(saveIcon).toBeVisible();
		expect(saveIcon.parentNode).toHaveAttribute('disabled', '');

		let inputFieldDiv = await screen.findByTestId('input-description');
		let inputField = within(inputFieldDiv).getByRole('textbox');
		userEvent.clear(inputField);
		userEvent.type(inputField, newDescription);

		expect(inputField).toHaveValue(newDescription);

		expect(saveIcon.parentNode).not.toHaveAttribute('disabled', '');

		const closeICon = screen.getByTestId('icon: Close');
		expect(closeICon).toBeVisible();
		userEvent.click(closeICon);

		editIcon = await screen.findByTestId('icon: Edit2Outline');
		expect(editIcon).toBeVisible();
		expect(screen.getByText(node.description)).toBeInTheDocument();

		userEvent.click(editIcon);

		inputFieldDiv = await screen.findByTestId('input-description');
		inputField = within(inputFieldDiv).getByRole('textbox');

		expect(inputField).toHaveValue(node.description);
	});

	test('save button close editing mode and call mutation', async () => {
		const node = populateFile();
		node.permissions.can_write_file = true;
		const newDescription = 'newDescription';

		const mocks = [
			mockUpdateNodeDescription(
				{
					id: node.id,
					description: newDescription
				},
				{
					...node,
					description: newDescription
				}
			)
		];
		render(
			<NodeDetailsDescription
				id={node.id}
				description={node.description}
				canUpsertDescription={canUpsertDescription(node)}
			/>,
			{ mocks }
		);
		expect(screen.getByText('Description')).toBeInTheDocument();
		expect(screen.getByText(node.description)).toBeInTheDocument();

		let editIcon = screen.getByTestId('icon: Edit2Outline');
		expect(editIcon).toBeVisible();
		expect(editIcon.parentNode).not.toHaveAttribute('disabled', '');
		userEvent.click(editIcon);

		const saveIcon = await screen.findByTestId('icon: SaveOutline');
		expect(saveIcon).toBeVisible();
		expect(saveIcon.parentNode).toHaveAttribute('disabled', '');

		const inputFieldDiv = await screen.findByTestId('input-description');
		const inputField = within(inputFieldDiv).getByRole('textbox');
		userEvent.clear(inputField);
		userEvent.type(inputField, newDescription);

		expect(inputField).toHaveValue(newDescription);

		expect(saveIcon.parentNode).not.toHaveAttribute('disabled', '');

		userEvent.click(saveIcon);

		editIcon = await screen.findByTestId('icon: Edit2Outline');
		expect(editIcon).toBeVisible();

		expect(saveIcon).not.toBeVisible();

		expect(updateNodeDescriptionMockFun).toBeCalled();
		expect(updateNodeDescriptionMockFun).toBeCalledTimes(1);
		expect(updateNodeDescriptionMockFun).toHaveBeenCalledWith(node.id, newDescription);
	});
});
