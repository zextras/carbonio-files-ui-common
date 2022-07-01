/*
 * SPDX-FileCopyrightText: 2021 Zextras <https://www.zextras.com>
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import React, { useEffect, useState, FC, useMemo } from 'react';

import { Modal, Button } from '@zextras/carbonio-design-system';
import { Location } from 'history';
import { useTranslation } from 'react-i18next';
import { Prompt, useHistory } from 'react-router-dom';

import { ModalFooter } from './ModalFooter';

export const RouteLeavingGuard: FC<{
	when?: boolean;
	onSave: () => void;
	dataHasError?: boolean;
}> = ({ children, when, onSave, dataHasError = false }) => {
	const history = useHistory();
	const lastLocationInitial = useMemo(() => history.location, [history]);
	const [modalVisible, setModalVisible] = useState(false);
	const [lastLocation, setLastLocation] = useState<Location>(lastLocationInitial);
	const [confirmedNavigation, setConfirmedNavigation] = useState(false);
	const [t] = useTranslation();
	const cancel = (): void => {
		setModalVisible(false);
		setConfirmedNavigation(false);
	};

	const handleBlockedNavigation = (nextLocation: Location): boolean => {
		if (
			!confirmedNavigation &&
			`${nextLocation.pathname}${nextLocation.search || ''}` !==
				`${history.location.pathname}${history.location.search}`
		) {
			setModalVisible(true);
			setLastLocation(nextLocation);
			return false;
		}
		return true;
	};

	const onConfirm = (): void => {
		setModalVisible(false);
		onSave();
		setConfirmedNavigation(true);
	};

	const onSecondaryAction = (): void => {
		setModalVisible(false);
		setConfirmedNavigation(true);
	};

	useEffect(() => {
		if (confirmedNavigation && lastLocation) {
			// Navigate to the previous blocked location with your navigate function
			history.push(lastLocation);
		}
	}, [confirmedNavigation, history, lastLocation]);
	return (
		<>
			<Prompt when={when} message={handleBlockedNavigation} />
			{/* Your own alert/dialog/modal component */}
			<Modal
				showCloseIcon
				open={modalVisible}
				title={t('label.unsaved_changes', 'You have unsaved changes')}
				onClose={cancel}
				customFooter={
					<ModalFooter
						confirmLabel={t('label.save_and_leave', 'Save and leave')}
						confirmHandler={onConfirm}
						cancelLabel={t('label.leave_anyway', 'Leave anyway')}
						cancelHandler={onSecondaryAction}
					>
						<Button label="Cancel" onClick={cancel} />
					</ModalFooter>
				}
			>
				{children}
			</Modal>
		</>
	);
};
