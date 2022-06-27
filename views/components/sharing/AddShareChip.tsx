/*
 * SPDX-FileCopyrightText: 2022 Zextras <https://www.zextras.com>
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

/* eslint-disable arrow-body-style */
import React, { useMemo } from 'react';

import filter from 'lodash/filter';
import toLower from 'lodash/toLower';

import { useActiveNode } from '../../../../hooks/useActiveNode';
import { useGetNodeQuery } from '../../../hooks/graphql/queries/useGetNodeQuery';
import { ChipActionsType, ChipProps, Role } from '../../../types/common';
import { Node } from '../../../types/graphql/types';
import { isFile, isFolder } from '../../../utils/ActionsFactory';
import { ChipWithPopover } from './ChipWithPopover';
import { NewShareChipPopoverContainer } from './NewShareChipPopoverContainer';

const rowRoleToIdxMap: { [key in Role]: number } = {
	[Role.Viewer]: 0,
	[Role.Editor]: 1
};

const roleAssignChecker: {
	[key in Role]: (node: Pick<Node, 'type' | 'permissions'>) => boolean;
} = {
	[Role.Editor]: (node: Pick<Node, 'type' | 'permissions'>): boolean =>
		(toLower(node.type) === 'folder' && node.permissions.can_write_folder) ||
		(!(toLower(node.type) === 'folder') && node.permissions.can_write_file),
	[Role.Viewer]: (): boolean => true
};

const rowIdxToRoleMap: { [key: number]: Role } = {
	0: Role.Viewer,
	1: Role.Editor
};

interface AddShareChip {
	id: string;
	type: string;
	role: Role;
	sharingAllowed: boolean;
}

interface AddShareChipProps extends ChipProps {
	value: AddShareChip;
	onUpdate: (id: string, updatedPartialObject: Partial<AddShareChip>) => void;
}

export const AddShareChip: React.FC<AddShareChipProps> = ({
	/** Chip value */
	value,
	/** Chip update function */
	onUpdate,
	/** Accept all Chip props */
	...rest
}) => {
	const switchSharingAllowed = (): void => {
		onUpdate(value.id, { sharingAllowed: !value.sharingAllowed });
	};

	const { activeNodeId } = useActiveNode();
	const { data: nodeData } = useGetNodeQuery(activeNodeId, undefined, {
		fetchPolicy: 'cache-only'
	});
	const node = useMemo(() => nodeData?.getNode || null, [nodeData]);

	const changeRole = (containerIdx: keyof typeof rowIdxToRoleMap): void => {
		const desiredRole = rowIdxToRoleMap[containerIdx];
		if (
			desiredRole !== Role.Editor ||
			// if desiredRole === Role.Editor you need write permission
			(node &&
				((isFolder(node) && node.permissions.can_write_folder) ||
					(isFile(node) && node.permissions.can_write_file)))
		) {
			onUpdate(value.id, { role: rowIdxToRoleMap[containerIdx] });
		}
	};

	const disabledRows = useMemo(() => {
		return filter(rowRoleToIdxMap, (idx, role) => {
			return !node || !roleAssignChecker[role as Role](node);
		});
	}, [node]);

	const actions: Array<ChipActionsType> = useMemo(() => {
		const icons: Array<ChipActionsType> = [];
		if (value.role === Role.Viewer) {
			icons.push({ icon: 'EyeOutline', id: 'EyeOutline', type: 'icon', color: 'gray0' });
		} else {
			icons.push({ icon: 'Edit2Outline', id: 'Edit2Outline', type: 'icon', color: 'gray0' });
		}
		if (value.sharingAllowed) {
			icons.push({ icon: 'Share', id: 'Share', type: 'icon', color: 'gray0' });
		}
		return icons;
	}, [value]);

	return (
		<>
			<ChipWithPopover maxWidth="210px" background="gray2" actions={actions} {...rest}>
				{(_closePopover: () => void): JSX.Element => (
					<NewShareChipPopoverContainer
						activeRow={rowRoleToIdxMap[value.role]}
						disabledRows={disabledRows}
						checkboxValue={value.sharingAllowed}
						checkboxOnClick={switchSharingAllowed}
						containerOnClick={changeRole}
					/>
				)}
			</ChipWithPopover>
		</>
	);
};
