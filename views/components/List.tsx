/*
 * SPDX-FileCopyrightText: 2022 Zextras <https://www.zextras.com>
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import React, { useCallback, useContext, useEffect, useMemo } from 'react';

import { Container } from '@zextras/carbonio-design-system';
import difference from 'lodash/difference';
import filter from 'lodash/filter';
import find from 'lodash/find';
import includes from 'lodash/includes';
import partition from 'lodash/partition';
import size from 'lodash/size';
import union from 'lodash/union';
import { useTranslation } from 'react-i18next';
import { useLocation, useParams } from 'react-router-dom';
import styled from 'styled-components';

import ListHeader from '../../../components/ListHeader';
import { ACTIONS_TO_REMOVE_DUE_TO_PRODUCT_CONTEXT } from '../../../constants';
import { useActiveNode } from '../../../hooks/useActiveNode';
import { useNavigation } from '../../../hooks/useNavigation';
import { useSendViaMail } from '../../../hooks/useSendViaMail';
import useUserInfo from '../../../hooks/useUserInfo';
import { DRAG_TYPES, ROOTS } from '../../constants';
import { ListContext, NodeAvatarIconContext } from '../../contexts';
import {
	DeleteNodesType,
	useDeleteNodesMutation
} from '../../hooks/graphql/mutations/useDeleteNodesMutation';
import {
	FlagNodesType,
	useFlagNodesMutation
} from '../../hooks/graphql/mutations/useFlagNodesMutation';
import {
	RestoreType,
	useRestoreNodesMutation
} from '../../hooks/graphql/mutations/useRestoreNodesMutation';
import {
	TrashNodesType,
	useTrashNodesMutation
} from '../../hooks/graphql/mutations/useTrashNodesMutation';
import {
	UpdateNodeType,
	useUpdateNodeMutation
} from '../../hooks/graphql/mutations/useUpdateNodeMutation';
import { OpenCopyModal, useCopyModal } from '../../hooks/modals/useCopyModal';
import { useDeletePermanentlyModal } from '../../hooks/modals/useDeletePermanentlyModal';
import { OpenMoveModal, useMoveModal } from '../../hooks/modals/useMoveModal';
import { OpenRenameModal, useRenameModal } from '../../hooks/modals/useRenameModal';
import { useCreateSnackbar } from '../../hooks/useCreateSnackbar';
import useSelection from '../../hooks/useSelection';
import { useUpload } from '../../hooks/useUpload';
import { Crumb, NodeListItemType, URLParams } from '../../types/common';
import {
	Action,
	ActionItem,
	ActionsFactoryChecker,
	ActionsFactoryCheckerMap,
	buildActionItems,
	getPermittedSelectionModePrimaryActions,
	getPermittedSelectionModeSecondaryActions,
	trashedNodeActions
} from '../../utils/ActionsFactory';
import { downloadNode, isTrashedVisible, isTrashView, openNodeWithDocs } from '../../utils/utils';
import { Dropzone } from './Dropzone';
import { EmptyFolder } from './EmptyFolder';
import { ListContent } from './ListContent';
import { SortingComponent } from './SortingComponent';

const MainContainer = styled(Container)`
	border-left: 1px solid ${(props): string => props.theme.palette.gray6.regular};
`;

interface ListProps {
	nodes: NodeListItemType[];
	loading?: boolean;
	hasMore?: boolean;
	loadMore?: () => void;
	folderId?: string;
	crumbs?: Crumb[];
	mainList: boolean;
	emptyListMessage: string;
	canUpload?: boolean;
	fillerWithActions?: JSX.Element;
}

export const List: React.VFC<ListProps> = ({
	nodes,
	loading,
	hasMore,
	loadMore,
	folderId,
	crumbs,
	mainList = false,
	emptyListMessage,
	canUpload = true,
	fillerWithActions
}) => {
	const { navigateToFolder } = useNavigation();
	const { activeNodeId: activeNode, setActiveNode } = useActiveNode();
	const [t] = useTranslation();

	const { setIsEmpty } = useContext(ListContext);

	useEffect(() => {
		// assuming that using the product means there are some contents and most of the lists
		// have at least one node inside, consider loading as "has nodes" to reduce
		// the effects related to list empty - loading - not empty state changes
		setIsEmpty(!loading && nodes.length === 0);
	}, [loading, nodes.length, setIsEmpty]);

	const {
		selectedIDs,
		selectedMap,
		selectId,
		isSelectionModeActive,
		unSelectAll,
		selectAll,
		exitSelectionMode
	} = useSelection(nodes);

	const { openMoveNodesModal } = useMoveModal(exitSelectionMode);

	const { openCopyNodesModal } = useCopyModal(exitSelectionMode);

	const selectedNodes = useMemo(
		() => filter(nodes, (node) => includes(selectedIDs, node.id)),
		[nodes, selectedIDs]
	);

	const params = useParams<URLParams>();
	const location = useLocation();
	const isATrashFilter = useMemo(() => isTrashView(params), [params]);
	const includeTrashed = useMemo(() => isTrashedVisible(params, location), [params, location]);

	const actionsToRemoveIfInsideTrash = useMemo(() => {
		if (isATrashFilter) {
			return difference(Object.values(Action), trashedNodeActions);
		}
		return [];
	}, [isATrashFilter]);

	const actionsToRemove = useMemo(() => {
		const selectedSize = size(selectedNodes);
		if (selectedSize > 0) {
			const [deleted, notDeleted] = partition(selectedNodes, { rootId: ROOTS.TRASH });
			if (selectedSize === size(deleted)) {
				return [Action.MarkForDeletion];
			}
			if (selectedSize === size(notDeleted)) {
				return trashedNodeActions;
			}
			return [...trashedNodeActions, Action.MarkForDeletion];
		}
		return !includeTrashed ? trashedNodeActions : [];
	}, [includeTrashed, selectedNodes]);

	const { me } = useUserInfo();

	const moveCheckFunction = useCallback<ActionsFactoryChecker>(
		(nodesToMove) => {
			// move for multiple selection is permitted only inside folders because of the workspace concept,
			// which limits the tree where the user can move a node into, considering shares and permissions
			const selectedSize = size(nodesToMove);
			return !!folderId || selectedSize === 1;
		},
		[folderId]
	);

	const actionCheckers = useMemo<ActionsFactoryCheckerMap>(
		() => ({ [Action.Move]: moveCheckFunction }),
		[moveCheckFunction]
	);

	const [permittedSelectionModePrimaryActions, permittedSelectionModeSecondaryActions] = useMemo(
		() => [
			getPermittedSelectionModePrimaryActions(
				selectedNodes,
				union(actionsToRemove, actionsToRemoveIfInsideTrash)
			),
			// TODO: REMOVE CHECK ON ROOT WHEN BE WILL NOT RETURN LOCAL_ROOT AS PARENT FOR SHARED NODES
			getPermittedSelectionModeSecondaryActions(
				selectedNodes,
				union(
					actionsToRemove,
					actionsToRemoveIfInsideTrash,
					ACTIONS_TO_REMOVE_DUE_TO_PRODUCT_CONTEXT
				),
				me,
				actionCheckers
			)
		],
		[actionsToRemove, actionsToRemoveIfInsideTrash, actionCheckers, me, selectedNodes]
	);

	const setActiveNodeHandler = useCallback<
		(node: Pick<NodeListItemType, 'id'>, event?: React.SyntheticEvent) => void
	>(
		(node, event) => {
			if (!event?.defaultPrevented) {
				setActiveNode(node.id);
			}
		},
		[setActiveNode]
	);

	/** Mutation to update the flag status */
	const toggleFlag = useFlagNodesMutation();

	/**
	 * Set flagValue for selected nodes.
	 * @param {boolean} flagValue - value to set
	 */
	const toggleFlagSelection = useCallback<FlagNodesType>(
		(flagValue) =>
			toggleFlag(flagValue, ...selectedNodes).then((result) => {
				exitSelectionMode();
				return result;
			}),
		[toggleFlag, selectedNodes, exitSelectionMode]
	);

	/** Mutation to mark nodes for deletion */
	const markNodesForDeletion = useTrashNodesMutation();

	/** Mutation to restore nodes */
	const restore = useRestoreNodesMutation();

	/** Mutation to delete permanently nodes */
	const deletePermanently = useDeleteNodesMutation();

	const markForDeletionSelection = useCallback<() => ReturnType<TrashNodesType>>(
		() =>
			markNodesForDeletion(...selectedNodes).then((result) => {
				exitSelectionMode();
				return result;
			}),
		[markNodesForDeletion, selectedNodes, exitSelectionMode]
	);

	const restoreSelection = useCallback<() => ReturnType<RestoreType>>(
		() =>
			restore(...selectedNodes).then((result) => {
				exitSelectionMode();
				return result;
			}),
		[restore, selectedNodes, exitSelectionMode]
	);

	const deletePermanentlySelection = useCallback<DeleteNodesType>(
		() => deletePermanently(...selectedNodes),
		[deletePermanently, selectedNodes]
	);

	const openMoveNodesModalAction = useCallback<
		(...nodesToMove: Parameters<OpenMoveModal>[0]) => ReturnType<OpenMoveModal>
	>((...nodesToMove) => openMoveNodesModal(nodesToMove, folderId), [folderId, openMoveNodesModal]);

	const openMoveNodesModalSelection = useCallback<() => ReturnType<OpenMoveModal>>(
		() => openMoveNodesModalAction(...selectedNodes),
		[openMoveNodesModalAction, selectedNodes]
	);

	const openCopyNodesModalAction = useCallback<
		(...nodesToCopy: Parameters<OpenCopyModal>[0]) => ReturnType<OpenCopyModal>
	>((...nodesToCopy) => openCopyNodesModal(nodesToCopy, folderId), [folderId, openCopyNodesModal]);

	const openCopyNodesModalSelection = useCallback<() => ReturnType<OpenCopyModal>>(
		() => openCopyNodesModalAction(...selectedNodes),
		[openCopyNodesModalAction, selectedNodes]
	);

	const [updateNode] = useUpdateNodeMutation();

	const renameNodeAction = useCallback<UpdateNodeType>(
		(nodeId, newName) =>
			updateNode(nodeId, newName).then((result) => {
				if (result.data?.updateNode) {
					setActiveNodeHandler(result.data.updateNode);
				}
				return result;
			}),
		[setActiveNodeHandler, updateNode]
	);

	const { openRenameModal } = useRenameModal(renameNodeAction, exitSelectionMode);

	const openRenameModalAction = useCallback<OpenRenameModal>(
		(node) => openRenameModal(node),
		[openRenameModal]
	);

	const openRenameModalSelection = useCallback<() => ReturnType<OpenRenameModal>>(
		() => openRenameModalAction(selectedNodes[0]),
		[openRenameModalAction, selectedNodes]
	);

	const { openDeletePermanentlyModal } = useDeletePermanentlyModal(
		deletePermanentlySelection,
		exitSelectionMode
	);

	const createSnackbar = useCreateSnackbar();

	const downloadSelection = useCallback(() => {
		const nodeToDownload = find(nodes, (node) => node.id === selectedIDs[0]);
		if (nodeToDownload) {
			// download node without version to be sure last version is downloaded
			downloadNode(nodeToDownload.id);
			exitSelectionMode();
			createSnackbar({
				key: new Date().toLocaleString(),
				type: 'info',
				label: t('snackbar.download.start', 'Your download will start soon'),
				replace: true,
				hideButton: true
			});
		}
	}, [createSnackbar, nodes, selectedIDs, t, exitSelectionMode]);

	const { sendViaMail } = useSendViaMail();

	const sendViaMailCallback = useCallback(() => {
		exitSelectionMode();
		const nodeToDownload = find(nodes, (node) => node.id === selectedIDs[0]);
		if (nodeToDownload) {
			sendViaMail(nodeToDownload.id);
		}
	}, [exitSelectionMode, nodes, selectedIDs, sendViaMail]);

	const openWithDocsSelection = useCallback(() => {
		const nodeToOpen = find(nodes, (node) => node.id === selectedIDs[0]);
		if (nodeToOpen) {
			openNodeWithDocs(nodeToOpen.id);
			exitSelectionMode();
		}
	}, [nodes, selectedIDs, exitSelectionMode]);

	const itemsMap = useMemo<Partial<Record<Action, ActionItem>>>(
		() => ({
			[Action.OpenWithDocs]: {
				id: 'OpenWithDocs',
				icon: 'BookOpenOutline',
				label: t('actions.openWithDocs', 'Open document'),
				click: openWithDocsSelection
			},
			[Action.MarkForDeletion]: {
				id: 'MarkForDeletion',
				icon: 'Trash2Outline',
				label: t('actions.moveToTrash', 'Move to Trash'),
				click: markForDeletionSelection
			},
			[Action.Rename]: {
				id: 'Rename',
				icon: 'EditOutline',
				label: t('actions.rename', 'Rename'),
				click: openRenameModalSelection
			},
			[Action.Copy]: {
				id: 'Copy',
				icon: 'Copy',
				label: t('actions.copy', 'Copy'),
				click: openCopyNodesModalSelection
			},
			[Action.Move]: {
				id: 'Move',
				icon: 'MoveOutline',
				label: t('actions.move', 'Move'),
				click: openMoveNodesModalSelection
			},
			[Action.Flag]: {
				id: 'Flag',
				icon: 'FlagOutline',
				label: t('actions.flag', 'Flag'),
				click: (): void => {
					toggleFlagSelection(true);
				}
			},
			[Action.UnFlag]: {
				id: 'UnFlag',
				icon: 'UnflagOutline',
				label: t('actions.unflag', 'Unflag'),
				click: (): void => {
					toggleFlagSelection(false);
				}
			},
			[Action.Download]: {
				id: 'Download',
				icon: 'Download',
				label: t('actions.download', 'Download'),
				click: downloadSelection
			},
			[Action.SendViaMail]: {
				id: 'SendViaMail',
				icon: 'EmailOutline',
				label: t('actions.sendViaMail', 'Send via mail'),
				click: sendViaMailCallback
			},
			[Action.Restore]: {
				id: 'Restore',
				icon: 'RestoreOutline',
				label: t('actions.restore', 'Restore'),
				click: restoreSelection
			},
			[Action.DeletePermanently]: {
				id: 'DeletePermanently',
				icon: 'DeletePermanentlyOutline',
				label: t('actions.deletePermanently', 'Delete Permanently'),
				click: openDeletePermanentlyModal
			}
		}),
		[
			downloadSelection,
			markForDeletionSelection,
			openCopyNodesModalSelection,
			openDeletePermanentlyModal,
			openMoveNodesModalSelection,
			openRenameModalSelection,
			openWithDocsSelection,
			restoreSelection,
			sendViaMailCallback,
			t,
			toggleFlagSelection
		]
	);

	const permittedSelectionModePrimaryActionsItems = useMemo(
		() => buildActionItems(itemsMap, permittedSelectionModePrimaryActions),
		[itemsMap, permittedSelectionModePrimaryActions]
	);

	const permittedSelectionModeSecondaryActionsItems = useMemo(
		() => buildActionItems(itemsMap, permittedSelectionModeSecondaryActions),
		[itemsMap, permittedSelectionModeSecondaryActions]
	);

	const selectionContextualMenuActionsItems = useMemo(
		() => [
			...permittedSelectionModePrimaryActionsItems,
			...permittedSelectionModeSecondaryActionsItems
		],
		[permittedSelectionModePrimaryActionsItems, permittedSelectionModeSecondaryActionsItems]
	);

	const { add } = useUpload();

	const uploadWithDragAndDrop = useCallback<React.DragEventHandler>(
		(event) => {
			if (canUpload) {
				add(event.dataTransfer.files, folderId || ROOTS.LOCAL_ROOT, true);
				if (!folderId) {
					createSnackbar({
						key: new Date().toLocaleString(),
						type: 'info',
						label: t('uploads.destination.home', "Upload occurred in Files' Home"),
						actionLabel: t('snackbar.upload.goToFolder', 'Go to folder'),
						onActionClick: () => {
							navigateToFolder(ROOTS.LOCAL_ROOT);
						},
						replace: true,
						hideButton: true
					});
				}
			}
		},
		[add, canUpload, createSnackbar, folderId, navigateToFolder, t]
	);

	const dropzoneModal = useMemo(
		() =>
			canUpload
				? {
						title: t('uploads.dropzone.title.enabled', 'Drag&Drop Mode'),
						message:
							(folderId &&
								t(
									'uploads.dropzone.message.folderView.enabled',
									'Drop here your attachments \n to quick-add them to this folder'
								)) ||
							t(
								'uploads.dropzone.message.otherView.enabled',
								'Drop here your attachments \n to quick-add them to your Home'
							),
						icons: ['ImageOutline', 'FileAddOutline', 'FilmOutline']
				  }
				: {
						title: t('uploads.dropzone.title.disabled', 'Drag&Drop Mode'),
						message: t(
							'uploads.dropzone.message.disabled',
							'You cannot drop an attachment in this area'
						),
						icons: ['AlertTriangleOutline']
				  },
		[canUpload, folderId, t]
	);

	return (
		<MainContainer
			mainAlignment="flex-start"
			data-testid={`list-${folderId || ''}`}
			maxHeight="100%"
			background="gray6"
		>
			<ListHeader
				folderId={folderId}
				crumbs={crumbs}
				loadingData={loading}
				isSelectionModeActive={isSelectionModeActive}
				isAllSelected={size(selectedIDs) === size(nodes)}
				unSelectAll={unSelectAll}
				selectAll={selectAll}
				exitSelectionMode={exitSelectionMode}
				permittedSelectionModePrimaryActionsItems={permittedSelectionModePrimaryActionsItems}
				permittedSelectionModeSecondaryActionsItems={permittedSelectionModeSecondaryActionsItems}
				actionComponent={<SortingComponent />}
			/>
			<Dropzone
				onDrop={uploadWithDragAndDrop}
				disabled={!canUpload}
				title={dropzoneModal.title}
				message={dropzoneModal.message}
				icons={dropzoneModal.icons}
				effect="copy"
				types={[DRAG_TYPES.upload]}
			>
				{(): JSX.Element => (
					<Container background="gray6" mainAlignment="flex-start">
						{nodes.length > 0 && (
							<NodeAvatarIconContext.Provider
								value={{
									tooltipLabel: t('selectionMode.node.tooltip', 'Activate selection mode'),
									tooltipDisabled: false
								}}
							>
								<ListContent
									nodes={nodes}
									selectedMap={selectedMap}
									selectId={selectId}
									isSelectionModeActive={isSelectionModeActive}
									exitSelectionMode={exitSelectionMode}
									toggleFlag={toggleFlag}
									renameNode={openRenameModalAction}
									markNodesForDeletion={markNodesForDeletion}
									restore={restore}
									deletePermanently={deletePermanently}
									moveNodes={openMoveNodesModalAction}
									copyNodes={openCopyNodesModalAction}
									activeNodes={activeNode}
									setActiveNode={setActiveNodeHandler}
									navigateTo={navigateToFolder}
									loading={loading}
									hasMore={hasMore}
									loadMore={loadMore}
									draggable
									customCheckers={actionCheckers}
									selectionContextualMenuActionsItems={selectionContextualMenuActionsItems}
									fillerWithActions={fillerWithActions}
								/>
								{fillerWithActions &&
									React.cloneElement(fillerWithActions, {
										children: <Container height="fill" data-testid="fillerContainer" />
									})}
							</NodeAvatarIconContext.Provider>
						)}
						{nodes.length === 0 && !loading && !fillerWithActions && (
							<EmptyFolder mainList={mainList} message={emptyListMessage} />
						)}
						{nodes.length === 0 &&
							!loading &&
							fillerWithActions &&
							React.cloneElement(fillerWithActions, {
								children: <EmptyFolder mainList={mainList} message={emptyListMessage} />
							})}
					</Container>
				)}
			</Dropzone>
		</MainContainer>
	);
};
