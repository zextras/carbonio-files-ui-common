/*
 * SPDX-FileCopyrightText: 2022 Zextras <https://www.zextras.com>
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import React, { useCallback } from 'react';

import { ApolloProvider } from '@apollo/client';
import { useModal } from '@zextras/carbonio-design-system';

import buildClient from '../../apollo';
import { BaseNodeFragment } from '../../types/graphql/types';
import { ArrayOneOrMore } from '../../types/utils';
import { NodesSelectionModalContent } from '../../views/components/NodesSelectionModalContent';

type IntegrationNode = BaseNodeFragment;

export type OpenNodesSelectionModal = (args: {
	title: string;
	confirmLabel: string;
	confirmAction: (nodes: ArrayOneOrMore<IntegrationNode>) => void;
	isValidSelection?: (node: IntegrationNode) => boolean;
}) => void;

export function useNodesSelectionModal(): {
	openNodesSelectionModal: OpenNodesSelectionModal;
} {
	const createModal = useModal();
	const apolloClient = buildClient();

	const openModal = useCallback<OpenNodesSelectionModal>(
		({ title, confirmLabel, confirmAction, isValidSelection }) => {
			const closeModal = createModal(
				{
					maxHeight: '60vh',
					children: (
						<ApolloProvider client={apolloClient}>
							<NodesSelectionModalContent
								title={title}
								confirmAction={confirmAction}
								confirmLabel={confirmLabel}
								closeAction={(): void => closeModal()}
								isValidSelection={isValidSelection}
							/>
						</ApolloProvider>
					)
				},
				true
			);
		},
		[apolloClient, createModal]
	);

	return { openNodesSelectionModal: openModal };
}
