/*
 * SPDX-FileCopyrightText: 2022 Zextras <https://www.zextras.com>
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */
import React, { useMemo } from 'react';

import { IconButton, Text, Tooltip } from '@zextras/carbonio-design-system';
import map from 'lodash/map';
import styled from 'styled-components';

import PreviewerBase from './PreviewerBase';

type PreviewerProps = Omit<React.ComponentPropsWithRef<typeof PreviewerBase>, 'Header' | 'Footer'> &
	Partial<FooterProps> &
	Partial<HeaderProps> & {
		closeTooltip?: string;
	};

const FooterContainer = styled.div`
	width: fit-content;
`;

const UpperCaseText = styled(Text)`
	text-transform: uppercase;
`;

interface FooterProps {
	/** Extension of the file, shown as info */
	extension: string;
	/** Name of the file, shown as info */
	filename: string;
	/** Size of the file, shown as info */
	size: string;
}

const Footer: React.VFC<FooterProps> = ({ filename, extension, size }) => (
	<FooterContainer>
		<Text size="small" color="gray6">
			{filename}
		</Text>
		<UpperCaseText size="small" color="gray6">
			{extension}
			{extension && size && <> &middot; </>}
			{size}
		</UpperCaseText>
	</FooterContainer>
);

interface HeaderAction {
	/** id used as key */
	id: string;
	/** Action called on click */
	onClick: React.ReactEventHandler;
	/** Icon from the theme */
	icon: string;
	/** Label to show as tooltip for the action */
	tooltip?: string;
	/** Disabled status for the action */
	disabled?: boolean;
}

interface HeaderProps {
	/** Actions for the previewer */
	actions: HeaderAction[];
}

const HeaderContainer = styled.div`
	display: flex;
	justify-content: flex-end;
`;

const Header: React.VFC<HeaderProps> = ({ actions }) => (
	<HeaderContainer>
		{map(actions, ({ id, onClick, disabled, icon, tooltip }) => (
			<Tooltip label={tooltip} disabled={!tooltip} key={id}>
				<IconButton
					onClick={onClick}
					disabled={disabled}
					icon={icon}
					size="large"
					backgroundColor="transparent"
					iconColor="gray6"
				/>
			</Tooltip>
		))}
	</HeaderContainer>
);

const Previewer = React.forwardRef<HTMLDivElement, PreviewerProps>(function PreviewerFn(
	{
		src,
		show,
		container,
		disablePortal,
		extension = '',
		filename = '',
		size = '',
		actions = [],
		onClose,
		closeTooltip = 'Close',
		alt
	},
	ref
) {
	const $actions = useMemo(
		() => [
			...actions,
			{ id: 'close-action', icon: 'Close', onClick: onClose, tooltip: closeTooltip }
		],
		[actions, closeTooltip, onClose]
	);
	return (
		<PreviewerBase
			footer={<Footer filename={filename} extension={extension} size={size} />}
			src={src}
			header={<Header actions={$actions} />}
			show={show}
			container={container}
			disablePortal={disablePortal}
			ref={ref}
			onClose={onClose}
			alt={alt ?? filename}
		/>
	);
});

export default Previewer;
