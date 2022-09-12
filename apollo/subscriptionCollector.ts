/* eslint-disable arrow-body-style,max-len */
/*
 * SPDX-FileCopyrightText: 2022 Zextras <https://www.zextras.com>
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import {
	ApolloClient,
	NormalizedCacheObject,
	ObservableSubscription,
	Reference
} from '@apollo/client';
import filter from 'lodash/filter';
import findIndex from 'lodash/findIndex';
import map from 'lodash/map';
import size from 'lodash/size';

import CHILD from '../graphql/fragments/child.graphql';
import GET_CHILD from '../graphql/queries/getChild.graphql';
import GET_CHILDREN from '../graphql/queries/getChildren.graphql';
import FOLDER_CONTENT_UPDATED from '../graphql/subscriptions/folderContentUpdated.graphql';
import { NodesPageCachedObject } from '../types/apollo';
import { SortableNode } from '../types/common';
import {
	ChildFragment,
	FolderContentUpdatedSubscription,
	FolderContentUpdatedSubscriptionVariables,
	GetChildQuery,
	GetChildQueryVariables,
	GetChildrenQuery,
	GetChildrenQueryVariables,
	NodeEventType
} from '../types/graphql/types';
import { addNodeInSortedList } from '../utils/utils';
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
					apolloClient.cache.modify({
						id: apolloClient.cache.identify({ __typename: 'Folder', id: nodeId }),
						fields: {
							// existingChildrenRefs is the data of the cache (array of references)
							children(
								existingChildrenRefs: NodesPageCachedObject,
								{ readField, storeFieldName, toReference }
							): NodesPageCachedObject {
								const sortArg = JSON.parse(storeFieldName.replace(`children:`, '')).sort;
								const extractedCache = apolloClient.cache.extract();

								const child = apolloClient.cache.readQuery<GetChildQuery, GetChildQueryVariables>({
									query: GET_CHILD,
									variables: {
										node_id: data.folderContentUpdated.node.id
									}
								});

								const nodes =
									(existingChildrenRefs.nodes &&
										map(
											[
												...existingChildrenRefs.nodes.ordered,
												...existingChildrenRefs.nodes.unOrdered
											],
											({ __ref }) => {
												return extractedCache[__ref];
											}
										)) ||
									[];

								let newNodeRef: Reference | undefined;
								if (child?.getNode) {
									newNodeRef = toReference(child.getNode);
								}

								// find the position of the node in the loaded list to check
								// if the updated node is an ordered or an unordered node
								const index = addNodeInSortedList(
									nodes as Array<SortableNode>,
									data.folderContentUpdated.node,
									sortArg
								);

								const newOrdered =
									(existingChildrenRefs.nodes && [...existingChildrenRefs.nodes.ordered]) || [];
								const newUnOrdered =
									(existingChildrenRefs.nodes && [...existingChildrenRefs.nodes.unOrdered]) || [];

								let newIndex = index;

								const currentIndexOrdered = findIndex(
									newOrdered,
									(item) => readField('id', item) === readField('id', newNodeRef)
								);
								let currentIndexUnordered = -1;
								if (currentIndexOrdered < 0) {
									currentIndexUnordered = findIndex(
										newUnOrdered,
										(item) => readField('id', item) === readField('id', newNodeRef)
									);
								}

								// if the node was already loaded, remove it from the list before the insert of the new one
								if (currentIndexOrdered > -1) {
									newOrdered.splice(currentIndexOrdered, 1);
									// also, if current position is before the new one, decrease by 1 the new index
									if (currentIndexOrdered < newIndex) {
										newIndex -= 1;
									}
								} else if (currentIndexUnordered > -1) {
									newUnOrdered.splice(currentIndexUnordered, 1);
									// also, if current position is before the new one, decrease by 1 the new index
									if (currentIndexUnordered + newOrdered.length < newIndex) {
										newIndex -= 1;
									}
								}

								if (newNodeRef) {
									if (newIndex < 0 || newIndex > newOrdered.length + newUnOrdered.length) {
										// no valid position, put node as last unordered
										newUnOrdered.push(newNodeRef);
									} else if (newIndex < newOrdered.length) {
										// if newIndex is valid, and it's before last element of the ordered list, put the node in the ordered list
										newOrdered.splice(newIndex, 0, newNodeRef);
									} else {
										// otherwise, add the node in the unordered list
										// calculate the index in the unordered by subtracting the ordered length to the given index
										newIndex -= newOrdered.length;
										newUnOrdered.splice(newIndex, 0, newNodeRef);
									}
								}

								return {
									...existingChildrenRefs,
									nodes: {
										ordered: newOrdered,
										unOrdered: newUnOrdered
									}
								};
							}
						}
					});
				} else if (data?.folderContentUpdated.action === NodeEventType.Added) {
					apolloClient
						.query<GetChildQuery, GetChildQueryVariables>({
							query: GET_CHILD,
							fetchPolicy: 'no-cache',
							variables: {
								node_id: data.folderContentUpdated.node.id as string
							}
						})
						.then((result) => {
							if (result?.data?.getNode) {
								apolloClient.cache.modify({
									id: apolloClient.cache.identify({ __typename: 'Folder', id: nodeId }),
									fields: {
										// existingChildrenRefs is the data of the cache (array of references)
										children(
											existingChildrenRefs: NodesPageCachedObject,
											{ readField, storeFieldName }
										): NodesPageCachedObject {
											const sortArg = JSON.parse(storeFieldName.replace(`children:`, '')).sort;

											const extractedCache = apolloClient.cache.extract();

											const nodes =
												(existingChildrenRefs.nodes &&
													map(
														[
															...existingChildrenRefs.nodes.ordered,
															...existingChildrenRefs.nodes.unOrdered
														],
														({ __ref }) => {
															return extractedCache[__ref];
														}
													)) ||
												[];

											const parentFolder = apolloClient.cache.readQuery<
												GetChildrenQuery,
												GetChildrenQueryVariables
											>({
												query: GET_CHILDREN,
												variables: {
													node_id: nodeId,
													children_limit: Number.MAX_SAFE_INTEGER,
													sort: sortArg
												}
											});

											let newNodeRef: Reference | undefined;
											if (result?.data?.getNode) {
												newNodeRef = apolloClient.cache.writeFragment<ChildFragment>({
													fragment: CHILD,
													fragmentName: 'Child',
													data: result.data.getNode
												});
											}

											// seems that inserting an incomplete node invalidate the cache and trigger a new getChildren
											// const newNodeRef =
											// 	apolloClient.cache.writeFragment<ChildWithoutComplexDataFragment>({
											// 		fragment: CHILD_WITHOUT_COMPLEX_DATA,
											// 		fragmentName: 'ChildWithoutComplexData',
											// 		data: data.folderContentUpdated.node
											// 	});

											// else find the position of the node in the loaded list to check
											// if the updated node is an ordered or an unordered node
											const index = addNodeInSortedList(
												nodes as Array<SortableNode>,
												data.folderContentUpdated.node,
												sortArg
											);

											const newOrdered =
												(existingChildrenRefs.nodes && [...existingChildrenRefs.nodes.ordered]) ||
												[];
											const newUnOrdered =
												(existingChildrenRefs.nodes && [...existingChildrenRefs.nodes.unOrdered]) ||
												[];

											let newIndex = index;

											const currentIndexOrdered = findIndex(
												newOrdered,
												(item) => readField('id', item) === readField('id', newNodeRef)
											);
											let currentIndexUnordered = -1;
											if (currentIndexOrdered < 0) {
												currentIndexUnordered = findIndex(
													newUnOrdered,
													(item) => readField('id', item) === readField('id', newNodeRef)
												);
											}

											// if the node was already loaded, remove it from the list before the insert of the new one
											if (currentIndexOrdered > -1) {
												newOrdered.splice(currentIndexOrdered, 1);
												// also, if current position is before the new one, decrease by 1 the new index
												if (currentIndexOrdered < newIndex) {
													newIndex -= 1;
												}
											} else if (currentIndexUnordered > -1) {
												newUnOrdered.splice(currentIndexUnordered, 1);
												// also, if current position is before the new one, decrease by 1 the new index
												if (currentIndexUnordered + newOrdered.length < newIndex) {
													newIndex -= 1;
												}
											}

											if (newNodeRef) {
												if (newIndex < 0 || newIndex > newOrdered.length + newUnOrdered.length) {
													// no valid position, put node as last unordered
													newUnOrdered.push(newNodeRef);
													console.log('push');
												} else if (newIndex < newOrdered.length) {
													// if newIndex is valid, and it's before last element of the ordered list, put the node in the ordered list
													newOrdered.splice(newIndex, 0, newNodeRef);
													console.log('splice1');
												} else {
													// otherwise, add the node in the unordered list
													// calculate the index in the unordered by subtracting the ordered length to the given index
													newIndex -= newOrdered.length;
													newUnOrdered.splice(newIndex, 0, newNodeRef);
													console.log('splice2');
												}
											}

											console.log('return');
											return {
												...existingChildrenRefs,
												nodes: {
													ordered: newOrdered,
													unOrdered: newUnOrdered
												}
											};
										}
									}
								});
							}
						});
				} else if (data?.folderContentUpdated.action === NodeEventType.Deleted) {
					apolloClient.cache.modify({
						id: apolloClient.cache.identify({ __typename: 'Folder', id: nodeId }),
						fields: {
							children(
								existingNodesRefs: NodesPageCachedObject,
								{ readField, DELETE }
							): NodesPageCachedObject {
								const newOrdered = filter(existingNodesRefs.nodes?.ordered, (ref) => {
									const id = readField<string>('id', ref);
									return !!id && id !== data.folderContentUpdated.node.id;
								});

								const newUnOrdered = filter(existingNodesRefs.nodes?.unOrdered, (ref) => {
									const id = readField<string>('id', ref);
									return !!id && id !== data.folderContentUpdated.node.id;
								});

								if (
									existingNodesRefs.page_token &&
									size(newOrdered) === 0 &&
									size(newUnOrdered) === 0
								) {
									return DELETE;
								}

								return {
									...existingNodesRefs,
									nodes: {
										ordered: newOrdered,
										unOrdered: newUnOrdered
									}
								};
							}
						}
					});
				}
			},
			error(err) {
				console.error('err', err);
			}
		});
	subscriptionMap[nodeId] = addedSubscription;
};
