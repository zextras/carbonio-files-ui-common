/*
 * SPDX-FileCopyrightText: 2022 Zextras <https://www.zextras.com>
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useApolloClient } from '@apollo/client';
import {
	Avatar,
	Button,
	Container,
	Dropdown,
	Input,
	Padding,
	Row,
	Text
} from '@zextras/carbonio-design-system';
import filter from 'lodash/filter';
import findIndex from 'lodash/findIndex';
import first from 'lodash/first';
import forEach from 'lodash/forEach';
import map from 'lodash/map';
import reduce from 'lodash/reduce';
import size from 'lodash/size';
import some from 'lodash/some';
import startsWith from 'lodash/startsWith';
import throttle from 'lodash/throttle';
import trim from 'lodash/trim';
import { useTranslation } from 'react-i18next';
import styled from 'styled-components';

import { soapFetch } from '../../../../network/network';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { ShareChipInput } from '../../../design_system_fork/SharesChipInput';
import GET_ACCOUNT_BY_EMAIL from '../../../graphql/queries/getAccountByEmail.graphql';
import { useCreateShareMutation } from '../../../hooks/graphql/mutations/useCreateShareMutation';
import { Contact, Node, Role } from '../../../types/common';
import {
	GetAccountByEmailQuery,
	GetAccountByEmailQueryVariables,
	Share
} from '../../../types/graphql/types';
import { AutocompleteRequest, AutocompleteResponse } from '../../../types/network';
import { getChipLabel, sharePermissionsGetter } from '../../../utils/utils';

const Gray5Input = styled(Input)`
	background-color: ${({ theme }): string => theme.palette.gray5.regular};
`;

const emailRegex =
	// eslint-disable-next-line @typescript-eslint/no-unused-vars, max-len, no-control-regex
	/(?:[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*|"(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21\x23-\x5b\x5d-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])*")@(?:(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?|\[(?:(?:(2(5[0-5]|[0-4][0-9])|1[0-9][0-9]|[1-9]?[0-9]))\.){3}(?:(2(5[0-5]|[0-4][0-9])|1[0-9][0-9]|[1-9]?[0-9])|[a-z0-9-]*[a-z0-9]:(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21-\x5a\x53-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])+)\])/;

interface HintProps {
	contact: Contact;
}
const Hint: React.VFC<HintProps> = ({ contact }) => {
	const label = useMemo(() => getChipLabel(contact), [contact]);
	return (
		<Container
			orientation="horizontal"
			mainAlignment="flex-start"
			crossAlignment="center"
			minWidth="256px"
			minHeight={32}
		>
			<Avatar label={getChipLabel(contact)} />
			<Container orientation="vertical" crossAlignment="flex-start" padding={{ left: 'small' }}>
				{label !== contact.email ? (
					<>
						<Row takeAvailableSpace mainAlignment="flex-start">
							<Text size="medium">{label}</Text>
						</Row>
						<Row takeAvailableSpace mainAlignment="flex-start">
							<Text color="secondary" size="small">
								{contact.email}
							</Text>
						</Row>
					</>
				) : (
					<Text size="medium">{label}</Text>
				)}
			</Container>
		</Container>
	);
};

const SkeletonTile = styled.div<{ width: string; height: string; radius: string }>`
	width: ${({ width }): string => width ?? '16px'};
	max-width: ${({ width }): string => width ?? '16px'};
	min-width: ${({ width }): string => width ?? '16px'};
	height: ${({ height }): string => height ?? '16px'};
	max-height: ${({ height }): string => height ?? '16px'};
	min-height: ${({ height }): string => height ?? '16px'};
	border-radius: ${({ radius }): string => radius ?? '2px'};
	background: ${({ theme }): string => theme.palette.gray2.regular};
`;

const Loader: React.VFC = () => (
	<Container
		orientation="horizontal"
		mainAlignment="flex-start"
		crossAlignment="center"
		minWidth="256px"
		minHeight={32}
	>
		<SkeletonTile radius="50%" width="32px" height="32px" />
		<Container orientation="vertical" crossAlignment="flex-start" padding={{ left: 'small' }}>
			<SkeletonTile
				radius="4px"
				width={`${Math.random() * 150 + 64}px`}
				height="14px"
				style={{ marginBottom: '4px' }}
			/>
			<SkeletonTile radius="4px" width={`${Math.random() * 150 + 64}px`} height="12px" />
		</Container>
	</Container>
);

interface AddSharingProps {
	node: Pick<Node, '__typename' | 'id' | 'owner'> & {
		shares?: Array<Pick<Share, '__typename' | 'share_target'> | null | undefined>;
	};
}

interface ShareChip {
	id: string;
	sharingAllowed: boolean;
	role: Role;
}

export const AddSharing: React.VFC<AddSharingProps> = ({ node }) => {
	const [t] = useTranslation();
	const apolloClient = useApolloClient();

	const [createShare, _createShareError] = useCreateShareMutation();

	const [mailTextValue, setMailTextValue] = useState('');

	const [searchResult, setSearchResult] = useState<Contact[]>([]);
	const [chips, setChips] = useState<ShareChip[]>([]);
	const [forceOpen, setForceOpen] = useState(false);
	const inputRef = useRef<HTMLInputElement>(null);
	const [loading, setLoading] = useState(false);
	const [searchText, setSearchText] = useState('');

	const createShareCallback = useCallback(() => {
		forEach(chips, (chip) => {
			createShare(
				node,
				chip.id,
				sharePermissionsGetter(chip.role, chip.sharingAllowed),
				trim(mailTextValue).length > 0 ? trim(mailTextValue) : undefined
			).catch(console.error);
		});
		setChips([]);
		setMailTextValue('');
	}, [chips, createShare, mailTextValue, node]);

	const addChip = useCallback(
		(contact: Contact) => (): void => {
			if (inputRef.current) {
				inputRef.current.textContent = '';
				inputRef.current.focus();
			}
			setSearchText('');
			if (contact.email) {
				apolloClient
					.query<GetAccountByEmailQuery, GetAccountByEmailQueryVariables>({
						query: GET_ACCOUNT_BY_EMAIL,
						fetchPolicy: 'no-cache',
						variables: {
							email: contact.email
						}
					})
					.then((result) => {
						if (result?.data.getAccountByEmail) {
							const contactWithId = {
								...contact,
								id: result.data.getAccountByEmail.id,
								role: Role.Viewer,
								sharingAllowed: false
							};
							setChips((c) => [...c, contactWithId]);
						} else {
							throw Error('getAccountByEmail: empty result');
						}
					})
					.catch((err) => {
						console.error(err);
					});
			}

			setSearchResult([]);
			setForceOpen(false);
		},
		[apolloClient]
	);

	const search = useMemo(
		() =>
			throttle(
				({ textContent }: React.KeyboardEvent & { textContent: string }) => {
					if (textContent === '') {
						setSearchResult((h) => (h.length > 0 ? [] : h));
						return;
					}
					setLoading(true);
					soapFetch<AutocompleteRequest, AutocompleteResponse>('AutoComplete', {
						includeGal: 1,
						name: {
							_content: textContent
						}
					})
						.then(({ match }) =>
							map(
								filter(match, (m) => !m.isGroup),
								(m) => ({
									...m,
									email: first(emailRegex.exec(m.email))
								})
							)
						)
						.then((remoteResults) => {
							setLoading(false);
							setSearchResult(
								reduce(
									remoteResults,
									(acc, result) => {
										// exclude emails already added in dropdown
										const localIndex = findIndex(acc, ['email', result.email]);
										if (localIndex >= 0) {
											return acc;
										}
										// exclude emails already added as new shares
										const alreadyInChips = findIndex(chips, ['email', result.email]) >= 0;
										if (alreadyInChips) {
											return acc;
										}
										// exclude email of node owner
										if (result.email === node.owner.email) {
											return acc;
										}
										// exclude emails already added as collaborators
										// TODO: handle distribution lists
										const alreadyInCollaborators =
											findIndex(
												node.shares,
												(share) =>
													share?.share_target?.__typename === 'User' &&
													share.share_target.email === result.email
											) >= 0;
										if (alreadyInCollaborators) {
											return acc;
										}
										return [
											...acc,
											{
												email: result.email,
												firstName: result.first,
												lastName: result.last,
												company: result.company,
												fullName: result.full
											}
										];
									},
									[] as Contact[]
								)
							);
						})
						.catch((err: Error) => {
							console.error(err);
						});
				},
				1000,
				{ leading: true, trailing: true }
			),
		[chips, node]
	);

	const onChipsChange = useCallback((c) => {
		setChips(c);
	}, []);

	const onType = useCallback(
		(ev) => {
			if (ev.key.length === 1 || ev.key === 'Delete' || ev.key === 'Backspace') {
				search(ev);
			}
			setSearchText(ev.textContent);
		},
		[search]
	);

	const filteredResult = useMemo(
		() =>
			filter(searchResult, (c) =>
				some([c.firstName, c.lastName, c.company, c.email, c.fullName], (field) =>
					startsWith(field?.toLowerCase(), searchText.toLowerCase())
				)
			),
		[searchResult, searchText]
	);

	const dropdownItems = useMemo(() => {
		const items = map(filteredResult, (contact) => ({
			label: `${contact.id} ${contact.email}`,
			id: `${contact.id} ${contact.email}`,
			customComponent: <Hint contact={contact} />,
			click: addChip(contact)
		}));
		if (loading) {
			items.push({
				id: 'loading',
				label: 'loading',
				customComponent: <Loader />,
				click: () => undefined
			});
		}
		return items;
	}, [addChip, loading, filteredResult]);

	useEffect(() => {
		if (dropdownItems?.length > 0) {
			setForceOpen(true);
		} else {
			setForceOpen(false);
		}
	}, [dropdownItems]);

	return (
		<Container padding={{ top: 'large' }}>
			<Container>
				<ShareChipInput
					inputRef={inputRef}
					placeholder={t('displayer.share.addShare.input.placeholder', 'Add new people or groups')}
					confirmChipOnBlur={false}
					onInputType={onType}
					onChange={onChipsChange}
					value={chips}
					valueKey="email"
					getChipLabel={getChipLabel}
					dividerColor="gray2"
				/>
				<Dropdown
					disablePortal={false}
					maxHeight="234px"
					disableAutoFocus
					disableRestoreFocus
					display="block"
					width="100%"
					maxWidth="100%"
					items={dropdownItems}
					forceOpen={forceOpen}
					onClose={(): void => setForceOpen(false)}
				>
					<div style={{ width: '100%' }} />
				</Dropdown>
			</Container>

			<Container
				orientation="horizontal"
				crossAlignment="baseline"
				mainAlignment="baseline"
				padding={{ top: 'medium', bottom: 'medium', right: 'medium' }}
			>
				<Padding right="small">
					<Text weight="bold" size="extrasmall" color="gray0">
						{t('displayer.share.addShare.note', 'Note:')}
					</Text>
				</Padding>
				<Text overflow="break-word" size="extrasmall" color="gray1">
					{t(
						'displayer.share.addShare.noteDescription',
						'The standard message displays your name, the name of the shared item, permissions granted to the recipients and sign in information, if necessary.'
					)}
				</Text>
			</Container>

			<Gray5Input
				autoComplete="on"
				label={t(
					'displayer.share.addShare.input.label',
					'Add a custom message to this notification'
				)}
				value={mailTextValue}
				onChange={(ev: React.ChangeEvent<HTMLInputElement>): void => {
					setMailTextValue(ev.target.value);
				}}
			/>
			<Container orientation="horizontal" mainAlignment="flex-end" padding={{ top: 'small' }}>
				<Button
					label="Share"
					color="primary"
					onClick={createShareCallback}
					disabled={!(size(chips) > 0)}
				/>
			</Container>
		</Container>
	);
};
