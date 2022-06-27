/*
 * SPDX-FileCopyrightText: 2022 Zextras <https://www.zextras.com>
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import React, { useCallback, useMemo, useState } from 'react';

import {
	Container,
	Padding,
	Row,
	Text,
	IconButton,
	Input,
	Tooltip
} from '@zextras/carbonio-design-system';
import { useTranslation } from 'react-i18next';
import styled from 'styled-components';

import { useUpdateNodeDescriptionMutation } from '../../hooks/graphql/mutations/useUpdateNodeDescriptionMutation';
import { ItalicText, ShimmerText } from './StyledComponents';

interface NodeDetailsDescriptionProps {
	description: string | undefined;
	canUpsertDescription: boolean;
	id: string;
	loading?: boolean | undefined;
}

const Label: React.FC = ({ children }) => (
	<Padding bottom="small">
		<Text color="secondary" size="small">
			{children}
		</Text>
	</Padding>
);

const CustomIconButton = styled(IconButton)`
	outline: none;
`;

const CustomItalicText = styled(ItalicText)`
	user-select: none;
`;

export const NodeDetailsDescription: React.VFC<NodeDetailsDescriptionProps> = ({
	description,
	canUpsertDescription,
	id,
	loading
}) => {
	const [t] = useTranslation();
	const [editingDescription, setEditingDescription] = useState(false);
	const { updateNodeDescription } = useUpdateNodeDescriptionMutation();

	const [descriptionValue, setDescriptionValue] = useState(description || '');

	const moreThan4096Characters = useMemo(
		() => descriptionValue != null && descriptionValue.length > 4096,
		[descriptionValue]
	);

	const changeDescription = useCallback<React.ChangeEventHandler<HTMLInputElement>>(
		({ target: { value } }) => {
			setDescriptionValue(value);
		},
		[]
	);

	const openEdit = useCallback(() => {
		setEditingDescription(true);
	}, []);

	const closeEdit = useCallback(() => {
		setEditingDescription(false);
		setDescriptionValue(description || '');
	}, [description]);

	const save = useCallback(() => {
		if (!moreThan4096Characters) {
			if (description !== descriptionValue) {
				updateNodeDescription(id, descriptionValue);
			}
			setEditingDescription(false);
		}
	}, [description, descriptionValue, id, moreThan4096Characters, updateNodeDescription]);

	return (
		<>
			{editingDescription && (
				<Row
					width="fill"
					orientation="vertical"
					crossAlignment="flex-start"
					padding={{ vertical: 'small' }}
				>
					<Row
						mainAlignment="space-between"
						wrap="nowrap"
						width="fill"
						padding={{ vertical: 'small' }}
					>
						<Label>{t('displayer.details.description', 'Description')}</Label>
						<Container orientation="horizontal" mainAlignment="flex-end">
							<Tooltip
								label={t(
									'displayer.details.editDescription.closeIconTooltip',
									'Close without saving'
								)}
							>
								<IconButton iconColor="secondary" size="small" icon="Close" onClick={closeEdit} />
							</Tooltip>
							<Tooltip
								disabled={description === descriptionValue || moreThan4096Characters}
								label={t('displayer.details.editDescription.saveIconTooltip', 'Save edits')}
							>
								<CustomIconButton
									iconColor="secondary"
									size="small"
									icon="SaveOutline"
									onClick={save}
									disabled={description === descriptionValue || moreThan4096Characters}
								/>
							</Tooltip>
						</Container>
					</Row>
					<Input
						backgroundColor="gray5"
						label={t(
							'displayer.details.editDescription.input.label',
							'Maximum length allowed is 4096 characters'
						)}
						value={descriptionValue}
						onChange={changeDescription}
						hasError={moreThan4096Characters}
						data-testid="input-description"
						onEnter={save}
					/>
				</Row>
			)}
			{!editingDescription && (
				<Row
					width="fill"
					orientation="vertical"
					crossAlignment="flex-start"
					padding={{ vertical: 'small' }}
				>
					<Row
						mainAlignment="space-between"
						wrap="nowrap"
						width="fill"
						padding={{ vertical: 'small' }}
					>
						<Label>{t('displayer.details.description', 'Description')}</Label>
						<Tooltip
							label={t('displayer.details.editDescription.editIconTooltip', 'Edit description')}
						>
							<IconButton
								iconColor="secondary"
								size="small"
								icon="Edit2Outline"
								onClick={openEdit}
								disabled={!canUpsertDescription}
							/>
						</Tooltip>
					</Row>
					{loading && description === undefined && <ShimmerText $size="medium" width="70%" />}
					{!loading && (
						<Text size="medium" overflow="break-word">
							{description ||
								(canUpsertDescription && (
									<CustomItalicText color="secondary" size="medium" overflow="break-word">
										{t(
											'displayer.details.missingDescription',
											'Click the edit button to add a description'
										)}
									</CustomItalicText>
								))}
						</Text>
					)}
				</Row>
			)}
		</>
	);
};
