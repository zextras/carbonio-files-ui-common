/*
 * SPDX-FileCopyrightText: 2022 Zextras <https://www.zextras.com>
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import map from 'lodash/map';
import { GraphQLContext, GraphQLRequest, ResponseResolver } from 'msw';

import { ROOTS } from '../constants';
import { RestoreNodesMutation, RestoreNodesMutationVariables } from '../types/graphql/types';

const handleRestoreNodesRequest: ResponseResolver<
	GraphQLRequest<RestoreNodesMutationVariables>,
	GraphQLContext<RestoreNodesMutation>,
	RestoreNodesMutation
> = (req, res, ctx) => {
	const { node_ids: nodes } = req.variables;

	let result = null;
	if (nodes) {
		if (nodes instanceof Array) {
			result = map(nodes, (node) => ({
				id: node,
				parent: {
					id: ROOTS.LOCAL_ROOT
				},
				rootId: ROOTS.LOCAL_ROOT
			}));
		} else {
			result = [
				{
					id: nodes,
					parent: {
						id: ROOTS.LOCAL_ROOT
					},
					rootId: ROOTS.LOCAL_ROOT
				}
			];
		}
	}

	return res(
		ctx.data({
			restoreNodes: result
		})
	);
};

export default handleRestoreNodesRequest;
