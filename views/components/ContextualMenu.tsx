/*
 * SPDX-FileCopyrightText: 2022 Zextras <https://www.zextras.com>
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';

import { Dropdown } from '@zextras/carbonio-design-system';
import styled from 'styled-components';

import { ActionItem } from '../../utils/ActionsFactory';

interface ContextualMenuProps {
	disabled?: boolean;
	onOpen: () => void;
	onClose: () => void;
	actions: ActionItem[];
	disableRestoreFocus?: boolean;
}

type ContextualMenuElement = HTMLDivElement & {
	dropdownOpen?: boolean;
};

const CustomDropdown = styled(Dropdown)`
	width: 100%;
	height: 100%;
`;

export const ContextualMenu: React.FC<ContextualMenuProps> = ({
	children,
	disabled = false,
	onOpen,
	onClose,
	actions,
	disableRestoreFocus
}) => {
	const contextMenuRef = useRef<ContextualMenuElement>(null);
	const [open, setOpen] = useState(false);

	useEffect(() => {
		if (contextMenuRef.current) {
			const htmlElement = contextMenuRef.current;
			htmlElement.oncontextmenu = (): void => {
				if (!htmlElement.dropdownOpen) {
					htmlElement.click();
				}
			};
		}
	}, []);

	const onOpenHandler = useCallback(() => {
		if (contextMenuRef.current) {
			contextMenuRef.current.dropdownOpen = true;
			setOpen(true);
		}
	}, []);

	const onCloseHandler = useCallback(() => {
		if (contextMenuRef.current) {
			contextMenuRef.current.dropdownOpen = false;
			setOpen(false);
		}
	}, []);

	useEffect(() => {
		// trigger onOpen and onClose with an internal state to avoid hover-bar to flash when contextual menu is
		// opened again but in a different position
		if (open) {
			onOpen();
		} else {
			onClose();
		}
	}, [onClose, onOpen, open]);

	useEffect(() => {
		// force close when disabled
		if (disabled && contextMenuRef.current && contextMenuRef.current.dropdownOpen) {
			contextMenuRef.current.click();
		}
	}, [open, disabled, onCloseHandler]);

	return (
		<CustomDropdown
			placement="right-start"
			contextMenu
			disabled={disabled}
			onOpen={onOpenHandler}
			onClose={onCloseHandler}
			items={actions}
			ref={contextMenuRef}
			disableRestoreFocus={disableRestoreFocus}
		>
			{children}
		</CustomDropdown>
	);
};
