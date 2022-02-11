/*
 * SPDX-FileCopyrightText: 2022 Zextras <https://www.zextras.com>
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { ApolloError, ServerError } from '@apollo/client';
import { DocumentNode } from 'graphql';

import {
	FULL_SHARES_LOAD_LIMIT,
	NODES_LOAD_LIMIT,
	NODES_SORT_DEFAULT,
	SHARES_LOAD_LIMIT
} from '../constants';
import CLONE_VERSION from '../graphql/mutations/cloneVersion.graphql';
import COPY_NODES from '../graphql/mutations/copyNodes.graphql';
import CREATE_FOLDER from '../graphql/mutations/createFolder.graphql';
import CREATE_SHARE from '../graphql/mutations/createShare.graphql';
import DELETE_NODES from '../graphql/mutations/deleteNodes.graphql';
import DELETE_SHARE from '../graphql/mutations/deleteShare.graphql';
import DELETE_VERSIONS from '../graphql/mutations/deleteVersions.graphql';
import FLAG_NODES from '../graphql/mutations/flagNodes.graphql';
import KEEP_VERSIONS from '../graphql/mutations/keepVersions.graphql';
import MOVE_NODES from '../graphql/mutations/moveNodes.graphql';
import RESTORE_NODES from '../graphql/mutations/restoreNodes.graphql';
import TRASH_NODES from '../graphql/mutations/trashNodes.graphql';
import UPDATE_NODE from '../graphql/mutations/updateNode.graphql';
import UPDATE_NODE_DESCRIPTION from '../graphql/mutations/updateNodeDescription.graphql';
import UPDATE_SHARE from '../graphql/mutations/updateShare.graphql';
import FIND_NODES from '../graphql/queries/findNodes.graphql';
import GET_ACCOUNT_BY_EMAIL from '../graphql/queries/getAccountByEmail.graphql';
import GET_BASE_NODE from '../graphql/queries/getBaseNode.graphql';
import GET_CHILDREN from '../graphql/queries/getChildren.graphql';
import GET_NODE from '../graphql/queries/getNode.graphql';
import GET_NODE_LINKS from '../graphql/queries/getNodeLinks.graphql';
import GET_PARENT from '../graphql/queries/getParent.graphql';
import GET_PATH from '../graphql/queries/getPath.graphql';
import GET_SHARES from '../graphql/queries/getShares.graphql';
import GET_VERSIONS from '../graphql/queries/getVersions.graphql';
import { populateNodePage } from '../mocks/mockUtils';
import {
	CopyNodesMutationVariables,
	CreateFolderMutationVariables,
	DeleteNodesMutationVariables,
	FindNodesQueryVariables,
	FlagNodesMutationVariables,
	GetBaseNodeQueryVariables,
	GetChildrenQueryVariables,
	GetNodeQueryVariables,
	GetParentQueryVariables,
	GetPathQueryVariables,
	GetSharesQueryVariables,
	MoveNodesMutationVariables,
	Mutation,
	Node,
	Query as QueryType,
	TrashNodesMutationVariables,
	RestoreNodesMutationVariables,
	UpdateNodeDescriptionMutationVariables,
	UpdateNodeMutationVariables,
	DeleteShareMutationVariables,
	CreateShareMutationVariables,
	UpdateShareMutationVariables,
	Share,
	GetAccountByEmailQueryVariables,
	GetNodeLinksQueryVariables,
	GetVersionsQueryVariables,
	File,
	DeleteVersionsMutationVariables,
	Maybe,
	Scalars,
	KeepVersionsMutationVariables,
	CloneVersionMutationVariables
} from '../types/graphql/types';

type Id = string;

type MockVariablePossibleType =
	| FindNodesQueryVariables
	| TrashNodesMutationVariables
	| RestoreNodesMutationVariables
	| DeleteNodesMutationVariables
	| UpdateNodeMutationVariables
	| UpdateNodeDescriptionMutationVariables
	| GetChildrenQueryVariables
	| MoveNodesMutationVariables
	| CreateFolderMutationVariables
	| FlagNodesMutationVariables
	| GetPathQueryVariables
	| GetParentQueryVariables
	| CopyNodesMutationVariables
	| GetNodeQueryVariables
	| GetSharesQueryVariables
	| GetBaseNodeQueryVariables
	| DeleteShareMutationVariables
	| CreateShareMutationVariables
	| UpdateShareMutationVariables
	| GetAccountByEmailQueryVariables
	| GetNodeLinksQueryVariables
	| DeleteVersionsMutationVariables
	| GetVersionsQueryVariables;

export interface Mock {
	request: {
		query: DocumentNode;
		variables: MockVariablePossibleType;
	};
	result?:
		| {
				data: Partial<QueryType> | Partial<Mutation>;
		  }
		| (() => {
				data: Partial<QueryType> | Partial<Mutation>;
		  });
	error?: ServerError | ApolloError;
}

/**
 * Find Nodes Mock
 */
