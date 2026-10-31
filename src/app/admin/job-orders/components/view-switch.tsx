'use client';

import type { ViewMode } from '../board-model';

const VIEWS: { key: ViewMode; label: string; icon: string }[] = [
	{ key: 'board', label: 'บอร์ด', icon: 'M4 5h4v14H4zM10 5h4v9h-4zM16 5h4v12h-4z' },
	{ key: 'list', label: 'รายการ', icon: 'M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01' },
	{ key: 'calendar', label: 'ปฏิทิน', icon: 'M5 6h14v14H5zM5 10h14M9 4v4M15 4v4' },
];

/** Board / list / calendar switch beside the page title. */
export default function ViewSwitch({ viewMode, onChange }: { viewMode: ViewMode; onChange: (view: ViewMode) => void }) {
	return (
		<div className="ka-seg" role="group" aria-label="มุมมอง">
			{VIEWS.map((view) => (
				<button key={view.key} type="button" aria-pressed={viewMode === view.key} onClick={() => onChange(view.key)}>
					<svg fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><path d={view.icon} /></svg>
					{view.label}
				</button>
			))}
		</div>
	);
}
