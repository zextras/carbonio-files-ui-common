/*
 * SPDX-FileCopyrightText: 2022 Zextras <https://www.zextras.com>
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { populateFile, populateFolder, populateLocalRoot, populateNodes } from '../mocks/mockUtils';
import { NodeSort } from '../types/graphql/types';
import { addNodeInSortedList, buildCrumbs } from './utils';

describe('Crumbs builder', () => {
	it('should return a flat array with 3 objects ordered from root to leaf', () => {
		const lvl0 = populateLocalRoot(0);
		const lvl1 = populateFolder();
		const lvl2 = populateFolder();
		lvl2.parent = lvl1;
		lvl1.parent = lvl0;

		const resultWithNode = buildCrumbs(lvl2);
		const resultWithArray = buildCrumbs([lvl0, lvl1, lvl2]);

		const expected = [
			{
				id: lvl0.id,
				label: lvl0.name
			},
			{
				id: lvl1.id,
				label: lvl1.name
			},
			{
				id: lvl2.id,
				label: lvl2.name
			}
		];

		expect(resultWithNode).toMatchObject(expected);
		expect(resultWithArray).toMatchObject(expected);
	});
});

describe('Sort algorithm', () => {
	it('should put folder before files', () => {
		const files = populateNodes(3, 'File');
		const folder = populateFolder(0, undefined, `${files[2].name}-last folder`);
		let position = addNodeInSortedList(files, folder, NodeSort.NameAsc);
		expect(position).toBe(0);
		position = addNodeInSortedList(files, folder, NodeSort.NameDesc);
		expect(position).toBe(0);
		position = addNodeInSortedList(files, folder, NodeSort.UpdatedAtAsc);
		expect(position).toBe(0);
		position = addNodeInSortedList(files, folder, NodeSort.UpdatedAtDesc);
		expect(position).toBe(0);
	});
	it('should put folder after files if sorting for size desc, before them if sorting for size asc', () => {
		const files = populateNodes(3, 'File');
		const folder = populateFolder(0, undefined, `${files[0].name}-last folder`);
		let position = addNodeInSortedList(files, folder, NodeSort.SizeDesc);
		expect(position).toBe(-1);
		position = addNodeInSortedList(files, folder, NodeSort.SizeAsc);
		expect(position).toBe(0);
	});

	it('should put file after folders', () => {
		const folders = populateNodes(3, 'Folder');
		const file = populateFile(undefined, folders[0].name.substring(0, folders[0].name.length - 1));
		let position = addNodeInSortedList(folders, file, NodeSort.NameAsc);
		expect(position).toBe(-1);
		position = addNodeInSortedList(folders, file, NodeSort.NameDesc);
		expect(position).toBe(-1);
		position = addNodeInSortedList(folders, file, NodeSort.UpdatedAtAsc);
		expect(position).toBe(-1);
		position = addNodeInSortedList(folders, file, NodeSort.UpdatedAtDesc);
		expect(position).toBe(-1);
	});
	it('should put files before folders if sorting for size desc, after them if sorting for size asc', () => {
		const folders = populateNodes(3, 'Folder');
		const file = populateFile(undefined, `${folders[2].name}-last file`);
		let position = addNodeInSortedList(folders, file, NodeSort.SizeDesc);
		expect(position).toBe(0);
		position = addNodeInSortedList(folders, file, NodeSort.SizeAsc);
		expect(position).toBe(-1);
	});
	it('should put node in its ordered position between same type of nodes (asc order)', () => {
		const nodes = [
			populateFolder(0, undefined, 'folder1'),
			populateFolder(0, undefined, 'folder3'),
			populateFolder(0, undefined, 'folder4'),
			populateFolder(0, undefined, 'folder5'),
			populateFile(undefined, 'file1'),
			populateFile(undefined, 'file2'),
			populateFile(undefined, 'file4'),
			populateFile(undefined, 'file5')
		];
		const folderToAdd = populateFolder(0, undefined, 'folder2');
		const fileToAdd = populateFile(undefined, 'file3');

		const folderPos = addNodeInSortedList(nodes, folderToAdd, NodeSort.NameAsc);
		expect(folderPos).toBe(1);
		const filePos = addNodeInSortedList(nodes, fileToAdd, NodeSort.NameAsc);
		expect(filePos).toBe(6);
	});
	it('should put node in its ordered position between same type of nodes (desc order)', () => {
		const nodes = [
			populateFolder(0, undefined, 'folder5'),
			populateFolder(0, undefined, 'folder4'),
			populateFolder(0, undefined, 'folder3'),
			populateFolder(0, undefined, 'folder1'),
			populateFile(undefined, 'file5'),
			populateFile(undefined, 'file4'),
			populateFile(undefined, 'file2'),
			populateFile(undefined, 'file1')
		];
		const folderToAdd = populateFolder(0, undefined, 'folder2');
		const fileToAdd = populateFile(undefined, 'file3');

		const folderPos = addNodeInSortedList(nodes, folderToAdd, NodeSort.NameDesc);
		expect(folderPos).toBe(3);
		const filePos = addNodeInSortedList(nodes, fileToAdd, NodeSort.NameDesc);
		expect(filePos).toBe(6);
	});
	it('should compare names with case insensitive', () => {
		const nodes = [
			populateFolder(0, undefined, 'folder5'),
			populateFolder(0, undefined, 'folder4'),
			populateFolder(0, undefined, 'folder3'),
			populateFolder(0, undefined, 'folder1'),
			populateFile(undefined, 'file5'),
			populateFile(undefined, 'file4'),
			populateFile(undefined, 'file2'),
			populateFile(undefined, 'file1')
		];
		const folderToAdd = populateFolder(0, undefined, 'FOLDER2');
		const fileToAdd = populateFile(undefined, 'FILE3');

		const folderPos = addNodeInSortedList(nodes, folderToAdd, NodeSort.NameDesc);
		expect(folderPos).toBe(3);
		const filePos = addNodeInSortedList(nodes, fileToAdd, NodeSort.NameDesc);
		expect(filePos).toBe(6);
	});
});

describe('CssCalc builder', () => {
	test.todo('if only first value is provided, returns the single value');
});
