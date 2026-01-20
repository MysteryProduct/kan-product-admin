import React from 'react';
import ChartCard from './ChartCard';

interface Schedule {
  title: string;
  time: string;
  color: string;
  attendees: number;
}

const schedules: Schedule[] = [
  { title: 'Marketing Meeting', time: '08:30 - 10:00', color: 'bg-blue-500', attendees: 18 },
  { title: 'Applied mathematics', time: '10:15 - 11:45', color: 'bg-purple-500', attendees: 18 },
  { title: 'SEO Session with Team', time: '12:00 - 13:25', color: 'bg-green-500', attendees: 18 },
];

export default function UpcomingSchedules() {
  return (
    <ChartCard title="Upcoming Schedules">
      <div className="space-y-4">
        <div className="flex gap-2 border-b pb-4">
          <div className="flex-1 text-center">
            <div className="text-2xl font-bold text-gray-900">1</div>
            <div className="text-xs text-gray-500">To 3</div>
          </div>
          <div className="flex-1 text-center">
            <div className="text-2xl font-bold text-gray-900">4</div>
            <div className="text-xs text-gray-500">To 7</div>
          </div>
          <div className="flex-1 text-center bg-blue-50 rounded-lg py-2">
            <div className="text-2xl font-bold text-blue-600">8</div>
            <div className="text-xs text-blue-600">To 10</div>
          </div>
        </div>

        <div className="space-y-3">
          {schedules.map((schedule, index) => (
            <div key={index} className="flex gap-4 p-4 border rounded-lg hover:shadow-md transition">
              <div className={`w-1 ${schedule.color} rounded`}></div>
              <div className="flex-1">
                <h4 className="font-semibold text-gray-900 mb-1">{schedule.title}</h4>
                <p className="text-sm text-gray-500 mb-2">{schedule.time}</p>
                <div className="flex items-center gap-2">
                  <div className="flex -space-x-2">
                    {[1, 2, 3, 4].map((i) => (
                      <div
                        key={i}
                        className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 border-2 border-white"
                      ></div>
                    ))}
                  </div>
                  <span className="text-sm text-gray-600 font-medium">+{schedule.attendees}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </ChartCard>
  );
}