interface FindNodesMock extends Mock {
	request: {
		query: DocumentNode;
		variables: FindNodesQueryVariables;
	};
	result: {
		data: Pick<QueryType, 'findNodes'>;
	};
}

export function getFindNodesVariables(
	variables: Partial<FindNodesQueryVariables>,
	withCursor = false
): FindNodesQueryVariables {
	return {
		limit: NODES_LOAD_LIMIT,
		sort: NODES_SORT_DEFAULT,
		pageToken: withCursor ? 'next_page_token' : undefined,
		sharesLimit: 1,
		...variables
	};
}

export function mockFindNodes(variables: FindNodesQueryVariables, nodes: Node[]): FindNodesMock {
	return {
		request: {
			query: FIND_NODES,
			variables
		},
		result: {
			data: {
				findNodes: populateNodePage(nodes, variables.limit)
			}
		}
	};
}

/**
 * Trash Nodes Mock
 */
interface TrashNodesMock extends Mock {
	request: {
		query: DocumentNode;
		variables: TrashNodesMutationVariables;
	};
	result: {
		data: Pick<Mutation, 'trashNodes'>;
	};
}

export function mockTrashNodes(
	variables: TrashNodesMutationVariables,
	trashNodes: Id[]
): TrashNodesMock {
	return {
		request: {
			query: TRASH_NODES,
			variables
		},
		result: {
			data: {
				trashNodes
			}
		}
	};
}

/**
 * Restore Nodes Mock
 */
interface RestoreNodesMock extends Mock {
	request: {
		query: DocumentNode;
		variables: RestoreNodesMutationVariables;
	};
	result: {
		data: Pick<Mutation, 'restoreNodes'>;
	};
}

export function mockRestoreNodes(
	variables: RestoreNodesMutationVariables,
	restoreNodes: Array<Node>
): RestoreNodesMock {
	return {
		request: {
			query: RESTORE_NODES,
			variables
		},
		result: {
			data: {
				restoreNodes
			}
		}
	};
}

/**
 * Delete Permanently Mock
 */
interface DeletePermanentlyMock extends Mock {
	request: {
		query: DocumentNode;
		variables: DeleteNodesMutationVariables;
	};
	result: {
		data: Pick<Mutation, 'deleteNodes'>;
	};
}

export function mockDeletePermanently(
	variables: DeleteNodesMutationVariables,
	deleteNodes: Id[]
): DeletePermanentlyMock {
	return {
		request: {
			query: DELETE_NODES,
			variables
		},
		result: {
			data: {
				deleteNodes
			}
		}
	};
}

/**
 * Update Node Mock
 */
interface UpdateNodeMock extends Mock {
	request: {
		query: DocumentNode;
		variables: UpdateNodeMutationVariables;
	};
	result: {
		data: Pick<Mutation, 'updateNode'>;
	};
}

export function mockUpdateNode(
	variables: UpdateNodeMutationVariables,
	updateNode: Node
): Pick<UpdateNodeMock, 'request' | 'result'> {
	return {
		request: {
			query: UPDATE_NODE,
			variables
		},
		result: {
			data: {
				updateNode
			}
		}
	};
}

export function mockUpdateNodeError(
	variables: UpdateNodeMutationVariables,
	error: ServerError | ApolloError
): Pick<UpdateNodeMock, 'request' | 'error'> {
	return {
		request: {
			query: UPDATE_NODE,
			variables
		},
		error
	};
}

/**
 * Update Node Description Mock
 */
