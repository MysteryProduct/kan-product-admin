'use client';

import { useState } from 'react';
import Image from 'next/image';

interface Product {
  id: number;
  name: string;
  description: string;
  assignedTo: {
    name: string;
    avatar: string;
  };
  status: 'In Stock' | 'Pending' | 'Out of Stock';
  date: string;
  price: number;
  category: string;
}

const mockProducts: Product[] = [
  {
    id: 1,
    name: 'Wireless Headphones Pro',
    description: 'Premium noise-cancelling headphones with 30h battery...',
    assignedTo: { name: 'Liam', avatar: '👨‍💼' },
    status: 'Out of Stock',
    date: 'Tue, Feb 21',
    price: 299.99,
    category: 'Electronics'
  },
  {
    id: 2,
    name: 'Smart Watch Ultra',
    description: 'Advanced fitness tracking with heart rate monitor...',
    assignedTo: { name: 'Steve', avatar: '👨‍💻' },
    status: 'Pending',
    date: 'Mon, Aug 17',
    price: 449.99,
    category: 'Wearables'
  },
  {
    id: 3,
    name: 'Laptop Stand Aluminum',
    description: 'Ergonomic laptop stand with adjustable height...',
    assignedTo: { name: 'Jack', avatar: '👨‍🎨' },
    status: 'In Stock',
    date: 'Sun, Nov 26',
    price: 79.99,
    category: 'Accessories'
  },
  {
    id: 4,
    name: 'Mechanical Keyboard RGB',
    description: 'Gaming keyboard with customizable RGB lighting...',
    assignedTo: { name: 'Steve', avatar: '👨‍💻' },
    status: 'Out of Stock',
    date: 'Sun, Sep 10',
    price: 159.99,
    category: 'Electronics'
  },
  {
    id: 5,
    name: 'Wireless Mouse Pro',
    description: 'Ergonomic wireless mouse with precision tracking...',
    assignedTo: { name: 'Liam', avatar: '👨‍💼' },
    status: 'Out of Stock',
    date: 'Fri, Jan 8',
    price: 89.99,
    category: 'Accessories'
  },
  {
    id: 6,
    name: 'USB-C Hub 7-in-1',
    description: 'Multi-port hub with HDMI, USB 3.0, and SD card...',
    assignedTo: { name: 'Jack', avatar: '👨‍🎨' },
    status: 'Pending',
    date: 'Sun, Oct 11',
    price: 49.99,
    category: 'Accessories'
  },
  {
    id: 7,
    name: 'Bluetooth Speaker Mini',
    description: 'Portable speaker with 360° sound and waterproof...',
    assignedTo: { name: 'Steve', avatar: '👨‍💻' },
    status: 'In Stock',
    date: 'Sun, Aug 21',
    price: 69.99,
    category: 'Audio'
  },
  {
    id: 8,
    name: 'Phone Case Premium',
    description: 'Shockproof case with military-grade protection...',
    assignedTo: { name: 'John', avatar: '👨‍🔧' },
    status: 'Out of Stock',
    date: 'Mon, Apr 29',
    price: 29.99,
    category: 'Accessories'
  },
];

type SortField = 'date' | 'price' | null;
type SortOrder = 'asc' | 'desc';

