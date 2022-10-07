/*
 * SPDX-FileCopyrightText: 2022 Zextras <https://www.zextras.com>
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */
import React, { useMemo } from 'react';

import { Tooltip, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';

import useUserInfo from '../../../../hooks/useUserInfo';
import { Contact } from '../../../types/common';
import { getChipLabel, getChipTooltip } from '../../../utils/utils';

interface ShareChipLabelProps {
	contact: Contact | null | undefined;
	showTooltip?: boolean;
}

export const ShareChipLabel = ({
	contact,
	showTooltip = true
}: ShareChipLabelProps): JSX.Element => {
	const { me } = useUserInfo();
	const [t] = useTranslation();

	const chipLabel = useMemo(
		() => (me === contact?.id ? t('displayer.share.chip.you', 'You') : getChipLabel(contact)),
		[contact, me, t]
	);

	return (
		<Tooltip title={getChipTooltip(contact)} disableHoverListener={!showTooltip} enterDelay={500}>
			<Typography variant="light">{chipLabel}</Typography>
		</Tooltip>
	);
};