interface UpdateNodeDescriptionMock extends Mock {
	request: {
		query: DocumentNode;
		variables: UpdateNodeDescriptionMutationVariables;
	};
	result: {
		data: Pick<Mutation, 'updateNode'>;
	};
}

export function mockUpdateNodeDescription(
	variables: UpdateNodeDescriptionMutationVariables,
	updateNode: Node
): Pick<UpdateNodeDescriptionMock, 'request' | 'result'> {
	return {
		request: {
			query: UPDATE_NODE_DESCRIPTION,
			variables
		},
		result: {
			data: {
				updateNode
			}
		}
	};
}

/**
 * Flag Nodes Mock
 */
interface FlagNodesMock extends Mock {
	request: {
		query: DocumentNode;
		variables: FlagNodesMutationVariables;
	};
	result: {
		data: Pick<Mutation, 'flagNodes'>;
	};
}

export function mockFlagNodes(
	variables: FlagNodesMutationVariables,
	flagNodes: Id[]
): FlagNodesMock {
	return {
		request: {
			query: FLAG_NODES,
			variables
		},
		result: {
			data: {
				flagNodes
			}
		}
	};
}

/**
 * Get Children Mock
 */
interface GetChildrenMock extends Mock {
	request: {
		query: DocumentNode;
		variables: GetChildrenQueryVariables;
	};
	result: {
		data: Pick<QueryType, 'getNode'>;
	};
}

export function getChildrenVariables(
	folderId: Id,
	childrenLimit = NODES_LOAD_LIMIT,
	sort = NODES_SORT_DEFAULT,
	sharesLimit = 1
): GetChildrenQueryVariables {
	return {
		id: folderId,
		childrenLimit,
		sort,
		sharesLimit
	};
}

export function mockGetChildren(
	variables: GetChildrenQueryVariables,
	getNode: Node
): Pick<GetChildrenMock, 'request' | 'result'> {
	return {
		request: {
			query: GET_CHILDREN,
			variables
		},
		result: {
			data: {
				getNode
			}
		}
	};
}

export function mockGetChildrenError(
	variables: GetChildrenQueryVariables,
	error: ServerError | ApolloError
): Pick<GetChildrenMock, 'request' | 'error'> {
	return {
		request: {
			query: GET_CHILDREN,
			variables
		},
		error
	};
}

/**
 * Move Nodes Mock
 */
export interface MoveNodesMock extends Mock {
	request: {
		query: DocumentNode;
		variables: MoveNodesMutationVariables;
	};
	result: () => {
		data: Pick<Mutation, 'moveNodes'>;
	};
}

export function mockMoveNodes(
	variables: MoveNodesMutationVariables,
	moveNodes: Node[],
	callback?: () => void
): MoveNodesMock {
	return {
		request: {
			query: MOVE_NODES,
			variables
		},
		result: (): ReturnType<MoveNodesMock['result']> => {
			callback && callback();
			return {
				data: {
					moveNodes
				}
			};
		}
	};
}

/**
 * Copy Nodes Mock
 */
interface CopyNodesMock extends Mock {
	request: {
		query: DocumentNode;
		variables: CopyNodesMutationVariables;
	};
	result: {
		data: Pick<Mutation, 'copyNodes'>;
	};
}

export function mockCopyNodes(
	variables: MoveNodesMutationVariables,
	copyNodes: Node[]
): CopyNodesMock {
	return {
		request: {
			query: COPY_NODES,
			variables
		},
		result: {
			data: {
				copyNodes
			}
		}
	};
}

/**
 * Create Folder Mock
 */

interface CreateFolderMock extends Mock {
	request: {
		query: DocumentNode;
		variables: CreateFolderMutationVariables;
	};
	result: {
		data: Pick<Mutation, 'createFolder'>;
	};
}

export function mockCreateFolder(
	variables: CreateFolderMutationVariables,
	createFolder: Node
): Pick<CreateFolderMock, 'request' | 'result'> {
	return {
		request: {
			query: CREATE_FOLDER,
			variables
		},
		result: {
			data: {
				createFolder
			}
		}
	};
}

export function mockCreateFolderError(
	variables: CreateFolderMutationVariables,
	error: ServerError | ApolloError
): Pick<CreateFolderMock, 'request' | 'error'> {
	return {
		request: {
			query: CREATE_FOLDER,
			variables
		},
		error
	};
}

