/*
 * SPDX-FileCopyrightText: 2022 Zextras <https://www.zextras.com>
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import {
	ApolloClient,
	FieldFunctionOptions,
	HttpLink,
	InMemoryCache,
	NormalizedCacheObject,
	Reference,
	split
} from '@apollo/client';
import { GraphQLWsLink } from '@apollo/client/link/subscriptions';
import { MockSubscriptionLink } from '@apollo/client/testing';
import { getMainDefinition } from '@apollo/client/utilities';
import { createClient } from 'graphql-ws';
import find from 'lodash/find';
import keyBy from 'lodash/keyBy';

import { GRAPHQL_ENDPOINT } from '../constants';
import {
	FindNodesCachedObject,
	NodesListCachedObject,
	NodesPage,
	NodesPageCachedObject
} from '../types/apollo';
import introspection from '../types/graphql/possible-types';
import {
	File,
	FindNodesQueryVariables,
	FolderChildrenArgs,
	GetChildrenQueryVariables,
	GetNodeQueryVariables,
	NodeSharesArgs,
	QueryFindNodesArgs,
	QueryGetNodeArgs,
	Share
} from '../types/graphql/types';

function mergeNodesList(
	existing: NodesListCachedObject | undefined,
	incoming: Reference[],
	{ readField, mergeObjects }: FieldFunctionOptions
): NodesListCachedObject {
	const newOrdered = keyBy(existing?.ordered, (item) => readField<string>('id', item) as string);
	const newUnOrdered = keyBy(
		existing?.unOrdered,
		(item) => readField<string>('id', item) as string
	);
	// add all incoming items
	// if an item was already loaded in existing ordered data it will be merged with the incoming one
	const unCachedOrdered: Reference[] = [];
	incoming.forEach((item: Reference) => {
		const id = readField<string>('id', item) as string;
		// if item is stored in cache id is valued
		if (id) {
			// check if item is stored inside the ordered nodes
			const cachedOrderedNode = newOrdered[id];
			if (cachedOrderedNode) {
				// if it is stored inside ordered nodes, merge existing data with incoming ones
				newOrdered[id] = mergeObjects(cachedOrderedNode, item);
			} else {
				// otherwise, add incoming data to the list of the uncached ordered nodes
				unCachedOrdered.push(item);
			}
			// unOrderItem that now is ordered
			if (newUnOrdered[id] != null) {
				// remove item from the unOrdered since it's now in the ordered list
				delete newUnOrdered[id];
			}
		} else {
			// item wasn't store in cache, so add it directly in the uncached ordered nodes
			unCachedOrdered.push(item);
		}
	});

	// finally, return an array again so that manual updates of the cache can work on the order of elements
	return {
		ordered: Object.values(newOrdered).concat(...unCachedOrdered),
		unOrdered: Object.values(newUnOrdered)
	};
}

function readNodesList(existing: NodesListCachedObject): Reference[] {
	const ordered = existing.ordered || [];
	const unOrdered = existing.unOrdered || [];
	return [...ordered, ...unOrdered];
}

const cache = new InMemoryCache({
	possibleTypes: introspection.possibleTypes,
	typePolicies: {
		Node: {
			merge: true,
			fields: {
				shares: {
					keyArgs: false,
					merge(
						existing: Share[],
						incoming: Share[],
						{ args }: FieldFunctionOptions<Partial<NodeSharesArgs>>
					): Share[] {
						if (args?.cursor) {
							const newExisting = existing || [];
							return [...newExisting, ...incoming];
						}
						return [...incoming];
					}
				}
			}
		},
		Folder: {
			fields: {
				children: {
					keyArgs: ['sort'],
					merge(
						existing: NodesPageCachedObject,
						incoming: NodesPage,
						fieldFunctions: FieldFunctionOptions<
							Partial<FolderChildrenArgs>,
							Partial<GetChildrenQueryVariables>
						>
					): NodesPageCachedObject {
						return {
							page_token: incoming.page_token,
							nodes: mergeNodesList(
								// for filters, if first page is requested, clear cached data emptying existing data
								fieldFunctions.variables?.page_token
									? existing.nodes
									: { ordered: [], unOrdered: [] },
								incoming.nodes,
								fieldFunctions
							)
						};
					},
					// Return all items stored so far, to avoid ambiguities
					// about the order of the items.
					read(existing: FindNodesCachedObject | undefined): NodesPage | undefined {
						if (existing) {
							return {
								nodes: existing?.nodes ? readNodesList(existing.nodes) : [],
								page_token: existing.page_token
							};
						}
						return existing;
					}
				}
			}
		},
		Query: {
			fields: {
				findNodes: {
					keyArgs: [
						'flagged',
						'shared_with_me',
						'shared_by_me',
						'folder_id',
						'cascade',
						'keywords',
						'sort'
					],
					merge(
						existing: FindNodesCachedObject,
						incoming: NodesPage,
						fieldFunctions: FieldFunctionOptions<
							QueryFindNodesArgs,
							Partial<FindNodesQueryVariables>
						>
					): FindNodesCachedObject {
						// see https://github.com/apollographql/apollo-client/issues/6394#issuecomment-656193666
						return {
							args: fieldFunctions.args,
							page_token: incoming.page_token,
							nodes: mergeNodesList(
								// for filters, if first page is requested, clear cached data emptying existing data
								fieldFunctions.variables?.page_token
									? existing.nodes
									: { ordered: [], unOrdered: [] },
								incoming.nodes,
								fieldFunctions
							)
						};
					},
					// Return all items stored so far, to avoid ambiguities
					// about the order of the items.
					read(existing: FindNodesCachedObject | undefined): NodesPage | undefined {
						if (existing) {
							return {
								nodes: existing?.nodes ? readNodesList(existing.nodes) : [],
								page_token: existing.page_token
							};
						}
						return existing;
					}
				},
				getVersions: {
					merge(
						existing: File[] | null | undefined,
						incoming: File[] | null | undefined
					): File[] | null | undefined {
						// always overwrite existing data with incoming one
						return incoming;
					}
				},
				getNode: {
					read(_, fieldFunctionOptions): Reference | undefined {
						const { args, toReference, canRead } = fieldFunctionOptions as FieldFunctionOptions<
							QueryGetNodeArgs,
							GetNodeQueryVariables
						>;
						if (args?.node_id) {
							const typename = find(introspection.possibleTypes.Node, (nodePossibleType) => {
								const nodeRef = toReference({
									__typename: nodePossibleType,
									id: args.node_id
								});
								return canRead(nodeRef);
							});

							return toReference({
								__typename: typename,
								id: args.node_id
							});
						}
						return undefined;
					}
				}
			}
		}
	}
});

let apolloClient: ApolloClient<NormalizedCacheObject>;

const buildClient: () => ApolloClient<NormalizedCacheObject> = () => {
	const uri = process.env.NODE_ENV === 'test' ? 'http://localhost:9000' : '';
	if (apolloClient == null) {
		const httpLink = new HttpLink({
			uri: `${uri}${GRAPHQL_ENDPOINT}`,
			credentials: 'same-origin'
		});

		const wsLink =
			process.env.NODE_ENV === 'test'
				? new MockSubscriptionLink()
				: new GraphQLWsLink(
						createClient({
							url: `wss://${window.location.hostname}/services/files/graphql-ws`,
							keepAlive: 45000
						})
				  );

		// The split function takes three parameters:
		// * A function that's called for each operation to execute
		// * The Link to use for an operation if the function returns a "truthy" value
		// * The Link to use for an operation if the function returns a "falsy" value
		const splitLink = split(
			({ query }) => {
				const definition = getMainDefinition(query);
				return definition.kind === 'OperationDefinition' && definition.operation === 'subscription';
			},
			wsLink,
			httpLink
		);

		apolloClient = new ApolloClient<NormalizedCacheObject>({
			cache,
			connectToDevTools: true,
			link: splitLink
		});
	}
	return apolloClient;
};

export default buildClient;
