/*
 * SPDX-FileCopyrightText: 2022 Zextras <https://www.zextras.com>
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import React, { ReactElement, useContext, useEffect, useMemo } from 'react';

import { ApolloProvider } from '@apollo/client';
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
	render,
	RenderOptions,
	RenderResult,
	screen,
	waitFor,
	within
} from '@testing-library/react';
import { renderHook, RenderHookOptions, RenderHookResult } from '@testing-library/react-hooks';
import userEvent from '@testing-library/user-event';
import { ModalManager, SnackbarManager } from '@zextras/carbonio-design-system';
import { PreviewManager, PreviewsManagerContext } from '@zextras/carbonio-ui-preview';
import { PreviewManagerContextType } from '@zextras/carbonio-ui-preview/lib/preview/PreviewManager';
import { EventEmitter } from 'events';
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

export type UserEvent = ReturnType<typeof userEvent['setup']>;

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

/**
 * Utility to generate an error for mocks that can be decoded with {@link decodeError}
 * @param message
 */
export function generateError(message: string): GraphQLError {
	return new GraphQLError(`Controlled error: ${message}`);
}

interface WrapperProps {
	children?: React.ReactNode | undefined;
	initialRouterEntries?: string[];
	mocks?: Mock[];
}

const Wrapper = ({ mocks, initialRouterEntries, children }: WrapperProps): JSX.Element => {
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
							<ModalManager>
								<PreviewManager>{children}</PreviewManager>
							</ModalManager>
						</SnackbarManager>
					</I18nextProvider>
				</StyledWrapper>
			</MemoryRouter>
		</ApolloProviderWrapper>
	);
};

function customRender(
	ui: React.ReactElement,
	{
		initialRouterEntries = ['/'],
		mocks,
		...options
	}: WrapperProps & {
		options?: Omit<RenderOptions, 'queries' | 'wrapper'>;
	} = {}
): RenderResult<typeof queries & CustomByTextWithMarkupQueries> {
	return render(ui, {
		wrapper: ({ children }: Pick<WrapperProps, 'children'>) => (
			<Wrapper initialRouterEntries={initialRouterEntries} mocks={mocks}>
				{children}
			</Wrapper>
		),
		queries: { ...queries, ...customQueryByTextWithMarkup },
		...options
	});
}

type SetupOptions = Pick<WrapperProps, 'initialRouterEntries' | 'mocks'> & {
	renderOptions?: Omit<RenderOptions, 'queries' | 'wrapper'>;
	setupOptions?: Parameters<typeof userEvent['setup']>[0];
};

export const setup = (
	ui: ReactElement,
	options?: SetupOptions
): { user: UserEvent } & ReturnType<typeof customRender> => ({
	user: userEvent.setup({ advanceTimers: jest.advanceTimersByTime, ...options?.setupOptions }),
	...customRender(ui, {
		initialRouterEntries: options?.initialRouterEntries,
		mocks: options?.mocks,
		...options?.renderOptions
	})
});

/**
 * Generate a wrapper for testing hooks with apollo operations
 */
export function setupHook<TProps, TResult>(
	hook: (props: TProps) => TResult,
	options?: Pick<WrapperProps, 'initialRouterEntries' | 'mocks'> & RenderHookOptions<TProps>
): RenderHookResult<TProps, TResult> {
	const renderHookResult = renderHook<TProps, TResult>(hook, {
		wrapper: ({ children }: Pick<WrapperProps, 'children'>) => (
			<Wrapper {...options}>{children}</Wrapper>
		)
	});

	const hookFn = renderHookResult.result.current;
	expect(hookFn).toBeDefined();
	return renderHookResult;
}

export async function triggerLoadMore(): Promise<void> {
	expect(screen.getByTestId('icon: Refresh')).toBeVisible();
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

export async function selectNodes(nodesToSelect: string[], user: UserEvent): Promise<void> {
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
		if (clickableItem) {
			// eslint-disable-next-line no-await-in-loop
			await user.click(clickableItem);
		}
	}
}

export async function renameNode(newName: string, user: UserEvent): Promise<void> {
	// check that the rename action becomes visible and click on it
	await screen.findByText(/\brename\b/i);
	await user.click(screen.getByText(/\brename\b/i));
	// fill new name in modal input field
	const inputFieldDiv = await screen.findByTestId('input-name');
	act(() => {
		// run timers of modal
		jest.advanceTimersToNextTimer();
	});
	const inputField = within(inputFieldDiv).getByRole('textbox');
	await user.clear(inputField);
	await user.type(inputField, newName);
	expect(inputField).toHaveValue(newName);
	// click on confirm button (rename)
	const button = screen.getByRole('button', { name: /rename/i });
	await user.click(button);
}

export async function moveNode(destinationFolder: Folder, user: UserEvent): Promise<void> {
	const moveAction = await screen.findByText('Move');
	expect(moveAction).toBeVisible();
	await user.click(moveAction);
	const modalList = await screen.findByTestId('modal-list-', { exact: false });
	act(() => {
		// run timers of modal
		jest.runOnlyPendingTimers();
	});
	const destinationFolderItem = await within(modalList).findByText(destinationFolder.name);
	await user.click(destinationFolderItem);
	await waitFor(() =>
		expect(screen.getByRole('button', { name: /move/i })).not.toHaveAttribute('disabled', '')
	);
	await user.click(screen.getByRole('button', { name: /move/i }));
	await waitFor(() =>
		expect(screen.queryByRole('button', { name: /move/i })).not.toBeInTheDocument()
	);
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
	restore: /^restore$/i,
	manageShares: /^manage shares$/i,
	preview: /^preview$/i
} as const;

export const iconRegexp = {
	moreVertical: /^icon: MoreVertical$/i,
	moveToTrash: /^icon: Trash2Outline$/i,
	restore: /^icon: RestoreOutline$/i,
	deletePermanently: /^icon: DeletePermanentlyOutline$/i,
	rename: /^icon: Edit2Outline$/i,
	copy: /^icon: Copy$/i,
	move: /^icon: MoveOutline$/i,
	flag: /^icon: FlagOutline$/i,
	unflag: /^icon: UnflagOutline$/i,
	download: /^icon: Download$/i,
	openDocument: /^icon: BookOpenOutline$/i,
	close: /^icon: Close$/i,
	trash: /^icon: Trash2Outline$/i
} as const;

export function getFirstOfNextMonth(from: Date | number = Date.now()): Date {
	const startingDate = new Date(from);
	let chosenDate: Date;
	if (startingDate.getMonth() === 11) {
		chosenDate = new Date(startingDate.getFullYear() + 1, 0, 1);
	} else {
		chosenDate = new Date(startingDate.getFullYear(), startingDate.getMonth() + 1, 1);
	}
	return chosenDate;
}

// utility to make msw respond in a controlled way
// see https://github.com/mswjs/msw/discussions/1307
export async function delayUntil(emitter: EventEmitter, event: string): Promise<void> {
	return new Promise((resolve) => {
		emitter.once(event, resolve);
	});
}

export const PreviewInitComponent: React.FC<{
	initPreviewArgs: Parameters<PreviewManagerContextType['initPreview']>[0];
}> = ({ children, initPreviewArgs }) => {
	const { initPreview, emptyPreview } = useContext(PreviewsManagerContext);

	useEffect(() => {
		initPreview(initPreviewArgs);
		return emptyPreview;
	}, [emptyPreview, initPreview, initPreviewArgs]);
	return <>{children}</>;
};
