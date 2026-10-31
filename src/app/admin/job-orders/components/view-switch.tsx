'use client';

import { useRef } from 'react';
import type { ViewMode } from '../board-model';

const VIEWS: { key: ViewMode; label: string; icon: string }[] = [
	{ key: 'board', label: 'บอร์ด', icon: 'M4 5h4v14H4zM10 5h4v9h-4zM16 5h4v12h-4z' },
	{ key: 'list', label: 'รายการ', icon: 'M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01' },
	{ key: 'calendar', label: 'ปฏิทิน', icon: 'M5 6h14v14H5zM5 10h14M9 4v4M15 4v4' },
];

/** Board / list / calendar as tabs: Tab reaches the chosen one, the arrow keys move between them. */
export default function ViewSwitch({ viewMode, onChange }: { viewMode: ViewMode; onChange: (view: ViewMode) => void }) {
	const tabs = useRef<(HTMLButtonElement | null)[]>([]);
	const moveBy = (from: number, step: number) => {
		const next = (from + step + VIEWS.length) % VIEWS.length;
		onChange(VIEWS[next].key);
		tabs.current[next]?.focus();
	};

	return (
		<div className="ka-seg ka-jo-views" role="tablist" aria-label="มุมมอง">
			{VIEWS.map((view, index) => (
				<button
					key={view.key}
					ref={(element) => {
						tabs.current[index] = element;
					}}
					type="button"
					role="tab"
					aria-selected={viewMode === view.key}
					tabIndex={viewMode === view.key ? 0 : -1}
					onClick={() => onChange(view.key)}
					onKeyDown={(event) => {
						if (event.key === 'ArrowRight') moveBy(index, 1);
						else if (event.key === 'ArrowLeft') moveBy(index, -1);
						else return;
						event.preventDefault();
					}}
				>
					<svg fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d={view.icon} /></svg>
					{view.label}
				</button>
			))}
		</div>
	);
}
