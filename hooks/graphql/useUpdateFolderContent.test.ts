/*
 * SPDX-FileCopyrightText: 2022 Zextras <https://www.zextras.com>
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { RenderHookResult } from '@testing-library/react-hooks';
import find from 'lodash/find';

import server from '../../../mocks/server';
import { NODES_LOAD_LIMIT, NODES_SORT_DEFAULT } from '../../constants';
import GET_CHILDREN from '../../graphql/queries/getChildren.graphql';
import {
	populateFile,
	populateFolder,
	populateNode,
	populateNodes,
	sortNodes
} from '../../mocks/mockUtils';
import {
	Folder,
	GetChildrenQuery,
	GetChildrenQueryVariables,
	Maybe,
	Node
} from '../../types/graphql/types';
import { getChildrenVariables } from '../../utils/mockUtils';
import { getApolloHookWrapper, WrapperProps } from '../../utils/testUtils';
import { addNodeInSortedList } from '../../utils/utils';
import { UpdateFolderContentType, useUpdateFolderContent } from './useUpdateFolderContent';

afterEach(() => {
	server.resetHandlers();
});

describe('useUpdateFolderContent', () => {
	function setupHook(): {
		renderHookResult: RenderHookResult<WrapperProps, unknown>;
		updateFolderContent: UpdateFolderContentType;
	} {
		const renderHookResult = getApolloHookWrapper(global.apolloClient, useUpdateFolderContent);
		const updateFolderContent = renderHookResult.result.current as UpdateFolderContentType;
		expect(updateFolderContent).toBeDefined();
		return { renderHookResult, updateFolderContent };
	}

	function readGetChildrenQuery(folderId: string, sort = NODES_SORT_DEFAULT): Folder {
		const queryResult = global.apolloClient.readQuery<GetChildrenQuery, GetChildrenQueryVariables>({
			query: GET_CHILDREN,
			variables: getChildrenVariables(folderId, NODES_LOAD_LIMIT * 2, sort)
		});
		expect(queryResult?.getNode || null).not.toBeNull();
		return queryResult?.getNode as Folder;
	}

	function prepareCache(folder: Folder, sort = NODES_SORT_DEFAULT): void {
		global.apolloClient.writeQuery<GetChildrenQuery, GetChildrenQueryVariables>({
			query: GET_CHILDREN,
			variables: getChildrenVariables(folder.id, NODES_LOAD_LIMIT, sort),
			data: {
				getNode: {
					...folder,
					children: folder.children.slice(0, Math.min(NODES_LOAD_LIMIT, folder.children.length))
				}
			}
		});
	}

	describe('add a new node not present in a folder', () => {
		it('should add the element at first position if folder has no children', async () => {
			const folder = populateFolder();

			prepareCache(folder);

			const element = populateNode();
			const {
				updateFolderContent: { addNodeToFolder }
			} = setupHook();

			addNodeToFolder(folder, element);
			const queryResult = global.apolloClient.readQuery<
				GetChildrenQuery,
				GetChildrenQueryVariables
			>({
				query: GET_CHILDREN,
				variables: getChildrenVariables(folder.id, NODES_LOAD_LIMIT)
			});
			expect((queryResult?.getNode || null) as Maybe<Folder>).not.toBeNull();
			expect((queryResult?.getNode as Folder).children).toHaveLength(1);
			// created element has to be the first and only element
			expect((queryResult?.getNode as Folder).children[0]?.id).toBe(element.id);
		});

		it('should add the element at the end if its next neighbor is not loaded yet', async () => {
			// create a folder with 2 elements more than the cached ones ( = NODES_LOAD_LIMIT)
			// this way we can simulate the creation of a node with a sort position after the last loaded child
			// and with a neighbor not loaded yet
			const folder = populateFolder(NODES_LOAD_LIMIT + 2);
			// extract new elements not loaded in cache to use them as the new
			// notLoadedElements[0] is the element that will be created
			// notLoadedElements[1] is the next neighbor
			const notLoadedElements = folder.children.splice(NODES_LOAD_LIMIT, 2) as Node[];

			prepareCache(folder);

			const {
				updateFolderContent: { addNodeToFolder }
			} = setupHook();

			// call the hook
			addNodeToFolder(folder, notLoadedElements[0]);
			const { children } = readGetChildrenQuery(folder.id);

			expect(children).toHaveLength(NODES_LOAD_LIMIT + 1);
			// created element has to be at the end of the the list
			expect(children[children.length - 1]?.id).toBe(notLoadedElements[0].id);
		});

		it('should add the element before its neighbor if the neighbor is already loaded', async () => {
			// create a folder with all its children loaded in cache
			// this way we can simulate the creation of a node with a sort position before the last loaded child
			// and with a neighbor not loaded yet
			const folder = populateFolder();
			folder.children = populateNodes(NODES_LOAD_LIMIT + 1, 'File');
			const sort = NODES_SORT_DEFAULT;
			sortNodes(folder.children, sort);
			// extract the element that will be created from the children so that it will no be written in cache
			const elementIndex = Math.floor(NODES_LOAD_LIMIT / 2);
			const element = folder.children.splice(elementIndex, 1)[0] as Node;
			// the neighbor is at the index where we want to insert the new element
			const neighbor = folder.children[elementIndex] as Node;
			// so give to element a name that put it before neighbor
			element.name = neighbor.name.substring(0, neighbor.name.length - 1);

			prepareCache(folder, sort);

			const {
				updateFolderContent: { addNodeToFolder }
			} = setupHook();

			// call the hook saying that there are no more children to load
			addNodeToFolder(folder, element);
			const { children } = readGetChildrenQuery(folder.id, sort);

			expect(children).toHaveLength(NODES_LOAD_LIMIT + 1);
			// at elementIndex has to be the created element
			expect(children[elementIndex]?.id).toBe(element.id);
			// neighbor has to be at elementIndex + 1
			expect(children[elementIndex + 1]?.id).toBe(neighbor.id);
		});

		it('should add the element at the end if it has no next neighbor and all children are already loaded', async () => {
			// create a folder with all its children loaded in cache
			// this way we can simulate the creation of a node with a sort position after the last loaded child
			// and with no neighbor
			const folder = populateFolder(NODES_LOAD_LIMIT + 1);
			const sort = NODES_SORT_DEFAULT;
			sortNodes(folder.children, sort);
			// extract the element that will be created from the children so that it will no be written in cache
			// the element is the last one of the folder
			const elementIndex = folder.children.length - 1;
			const element = folder.children.splice(elementIndex, 1)[0] as Node;

			prepareCache(folder, sort);

			const {
				updateFolderContent: { addNodeToFolder }
			} = setupHook();

			// call the hook saying that there are no more children to load
			addNodeToFolder(folder, element);
			const { children } = readGetChildrenQuery(folder.id, sort);

			expect(children).toHaveLength(NODES_LOAD_LIMIT + 1);
			// last element has to be the created element
			expect(children[NODES_LOAD_LIMIT]?.id).toBe(element.id);
		});

		it('should add the element at the end if it has no next neighbor but not all children are loaded yet', async () => {
			// create a folder with some children not loaded in cache
			// this way we can simulate the creation of a node with a sort position after the last loaded child
			// but with no neighbor
			const folder = populateFolder(NODES_LOAD_LIMIT + 2);
			// extract the element that will be created from the children so that it will no be written in cache
			// the element is the last one of the folder
			const elementIndex = folder.children.length - 1;
			const element = folder.children.splice(elementIndex, 1)[0] as Node;
			// element at position NODES_LOAD_LIMIT will not be written in cache
			// and should not be present in the list after the update
			const notLoadedElement = folder.children[folder.children.length - 1] as Node;

			prepareCache(folder);

			const {
				updateFolderContent: { addNodeToFolder }
			} = setupHook();

			// call the hook saying that there are more children to load
			addNodeToFolder(folder, element);
			const { children } = readGetChildrenQuery(folder.id);

			expect(children).toHaveLength(NODES_LOAD_LIMIT + 1);
			// created element should be at last position in the list
			expect(children[children.length - 1]?.id).toBe(element.id);
			// the not loaded element should not be loaded
			expect(find(children, (item) => item?.id === notLoadedElement.id)).not.toBeDefined();
		});

		it('should add the element at the end if it has a neighbor that is unordered', async () => {
			// create a folder with some children not loaded in cache
			// this way we can simulate the creation of multiple node with a sort position after the last loaded child
			const folder = populateFolder(NODES_LOAD_LIMIT);
			const newNodes = populateNodes(2, 'File');

			prepareCache(folder);

			const {
				updateFolderContent: { addNodeToFolder }
			} = setupHook();

			// first create operation
			// give new files a name that will put them at the end of the list
			newNodes[0].name = `${folder.children[folder.children.length - 1]?.name} - n1`;
			newNodes[1].name = `${folder.children[folder.children.length - 1]?.name} - n2`;

			// call the hook saying that there are more children to load
			addNodeToFolder(folder, newNodes[0]);
			const { children } = readGetChildrenQuery(folder.id);

			expect(children).toHaveLength(folder.children.length + 1);
			// created element should be at last position in the list
			expect(children[children.length - 1]?.id).toBe(newNodes[0].id);

			// second create operation
			// call the hook saying that there are more children to load
			addNodeToFolder(folder, newNodes[1]);
			const { children: children2 } = readGetChildrenQuery(folder.id);

			expect(children2).toHaveLength(folder.children.length + 2);
			// new created element should be at last position in the list even if its neighbor is loaded
			expect(children2[children2.length - 1]?.id).toBe(newNodes[1].id);
			expect(children2[children2.length - 2]?.id).toBe(newNodes[0].id);
		});
	});

	describe('update an existing node already loaded in a folder', () => {
		it('should move the element up in the list with all children loaded', async () => {
			// create a folder with all children loaded in cache
			// this way we can simulate the update of a node with a sort position different than the original one
			const folder = populateFolder(NODES_LOAD_LIMIT);

			prepareCache(folder);

			// to move a node up take the last element and move it with a rename
			const element = folder.children[folder.children.length - 1] as Node;
			element.name = folder.children[0]?.name.substring(0, folder.children[0].name.length) || '000';
			let newPos = addNodeInSortedList(folder.children, element, NODES_SORT_DEFAULT);
			newPos = newPos > -1 ? newPos : folder.children.length;

			const {
				updateFolderContent: { addNodeToFolder }
			} = setupHook();

			// call the hook
			addNodeToFolder(folder, element);
			const { children } = readGetChildrenQuery(folder.id);

			// number of elements has not to be changed after the update
			expect(children).toHaveLength(NODES_LOAD_LIMIT);
			// updated element should be the first element of the list
			expect(children[newPos]?.id).toBe(element.id);
			// last element of returned list should the second-last of the original list
			const secondLastElement = folder.children[folder.children.length - 2] as Node;
			expect(children[children.length - 1]?.id).toBe(secondLastElement.id);
		});

		it('should move the element down in the list with all children loaded', () => {
			// create a folder with all children loaded in cache
			// this way we can simulate the update of a node with a sort position different than the original one
			const folder = populateFolder(NODES_LOAD_LIMIT);

			prepareCache(folder);

			const element = folder.children[0] as Node;

			element.name = `${folder.children[folder.children.length - 1]?.name}-last`;

			let newPos = addNodeInSortedList(folder.children, element, NODES_SORT_DEFAULT);
			newPos = newPos > -1 ? newPos : folder.children.length;
			const {
				updateFolderContent: { addNodeToFolder }
			} = setupHook();

			// call the hook saying that there are no more children to load
			addNodeToFolder(folder, element);
			const { children } = readGetChildrenQuery(folder.id);

			// number of elements has not to be changed after the update
			expect(children).toHaveLength(NODES_LOAD_LIMIT);
			// updated element should be the last element of the list
			expect(children[newPos - 1]?.id).toBe(element.id);
			// first element of returned list should the second of the original list
			const secondElement = folder.children[1] as Node;
			expect(children[0]?.id).toBe(secondElement.id);
		});

		it('should remove the reference from the partial list if the node is moved from unordered to ordered and viceversa', async () => {
			const folder = populateFolder(NODES_LOAD_LIMIT + 3);
			const sort = NODES_SORT_DEFAULT;
			// extract the element that will be created from the children so that it will no be written in cache
			// the element is the last one of the folder
			const elementIndex = folder.children.length - 2;
			const element = folder.children.splice(elementIndex, 1)[0] as Node;
			// element at position NODES_LOAD_LIMIT will not be written in cache
			// and should not be present in the list after the update
			const notLoadedElement = folder.children[folder.children.length - 1] as Node;

			prepareCache(folder);

			let newPos = addNodeInSortedList(folder.children.slice(0, NODES_LOAD_LIMIT), element, sort);
			newPos = newPos > -1 ? newPos : NODES_LOAD_LIMIT;

			const {
				updateFolderContent: { addNodeToFolder }
			} = setupHook();

			// call the hook saying that there are more children to load
			addNodeToFolder(folder, element);
			const { children } = readGetChildrenQuery(folder.id, sort);

			expect(children).toHaveLength(NODES_LOAD_LIMIT + 1);
			// created element should be at last position in the list
			expect(children[newPos]?.id).toBe(element.id);
			// the not loaded element should not be loaded
			expect(find(children, (item) => item?.id === notLoadedElement.id)).not.toBeDefined();

			// rename element to put it as first
			element.name = (children[0] as Node).name.substring(0, (children[0] as Node).name.length - 1);

			newPos = addNodeInSortedList(children, element, sort);

			addNodeToFolder({ ...folder, children }, element);

			const { children: children2 } = readGetChildrenQuery(folder.id, sort);
			expect(children2).toHaveLength(NODES_LOAD_LIMIT + 1);
			// created element should be at first position in the list
			expect(children2[newPos]?.id).toBe(element.id);

			// rename again to move it as last element
			element.name = `${(children2[children2.length - 1] as Node).name}-last`;
			newPos = addNodeInSortedList(children2, element, sort);
			newPos = newPos > -1 ? newPos : children2.length;
			// call the hook saying that there are more children to load
			addNodeToFolder({ ...folder, children: children2 }, element);
			const { children: children3 } = readGetChildrenQuery(folder.id, sort);

			expect(children3).toHaveLength(NODES_LOAD_LIMIT + 1);
			// created element should be at last position in the list (new pos - 1 because it is removed from the top)
			expect(children3[newPos - 1]?.id).toBe(element.id);
		});

		it('should update the list with some unordered items correctly when an already existing unordered item was updated', async () => {
			const folder = populateFolder(NODES_LOAD_LIMIT + 2);
			const sort = NODES_SORT_DEFAULT;
			// extract the last 2 elements that will be added after
			const last = folder.children.splice(folder.children.length - 1, 1)[0] as Node;
			const secondLastNode = folder.children.splice(folder.children.length - 1, 1)[0] as Node;
			// we need to be sure that it is a file
			const secondLast = populateFile(secondLastNode.id, secondLastNode.name);

			prepareCache(folder);

			let newPos = addNodeInSortedList(folder.children, secondLast, sort);
			expect(newPos).toBe(-1);

			const {
				updateFolderContent: { addNodeToFolder }
			} = setupHook();

			// add the secondLast item to the folder, it is out from ordered items, so it will be put in the unordered items
			addNodeToFolder(folder, secondLast);
			const { children } = readGetChildrenQuery(folder.id, sort);

			expect(children).toHaveLength(NODES_LOAD_LIMIT + 1);
			// created element should be at last position in the list
			expect(children[children.length - 1]?.id).toBe(secondLast.id);

			newPos = addNodeInSortedList(children, last, sort);
			expect(newPos).toBe(-1);

			// add the last item to the folder, it is out from ordered items, so it will be put in the unordered items
			addNodeToFolder({ ...folder, children }, last);

			const { children: children2 } = readGetChildrenQuery(folder.id, sort);
			expect(children2).toHaveLength(NODES_LOAD_LIMIT + 2);
			// created element should be at last position in the list
			expect(children2[children2.length - 1]?.id).toBe(last.id);

			// simulate upload version of already existing file
			secondLast.size += 10000;

			// addNodeInSortedList function return the idx + 1 of the already inserted item
			newPos = addNodeInSortedList(children2, secondLast, sort);
			expect(newPos).toBe(children2.length - 1);

			addNodeToFolder({ ...folder, children: children2 }, secondLast);

			const { children: children3 } = readGetChildrenQuery(folder.id, sort);
			// updated element should not increment the size
			expect(children3).toHaveLength(NODES_LOAD_LIMIT + 2);
			// secondLast element should remain the second last element if current sorting criteria is not afflicted
			expect(children3[children3.length - 2]?.id).toBe(secondLast.id);
		});
	});
});
