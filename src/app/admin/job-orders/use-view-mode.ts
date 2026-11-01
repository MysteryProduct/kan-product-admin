import { useEffect, useState } from 'react';
import type { ViewMode } from './board-model';

const STORAGE_KEY = 'ka.jobOrders.view';
const VIEWS: ViewMode[] = ['board', 'list', 'calendar'];
const isView = (value: unknown): value is ViewMode => VIEWS.includes(value as ViewMode);

const readStored = (): ViewMode | null => {
	try {
		const value = window.localStorage.getItem(STORAGE_KEY);
		return isView(value) ? value : null;
	} catch {
		return null;
	}
};

/**
 * The open view: `?view=` first, then the view last chosen on this browser, else the list on phones
 * (below 640px) and the board elsewhere. A choice is remembered and written back to the address,
 * so a reload or a shared link opens the same view.
 */
export function useViewMode() {
	const [viewMode, setViewModeState] = useState<ViewMode>('board');

	useEffect(() => {
		const fromUrl = new URLSearchParams(window.location.search).get('view');
		const initial = isView(fromUrl) ? fromUrl : readStored() ?? (window.matchMedia('(max-width: 639px)').matches ? 'list' : 'board');
		// Read once after mount: the server render cannot know the address query, storage or width.
		const frame = requestAnimationFrame(() => setViewModeState(initial));
		return () => cancelAnimationFrame(frame);
	}, []);

	const setViewMode = (view: ViewMode) => {
		setViewModeState(view);
		try {
			window.localStorage.setItem(STORAGE_KEY, view);
		} catch {
			// Private windows may refuse storage; the address still keeps the view.
		}
		const url = new URL(window.location.href);
		url.searchParams.set('view', view);
		window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
	};

	return [viewMode, setViewMode] as const;
}
