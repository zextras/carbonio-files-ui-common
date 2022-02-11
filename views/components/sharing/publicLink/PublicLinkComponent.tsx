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
	Chip,
	Divider,
	Text,
	Tooltip,
	Row
} from '@zextras/carbonio-design-system';
import { useTranslation } from 'react-i18next';
import styled from 'styled-components';

import useUserInfo from '../../../../../hooks/useUserInfo';
import { useCreateSnackbar } from '../../../../hooks/useCreateSnackbar';
import { PublicLinkRowStatus } from '../../../../types/common';
import { copyToClipboard, formatDate } from '../../../../utils/utils';

const CustomText = styled(Text)`
	margin-right: 0;
	margin-left: auto;
`;

interface PublicLinkComponentProps {
	id: string;
	description?: string | null;
	url?: string | null;
	status: PublicLinkRowStatus;
	expiresAt?: number | null;
	onEdit: (linkId: string) => void;
	onEditConfirm: (linkId: string, description?: string, expiresAt?: number) => void;
	onUndo: () => void;
	onRevokeOrRemove: (linkId: string, isRevoke: boolean) => void;
	forceUrlCopyDisabled: boolean;
}

export const PublicLinkComponent: React.FC<PublicLinkComponentProps> = ({
	id,
	description,
	url,
	status,
	expiresAt,
	onEdit,
	onEditConfirm,
	onUndo,
	onRevokeOrRemove,
	forceUrlCopyDisabled
}) => {
	const [t] = useTranslation();
	const createSnackbar = useCreateSnackbar();
	const { zimbraPrefTimeZoneId } = useUserInfo();

	const isExpired = useMemo(() => (expiresAt ? Date.now() > expiresAt : false), [expiresAt]);

	const [linkDescriptionValue, setLinkDescriptionValue] = useState(description || undefined);

	const moreThan300Characters = useMemo(
		() => linkDescriptionValue != null && linkDescriptionValue.length > 300,
		[linkDescriptionValue]
	);

	const linkDescriptionOnChange = useCallback((ev) => {
		setLinkDescriptionValue(ev.target.value);
	}, []);

	const [date, setDate] = useState(expiresAt);
	const handleChange = useCallback((d: Date | string) => {
		if (typeof d === 'string' && d.length === 0) {
			setDate(undefined);
		} else {
			const userTimezoneOffset = (d as Date).getTimezoneOffset() * 60000;
			const epoch = (d as Date).getTime() - userTimezoneOffset;
			// add 23 hours and 59 minutes
			const epochPlusOneDay = epoch + 24 * 60 * 60 * 1000 - 60000;
			setDate(epochPlusOneDay);
		}
	}, []);

	const onEditCallback = useCallback(() => {
		onEdit(id);
	}, [id, onEdit]);

	const onUndoCallback = useCallback(() => {
		setLinkDescriptionValue(description || undefined);
		onUndo();
	}, [description, onUndo]);

	const onRevokeOrRemoveCallback = useCallback(() => {
		onRevokeOrRemove(id, !isExpired);
	}, [id, onRevokeOrRemove, isExpired]);

	const onEditConfirmCallback = useCallback(() => {
		onEditConfirm(id, linkDescriptionValue, date !== expiresAt ? date || 0 : undefined);
	}, [date, expiresAt, id, linkDescriptionValue, onEditConfirm]);

	const copyUrl = useCallback(
		(_event) => {
			copyToClipboard(url as string).then(() => {
				createSnackbar({
					key: new Date().toLocaleString(),
					type: 'info',
					label: t('snackbar.publicLink.copyLink', 'Public link copied'),
					replace: true,
					hideButton: true
				});
			});
		},
		[createSnackbar, t, url]
	);

	const [pickerIsOpen, setPickerIsOpen] = useState(false);

	const handleCalendarOpen = useCallback(() => {
		setPickerIsOpen(true);
	}, []);

	const handleCalendarClose = useCallback(() => {
		setPickerIsOpen(false);
	}, []);

	return (
		<Container>
			<Padding vertical="small" />
			<Container orientation="horizontal" mainAlignment="space-between">
				<Chip
					label={
						<Tooltip
							label={
								isExpired
									? t('publicLink.link.urlChip.tooltip.expired', 'This link has expired')
									: t('publicLink.link.urlChip.tooltip.copy', 'Copy public link')
							}
							maxWidth="unset"
							placement="top"
							disabled={forceUrlCopyDisabled && !isExpired}
						>
							<Text size="small" weight="light">
								{url}
							</Text>
						</Tooltip>
					}
					hasAvatar={false}
					onClick={forceUrlCopyDisabled || isExpired ? undefined : copyUrl}
					disabled={forceUrlCopyDisabled || isExpired}
					minWidth={0}
				/>
				<Container orientation="horizontal" width="fit" padding={{ left: 'large' }}>
					{status === PublicLinkRowStatus.OPEN && (
						<>
							<Button
								isSmall
								type="outlined"
								color="secondary"
								label={t('publicLink.link.undo', 'Undo')}
								onClick={onUndoCallback}
							/>
							<Padding right="small" />
							<Button
								isSmall
								type="outlined"
								color={'secondary'}
								label={t('publicLink.link.editLink', 'Edit Link')}
								onClick={onEditConfirmCallback}
								disabled={moreThan300Characters}
							/>
						</>
					)}
					{status !== PublicLinkRowStatus.OPEN && (
						<>
							<Button
								disabled={status === PublicLinkRowStatus.DISABLED}
								isSmall
								type="outlined"
								color="error"
								label={
									!isExpired
										? t('publicLink.link.revoke', 'Revoke')
										: t('publicLink.link.remove', 'Remove')
								}
								icon={!isExpired ? 'SlashOutline' : 'DeletePermanentlyOutline'}
								onClick={onRevokeOrRemoveCallback}
							/>
							<Padding right="small" />
							<Button
								disabled={status === PublicLinkRowStatus.DISABLED}
								isSmall
								type="outlined"
								color={'secondary'}
								label={t('publicLink.link.edit', 'Edit')}
								icon={'Edit2Outline'}
								onClick={onEditCallback}
							/>
						</>
					)}
				</Container>
			</Container>
			<Padding vertical="small" />
			{status === PublicLinkRowStatus.OPEN && (
				<>
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
						defaultValue={date}
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

			{status !== PublicLinkRowStatus.OPEN && (
				<Container orientation="horizontal" mainAlignment="space-between" wrap="wrap">
					<Text overflow="break-word" color="gray1" size="small" disabled={isExpired}>
						{description}
					</Text>
					<CustomText color="gray1" size="small">
						{expiresAt
							? !isExpired
								? `${t('publicLink.link.expireOn', 'Expires on:')} ${formatDate(
										expiresAt,
										'DD/MM/YY HH:mm',
										zimbraPrefTimeZoneId
								  )}`
								: `${t('publicLink.link.expiredOn', 'This link has expired on:')} ${formatDate(
										expiresAt,
										'DD/MM/YY HH:mm',
										zimbraPrefTimeZoneId
								  )}`
							: t('publicLink.link.noExpirationDate', 'Has no expiration date')}
					</CustomText>
				</Container>
			)}
			<Padding vertical="small" />
			<Divider color="gray2" />
		</Container>
	);
};
