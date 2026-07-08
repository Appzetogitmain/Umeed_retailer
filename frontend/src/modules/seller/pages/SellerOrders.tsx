import { useState, useEffect, useMemo, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { getOrders, Order, GetOrdersParams } from '../../../services/api/orderService';
import { jsPDF } from 'jspdf';


type SortField = 'orderId' | 'deliveryDate' | 'orderDate' | 'status' | 'amount';
type SortDirection = 'asc' | 'desc';

export default function SellerOrders() {
  const navigate = useNavigate();
  const location = useLocation();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const fromDateRef = useRef<HTMLInputElement>(null);
  const toDateRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState(location.state?.status || 'All Status');
  const [entriesPerPage, setEntriesPerPage] = useState('10');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [isExportDropdownOpen, setIsExportDropdownOpen] = useState(false);

  // Fetch orders from API
  useEffect(() => {
    const fetchOrders = async () => {
      setLoading(true);
      setError('');
      try {
        const params: GetOrdersParams = {
          page: currentPage,
          limit: parseInt(entriesPerPage),
          sortBy: sortField || 'orderDate',
          sortOrder: sortDirection,
        };

        // Parse date range
        if (dateFrom && dateTo) {
          params.dateFrom = dateFrom;
          params.dateTo = dateTo;
        }

        // Add status filter
        if (status !== 'All Status') {
          params.status = status;
        }

        // Add search
        if (searchQuery) {
          params.search = searchQuery;
        }

        const response = await getOrders(params);
        if (response.success && response.data) {
          setOrders(response.data);
        } else {
          setError(response.message || 'Failed to fetch orders');
        }
      } catch (err: any) {
        setError(err.response?.data?.message || err.message || 'Failed to fetch orders');
      } finally {
        setLoading(false);
      }
    };

    fetchOrders();
  }, [dateFrom, dateTo, status, entriesPerPage, searchQuery, currentPage, sortField, sortDirection]);

  const handleClearDate = () => {
    setDateFrom('');
    setDateTo('');
    setCurrentPage(1);
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const filteredAndSortedOrders = useMemo(() => {
    let result = [...orders];

    // Client-side filtering as fallback/enhancement
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(order =>
        order.orderId?.toLowerCase().includes(query) ||
        order.status?.toLowerCase().includes(query) ||
        order.amount?.toString().includes(query)
      );
    }
    
    if (status !== 'All Status') {
      result = result.filter(order => order.status === status);
    }

    if (dateFrom && dateTo) {
      const start = new Date(dateFrom).getTime();
      const end = new Date(dateTo).getTime();
      // adjust end to include the whole day
      const adjustedEnd = end + (24 * 60 * 60 * 1000) - 1;
      
      result = result.filter(order => {
        if (!order.orderDate) return true;
        const orderTime = new Date(order.orderDate).getTime();
        return orderTime >= start && orderTime <= adjustedEnd;
      });
    }

    // Apply sorting
    if (sortField) {
      result.sort((a, b) => {
        let aVal = a[sortField];
        let bVal = b[sortField];
        if (aVal == null) aVal = "";
        if (bVal == null) bVal = "";
        
        if (sortField === 'amount') {
          return sortDirection === 'asc' ? (Number(aVal) - Number(bVal)) : (Number(bVal) - Number(aVal));
        }

        return sortDirection === 'asc' 
          ? String(aVal).localeCompare(String(bVal))
          : String(bVal).localeCompare(String(aVal));
      });
    }

    return result;
  }, [orders, searchQuery, status, dateFrom, dateTo, sortField, sortDirection]);

  const handleExportCSV = () => {
    // Create CSV content
    const headers = ['Order ID', 'Delivery Date', 'Order Date', 'Status', 'Amount'];
    const csvContent = [
      headers.join(','),
      ...filteredAndSortedOrders.map(order =>
        [order.orderId, order.deliveryDate, order.orderDate, order.status, order.amount].join(',')
      )
    ].join('\n');

    // Create blob and download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `orders_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportExcel = () => {
    const headers = ['Order ID', 'Delivery Date', 'Order Date', 'Status', 'Amount'];
    const csvContent = [
      headers.join(','),
      ...filteredAndSortedOrders.map(order =>
        [order.orderId, order.deliveryDate, order.orderDate, order.status, order.amount].join(',')
      )
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `orders_${new Date().toISOString().split('T')[0]}.xls`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportPDF = () => {
    const doc = new jsPDF();
    doc.setFont("helvetica");
    doc.setFontSize(16);
    doc.text("Speedoo - Seller Orders Export", 14, 15);
    doc.setFontSize(10);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 22);

    let y = 30;
    const cols = ["Order ID", "Delivery Date", "Order Date", "Status", "Amount"];
    doc.setFont("helvetica", "bold");
    let x = 14;
    cols.forEach((col, idx) => {
      let width = 35;
      if (idx === 0) width = 45;
      if (idx === 3) width = 30;
      doc.text(col, x, y);
      x += width;
    });

    y += 8;
    doc.line(14, y - 4, 195, y - 4);

    doc.setFont("helvetica", "normal");
    filteredAndSortedOrders.forEach(order => {
      if (y > 280) {
        doc.addPage();
        y = 20;
      }
      x = 14;
      
      const row = [
        order.orderId || "N/A",
        order.deliveryDate || "N/A",
        order.orderDate || "N/A",
        order.status || "N/A",
        order.amount ? `Rs. ${order.amount}` : "Rs. 0"
      ];

      row.forEach((col, idx) => {
        let width = 35;
        if (idx === 0) width = 45;
        if (idx === 3) width = 30;
        doc.text(String(col), x, y);
        x += width;
      });
      y += 8;
    });

    doc.save(`orders_${new Date().toISOString().split("T")[0]}.pdf`);
  };

  // Pagination (client-side for now, can be moved to backend later)
  const entriesPerPageNum = parseInt(entriesPerPage);
  const totalPages = Math.max(1, Math.ceil(filteredAndSortedOrders.length / entriesPerPageNum));
  const startIndex = (currentPage - 1) * entriesPerPageNum;
  const endIndex = startIndex + entriesPerPageNum;
  const paginatedOrders = filteredAndSortedOrders.slice(startIndex, endIndex);

  const handlePreviousPage = () => {
    setCurrentPage(prev => Math.max(1, prev - 1));
  };

  const handleNextPage = () => {
    setCurrentPage(prev => Math.min(totalPages, prev + 1));
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'Accepted':
        return 'bg-blue-100 text-blue-800';
      case 'On the way':
        return 'bg-purple-100 text-purple-800';
      case 'Delivered':
        return 'bg-green-100 text-green-800';
      case 'Cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-neutral-100 text-neutral-800';
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6 -mx-3 sm:-mx-4 md:-mx-6 -mt-3 sm:-mt-4 md:-mt-6">
      {/* Header Section */}
      <div className="bg-white border-b border-neutral-200 px-3 sm:px-4 md:px-6 py-3 sm:py-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-0">
          {/* Page Title */}
          <h1 className="text-xl sm:text-2xl font-bold text-neutral-900">Orders List</h1>

          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-xs sm:text-sm">
            <Link to="/seller" className="text-blue-600 hover:text-blue-700">
              Home
            </Link>
            <span className="text-neutral-500">/</span>
            <span className="text-neutral-700">Orders List</span>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="px-3 sm:px-4 md:px-6">
        {/* White Card Container */}
        <div className="bg-white rounded-lg shadow-sm border border-neutral-200 overflow-hidden">
          {/* Green Banner */}
          <div className="bg-green-600 text-white px-4 sm:px-6 py-2 sm:py-3 rounded-t-lg">
            <h2 className="text-base sm:text-lg font-semibold">View Order List</h2>
          </div>

          {/* Filter and Action Bar */}
          <div className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 border-b border-neutral-200">
            <div className="flex flex-col sm:flex-row flex-wrap items-start sm:items-center gap-3 sm:gap-4">
              {/* Date Range Filter */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 w-full lg:w-auto">
                <label className="text-xs sm:text-sm font-medium text-neutral-700 whitespace-nowrap">
                  From - To Order Date
                </label>
                <div className="flex items-center gap-2 bg-white border border-neutral-300 rounded px-2 sm:px-3 py-1 sm:py-1.5 w-full sm:w-auto">
                  <div className="flex items-center gap-1">
                    <button 
                      onClick={() => fromDateRef.current?.showPicker?.() || fromDateRef.current?.focus()}
                      className="p-1 hover:bg-neutral-100 rounded transition-colors"
                    >
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                        className="text-neutral-500 flex-shrink-0">
                        <path
                          d="M8 2V6M16 2V6M3 10H21M5 4H19C20.1046 4 21 4.89543 21 6V20C21 21.1046 20.1046 22 19 22H5C3.89543 22 3 21.1046 3 20V6C3 4.89543 3.89543 4 5 4Z"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </button>
                    <input
                      type="date"
                      ref={fromDateRef}
                      value={dateFrom}
                      onChange={(e) => {
                        setDateFrom(e.target.value);
                        setCurrentPage(1);
                      }}
                      max={dateTo || undefined}
                      className="border-none focus-visible:ring-0 h-8 text-xs w-28 p-0 bg-transparent focus:outline-none"
                    />
                  </div>
                  <span className="text-neutral-400 font-medium text-xs sm:text-sm">-</span>
                  <div className="flex items-center gap-1">
                    <button 
                      onClick={() => toDateRef.current?.showPicker?.() || toDateRef.current?.focus()}
                      className="p-1 hover:bg-neutral-100 rounded transition-colors"
                    >
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                        className="text-neutral-500 flex-shrink-0">
                        <path
                          d="M8 2V6M16 2V6M3 10H21M5 4H19C20.1046 4 21 4.89543 21 6V20C21 21.1046 20.1046 22 19 22H5C3.89543 22 3 21.1046 3 20V6C3 4.89543 3.89543 4 5 4Z"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </button>
                    <input
                      type="date"
                      ref={toDateRef}
                      value={dateTo}
                      onChange={(e) => {
                        setDateTo(e.target.value);
                        setCurrentPage(1);
                      }}
                      min={dateFrom || undefined}
                      className="border-none focus-visible:ring-0 h-8 text-xs w-28 p-0 bg-transparent focus:outline-none"
                    />
                  </div>
                </div>
                {(dateFrom || dateTo) && (
                  <button
                    onClick={handleClearDate}
                    className="px-2 py-1 text-xs font-medium text-neutral-700 bg-neutral-200 hover:bg-neutral-300 rounded transition-colors">
                    Clear
                  </button>
                )}
              </div>

              {/* Status Filter */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 w-full sm:w-auto">
                <label className="text-xs sm:text-sm font-medium text-neutral-700 whitespace-nowrap">
                  Status
                </label>
                <select
                  value={status}
                  onChange={(e) => {
                    setStatus(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full sm:w-auto px-3 py-2 border border-neutral-300 rounded text-xs sm:text-sm text-neutral-900 bg-white focus:outline-none focus:ring-1 focus:ring-green-500 focus:border-green-500"
                >
                  <option>All Status</option>
                  <option>Pending</option>
                  <option>Accepted</option>
                  <option>On the way</option>
                  <option>Delivered</option>
                  <option>Cancelled</option>
                </select>
              </div>

              {/* Entries Per Page */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 w-full sm:w-auto">
                <select
                  value={entriesPerPage}
                  onChange={(e) => {
                    setEntriesPerPage(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full sm:w-auto px-3 py-2 border border-neutral-300 rounded text-xs sm:text-sm text-neutral-900 bg-white focus:outline-none focus:ring-1 focus:ring-green-500 focus:border-green-500"
                >
                  <option>10</option>
                  <option>25</option>
                  <option>50</option>
                  <option>100</option>
                </select>
              </div>

              {/* Search Bar */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 w-full sm:w-auto sm:flex-1">
                <label className="text-xs sm:text-sm font-medium text-neutral-700 whitespace-nowrap">
                  Search:
                </label>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="flex-1 w-full sm:w-auto px-3 py-2 border border-neutral-300 rounded text-xs sm:text-sm text-neutral-900 bg-white focus:outline-none focus:ring-1 focus:ring-green-500 focus:border-green-500"
                  placeholder="Search by Order ID, Status, or Amount"
                />
              </div>

              {/* Export Button */}
              <div className="flex items-center gap-2 w-full lg:w-auto lg:ml-auto">
                <div className="relative">
                  <button
                    onClick={() => setIsExportDropdownOpen(!isExportDropdownOpen)}
                    className="flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white px-3 sm:px-4 py-2 rounded text-xs sm:text-sm font-medium transition-colors w-full sm:w-auto"
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                      className="flex-shrink-0"
                    >
                      <path
                        d="M21 15V19C21 20.1046 20.1046 21 19 21H5C3.89543 21 3 20.1046 3 19V15M7 10L12 15M12 15L17 10M12 15V3"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    <span className="hidden sm:inline">Export</span>
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                      className="hidden sm:block flex-shrink-0"
                    >
                      <path
                        d="M6 9L12 15L18 9"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>

                  {isExportDropdownOpen && (
                    <>
                      <div
                        className="fixed inset-0 z-10"
                        onClick={() => setIsExportDropdownOpen(false)}
                      />
                      <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-neutral-200 py-1 z-20">
                        <button
                          onClick={() => {
                            handleExportCSV();
                            setIsExportDropdownOpen(false);
                          }}
                          className="w-full text-left px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-50 transition-colors">
                          Export as CSV
                        </button>
                        <button
                          onClick={() => {
                            handleExportExcel();
                            setIsExportDropdownOpen(false);
                          }}
                          className="w-full text-left px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-50 transition-colors">
                          Export as Excel
                        </button>
                        <button
                          onClick={() => {
                            handleExportPDF();
                            setIsExportDropdownOpen(false);
                          }}
                          className="w-full text-left px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-50 transition-colors">
                          Export as PDF
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Loading and Error States */}
          {loading && (
            <div className="flex items-center justify-center p-8">
              <div className="text-neutral-500">Loading orders...</div>
            </div>
          )}
          {error && !loading && (
            <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg m-4">
              {error}
            </div>
          )}

          {/* Table */}
          {!loading && !error && (
            <div className="overflow-x-auto -mx-3 sm:-mx-4 md:-mx-6 px-3 sm:px-4 md:px-6">
              <table className="w-full min-w-[600px]">
                <thead className="bg-neutral-50 border-b border-neutral-200">
                  <tr>
                    <th className="px-3 sm:px-4 md:px-6 py-2 sm:py-3 text-left text-xs font-semibold text-neutral-700 uppercase tracking-wider">
                      <button
                        onClick={() => handleSort('orderId')}
                        className="flex items-center gap-2 hover:text-neutral-900 transition-colors"
                      >
                        O. Id
                        <svg
                          width="12"
                          height="12"
                          viewBox="0 0 24 24"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                          className={`cursor-pointer ${sortField === 'orderId' ? 'text-green-600' : 'text-neutral-400'
                            }`}
                        >
                          <path
                            d={sortField === 'orderId' && sortDirection === 'asc'
                              ? "M7 14L12 9L17 14"
                              : sortField === 'orderId' && sortDirection === 'desc'
                                ? "M7 10L12 15L17 10"
                                : "M7 10L12 5L17 10M7 14L12 19L17 14"}
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </button>
                    </th>
                    <th className="px-3 sm:px-4 md:px-6 py-2 sm:py-3 text-left text-xs font-semibold text-neutral-700 uppercase tracking-wider">
                      <button
                        onClick={() => handleSort('deliveryDate')}
                        className="flex items-center gap-2 hover:text-neutral-900 transition-colors"
                      >
                        D. Date
                        <svg
                          width="12"
                          height="12"
                          viewBox="0 0 24 24"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                          className={`cursor-pointer ${sortField === 'deliveryDate' ? 'text-green-600' : 'text-neutral-400'
                            }`}
                        >
                          <path
                            d={sortField === 'deliveryDate' && sortDirection === 'asc'
                              ? "M7 14L12 9L17 14"
                              : sortField === 'deliveryDate' && sortDirection === 'desc'
                                ? "M7 10L12 15L17 10"
                                : "M7 10L12 5L17 10M7 14L12 19L17 14"}
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </button>
                    </th>
                    <th className="px-3 sm:px-4 md:px-6 py-2 sm:py-3 text-left text-xs font-semibold text-neutral-700 uppercase tracking-wider">
                      <button
                        onClick={() => handleSort('orderDate')}
                        className="flex items-center gap-2 hover:text-neutral-900 transition-colors"
                      >
                        O. Date
                        <svg
                          width="12"
                          height="12"
                          viewBox="0 0 24 24"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                          className={`cursor-pointer ${sortField === 'orderDate' ? 'text-green-600' : 'text-neutral-400'
                            }`}
                        >
                          <path
                            d={sortField === 'orderDate' && sortDirection === 'asc'
                              ? "M7 14L12 9L17 14"
                              : sortField === 'orderDate' && sortDirection === 'desc'
                                ? "M7 10L12 15L17 10"
                                : "M7 10L12 5L17 10M7 14L12 19L17 14"}
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </button>
                    </th>
                    <th className="px-3 sm:px-4 md:px-6 py-2 sm:py-3 text-left text-xs font-semibold text-neutral-700 uppercase tracking-wider">
                      <button
                        onClick={() => handleSort('status')}
                        className="flex items-center gap-2 hover:text-neutral-900 transition-colors"
                      >
                        Status
                        <svg
                          width="12"
                          height="12"
                          viewBox="0 0 24 24"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                          className={`cursor-pointer ${sortField === 'status' ? 'text-green-600' : 'text-neutral-400'
                            }`}
                        >
                          <path
                            d={sortField === 'status' && sortDirection === 'asc'
                              ? "M7 14L12 9L17 14"
                              : sortField === 'status' && sortDirection === 'desc'
                                ? "M7 10L12 15L17 10"
                                : "M7 10L12 5L17 10M7 14L12 19L17 14"}
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </button>
                    </th>
                    <th className="px-3 sm:px-4 md:px-6 py-2 sm:py-3 text-left text-xs font-semibold text-neutral-700 uppercase tracking-wider">
                      <button
                        onClick={() => handleSort('amount')}
                        className="flex items-center gap-2 hover:text-neutral-900 transition-colors"
                      >
                        Amount
                        <svg
                          width="12"
                          height="12"
                          viewBox="0 0 24 24"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                          className={`cursor-pointer ${sortField === 'amount' ? 'text-green-600' : 'text-neutral-400'
                            }`}
                        >
                          <path
                            d={sortField === 'amount' && sortDirection === 'asc'
                              ? "M7 14L12 9L17 14"
                              : sortField === 'amount' && sortDirection === 'desc'
                                ? "M7 10L12 15L17 10"
                                : "M7 10L12 5L17 10M7 14L12 19L17 14"}
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </button>
                    </th>
                    <th className="px-3 sm:px-4 md:px-6 py-2 sm:py-3 text-left text-xs font-semibold text-neutral-700 uppercase tracking-wider">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-neutral-200">
                  {paginatedOrders.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-3 sm:px-4 md:px-6 py-8 sm:py-12 text-center text-xs sm:text-sm text-neutral-500">
                        No data available in table
                      </td>
                    </tr>
                  ) : (
                    paginatedOrders.map((order) => (
                      <tr key={order.id} className="hover:bg-neutral-50 transition-colors">
                        <td className="px-3 sm:px-4 md:px-6 py-3 text-xs sm:text-sm text-neutral-900">
                          {order.orderId}
                        </td>
                        <td className="px-3 sm:px-4 md:px-6 py-3 text-xs sm:text-sm text-neutral-700">
                          {order.deliveryDate}
                        </td>
                        <td className="px-3 sm:px-4 md:px-6 py-3 text-xs sm:text-sm text-neutral-700">
                          {order.orderDate}
                        </td>
                        <td className="px-3 sm:px-4 md:px-6 py-3">
                          <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(order.status)}`}>
                            {order.status}
                          </span>
                        </td>
                        <td className="px-3 sm:px-4 md:px-6 py-3 text-xs sm:text-sm text-neutral-900 font-medium">
                          ₹{order.amount.toFixed(2)}
                        </td>
                        <td className="px-3 sm:px-4 md:px-6 py-3">
                          <button
                            onClick={() => navigate(`/seller/orders/${order.id}`)}
                            className="text-green-600 hover:text-green-700 text-xs sm:text-sm font-medium transition-colors"
                          >
                            View
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          <div className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 border-t border-neutral-200 flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-0">
              <span className="text-sm text-neutral-700">
                Showing <span className="font-medium">{filteredAndSortedOrders.length > 0 ? startIndex + 1 : 0}</span> to{" "}
                <span className="font-medium">
                  {Math.min(endIndex, filteredAndSortedOrders.length)}
                </span>{" "}
                of <span className="font-medium">{filteredAndSortedOrders.length}</span>{" "}
                entries
              </span>
            <div className="flex items-center gap-2">
              <button
                onClick={handlePreviousPage}
                disabled={currentPage === 1}
                className={`p-2 border border-neutral-300 rounded transition-colors ${currentPage === 1
                  ? 'text-neutral-400 cursor-not-allowed bg-neutral-50'
                  : 'text-neutral-700 hover:bg-neutral-50'
                  }`}
                aria-label="Previous page"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M15 18L9 12L15 6"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
              <button
                onClick={handleNextPage}
                disabled={currentPage >= totalPages}
                className={`p-2 border border-neutral-300 rounded transition-colors ${currentPage >= totalPages
                  ? 'text-neutral-400 cursor-not-allowed bg-neutral-50'
                  : 'text-neutral-700 hover:bg-neutral-50'
                  }`}
                aria-label="Next page"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M9 18L15 12L9 6"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="px-3 sm:px-4 md:px-6 text-center py-4 sm:py-6">
        <p className="text-xs sm:text-sm text-neutral-600">
          Copyright © 2026. Developed By{' '}
          <Link to="/seller" className="text-blue-600 hover:text-blue-700 font-semibold">Speedoo - Your Order Our Priority
          </Link>
        </p>
      </footer>
    </div>
  );
}

