import React from 'react';
import ChartCard from './ChartCard';
import StatusBadge, { type BadgeTone } from '@/components/StatusBadge';

interface Employee {
  name: string;
  role: string;
  rate: string;
  skill: string;
  status: string;
  statusTone: BadgeTone;
}

const employees: Employee[] = [
  { name: 'Mark J. Freeman', role: 'Developer', rate: '$80 / hour', skill: 'HTML', status: 'Available', statusTone: 'success' },
  { name: 'Nina R. Oldman', role: 'Designer', rate: '$70 / hour', skill: 'JavaScript', status: 'On Holiday', statusTone: 'info' },
  { name: 'Arya H. Shah', role: 'Developer', rate: '$40 / hour', skill: 'React', status: 'Absent', statusTone: 'danger' },
  { name: 'June R. Smith', role: 'Designer', rate: '$20 / hour', skill: 'Vuejs', status: 'On Leave', statusTone: 'warning' },
  { name: 'Deo K. Luis', role: 'Developer', rate: '$65 / hour', skill: 'Angular', status: 'Available', statusTone: 'success' },
];

export default function TopEmployees() {
  return (
    <ChartCard title="Top Employees">
      <div className="overflow-x-auto -mx-4 sm:mx-0">
        <table className="w-full min-w-[640px]">
          <thead>
            <tr className="border-b border-[var(--border)]">
              <th className="text-left py-2 sm:py-3 px-2 text-[13px] sm:text-sm font-semibold text-[var(--ink)]">Employee</th>
              <th className="text-left py-2 sm:py-3 px-2 text-[13px] sm:text-sm font-semibold text-[var(--ink)]">Rate</th>
              <th className="text-left py-2 sm:py-3 px-2 text-[13px] sm:text-sm font-semibold text-[var(--ink)]">Skill</th>
              <th className="text-left py-2 sm:py-3 px-2 text-[13px] sm:text-sm font-semibold text-[var(--ink)]">Status</th>
            </tr>
          </thead>
          <tbody>
            {employees.map((employee, index) => (
              <tr key={index} className="border-b border-[var(--border)] last:border-b-0 hover:bg-[var(--bg-subtle)]">
                <td className="py-3 sm:py-4 px-2">
                  <div className="flex items-center gap-2 sm:gap-3">
                    <div className="w-8 h-8 sm:w-10 sm:h-10 bg-[var(--bg-sidebar)] rounded-full flex items-center justify-center text-[var(--ink-on-sidebar-active)] text-[13px] sm:text-sm font-semibold">
                      {employee.name.split(' ').map(n => n[0]).join('')}
                    </div>
                    <div>
                      <p className="text-sm sm:text-base font-semibold text-[var(--ink)]">{employee.name}</p>
                      <p className="text-[13px] sm:text-sm text-[var(--ink-muted)]">{employee.role}</p>
                    </div>
                  </div>
                </td>
                <td className="py-3 sm:py-4 px-2 text-sm sm:text-base text-[var(--ink)]">{employee.rate}</td>
                <td className="py-3 sm:py-4 px-2">
                  <span className="px-2 sm:px-3 py-1 bg-[var(--brand-soft)] text-[var(--brand-ink)] rounded-full text-[13px] sm:text-sm font-medium">
                    {employee.skill}
                  </span>
                </td>
                <td className="py-3 sm:py-4 px-2">
                  <StatusBadge tone={employee.statusTone}>{employee.status}</StatusBadge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </ChartCard>
  );
}
