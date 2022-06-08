/*
 * SPDX-FileCopyrightText: 2022 Zextras <https://www.zextras.com>
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import {
	ApolloClient,
	FieldFunctionOptions,
	InMemoryCache,
	NormalizedCacheObject,
	Reference
} from '@apollo/client';
import keyBy from 'lodash/keyBy';
import last from 'lodash/last';

import { GRAPHQL_ENDPOINT } from '../constants';
import { FindNodesCachedObject, FindNodesObject, NodesListCachedObject } from '../types/apollo';
import introspection from '../types/graphql/possible-types';
import {
	File,
	FindNodesQueryVariables,
	FolderChildrenArgs,
	GetChildrenQueryVariables,
	NodeSharesArgs,
	QueryFindNodesArgs,
	Share
} from '../types/graphql/types';
import { nodeListCursorVar } from './nodeListCursorVar';

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
					},
					read(existing: Share[] | undefined): Share[] {
						return existing || [];
					}
				}
			}
		},
		Folder: {
			fields: {
				children: {
					keyArgs: ['sort'],
					merge(
						existing: NodesListCachedObject | undefined,
						incoming: Reference[],
						fieldFunctions: FieldFunctionOptions<
							Partial<FolderChildrenArgs>,
							Partial<GetChildrenQueryVariables>
						>
					): NodesListCachedObject {
						const merged = mergeNodesList(existing, incoming, fieldFunctions);
						const nodeListCursorKey = fieldFunctions.variables?.node_id;
						const pageSize = fieldFunctions.variables?.children_limit;
						// By putting this logic here cursor is updated only when new data are received by network requests.
						// If an update to ordered nodes is done from client, the cursor does not change.
						// The only case where the cursor might have to be updated is when client add a node as last ordered
						// element, but this happens only when all pages are loaded, so cursor is null and has to remain
						// null to tell all nodes are already loaded
						if (nodeListCursorKey && pageSize) {
							const cursor = last(merged.ordered);

							if (incoming.length > 0 && incoming.length % pageSize === 0) {
								nodeListCursorVar({
									...nodeListCursorVar(),
									[nodeListCursorKey]: cursor
								});
							} else {
								nodeListCursorVar({
									...nodeListCursorVar(),
									[nodeListCursorKey]: null
								});
							}
						}
						return merged;
					},
					// Return all items stored so far, to avoid ambiguities
					// about the order of the items.
					read(existing: NodesListCachedObject | undefined): Reference[] | undefined {
						if (existing) {
							return readNodesList(existing);
						}
						return existing;
					}
				},
				cursor(
					_existing: string,
					{
						variables,
						readField
					}: FieldFunctionOptions<unknown, Partial<GetChildrenQueryVariables>>
				): string | null | undefined {
					// cursor can have 3 state:
					// 1) non-empty string: it's a cursor to load pages after first one
					// 2) null: there are no more pages to load
					// 3) undefined: indicates that there might be a new first page.
					// Useful state to force refetch when all ordered nodes are removed from the list
					// but there are some pages not loaded yet.
					if (variables?.node_id) {
						const cursor = nodeListCursorVar()[variables.node_id];
						if (cursor) {
							return readField('id', cursor);
						}
						return cursor;
					}
					return undefined;
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
						// eslint-disable-next-line camelcase
						incoming: { nodes: Reference[]; page_token: string },
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
					read(existing: FindNodesCachedObject | undefined): FindNodesObject | undefined {
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
				}
			}
		}
	}
});

let apolloClient: ApolloClient<NormalizedCacheObject>;

const buildClient: () => ApolloClient<NormalizedCacheObject> = () => {
	const uri = process.env.NODE_ENV === 'test' ? 'http://localhost:9000' : '';
	if (apolloClient == null) {
		apolloClient = new ApolloClient<NormalizedCacheObject>({
			uri: `${uri}${GRAPHQL_ENDPOINT}`,
			cache,
			credentials: 'same-origin',
			connectToDevTools: true
		});
	}
	return apolloClient;
};

export default buildClient;
