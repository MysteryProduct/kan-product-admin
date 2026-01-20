import React from 'react';
import ChartCard from './ChartCard';

interface Employee {
  name: string;
  role: string;
  rate: string;
  skill: string;
  status: string;
  statusColor: string;
}

const employees: Employee[] = [
  { name: 'Mark J. Freeman', role: 'Developer', rate: '$80 / hour', skill: 'HTML', status: 'Available', statusColor: 'bg-green-100 text-green-700' },
  { name: 'Nina R. Oldman', role: 'Designer', rate: '$70 / hour', skill: 'JavaScript', status: 'On Holiday', statusColor: 'bg-yellow-100 text-yellow-700' },
  { name: 'Arya H. Shah', role: 'Developer', rate: '$40 / hour', skill: 'React', status: 'Absent', statusColor: 'bg-red-100 text-red-700' },
  { name: 'June R. Smith', role: 'Designer', rate: '$20 / hour', skill: 'Vuejs', status: 'On Leave', statusColor: 'bg-orange-100 text-orange-700' },
  { name: 'Deo K. Luis', role: 'Developer', rate: '$65 / hour', skill: 'Angular', status: 'Available', statusColor: 'bg-green-100 text-green-700' },
];

export default function TopEmployees() {
  return (
    <ChartCard title="Top Employees">
      <div className="overflow-x-auto -mx-4 sm:mx-0">
        <table className="w-full min-w-[640px]">
          <thead>
            <tr className="border-b">
              <th className="text-left py-2 sm:py-3 px-2 text-xs sm:text-sm font-semibold text-gray-700">Employee</th>
              <th className="text-left py-2 sm:py-3 px-2 text-xs sm:text-sm font-semibold text-gray-700">Rate</th>
              <th className="text-left py-2 sm:py-3 px-2 text-xs sm:text-sm font-semibold text-gray-700">Skill</th>
              <th className="text-left py-2 sm:py-3 px-2 text-xs sm:text-sm font-semibold text-gray-700">Status</th>
            </tr>
          </thead>
          <tbody>
            {employees.map((employee, index) => (
              <tr key={index} className="border-b last:border-b-0 hover:bg-gray-50">
                <td className="py-3 sm:py-4 px-2">
                  <div className="flex items-center gap-2 sm:gap-3">
                    <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full flex items-center justify-center text-white text-xs sm:text-sm font-semibold">
                      {employee.name.split(' ').map(n => n[0]).join('')}
                    </div>
                    <div>
                      <p className="text-sm sm:text-base font-semibold text-gray-900">{employee.name}</p>
                      <p className="text-xs sm:text-sm text-gray-500">{employee.role}</p>
                    </div>
                  </div>
                </td>
                <td className="py-3 sm:py-4 px-2 text-sm sm:text-base text-gray-700">{employee.rate}</td>
                <td className="py-3 sm:py-4 px-2">
                  <span className="px-2 sm:px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs sm:text-sm font-medium">
                    {employee.skill}
                  </span>
                </td>
                <td className="py-3 sm:py-4 px-2">
                  <span className={`px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-medium ${employee.statusColor}`}>
                    {employee.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </ChartCard>
  );
}
