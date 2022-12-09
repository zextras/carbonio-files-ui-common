import { TypePolicies } from '@apollo/client';

import { nodeTypePolicies } from './Node';
import { folderTypePolicies } from './Folder';
import { queryTypePolicies } from './Query';

export const typePolicies: TypePolicies = {
	Node: nodeTypePolicies,
	Folder: folderTypePolicies,
	Query: queryTypePolicies
};
