/*
 * SPDX-FileCopyrightText: 2022 Zextras <https://www.zextras.com>
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import {
	ApolloClient,
	FieldFunctionOptions,
	gql,
	InMemoryCache,
	NormalizedCacheObject,
	Reference
} from '@apollo/client';
import find from 'lodash/find';
import forEach from 'lodash/forEach';
import keyBy from 'lodash/keyBy';
import last from 'lodash/last';

import { GRAPHQL_ENDPOINT } from '../constants';
import { FindNodesCachedObject, FindNodesObject, NodesListCachedObject } from '../types/apollo';
import { NodeParent } from '../types/common';
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
import { nodeListCursorVar } from './nodeListCursorVar';

const ParentFragment = gql`
	fragment ParentFragment on Node {
		id
		name
		permissions {
			can_read
			can_write_file
			can_write_folder
			can_delete
			can_add_version
			can_read_link
			can_change_link
			can_share
			can_read_share
			can_change_share
		}
	}
`;

const NodeParentFragment = gql`
	fragment NodeParent on Node {
		parent {
			id
			name
			permissions {
				can_read
				can_write_file
				can_write_folder
				can_delete
				can_add_version
				can_read_link
				can_change_link
				can_share
				can_read_share
				can_change_share
			}
		}
	}
`;

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

const apolloCache = new InMemoryCache({
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
						existing: NodesListCachedObject | undefined,
						incoming: Reference[],
						fieldFunctions: FieldFunctionOptions<
							Partial<FolderChildrenArgs>,
							Partial<GetChildrenQueryVariables>
						>
					): NodesListCachedObject {
						const merged = mergeNodesList(existing, incoming, fieldFunctions);

						// update children to set parent field
						const { variables, toReference, canRead, cache } = fieldFunctions;

						if (variables?.node_id) {
							const parentFolderRef = toReference({
								__typename: 'Folder',
								id: variables.node_id
							});
							if (parentFolderRef && canRead(parentFolderRef)) {
								const parentNode = cache.readFragment<NodeParent['parent']>({
									fragment: ParentFragment,
									id: cache.identify(parentFolderRef)
								});
								// write parent data on each child
								forEach([...merged.ordered, ...merged.unOrdered], (child) => {
									cache.writeFragment<NodeParent>({
										id: cache.identify(child),
										fragment: NodeParentFragment,
										data: {
											parent: parentNode
										}
									});
								});
							}
						}

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
		apolloClient = new ApolloClient<NormalizedCacheObject>({
			uri: `${uri}${GRAPHQL_ENDPOINT}`,
			cache: apolloCache,
			credentials: 'same-origin',
			connectToDevTools: true
		});
	}
	return apolloClient;
};

export default buildClient;
