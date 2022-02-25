/*
 * SPDX-FileCopyrightText: 2022 Zextras <https://www.zextras.com>
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import React, { ReactElement, useMemo } from 'react';

import { ApolloClient, ApolloProvider, NormalizedCacheObject } from '@apollo/client';
import { MockedProvider } from '@apollo/client/testing';
import {
	act,
	FindAllBy,
	FindBy,
	GetAllBy,
	GetBy,
	queries,
	QueryBy,
	queryHelpers,
	render as reactRender,
	RenderOptions,
	RenderResult,
	screen,
	waitFor,
	waitForElementToBeRemoved,
	within
} from '@testing-library/react';
import { renderHook, RenderHookResult } from '@testing-library/react-hooks';
import userEvent from '@testing-library/user-event';
import { ModalManager, SnackbarManager } from '@zextras/carbonio-design-system';
import { GraphQLError } from 'graphql';
import forEach from 'lodash/forEach';
import map from 'lodash/map';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter } from 'react-router-dom';

import I18nFactory from '../../i18n/i18n-test-factory';
import StyledWrapper from '../../StyledWrapper';
import { AdvancedFilters } from '../types/common';
import { Folder } from '../types/graphql/types';
import { Mock } from './mockUtils';

/**
 * Matcher function to search a string in more html elements and not just in a single element.
 */
const queryAllByTextWithMarkup: GetAllBy<[string | RegExp]> = (container, text) =>
	screen.queryAllByText((_content: string, node: Element | null) => {
		if (node) {
			const hasText = (singleNode: Element): boolean => {
				const regExp = RegExp(text);
				return singleNode.textContent != null && regExp.test(singleNode.textContent);
			};
			const childrenDontHaveText = Array.from(node.children).every(
				(child) => !hasText(child as HTMLElement)
			);
			return hasText(node) && childrenDontHaveText;
		}
		return false;
	});

const getByTextWithMarkupMultipleError = (
	container: Element | null,
	text: string | RegExp
): string => `Found multiple elements with text: ${text}`;
const getByTextWithMarkupMissingError = (
	container: Element | null,
	text: string | RegExp
): string => `Unable to find an element with text: ${text}`;

const [
	queryByTextWithMarkup,
	getAllByTextWithMarkup,
	getByTextWithMarkup,
	findAllByTextWithMarkup,
	findByTextWithMarkup
] = queryHelpers.buildQueries<[string | RegExp]>(
	queryAllByTextWithMarkup,
	getByTextWithMarkupMultipleError,
	getByTextWithMarkupMissingError
);

export type CustomByTextWithMarkupQueries = {
	queryByTextWithMarkup: QueryBy<[string | RegExp]>;
	getAllByTextWithMarkup: GetAllBy<[string | RegExp]>;
	getByTextWithMarkup: GetBy<[string | RegExp]>;
	findAllByTextWithMarkup: FindAllBy<[string | RegExp]>;
	findByTextWithMarkup: FindBy<[string | RegExp]>;
};

export const customQueryByTextWithMarkup: CustomByTextWithMarkupQueries = {
	queryByTextWithMarkup,
	getAllByTextWithMarkup,
	getByTextWithMarkup,
	findAllByTextWithMarkup,
	findByTextWithMarkup
};

function escapeRegExp(string: string): string {
	return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
}

/**
 * Create a regExp for searching breadcrumb as a string with the textWithMarkup helper function.
 * <br />
 * The regExp is built to match a breadcrumb formed as "/ level0 / level1 / level2" ,
 * with a / at the begin and no / at the end
 * @param nodesNames
 *
 * @example
 * // returns /^/\s*level0\s*\/\s*level1(?!/)$
 * buildBreadCrumbRegExp('level0', 'level1');
 * @returns {RegExp} Returns a regular expression instance to match a breadcrumb in the asserted format
 */
export const buildBreadCrumbRegExp = (...nodesNames: string[]): RegExp => {
	let regExp = '^/\\s*';
	forEach(nodesNames, (name, index) => {
		if (index !== 0) {
			regExp += '/';
		}
		regExp += `\\s*${escapeRegExp(name)}\\s*`;
	});
	regExp += `(?!/)$`;
	return RegExp(regExp, 'g');
};

export interface WrapperProps {
	children: React.ReactElement;
}

/**
 * Generate a wrapper for testing hooks with apollo operations
 * @param client
 * @param hook
 */
export function getApolloHookWrapper(
	client: ApolloClient<NormalizedCacheObject>,
	hook: () => unknown
): RenderHookResult<WrapperProps, unknown> {
	const wrapper: React.VFC<WrapperProps> = ({ children }) => (
		<ApolloProvider client={client}>{children}</ApolloProvider>
	);

	return renderHook(() => hook(), { wrapper });
}

/**
 * Utility to generate an error for mocks that can be decoded with {@link decodeError}
 * @param message
 */
