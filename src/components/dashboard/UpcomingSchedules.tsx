import React from 'react';
import ChartCard from './ChartCard';

interface Schedule {
  title: string;
  time: string;
  color: string;
  attendees: number;
}

const schedules: Schedule[] = [
  { title: 'Marketing Meeting', time: '08:30 - 10:00', color: 'bg-[var(--brand)]', attendees: 18 },
  { title: 'Applied mathematics', time: '10:15 - 11:45', color: 'bg-[var(--info)]', attendees: 18 },
  { title: 'SEO Session with Team', time: '12:00 - 13:25', color: 'bg-[var(--success)]', attendees: 18 },
];

export default function UpcomingSchedules() {
  return (
    <ChartCard title="Upcoming Schedules">
      <div className="space-y-4">
        <div className="flex gap-2 border-b border-[var(--border)] pb-4">
          <div className="flex-1 text-center">
            <div className="text-2xl font-bold text-[var(--ink)]">1</div>
            <div className="text-[13px] text-[var(--ink-muted)]">To 3</div>
          </div>
          <div className="flex-1 text-center">
            <div className="text-2xl font-bold text-[var(--ink)]">4</div>
            <div className="text-[13px] text-[var(--ink-muted)]">To 7</div>
          </div>
          <div className="flex-1 text-center bg-[var(--brand-soft)] rounded-lg py-2">
            <div className="text-2xl font-bold text-[var(--brand-ink)]">8</div>
            <div className="text-[13px] text-[var(--brand-ink)]">To 10</div>
          </div>
        </div>

        <div className="space-y-3">
          {schedules.map((schedule, index) => (
            <div key={index} className="flex gap-4 p-4 border border-[var(--border)] rounded-lg hover:shadow-md transition">
              <div className={`w-1 ${schedule.color} rounded`}></div>
              <div className="flex-1">
                <h4 className="font-semibold text-[var(--ink)] mb-1">{schedule.title}</h4>
                <p className="text-sm text-[var(--ink-muted)] mb-2">{schedule.time}</p>
                <div className="flex items-center gap-2">
                  <div className="flex -space-x-2">
                    {[1, 2, 3, 4].map((i) => (
                      <div
                        key={i}
                        className="w-8 h-8 rounded-full bg-[var(--bg-muted)] border-2 border-[var(--bg-surface)]"
                      ></div>
                    ))}
                  </div>
                  <span className="text-sm text-[var(--ink-muted)] font-medium">+{schedule.attendees}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </ChartCard>
  );
}
