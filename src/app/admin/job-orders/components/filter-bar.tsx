'use client';

import { useRef, useState } from 'react';
import FilterChip, { type FilterChipOption } from '@/components/FilterChip';
import Popover from '@/components/Popover';
import { formatThaiDate } from '@/lib/date-format';
import { toIsoDate, type ViewMode } from '../board-model';

type JobType = 'all' | 'website' | 'purchase';

interface FilterBarProps {
	isLoading: boolean;
	hasLoaded: boolean;
	viewMode: ViewMode;
	searchText: string;
	setSearchText: (value: string) => void;
	dateStart: string;
	dateEnd: string;
	setDateStart: (value: string) => void;
	setDateEnd: (value: string) => void;
	assigneeOptions: FilterChipOption[];
	selectedAssignee: string;
	setSelectedAssignee: (value: string) => void;
	selectedType: JobType;
	setSelectedType: (value: JobType) => void;
	sortDirection: 'ASC' | 'DESC';
	setSortDirection: (update: (value: 'ASC' | 'DESC') => 'ASC' | 'DESC') => void;
}

/** Search, target-date range with presets, assignee, type and sort, as chips above the board. */
export default function FilterBar({ isLoading, hasLoaded, viewMode, searchText, setSearchText, dateStart, dateEnd, setDateStart, setDateEnd, assigneeOptions, selectedAssignee, setSelectedAssignee, selectedType, setSelectedType, sortDirection, setSortDirection }: FilterBarProps) {
	const [rangeOpen, setRangeOpen] = useState(false);
	const rangeChipRef = useRef<HTMLButtonElement | null>(null);
	const rangeLabel = dateStart && dateEnd ? `${formatThaiDate(dateStart)} – ${formatThaiDate(dateEnd)}` : dateStart ? `ตั้งแต่ ${formatThaiDate(dateStart)}` : dateEnd ? `ถึง ${formatThaiDate(dateEnd)}` : 'ทุกวันเป้าหมาย';
	const activeChipCount = (selectedAssignee !== 'all' ? 1 : 0) + (selectedType !== 'all' ? 1 : 0) + (searchText.trim() ? 1 : 0);

	return (
	<div className="ka-fbar ka-fbar--page" aria-busy={isLoading}>
		<p role="status" className="sr-only">{isLoading && hasLoaded ? 'กำลังโหลดงานผลิต' : ''}</p>
		<div className="ka-input-wrap ka-fbar__search">
			<svg fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
			<input type="search" className="ka-input" aria-label="ค้นหางานผลิต" placeholder="ชื่องานหรือเลข JO" value={searchText} onChange={(e) => setSearchText(e.target.value)} />
		</div>
		{viewMode === 'board' && (
			<>
				<button ref={rangeChipRef} type="button" className="ka-chip" data-active={dateStart || dateEnd ? true : undefined} aria-haspopup="dialog" aria-expanded={rangeOpen} onClick={() => setRangeOpen((value) => !value)}>
					<svg fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><path d="M5 6h14v14H5zM5 10h14M9 4v4M15 4v4" /></svg>
					{rangeLabel}
				</button>
				<Popover open={rangeOpen} onClose={() => setRangeOpen(false)} anchorRef={rangeChipRef} title="เลือกช่วงวันเป้าหมาย" width={320}
					footer={
						<>
							<button type="button" className="ka-btn ka-btn--ghost ka-btn--sm" onClick={() => { setDateStart(''); setDateEnd(''); }}>ล้าง</button>
							<button type="button" className="ka-btn ka-btn--primary ka-btn--sm" onClick={() => setRangeOpen(false)}>ใช้ช่วงนี้</button>
						</>
					}
				>
					<div className="grid gap-3 p-1">
						<div className="flex flex-wrap gap-2">
							{[
								{ label: 'วันนี้', days: 0 },
								{ label: '7 วัน', days: 6 },
								{ label: 'เดือนนี้', days: -1 },
							].map((preset) => (
								<button
									key={preset.label}
									type="button"
									className="ka-chip"
									onClick={() => {
										const now = new Date();
										if (preset.days === -1) {
											setDateStart(toIsoDate(new Date(now.getFullYear(), now.getMonth(), 1)));
											setDateEnd(toIsoDate(new Date(now.getFullYear(), now.getMonth() + 1, 0)));
										} else {
											setDateStart(toIsoDate(new Date(now.getFullYear(), now.getMonth(), now.getDate() - preset.days)));
											setDateEnd(toIsoDate(now));
										}
									}}
								>
									{preset.label}
								</button>
							))}
						</div>
						<label className="ka-field"><span className="ka-label">ตั้งแต่</span><input type="date" className="ka-input" value={dateStart} onChange={(e) => setDateStart(e.target.value)} /></label>
						<label className="ka-field"><span className="ka-label">ถึง</span><input type="date" className="ka-input" value={dateEnd} min={dateStart || undefined} onChange={(e) => setDateEnd(e.target.value)} /></label>
					</div>
				</Popover>
			</>
		)}
		<FilterChip label="ผู้รับผิดชอบ" single options={assigneeOptions} selected={selectedAssignee === 'all' ? [] : [selectedAssignee]} onChange={(values) => setSelectedAssignee(values[0] ?? 'all')} />
		<FilterChip label="ประเภท" single options={[{ value: 'website', label: 'ขายบน Website' }, { value: 'purchase', label: 'ตามคำสั่งซื้อ' }]} selected={selectedType === 'all' ? [] : [selectedType]} onChange={(values) => setSelectedType((values[0] as JobType | undefined) ?? 'all')} />
		{activeChipCount > 0 && (
			<button type="button" className="ka-btn ka-btn--ghost" onClick={() => { setSearchText(''); setSelectedAssignee('all'); setSelectedType('all'); }}>ล้างตัวกรอง</button>
		)}
		<span className="ka-table-tools__spacer" />
		{viewMode === 'board' && (
			<button type="button" className="ka-chip" style={{ borderStyle: 'solid', borderRadius: 'var(--radius-control)' }} aria-label={`เรียงตามวันเป้าหมาย ${sortDirection === 'ASC' ? 'เก่าไปใหม่' : 'ใหม่ไปเก่า'}`} onClick={() => setSortDirection((value) => (value === 'ASC' ? 'DESC' : 'ASC'))}>
				<svg fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" d="M4 7h16M7 12h10M10 17h4" /></svg>
				วันเป้าหมาย {sortDirection === 'ASC' ? '↑' : '↓'}
			</button>
		)}
	</div>
	);
}
