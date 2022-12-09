import { TypePolicy } from '@apollo/client';
import { findNodesFieldPolicy } from './fieldPolicies/findNodes';
import { getVersionsFieldPolicy } from './fieldPolicies/getVersions';
import { getNodeFieldPolicy } from './fieldPolicies/getNode';
import { getUploadItemsFieldPolicy } from './fieldPolicies/getUploadItems';
import { getUploadItemFieldPolicy } from './fieldPolicies/getUploadItem';

export const queryTypePolicies: TypePolicy = {
	fields: {
		findNodes: findNodesFieldPolicy,
		getVersions: getVersionsFieldPolicy,
		getNode: getNodeFieldPolicy,
		getUploadItems: getUploadItemsFieldPolicy,
		getUploadItem: getUploadItemFieldPolicy
	}
};
