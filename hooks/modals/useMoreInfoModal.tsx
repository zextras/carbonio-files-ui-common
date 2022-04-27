/*
 * SPDX-FileCopyrightText: 2022 Zextras <https://www.zextras.com>
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import React, { useCallback } from 'react';

import { Padding, Text, useModal } from '@zextras/carbonio-design-system';
import { useTranslation } from 'react-i18next';

export function useMoreInfoModal(): {
	openMoreInfoModal: (message: string) => void;
} {
	const createModal = useModal();
	const [t] = useTranslation();

	const openMoreInfoModal = useCallback(
		(message: string) => {
			const closeModal = createModal({
				title: t('modal.moreInfo.title', 'Additional info'),
				showCloseIcon: true,
				onClose: () => {
					closeModal();
				},
				hideFooter: true,
				children: (
					<Padding bottom="extralarge">
						<Text overflow="break-word" size="small">
							{message}
						</Text>
					</Padding>
				)
			});
		},
		[createModal, t]
	);

	return { openMoreInfoModal };
}
