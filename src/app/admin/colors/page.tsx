'use client';

import { useEffect, useState } from 'react';
import ColorModel from '@/models/color';
interface Color {
  id: number;
  name: string;
  hexCode: string;
  description: string;
  assignedTo: {
    name: string;
    avatar: string;
  };
  status: 'Active' | 'Pending' | 'Inactive';
  date: string;
  category: string;
}

const mockColors: Color[] = [
  {
    id: 1,
    name: 'Ocean Blue',
    hexCode: '#0077BE',
    description: 'Primary brand color for headers and buttons...',
    assignedTo: { name: 'Liam', avatar: '👨‍💼' },
    status: 'Active',
    date: 'Tue, Feb 21',
    category: 'Primary'
  },
  {
    id: 2,
    name: 'Sunset Orange',
    hexCode: '#FF6B35',
    description: 'Accent color for call-to-action elements...',
    assignedTo: { name: 'Steve', avatar: '👨‍💻' },
    status: 'Pending',
    date: 'Mon, Aug 17',
    category: 'Accent'
  },
  {
    id: 3,
    name: 'Forest Green',
    hexCode: '#2D6A4F',
    description: 'Success state and positive feedback color...',
    assignedTo: { name: 'Jack', avatar: '👨‍🎨' },
    status: 'Active',
    date: 'Sun, Nov 26',
    category: 'Secondary'
  },
  {
    id: 4,
    name: 'Royal Purple',
    hexCode: '#6A4C93',
    description: 'Premium features and special highlights...',
    assignedTo: { name: 'Steve', avatar: '👨‍💻' },
    status: 'Inactive',
    date: 'Sun, Sep 10',
    category: 'Accent'
  },
  {
    id: 5,
    name: 'Cherry Red',
    hexCode: '#C9184A',
    description: 'Error states and warning notifications...',
    assignedTo: { name: 'Liam', avatar: '👨‍💼' },
    status: 'Active',
    date: 'Fri, Jan 8',
    category: 'Alert'
  },
  {
    id: 6,
    name: 'Sunshine Yellow',
    hexCode: '#FFB703',
    description: 'Warning states and attention indicators...',
    assignedTo: { name: 'Jack', avatar: '👨‍🎨' },
    status: 'Pending',
    date: 'Sun, Oct 11',
    category: 'Alert'
  },
  {
    id: 7,
    name: 'Sky Blue',
    hexCode: '#48CAE4',
    description: 'Secondary buttons and informational elements...',
    assignedTo: { name: 'Steve', avatar: '👨‍💻' },
    status: 'Active',
    date: 'Sun, Aug 21',
    category: 'Secondary'
  },
  {
    id: 8,
    name: 'Slate Gray',
    hexCode: '#495057',
    description: 'Text and neutral backgrounds...',
    assignedTo: { name: 'John', avatar: '👨‍🔧' },
    status: 'Active',
    date: 'Mon, Apr 29',
    category: 'Neutral'
  },
];

type SortField = 'date' | 'name' | null;
type SortOrder = 'asc' | 'desc';

