/*
 * SPDX-FileCopyrightText: 2022 Zextras <https://www.zextras.com>
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import React, { useCallback } from 'react';

import { ApolloProvider } from '@apollo/client';
import { useModal } from '@zextras/carbonio-design-system';

import buildClient from '../../apollo';
import { NodesSelectionModalContent } from '../../views/components/NodesSelectionModalContent';

export type OpenNodesSelectionModal = (
	args: Omit<React.ComponentPropsWithoutRef<typeof NodesSelectionModalContent>, 'closeAction'>
) => void;

export function useNodesSelectionModal(): {
	openNodesSelectionModal: OpenNodesSelectionModal;
} {
	const createModal = useModal();
	const apolloClient = buildClient();

	const openModal = useCallback<OpenNodesSelectionModal>(
		(props) => {
			const closeModal = createModal(
				{
					maxHeight: '60vh',
					children: (
						<ApolloProvider client={apolloClient}>
							<NodesSelectionModalContent closeAction={(): void => closeModal()} {...props} />
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