export function generateError(message: string): GraphQLError {
	return new GraphQLError(`Controlled error: ${message}`);
}

export const render = (
	ui: ReactElement,
	{
		initialRouterEntries = ['/'],
		mocks,
		...options
	}: {
		initialRouterEntries?: string[];
		mocks?: Mock[];
		options?: Omit<RenderOptions, 'queries' | 'wrapper'>;
	} = {}
): RenderResult<typeof queries & CustomByTextWithMarkupQueries> => {
	const Wrapper: React.FC = ({ children }) => {
		const i18n = useMemo(() => {
			const i18nFactory = new I18nFactory();
			return i18nFactory.getAppI18n();
		}, []);

		const ApolloProviderWrapper: React.FC = ({ children: apolloChildren }) =>
			mocks ? (
				<MockedProvider mocks={mocks} cache={global.apolloClient.cache}>
					{apolloChildren}
				</MockedProvider>
			) : (
				<ApolloProvider client={global.apolloClient}>{apolloChildren}</ApolloProvider>
			);

		return (
			<ApolloProviderWrapper>
				<MemoryRouter
					initialEntries={initialRouterEntries}
					initialIndex={(initialRouterEntries?.length || 1) - 1}
				>
					<StyledWrapper>
						<I18nextProvider i18n={i18n}>
							<SnackbarManager>
								<ModalManager>{children}</ModalManager>
							</SnackbarManager>
						</I18nextProvider>
					</StyledWrapper>
				</MemoryRouter>
			</ApolloProviderWrapper>
		);
	};
	return reactRender(ui, {
		wrapper: Wrapper,
		queries: { ...queries, ...customQueryByTextWithMarkup },
		...options
	});
};

export async function triggerLoadMore(): Promise<void> {
	const { calls } = (window.IntersectionObserver as jest.Mock<IntersectionObserver>).mock;
	const [onChange] = calls[calls.length - 1];
	// trigger the intersection on the observed element
	await waitFor(() =>
		onChange([
			{
				target: screen.getByTestId('icon: Refresh'),
				intersectionRatio: 0,
				isIntersecting: true
			}
		])
	);
}

export function selectNodes(nodesToSelect: string[]): void {
	for (let i = 0; i < nodesToSelect.length; i += 1) {
		const id = nodesToSelect[i];
		const node = within(screen.getByTestId(`node-item-${id}`));
		let clickableItem = node.queryByTestId('file-icon-preview');
		if (clickableItem == null) {
			clickableItem = node.queryByTestId('unCheckedAvatar');
		}
		if (clickableItem == null) {
			clickableItem = node.queryByTestId('checkedAvatar');
		}
		act(() => {
			if (clickableItem) {
				userEvent.click(clickableItem, undefined, { skipHover: true });
			}
		});
	}
}

export async function renameNode(newName: string): Promise<void> {
	// check that the rename action becomes visible and click on it
	await screen.findByText(/\brename\b/i);
	userEvent.click(screen.getByText(/\brename\b/i));
	// fill new name in modal input field
	const inputFieldDiv = await screen.findByTestId('input-name');
	const inputField = within(inputFieldDiv).getByRole('textbox');
	userEvent.clear(inputField);
	userEvent.type(inputField, newName);
	expect(inputField).toHaveValue(newName);
	// click on confirm button (rename)
	const button = screen.getByRole('button', { name: /rename/i });
	userEvent.click(button);
}

export async function moveNode(destinationFolder: Folder): Promise<void> {
	const moveAction = await screen.findByText('Move');
	expect(moveAction).toBeVisible();
	userEvent.click(moveAction);
	const modalList = await screen.findByTestId('modal-list-', { exact: false });
	const destinationFolderItem = await within(modalList).findByText(destinationFolder.name);
	userEvent.click(destinationFolderItem);
	await waitFor(() =>
		expect(screen.getByRole('button', { name: /move/i })).not.toHaveAttribute('disabled', '')
	);
	// eslint-disable-next-line testing-library/no-unnecessary-act
	act(() => {
		userEvent.click(screen.getByRole('button', { name: /move/i }));
	});
	await waitForElementToBeRemoved(screen.queryByRole('button', { name: /move/i }));
	expect(screen.queryByRole('button', { name: /move/i })).not.toBeInTheDocument();
	expect(screen.queryByText('Move')).not.toBeInTheDocument();
}

export function buildChipsFromKeywords(keywords: string[]): AdvancedFilters['keywords'] {
	return map(keywords, (k) => ({ label: k, hasAvatar: false, value: k, background: 'gray2' }));
}

export const actionRegexp = {
	rename: /^rename$/i,
	copy: /^copy$/i,
	flag: /^flag$/i,
	unflag: /^unflag$/i,
	move: /^move$/i,
	moveToTrash: /^move to trash$/i,
	download: /^download$/i,
	openDocument: /^open document$/i,
	deletePermanently: /^delete permanently$/i,
	restore: /^restore$/i
} as const;
