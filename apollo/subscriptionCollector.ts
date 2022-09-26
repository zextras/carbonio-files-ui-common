/* eslint-disable arrow-body-style,max-len */
/*
 * SPDX-FileCopyrightText: 2022 Zextras <https://www.zextras.com>
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { ApolloClient, NormalizedCacheObject, ObservableSubscription } from '@apollo/client';

import GET_CHILD from '../graphql/queries/getChild.graphql';
import FOLDER_CONTENT_UPDATED from '../graphql/subscriptions/folderContentUpdated.graphql';
import {
	FolderContentUpdatedSubscription,
	FolderContentUpdatedSubscriptionVariables,
	GetChildQuery,
	GetChildQueryVariables,
	NodeEventType
} from '../types/graphql/types';
import { removeNodesFromFolder, upsertNodeInFolder } from './cacheUtils';
import buildClient from './index';

const apolloClient: ApolloClient<NormalizedCacheObject> = buildClient();

const subscriptionMap: Record<string, ObservableSubscription> = {};

export const subscribeToFolderContent = (nodeId: string): void => {
	if (subscriptionMap[nodeId]) {
		return;
	}
	const addedSubscription = apolloClient
		.subscribe<FolderContentUpdatedSubscription, FolderContentUpdatedSubscriptionVariables>({
			query: FOLDER_CONTENT_UPDATED,
			variables: { folder_id: nodeId }
		})
		.subscribe({
			next({ data }) {
				if (data?.folderContentUpdated.action === NodeEventType.Updated) {
					const child = apolloClient.cache.readQuery<GetChildQuery, GetChildQueryVariables>({
						query: GET_CHILD,
						variables: {
							node_id: data.folderContentUpdated.node.id
						}
					});
					if (child?.getNode) {
						upsertNodeInFolder(apolloClient.cache, nodeId, child.getNode);
					}
				} else if (data?.folderContentUpdated.action === NodeEventType.Added) {
					apolloClient
						.query<GetChildQuery, GetChildQueryVariables>({
							query: GET_CHILD,
							fetchPolicy: 'network-only',
							variables: {
								node_id: data.folderContentUpdated.node.id as string
							}
						})
						.then((result) => {
							if (result?.data?.getNode) {
								upsertNodeInFolder(apolloClient.cache, nodeId, result.data.getNode);
							}
						});
				} else if (data?.folderContentUpdated.action === NodeEventType.Deleted) {
					removeNodesFromFolder(apolloClient.cache, nodeId, [data.folderContentUpdated.node.id]);
				}
			},
			error(errorValue) {
				console.error(errorValue);
			}
		});
	subscriptionMap[nodeId] = addedSubscription;
};
