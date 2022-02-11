/*
 * SPDX-FileCopyrightText: 2022 Zextras <https://www.zextras.com>
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import * as faker from 'faker';
import forEach from 'lodash/forEach';
import { GraphQLContext, GraphQLRequest, ResponseResolver } from 'msw';

import buildClient from '../apollo';
import CHILD from '../graphql/fragments/child.graphql';
import { Node, CopyNodesMutation, CopyNodesMutationVariables } from '../types/graphql/types';

const handleCopyNodesRequest: ResponseResolver<
	GraphQLRequest<CopyNodesMutationVariables>,
	GraphQLContext<CopyNodesMutation>,
	CopyNodesMutation
> = (req, res, ctx) => {
	// eslint-disable-next-line camelcase
	const { nodes_ids, destination_id } = req.variables;

	const apolloClient = buildClient();

	const nodes: Node[] = [];

	forEach(nodes_ids, (nodeId) => {
		// try to read the node as a file
		let node = apolloClient.readFragment({
			fragmentName: 'Child',
			fragment: CHILD,
			id: `File:${nodeId}`
		});

		if (!node) {
			// if result is null, try to read the node as a folder
			node = apolloClient.readFragment({
				fragmentName: 'Child',
				fragment: CHILD,
				id: `Folder:${nodeId}`
			});
		}

		const newNode = {
			...node,
			id: faker.datatype.uuid(),
			name: `${node.name} - Copy`,
			parent: { __typename: 'Folder', id: destination_id, name: 'parent folder' }
		};

		nodes.push(newNode);
	});

	return res(
		ctx.data({
			copyNodes: nodes
		})
	);
};

export default handleCopyNodesRequest;