/**
 * Get parents mock
 */

interface GetParentMock extends Mock {
	request: {
		query: DocumentNode;
		variables: GetParentQueryVariables;
	};
	result: {
		data: Pick<QueryType, 'getNode'>;
	};
}

export function mockGetParent(variables: GetParentQueryVariables, node: Node): GetParentMock {
	return {
		request: {
			query: GET_PARENT,
			variables
		},
		result: {
			data: {
				getNode: node
			}
		}
	};
}

/**
 * Get path mock
 */

interface GetPathMock extends Mock {
	request: {
		query: DocumentNode;
		variables: GetPathQueryVariables;
	};
	result: {
		data: Pick<QueryType, 'getPath'>;
	};
}

export function mockGetPath(variables: GetPathQueryVariables, getPath: Node[]): GetPathMock {
	return {
		request: {
			query: GET_PATH,
			variables
		},
		result: {
			data: {
				getPath
			}
		}
	};
}

/**
 * Get node mock
 */
interface GetNodeMock extends Mock {
	request: {
		query: DocumentNode;
		variables: GetNodeQueryVariables;
	};
	result: {
		data: Pick<QueryType, 'getNode'>;
	};
}

export function getNodeVariables(
	nodeId: Id,
	childrenLimit = NODES_LOAD_LIMIT,
	sort = NODES_SORT_DEFAULT,
	sharesLimit = SHARES_LOAD_LIMIT
): GetNodeQueryVariables {
	return {
		id: nodeId,
		childrenLimit,
		sort,
		sharesLimit
	};
}

export function mockGetNode(
	variables: GetNodeQueryVariables,
	getNode: Node
): Pick<GetNodeMock, 'request' | 'result'> {
	return {
		request: {
			query: GET_NODE,
			variables
		},
		result: {
			data: {
				getNode
			}
		}
	};
}

/**
 * Get shares mock
 */
interface GetSharesMock extends Mock {
	request: {
		query: DocumentNode;
		variables: GetSharesQueryVariables;
	};
	result: {
		data: Pick<QueryType, 'getNode'>;
	};
}

export function getSharesVariables(
	nodeId: Id,
	sharesLimit = FULL_SHARES_LOAD_LIMIT
): GetSharesQueryVariables {
	return {
		id: nodeId,
		sharesLimit
	};
}

export function mockGetShares(
	variables: GetSharesQueryVariables,
	getNode: Node
): Pick<GetSharesMock, 'request' | 'result'> {
	return {
		request: {
			query: GET_SHARES,
			variables
		},
		result: {
			data: {
				getNode
			}
		}
	};
}

/**
 * Get node mock
 */
interface GetBaseNodeMock extends Mock {
	request: {
		query: DocumentNode;
		variables: GetBaseNodeQueryVariables;
	};
	result: {
		data: Pick<QueryType, 'getNode'>;
	};
}

export function mockGetBaseNode(
	variables: GetBaseNodeQueryVariables,
	getNode: Node
): Pick<GetBaseNodeMock, 'request' | 'result'> {
	return {
		request: {
			query: GET_BASE_NODE,
			variables
		},
		result: {
			data: {
				getNode
			}
		}
	};
}

/**
 * Delete share mock
 */

interface DeleteShareMock extends Mock {
	request: {
		query: DocumentNode;
		variables: DeleteShareMutationVariables;
	};
	result: {
		data: Pick<Mutation, 'deleteShare'>;
	};
}

export function mockDeleteShare(
	variables: DeleteShareMutationVariables,
	deleteShare: boolean
): DeleteShareMock {
	return {
		request: {
			query: DELETE_SHARE,
			variables
		},
		result: {
			data: {
				deleteShare
			}
		}
	};
}

/**
 * Create share mock
 */

interface CreateShareMock extends Mock {
	request: {
		query: DocumentNode;
		variables: CreateShareMutationVariables;
	};
	result: () => {
		data: Pick<Mutation, 'createShare'>;
	};
}

export function mockCreateShare(
	variables: CreateShareMutationVariables,
	createShare: Share,
	callback?: (...args: unknown[]) => void
): CreateShareMock {
	return {
		request: {
			query: CREATE_SHARE,
			variables
		},
		result: (): ReturnType<CreateShareMock['result']> => {
			callback && callback();
			return {
				data: {
					createShare
				}
			};
		}
	};
}

