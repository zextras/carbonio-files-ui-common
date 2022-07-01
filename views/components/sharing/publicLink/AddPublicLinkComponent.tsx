/*
 * SPDX-FileCopyrightText: 2022 Zextras <https://www.zextras.com>
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

/* eslint-disable no-nested-ternary */
import React, { useCallback, useMemo, useState } from 'react';

import {
	Button,
	Container,
	DateTimePicker,
	Input,
	Padding,
	Text,
	Row
} from '@zextras/carbonio-design-system';
import { useTranslation } from 'react-i18next';

import { PublicLinkRowStatus } from '../../../../types/common';
import { RouteLeavingGuard } from '../../RouteLeavingGuard';

interface AddPublicLinkComponentProps {
	status: PublicLinkRowStatus;
	onAddLink: () => void;
	onUndo: () => void;
	onGenerate: (linkDescriptionValue: string, date: Date | undefined) => void;
	limitReached: boolean;
}

export const AddPublicLinkComponent: React.FC<AddPublicLinkComponentProps> = ({
	status,
	onAddLink,
	onUndo,
	onGenerate,
	limitReached
}) => {
	const [t] = useTranslation();

	const [linkDescriptionValue, setLinkDescriptionValue] = useState('');

	const moreThan300Characters = useMemo(
		() => linkDescriptionValue != null && linkDescriptionValue.length > 300,
		[linkDescriptionValue]
	);

	const linkDescriptionOnChange = useCallback((ev) => {
		setLinkDescriptionValue(ev.target.value);
	}, []);

	const [date, setDate] = useState<Date | undefined>(undefined);

	const isSomethingChanged = useMemo(
		() => date != null || linkDescriptionValue.length > 0,
		[date, linkDescriptionValue.length]
	);

	const handleChange = useCallback((d) => {
		if (typeof d === 'string' && d.length === 0) {
			setDate(undefined);
		} else {
			const userTimezoneOffset = d.getTimezoneOffset() * 60000;
			const epoch = d.getTime() - userTimezoneOffset;
			// add 23 hours and 59 minutes
			const epochPlusOneDay = epoch + 24 * 60 * 60 * 1000 - 60000;
			setDate(new Date(epochPlusOneDay));
		}
	}, []);

	const onGenerateCallback = useCallback(() => {
		onGenerate(linkDescriptionValue, date);
		setLinkDescriptionValue('');
		setDate(undefined);
	}, [date, linkDescriptionValue, onGenerate]);

	const onUndoCallback = useCallback(() => {
		onUndo();
		setLinkDescriptionValue('');
		setDate(undefined);
	}, [onUndo]);

	const [pickerIsOpen, setPickerIsOpen] = useState(false);

	const handleCalendarOpen = useCallback(() => {
		setPickerIsOpen(true);
	}, []);

	const handleCalendarClose = useCallback(() => {
		setPickerIsOpen(false);
	}, []);

	return (
		<Container>
			<RouteLeavingGuard
				when={isSomethingChanged}
				onSave={onGenerateCallback}
				dataHasError={moreThan300Characters}
			>
				<Text overflow="">
					{t('modal.unsaved_changes.body.line1', 'Do you want to leave the page without saving?')}
				</Text>
				<Text>{t('modal.unsaved_changes.body.line2', 'All unsaved changes will be lost')}</Text>
			</RouteLeavingGuard>
			<Container orientation="horizontal" mainAlignment="space-between">
				<Text size="medium">{t('publicLink.addLink.title', 'Public Link')}</Text>
				{limitReached && (
					<Text size="small" color="secondary">
						{t(
							'publicLink.addLink.limitReached',
							'The maximum amount of public links has been reached'
						)}
					</Text>
				)}
				{!limitReached && (
					<Container orientation="horizontal" width="fit">
						{status === PublicLinkRowStatus.OPEN && (
							<>
								<Button
									isSmall
									type="outlined"
									color="secondary"
									label={t('publicLink.addLink.undo', 'Undo')}
									onClick={onUndoCallback}
								/>
								<Padding right="small" />
								<Button
									isSmall
									type="outlined"
									label={t('publicLink.addLink.generateLink', 'Generate Link')}
									onClick={onGenerateCallback}
									disabled={moreThan300Characters}
								/>
							</>
						)}
						{status !== PublicLinkRowStatus.OPEN && (
							<Button
								disabled={status === PublicLinkRowStatus.DISABLED}
								isSmall
								type="outlined"
								label={t('publicLink.addLink.addLink', 'Add Link')}
								onClick={onAddLink}
							/>
						)}
					</Container>
				)}
			</Container>
			{status === PublicLinkRowStatus.OPEN && (
				<>
					<Padding vertical="small" />
					<Input
						backgroundColor="gray5"
						label={t('publicLink.input.label', "Link's description")}
						value={linkDescriptionValue}
						onChange={linkDescriptionOnChange}
						hasError={moreThan300Characters}
					/>
					{moreThan300Characters && (
						<Row width="fill" mainAlignment="flex-start" padding={{ top: 'small' }}>
							<Text size="small" color="error">
								{t(
									'publicLink.input.description.error.maxLengthAllowed',
									'Maximum length allowed is 300 characters'
								)}
							</Text>
						</Row>
					)}
					<Padding vertical="small" />
					<DateTimePicker
						width="fill"
						label={t('publicLink.dateTimePicker.label', 'Expiration Date')}
						includeTime={false}
						enableChips
						dateFormat="dd/MM/yyyy"
						chipProps={{ hasAvatar: false }}
						onChange={handleChange}
						onCalendarClose={handleCalendarClose}
						onCalendarOpen={handleCalendarOpen}
						minDate={new Date()}
						popperPlacement="bottom-end"
					/>
					{(date || pickerIsOpen) && (
						<Row width="fill" mainAlignment="flex-start" padding={{ top: 'small' }}>
							<Text size="small" color="secondary">
								{t(
									'publicLink.datePickerInput.description',
									'The link expires at the end of the chosen day'
								)}
							</Text>
						</Row>
					)}
				</>
			)}
		</Container>
	);
};
