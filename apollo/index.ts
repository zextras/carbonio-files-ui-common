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
	Reference
} from '@apollo/client';
import find from 'lodash/find';
import keyBy from 'lodash/keyBy';

import { GRAPHQL_ENDPOINT } from '../constants';
import {
	FindNodesCachedObject,
	NodesListCachedObject,
	NodesPage,
	NodesPageCachedObject,
	ShareCachedObject,
	SharesCachedObject
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
	QueryGetNodeArgs
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
						existing: ShareCachedObject[],
						incoming: ShareCachedObject[],
						{ args }: FieldFunctionOptions<Partial<NodeSharesArgs>>
					): SharesCachedObject {
						if (args?.cursor) {
							const newExisting = existing || [];
							return {
								args,
								shares: [...newExisting, ...incoming]
							};
						}
						return { args, shares: [...incoming] };
					},
					read(
						existing: SharesCachedObject,
						{ args }: FieldFunctionOptions<Partial<NodeSharesArgs>>
					): ShareCachedObject[] | undefined {
						// return the already cached data when:
						// cached data is missing
						// or
						// no arg limit is passed
						// or
						// a previous query requested a greater number of shares (cached limit is greater than args limit)
						// or
						// cached shares number is lower than the previous query limit
						// (so even requesting a greater limit, the returned share will be the same of the already cached)
						if (
							!existing?.args?.limit ||
							!args?.limit ||
							existing.args.limit >= args.limit ||
							existing.shares.length < existing.args.limit
						) {
							return existing?.shares;
						}
						// otherwise, if a query is requesting a number of shares grater then the cached data,
						// return undefined to force the network request
						return undefined;
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

		apolloClient = new ApolloClient<NormalizedCacheObject>({
			cache,
			connectToDevTools: true,
			link: httpLink
		});
	}
	return apolloClient;
};

export default buildClient;
