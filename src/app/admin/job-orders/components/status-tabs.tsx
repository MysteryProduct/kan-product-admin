'use client';

import { count, STATUS_META, type StatusTab } from '../board-model';

const TABS: StatusTab[] = ['all', 'late', 'pending', 'in_progress', 'completed', 'cancelled'];

/** Status pills with a dot and the count left after the other filters; they filter the list and the calendar. */
export default function StatusTabs({ value, counts, onChange }: { value: StatusTab; counts: Record<StatusTab, number>; onChange: (tab: StatusTab) => void }) {
	return (
		<div className="ka-jo-tabs" role="tablist" aria-label="กรองตามสถานะ">
			{TABS.map((tab) => (
				<button key={tab} type="button" role="tab" aria-selected={value === tab} className="ka-jo-tab" onClick={() => onChange(tab)}>
					<span className="ka-jo-dot" style={{ background: STATUS_META[tab].color }} aria-hidden="true" />
					{STATUS_META[tab].label}
					<span className="ka-jo-tab__n numeric">{count(counts[tab])}</span>
				</button>
			))}
		</div>
	);
}
