/*
 * SPDX-FileCopyrightText: 2022 Zextras <https://www.zextras.com>
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { QueryResult, useQuery } from '@apollo/client';

import GET_NODE_INVITATION_LINKS from '../../../graphql/queries/getNodeInvitationLinks.graphql';
import {
	GetNodeInvitationLinksQuery,
	GetNodeInvitationLinksQueryVariables
} from '../../../types/graphql/types';
import { useErrorHandler } from '../../useErrorHandler';

export function useGetNodeInvitationLinksQuery(
	nodeId: string
): Pick<QueryResult<GetNodeInvitationLinksQuery>, 'data' | 'loading' | 'error'> {
	const { data, loading, error } = useQuery<
		GetNodeInvitationLinksQuery,
		GetNodeInvitationLinksQueryVariables
	>(GET_NODE_INVITATION_LINKS, {
		variables: {
			node_id: nodeId
		},
		skip: !nodeId,
		notifyOnNetworkStatusChange: true,
		errorPolicy: 'all',
		returnPartialData: true
	});
	useErrorHandler(error, 'GET_NODE_INVITATION_LINKS');

	return { data, loading, error };
}
