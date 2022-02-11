/*
 * SPDX-FileCopyrightText: 2022 Zextras <https://www.zextras.com>
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { GraphQLContext, GraphQLRequest, ResponseResolver } from 'msw';

import buildClient from '../apollo';
import CHILD from '../graphql/fragments/child.graphql';
import { UpdateNodeMutation, UpdateNodeMutationVariables } from '../types/graphql/types';

const handleUpdateNodeRequest: ResponseResolver<
	GraphQLRequest<UpdateNodeMutationVariables>,
	GraphQLContext<UpdateNodeMutation>,
	UpdateNodeMutation
> = (req, res, ctx) => {
	const { id, name, description } = req.variables;

	const apolloClient = buildClient();

	// try to read the node as a file
	let result = apolloClient.readFragment({
		fragmentName: 'Child',
		fragment: CHILD,
		id: `File:${id}`
	});

	if (!result) {
		// if result is null, try to read the node as a folder
		result = apolloClient.readFragment({
			fragmentName: 'Child',
			fragment: CHILD,
			id: `Folder:${id}`
		});
	}

	return res(
		ctx.data({
			updateNode: {
				...result,
				name: name || result.name,
				description
			}
		})
	);
};

export default handleUpdateNodeRequest;