/**
 * Create share mock
 */

interface UpdateShareMock extends Mock {
	request: {
		query: DocumentNode;
		variables: UpdateShareMutationVariables;
	};
	result: () => { data: Pick<Mutation, 'updateShare'> };
}

export function mockUpdateShare(
	variables: UpdateShareMutationVariables,
	updateShare?: Share | null,
	callback?: () => void
): UpdateShareMock {
	return {
		request: {
			query: UPDATE_SHARE,
			variables
		},
		result: (): ReturnType<UpdateShareMock['result']> => {
			callback && callback();
			return {
				data: {
					updateShare
				}
			};
		}
	};
}

/**
 * Get account by email mock
 */

interface GetAccountByEmailMock extends Mock {
	request: {
		query: DocumentNode;
		variables: GetAccountByEmailQueryVariables;
	};
	result?: { data: Pick<QueryType, 'getAccountByEmail'> };
}

export function mockGetAccountByEmail(
	variables: GetAccountByEmailQueryVariables,
	account: QueryType['getAccountByEmail'],
	error?: ApolloError
): GetAccountByEmailMock {
	return {
		request: {
			query: GET_ACCOUNT_BY_EMAIL,
			variables
		},
		result: {
			data: {
				getAccountByEmail: account
			}
		},
		error
	};
}

/**
 * Get Node Links mock
 */
interface GetNodeLinksMock extends Mock {
	request: {
		query: DocumentNode;
		variables: GetNodeLinksQueryVariables;
	};
	result: {
		data: Pick<QueryType, 'getNode'>;
	};
}

export function mockGetNodeLinks(
	variables: GetNodeLinksQueryVariables,
	node: Node
): GetNodeLinksMock {
	return {
		request: {
			query: GET_NODE_LINKS,
			variables
		},
		result: {
			data: {
				getNode: {
					...node,
					links: []
				}
			}
		}
	};
}

/**
 * Get File Versions mock
 */
interface GetVersionsMock extends Mock {
	request: {
		query: DocumentNode;
		variables: GetVersionsQueryVariables;
	};
	result: {
		data: Pick<QueryType, 'getVersions'>;
	};
}

export function mockGetVersions(
	variables: GetVersionsQueryVariables,
	files: File[]
): GetVersionsMock {
	return {
		request: {
			query: GET_VERSIONS,
			variables
		},
		result: {
			data: {
				getVersions: files
			}
		}
	};
}

/**
 * Delete versions mock
 */

interface DeleteVersionsMock extends Mock {
	request: {
		query: DocumentNode;
		variables: DeleteVersionsMutationVariables;
	};
	result: {
		data: Pick<Mutation, 'deleteVersions'>;
	};
}

export function mockDeleteVersions(
	variables: DeleteVersionsMutationVariables,
	versions: Array<Maybe<Scalars['Int']>>
): DeleteVersionsMock {
	return {
		request: {
			query: DELETE_VERSIONS,
			variables
		},
		result: {
			data: {
				deleteVersions: versions
			}
		}
	};
}

/**
 * keep versions mock
 */

interface KeepVersionsMock extends Mock {
	request: {
		query: DocumentNode;
		variables: KeepVersionsMutationVariables;
	};
	result: {
		data: Pick<Mutation, 'keepVersions'>;
	};
}

export function mockKeepVersions(
	variables: KeepVersionsMutationVariables,
	versions: Array<Maybe<Scalars['Int']>>
): KeepVersionsMock {
	return {
		request: {
			query: KEEP_VERSIONS,
			variables
		},
		result: {
			data: {
				keepVersions: versions
			}
		}
	};
}

/**
 * Clone version mock
 */

interface CloneVersionMock extends Mock {
	request: {
		query: DocumentNode;
		variables: CloneVersionMutationVariables;
	};
	result: {
		data: Pick<Mutation, 'cloneVersion'>;
	};
}

export function mockCloneVersion(
	variables: CloneVersionMutationVariables,
	file: File
): CloneVersionMock {
	return {
		request: {
			query: CLONE_VERSION,
			variables
		},
		result: {
			data: {
				cloneVersion: file
			}
		}
	};
}
