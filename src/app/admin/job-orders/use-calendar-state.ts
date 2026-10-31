import { useMemo, useState } from 'react';
import { bangkokDayKey, parseCalendarMonth, toIsoDate } from './board-model';

const monthOf = (dayKey: string) => dayKey.slice(0, 7);

/** The calendar's month and chosen day; choosing a day of another month moves the month with it. */
export function useCalendarState() {
	const todayKey = bangkokDayKey(new Date()) ?? toIsoDate(new Date());
	const [calendarMonth, setCalendarMonth] = useState(() => monthOf(todayKey));
	const [selectedDay, setSelectedDay] = useState(todayKey);

	const monthDate = useMemo(() => parseCalendarMonth(calendarMonth), [calendarMonth]);
	const monthRange = useMemo(
		() => ({ start: toIsoDate(monthDate), end: toIsoDate(new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0)) }),
		[monthDate],
	);

	const selectDay = (dayKey: string) => {
		setSelectedDay(dayKey);
		if (monthOf(dayKey) !== calendarMonth) setCalendarMonth(monthOf(dayKey));
	};

	// The day panel only knows the month on screen, so moving the month also moves the chosen day:
	// to today in the current month, otherwise to the 1st.
	const moveMonth = (direction: -1 | 1) => {
		const next = new Date(monthDate.getFullYear(), monthDate.getMonth() + direction, 1);
		const key = toIsoDate(next).slice(0, 7);
		setCalendarMonth(key);
		setSelectedDay(key === monthOf(todayKey) ? todayKey : `${key}-01`);
	};

	const goToday = () => selectDay(todayKey);

	return { todayKey, monthDate, monthRange, selectedDay, selectDay, moveMonth, goToday };
}