export default function ProductsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [sortField, setSortField] = useState<SortField>(null);
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      // Toggle order if same field
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      // Set new field with ascending order
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const totalProducts = mockProducts.length;
  const pendingProducts = mockProducts.filter(p => p.status === 'Pending').length;
  const inStockProducts = mockProducts.filter(p => p.status === 'In Stock').length;
  const outOfStockProducts = mockProducts.filter(p => p.status === 'Out of Stock').length;

  const parseDate = (dateStr: string): Date => {
    // Convert "Tue, Feb 21" format to Date object
    const months: { [key: string]: number } = {
      Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
      Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11
    };
    const parts = dateStr.split(' ');
    const month = months[parts[1]];
    const day = parseInt(parts[2]);
    return new Date(2026, month, day); // Using 2026 as current year
  };

  let filteredProducts = mockProducts.filter(product =>
    product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    product.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Apply sorting
  if (sortField) {
    filteredProducts = [...filteredProducts].sort((a, b) => {
      if (sortField === 'date') {
        const dateA = parseDate(a.date).getTime();
        const dateB = parseDate(b.date).getTime();
        return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
      } else if (sortField === 'price') {
        return sortOrder === 'asc' ? a.price - b.price : b.price - a.price;
      }
      return 0;
    });
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'In Stock':
        return 'bg-green-100 text-green-700';
      case 'Pending':
        return 'bg-orange-100 text-orange-700';
      case 'Out of Stock':
        return 'bg-red-100 text-red-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <div className="bg-gray-50 p-2 sm:p-4 md:p-6 lg:p-8">
      {/* Statistics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4 mb-4 sm:mb-6">
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl sm:rounded-2xl p-3 sm:p-6 shadow-sm">
          <div className="text-2xl sm:text-4xl font-bold text-blue-600 mb-1 sm:mb-2">{totalProducts}</div>
          <div className="text-xs sm:text-sm text-blue-700 font-medium">Total Products</div>
        </div>
        
        <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-xl sm:rounded-2xl p-3 sm:p-6 shadow-sm">
          <div className="text-2xl sm:text-4xl font-bold text-orange-600 mb-1 sm:mb-2">{pendingProducts}</div>
          <div className="text-xs sm:text-sm text-orange-700 font-medium">Pending Products</div>
        </div>
        
        <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl sm:rounded-2xl p-3 sm:p-6 shadow-sm">
          <div className="text-2xl sm:text-4xl font-bold text-green-600 mb-1 sm:mb-2">{inStockProducts}</div>
          <div className="text-xs sm:text-sm text-green-700 font-medium">In Stock</div>
        </div>
        
        <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-xl sm:rounded-2xl p-3 sm:p-6 shadow-sm">
          <div className="text-2xl sm:text-4xl font-bold text-red-600 mb-1 sm:mb-2">{outOfStockProducts}</div>
          <div className="text-xs sm:text-sm text-red-700 font-medium">Out of Stock</div>
        </div>
      </div>

      {/* Main Content Card */}
      <div className="bg-white rounded-xl sm:rounded-2xl shadow-sm overflow-hidden">
        {/* Search Bar */}
        <div className="p-3 sm:p-4 md:p-6 border-b border-gray-100">
          <div className="relative max-w-full sm:max-w-xs">
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
        </div>

        {/* Table */}
        <div className="overflow-x-auto -mx-2 sm:mx-0">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left px-2 sm:px-3 md:px-6 py-3 sm:py-4 text-xs sm:text-sm font-semibold text-gray-700 hidden sm:table-cell">Id</th>
                <th className="text-left px-2 sm:px-3 md:px-6 py-3 sm:py-4 text-xs sm:text-sm font-semibold text-gray-700">Product</th>
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
                <th className="text-left px-2 sm:px-3 md:px-6 py-3 sm:py-4 text-xs sm:text-sm font-semibold text-gray-700 hidden md:table-cell">
                  <button
                    onClick={() => handleSort('price')}
                    className="flex items-center gap-2 hover:text-blue-600 transition-colors"
                  >
                    Price
                    {sortField === 'price' && (
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
                    {sortField !== 'price' && (
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
              {filteredProducts.map((product, index) => (
                <tr
                  key={product.id}
                  className="bg-white border-b border-gray-50 hover:bg-gray-50 transition-colors"
                >
                  <td className="px-2 sm:px-3 md:px-6 py-3 sm:py-4 text-sm text-gray-600 hidden sm:table-cell">{product.id}</td>
                  <td className="px-2 sm:px-3 md:px-6 py-3 sm:py-4">
                    <div className="max-w-full sm:max-w-md">
                      <div className="font-semibold text-gray-900 mb-1 text-sm sm:text-base">{product.name}</div>
                      <div className="text-xs sm:text-sm text-gray-500 truncate hidden sm:block">{product.description}</div>
                    </div>
                  </td>
                  <td className="px-2 sm:px-3 md:px-6 py-3 sm:py-4 hidden lg:table-cell">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full flex items-center justify-center text-white text-sm">
                        {product.assignedTo.avatar}
                      </div>
                      <span className="text-sm font-medium text-gray-700">{product.assignedTo.name}</span>
                    </div>
                  </td>
                  <td className="px-2 sm:px-3 md:px-6 py-3 sm:py-4">
                    <span className={`inline-flex px-2 sm:px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(product.status)}`}>
                      {product.status}
                    </span>
                  </td>
                  <td className="px-2 sm:px-3 md:px-6 py-3 sm:py-4 text-sm text-gray-600 hidden md:table-cell">{product.date}</td>
                  <td className="px-2 sm:px-3 md:px-6 py-3 sm:py-4 text-sm font-semibold text-gray-900 hidden md:table-cell">${product.price}</td>
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
  );
}