export default function ColorsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [sortField, setSortField] = useState<SortField>(null);
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');

  const [colors, setColors] = useState([]);
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  useEffect(() => {
    const fetchColors = async () => {
      const colorModel = new ColorModel();
      try {
        const data = await colorModel.getColors(currentPage, 10, searchQuery);
        setColors(data.data);
      } catch (error) {
        console.error('Failed to fetch colors:', error);
      }
    };

    fetchColors();
  }, []);

  const totalColors = mockColors.length;
  const activeColors = mockColors.filter(c => c.status === 'Active').length;
  const pendingColors = mockColors.filter(c => c.status === 'Pending').length;
  const inactiveColors = mockColors.filter(c => c.status === 'Inactive').length;

  const parseDate = (dateStr: string): Date => {
    const months: { [key: string]: number } = {
      Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
      Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11
    };
    const parts = dateStr.split(' ');
    const month = months[parts[1]];
    const day = parseInt(parts[2]);
    return new Date(2026, month, day);
  };

  let filteredColors = mockColors.filter(color =>
    color.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    color.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
    color.hexCode.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (sortField) {
    filteredColors = [...filteredColors].sort((a, b) => {
      if (sortField === 'date') {
        const dateA = parseDate(a.date).getTime();
        const dateB = parseDate(b.date).getTime();
        return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
      } else if (sortField === 'name') {
        return sortOrder === 'asc' 
          ? a.name.localeCompare(b.name)
          : b.name.localeCompare(a.name);
      }
      return 0;
    });
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Active':
        return 'bg-green-100 text-green-700';
      case 'Pending':
        return 'bg-orange-100 text-orange-700';
      case 'Inactive':
        return 'bg-red-100 text-red-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <div className="flex-1 bg-gray-50 p-2 sm:p-4 md:p-6 lg:p-8">
      {/* Statistics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4 mb-4 sm:mb-6">
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl sm:rounded-2xl p-3 sm:p-6 shadow-sm">
          <div className="text-2xl sm:text-4xl font-bold text-blue-600 mb-1 sm:mb-2">{totalColors}</div>
          <div className="text-xs sm:text-sm text-blue-700 font-medium">Total Colors</div>
        </div>
        
        <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl sm:rounded-2xl p-3 sm:p-6 shadow-sm">
          <div className="text-2xl sm:text-4xl font-bold text-green-600 mb-1 sm:mb-2">{activeColors}</div>
          <div className="text-xs sm:text-sm text-green-700 font-medium">Active Colors</div>
        </div>
        
        <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-xl sm:rounded-2xl p-3 sm:p-6 shadow-sm">
          <div className="text-2xl sm:text-4xl font-bold text-orange-600 mb-1 sm:mb-2">{pendingColors}</div>
          <div className="text-xs sm:text-sm text-orange-700 font-medium">Pending Colors</div>
        </div>
        
        <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-xl sm:rounded-2xl p-3 sm:p-6 shadow-sm">
          <div className="text-2xl sm:text-4xl font-bold text-red-600 mb-1 sm:mb-2">{inactiveColors}</div>
          <div className="text-xs sm:text-sm text-red-700 font-medium">Inactive Colors</div>
        </div>
      </div>

      {/* Main Content Card */}
      <div className="bg-white rounded-xl sm:rounded-2xl shadow-sm overflow-hidden">
        {/* Search Bar and Add Button */}
        <div className="p-3 sm:p-4 md:p-6 border-b border-gray-100">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-4">
            <div className="relative flex-1 max-w-full sm:max-w-xs">
              <input
                type="text"
                placeholder="Search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 placeholder:text-gray-400"
              />
              <svg
                className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>
            
            <button className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium whitespace-nowrap">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span>เพิ่มข้อมูล</span>
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto -mx-2 sm:mx-0">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left px-2 sm:px-3 md:px-6 py-3 sm:py-4 text-xs sm:text-sm font-semibold text-gray-700 hidden sm:table-cell">Id</th>
                <th className="text-left px-2 sm:px-3 md:px-6 py-3 sm:py-4 text-xs sm:text-sm font-semibold text-gray-700">
                  <button
                    onClick={() => handleSort('name')}
                    className="flex items-center gap-2 hover:text-blue-600 transition-colors"
                  >
                    Color
                    {sortField === 'name' && (
                      <svg
                        className={`w-4 h-4 transition-transform ${sortOrder === 'desc' ? 'rotate-180' : ''}`}
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                          clipRule="evenodd"
                        />
                      </svg>
                    )}
                    {sortField !== 'name' && (
                      <svg className="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M5 12a1 1 0 102 0V6.414l1.293 1.293a1 1 0 001.414-1.414l-3-3a1 1 0 00-1.414 0l-3 3a1 1 0 001.414 1.414L5 6.414V12zM15 8a1 1 0 10-2 0v5.586l-1.293-1.293a1 1 0 00-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L15 13.586V8z" />
                      </svg>
                    )}
                  </button>
                </th>
                <th className="text-left px-2 sm:px-3 md:px-6 py-3 sm:py-4 text-xs sm:text-sm font-semibold text-gray-700 hidden lg:table-cell">Assigned To</th>
                <th className="text-left px-2 sm:px-3 md:px-6 py-3 sm:py-4 text-xs sm:text-sm font-semibold text-gray-700">Status</th>
                <th className="text-left px-2 sm:px-3 md:px-6 py-3 sm:py-4 text-xs sm:text-sm font-semibold text-gray-700 hidden md:table-cell">
                  <button
                    onClick={() => handleSort('date')}
                    className="flex items-center gap-2 hover:text-blue-600 transition-colors"
                  >
                    Date
                    {sortField === 'date' && (
                      <svg
                        className={`w-4 h-4 transition-transform ${sortOrder === 'desc' ? 'rotate-180' : ''}`}
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                          clipRule="evenodd"
                        />
                      </svg>
                    )}
                    {sortField !== 'date' && (
                      <svg className="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M5 12a1 1 0 102 0V6.414l1.293 1.293a1 1 0 001.414-1.414l-3-3a1 1 0 00-1.414 0l-3 3a1 1 0 001.414 1.414L5 6.414V12zM15 8a1 1 0 10-2 0v5.586l-1.293-1.293a1 1 0 00-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L15 13.586V8z" />
                      </svg>
                    )}
                  </button>
                </th>
                <th className="text-left px-2 sm:px-3 md:px-6 py-3 sm:py-4 text-xs sm:text-sm font-semibold text-gray-700">Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredColors.map((color, index) => (
                <tr
                  key={color.id}
                  className="bg-white border-b border-gray-50 hover:bg-gray-50 transition-colors"
                >
                  <td className="px-2 sm:px-3 md:px-6 py-3 sm:py-4 text-sm text-gray-600 hidden sm:table-cell">{color.id}</td>
                  <td className="px-2 sm:px-3 md:px-6 py-3 sm:py-4">
                    <div className="flex items-center gap-2 sm:gap-3 md:gap-4">
                      <div
                        className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 rounded-lg shadow-sm border-2 border-gray-200 flex-shrink-0"
                        style={{ backgroundColor: color.hexCode }}
                        title={color.hexCode}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold text-gray-900 mb-1 text-sm sm:text-base">{color.name}</div>
                        <div className="text-xs sm:text-sm text-gray-500 truncate hidden sm:block">{color.description}</div>
                        <div className="text-xs text-gray-400 mt-1 font-mono">{color.hexCode}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-2 sm:px-3 md:px-6 py-3 sm:py-4 hidden lg:table-cell">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full flex items-center justify-center text-white text-sm">
                        {color.assignedTo.avatar}
                      </div>
                      <span className="text-sm font-medium text-gray-700">{color.assignedTo.name}</span>
                    </div>
                  </td>
                  <td className="px-2 sm:px-3 md:px-6 py-3 sm:py-4">
                    <span className={`inline-flex px-2 sm:px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(color.status)}`}>
                      {color.status}
                    </span>
                  </td>
                  <td className="px-2 sm:px-3 md:px-6 py-3 sm:py-4 text-sm text-gray-600 hidden md:table-cell">{color.date}</td>
                  <td className="px-2 sm:px-3 md:px-6 py-3 sm:py-4">
                    <button className="text-gray-400 hover:text-red-500 transition-colors">
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path
                          fillRule="evenodd"
                          d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="px-2 sm:px-4 md:px-6 py-3 sm:py-4 border-t border-gray-100">
          <div className="flex items-center justify-center gap-1 sm:gap-2">
            <button
              className="w-8 h-8 flex items-center justify-center rounded hover:bg-gray-100 transition-colors"
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
            >
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>

            {[1, 2, 3, 4, 5].map((page) => (
              <button
                key={page}
                onClick={() => setCurrentPage(page)}
                className={`w-8 h-8 flex items-center justify-center rounded transition-colors ${
                  currentPage === page
                    ? 'bg-blue-500 text-white'
                    : 'hover:bg-gray-100 text-gray-700'
                }`}
              >
                {page}
              </button>
            ))}

            <span className="text-gray-400 mx-1">...</span>

            <button
              onClick={() => setCurrentPage(10)}
              className="w-8 h-8 flex items-center justify-center rounded hover:bg-gray-100 text-gray-700 transition-colors"
            >
              10
            </button>

            <button
              className="w-8 h-8 flex items-center justify-center rounded hover:bg-gray-100 transition-colors"
              onClick={() => setCurrentPage(currentPage + 1)}
            >
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
