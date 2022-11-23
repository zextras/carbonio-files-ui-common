/*
 * SPDX-FileCopyrightText: 2022 Zextras <https://www.zextras.com>
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */
import React, { useEffect, useMemo, useState } from 'react';

import { CollapsingActions, Container } from '@zextras/carbonio-design-system';
import { flatten } from 'lodash';
import map from 'lodash/map';
import { useTranslation } from 'react-i18next';

import { useActiveNode } from '../../../hooks/useActiveNode';
import { useGetBaseNodeQuery } from '../../hooks/graphql/queries/useGetBaseNodeQuery';
import { useUploadActions } from '../../hooks/useUploadActions';
import { UploadStatus, UploadType } from '../../types/common';
import { NodeType } from '../../types/graphql/types';
import { MakeOptional } from '../../types/utils';
import { getUploadNodeType, humanFileSize } from '../../utils/utils';
import { DisplayerHeader } from './DisplayerHeader';
import { NodeContent } from './NodeContent';
import { PathRow, PathRowProps } from './PathRow';
import { DisplayerContentContainer } from './StyledComponents';
import { TextRowWithShim } from './TextRowWithShim';
import { UploadNodeDetailsListItem } from './UploadNodeDetailsListItem';

function getDirectoryContent(
	fsDirectoryEntry: FileSystemDirectoryEntry
): Promise<FileSystemEntry[]> {
	const promises: Promise<FileSystemEntry[]>[] = [];
	const directoryReader = fsDirectoryEntry.createReader();
	const promise = new Promise((resolve) => {
		directoryReader.readEntries((entries) => {
			if (entries) {
				for (let i = 0; i < entries.length; i += 1) {
					const entry = entries[i];
					if (entry.isDirectory && entry instanceof FileSystemDirectoryEntry) {
						promises.push(getDirectoryContent(entry));
					}
				}
			}
			promises.push(Promise.resolve(entries));
			resolve(entries);
		});
	});
	return promise.then(() =>
		Promise.all(flatten(promises)).then((resultArray) => flatten(resultArray))
	);
}

function getFilePromise(entry: FileSystemEntry): Promise<File> {
	return new Promise<File>((resolve, reject) => {
		if (entry.isFile && entry instanceof FileSystemFileEntry) {
			entry.file((entryFile) => {
				resolve(entryFile);
			});
		} else if (entry.isDirectory && entry instanceof FileSystemDirectoryEntry) {
			resolve(new File([], entry.name));
		} else {
			reject(new Error('cannot detect type for this FileSystemEntry'));
		}
	});
}

type UploadDisplayerType = MakeOptional<UploadType, 'parentId'>;

interface UploadDisplayerNodeProps {
	node: NonNullable<UploadDisplayerType>;
}

export const UploadDisplayerNode = ({ node }: UploadDisplayerNodeProps): JSX.Element => {
	const [t] = useTranslation();
	const { removeActiveNode } = useActiveNode();
	const [content, setContent] = useState<UploadDisplayerType[] | null>(null);

	const actions = useUploadActions([node]);

	useEffect(() => {
		if (
			node.fileSystemEntry &&
			node.fileSystemEntry.isDirectory &&
			!node.fileSystemEntry.isFile &&
			node.fileSystemEntry instanceof FileSystemDirectoryEntry
		) {
			getDirectoryContent(node.fileSystemEntry)
				.then((flattenContent) => {
					const uploadListPromises: Promise<UploadDisplayerType>[] = [];
					for (let i = 0; i < flattenContent.length; i += 1) {
						const entry = flattenContent[i];
						uploadListPromises.push(
							getFilePromise(entry).then((file) => ({
								id: `${node.id}-${i}-${Date.now()}`,
								nodeId: undefined,
								file,
								fileSystemEntry: entry,
								status: UploadStatus.LOADING,
								parentId: undefined,
								percentage: 0
							}))
						);
					}
					return Promise.all(uploadListPromises);
				})
				.then((uploadItemList) => {
					setContent(uploadItemList);
				});
		} else {
			setContent(null);
		}
	}, [node.fileSystemEntry, node.id]);

	const contentItems = useMemo(
		() => map(content, (uploadItem) => <UploadNodeDetailsListItem node={uploadItem} />),
		[content]
	);

	const { data: parentData, loading: loadingParent } = useGetBaseNodeQuery(node.parentId);

	const parentNode = useMemo<PathRowProps>(() => {
		if (!loadingParent) {
			if (parentData?.getNode) {
				return parentData.getNode;
			}
			const path = node.fileSystemEntry?.fullPath.split('/') || [];
			if (path.length > 0) {
				if (path.length > 1) {
					return {
						name: path[path.length - 2],
						type: NodeType.Folder,
						rootId: undefined,
						id: node.parentId || `${node.id}-parent-${Date.now().toLocaleString()}`
					};
				}
				return {
					name: path[path.length - 1],
					type: NodeType.Other,
					rootId: undefined,
					id: node.id
				};
			}
		}
		return {
			name: '',
			type: NodeType.Other,
			rootId: undefined,
			id: ''
		};
	}, [loadingParent, node.fileSystemEntry?.fullPath, node.id, node.parentId, parentData?.getNode]);

	return (
		<>
			<DisplayerHeader
				name={node.file.name}
				type={getUploadNodeType(node)}
				closeAction={removeActiveNode}
				mimeType={node.file.type}
			/>
			<Container
				orientation="horizontal"
				mainAlignment="flex-end"
				crossAlignment="center"
				height="auto"
				padding={{ horizontal: 'large', vertical: 'small' }}
				data-testid="displayer-actions-header"
			>
				<CollapsingActions actions={actions} />
			</Container>
			<DisplayerContentContainer
				height={'fill'}
				background={'gray5'}
				padding={{ horizontal: 'large' }}
				mainAlignment={'flex-start'}
				data-testid="displayer-content"
			>
				<Container
					mainAlignment={'flex-start'}
					background={'gray5'}
					height={'auto'}
					data-testid="node-details"
					gap="0.75rem"
				>
					<DisplayerContentContainer
						mainAlignment={'flex-start'}
						crossAlignment={'flex-start'}
						height={'fit'}
						padding={{ all: 'large' }}
						background={'gray6'}
					>
						{node.file.type && (
							<TextRowWithShim
								loading={false}
								label={t('displayer.details.size', 'Size')}
								content={humanFileSize(node.file.size ?? 0)}
								shimmerWidth="5rem"
							/>
						)}
						<PathRow
							id={parentNode.id}
							name={parentNode.name}
							type={parentNode.type}
							rootId={parentNode.rootId}
						/>
					</DisplayerContentContainer>
					{content !== null && (
						<NodeContent id={node.id} loading={false} hasMore={false}>
							{contentItems}
						</NodeContent>
					)}
				</Container>
			</DisplayerContentContainer>
		</>
	);
};
