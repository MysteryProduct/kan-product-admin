'use client';

import { count } from '../board-model';

/** Shown while jobs are past their target day, with a shortcut to the overdue list. */
export default function OverdueBanner({ overdue, onShow }: { overdue: number; onShow: () => void }) {
	if (overdue <= 0) return null;
	return (
		<div className="ka-jo-alert" role="status">
			<svg fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4l9 16H3zM12 10v4M12 17h.01" /></svg>
			<span className="ka-jo-alert__text"><b>เลยกำหนด {count(overdue)} งาน</b> · ควรอัปเดตสถานะหรือเลื่อนวันเป้าหมาย</span>
			<button type="button" className="ka-btn ka-btn--sm" onClick={onShow}>ดูงานที่เลยกำหนด</button>
		</div>
	);
}
