'use client';

import { BOARD_COLUMNS, type ViewMode } from '../board-model';

/** Placeholder shapes of the open view while its first load runs. */
export function ViewSkeleton({ viewMode }: { viewMode: ViewMode }) {
	if (viewMode === 'list') {
		return (
			<section className="ka-card ka-jo-list" aria-busy="true" aria-label="กำลังโหลดรายการงานผลิต">
				{[0, 1, 2, 3, 4].map((row) => (
					<div key={row} className="ka-jo-row ka-jo-row--skel"><span className="ka-skel" style={{ height: 20 }} /><span className="ka-skel ka-jo-row__type" style={{ height: 20 }} /><span className="ka-skel ka-jo-row__qty" style={{ height: 20 }} /><span className="ka-skel ka-jo-row__due" style={{ height: 20 }} /><span className="ka-skel ka-jo-row__own" style={{ height: 20 }} /><span className="ka-skel" style={{ height: 32 }} /></div>
				))}
			</section>
		);
	}
	if (viewMode === 'calendar') {
		return (
			<div className="ka-cal ka-jo-cal" aria-busy="true" aria-label="กำลังโหลดปฏิทินงานผลิต">
				<span className="ka-skel" style={{ height: 520 }} />
				<span className="ka-skel" style={{ height: 240 }} />
			</div>
		);
	}
	return (
		<div className="ka-board" aria-busy="true" aria-label="กำลังโหลดบอร์ดงานผลิต">
			{BOARD_COLUMNS.map((column) => (
				<section key={column.key} className="ka-col" style={{ ['--c' as string]: column.color }}>
					<div className="ka-col__head"><b>{column.label}</b></div>
					<span className="ka-skel" style={{ height: 96 }} />
					<span className="ka-skel" style={{ height: 96 }} />
				</section>
			))}
		</div>
	);
}

/** Nothing has a target date in the chosen range. */
export function NoJobsState({ canAdd, onCreate }: { canAdd: boolean; onCreate: () => void }) {
	return (
		<div className="ka-card ka-empty">
			<span className="ka-empty__art" aria-hidden="true">
				<svg fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 5h4v14H4zM10 5h4v9h-4zM16 5h4v12h-4z" /></svg>
			</span>
			<strong>ยังไม่มีงานผลิตในช่วงนี้</strong>
			<span>เลือกช่วงวันเป้าหมายอื่น หรือสร้างงานใหม่</span>
			{canAdd && <button type="button" className="ka-btn ka-btn--primary ka-empty__action" onClick={onCreate}>สร้างงานผลิต</button>}
		</div>
	);
}

/** Jobs exist in the range, but none pass the filters; says which filters are on. */
export function NoMatchState({ filters, onClear }: { filters: string[]; onClear: () => void }) {
	return (
		<div className="ka-card ka-empty" role="status">
			<span className="ka-empty__art" aria-hidden="true">
				<svg fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
			</span>
			<strong>ไม่พบงานที่ตรงกับตัวกรอง</strong>
			{filters.length > 0 && <span>กรองอยู่: {filters.join(' · ')}</span>}
			<button type="button" className="ka-btn ka-empty__action" onClick={onClear}>ล้างตัวกรอง</button>
		</div>
	);
}
