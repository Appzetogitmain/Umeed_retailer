import { useState, useMemo, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Input } from '../../../components/ui/input';
import { jsPDF } from 'jspdf';
import { getOrdersByStatus, type Order } from '../../../services/api/admin/adminOrderService';
import { getAllSellers, type Seller } from '../../../services/api/sellerService';
import { useAuth } from '../../../context/AuthContext';

type SortField = 'orderId' | 'customerDetails' | 'address' | 'deliveryDate' | 'orderDate' | 'status' | 'deliveryBoyStatus' | 'amount';
type SortDirection = 'asc' | 'desc';

export default function AdminReceivedOrders() {
  const { isAuthenticated, token } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const fromDateRef = useRef<HTMLInputElement>(null);
  const toDateRef = useRef<HTMLInputElement>(null);
  const [seller, setSeller] = useState('All Sellers');
  const [status, setStatus] = useState('Received');
  const [entriesPerPage, setEntriesPerPage] = useState('10');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [totalEntries, setTotalEntries] = useState(0);
  const [isExportDropdownOpen, setIsExportDropdownOpen] = useState(false);

  // Fetch sellers on component mount
  useEffect(() => {
    if (!isAuthenticated || !token) return;

    const fetchSellers = async () => {
      try {
        const response = await getAllSellers();
        if (response.success) {
          setSellers(response.data);
        }
      } catch (err) {
        console.error("Error fetching sellers:", err);
      }
    };

    fetchSellers();
  }, [isAuthenticated, token]);

  // Fetch orders on component mount
  useEffect(() => {
    if (!isAuthenticated || !token) {
      setLoading(false);
      return;
    }

    const fetchOrders = async () => {
      try {
        setLoading(true);
        setError(null);

        const params: any = {
          page: currentPage,
          limit: parseInt(entriesPerPage),
        };

        if (searchQuery) {
          params.search = searchQuery;
        }

        if (dateFrom) {
          params.dateFrom = dateFrom;
        }
        if (dateTo) {
          params.dateTo = dateTo;
        }

        if (seller !== 'All Sellers') {
          params.seller = seller;
        }

        const response = await getOrdersByStatus('Received', params);
        if (response.success) {
          setOrders(response.data);
          if (response.pagination) {
            setTotalPages(response.pagination.pages || 1);
            setTotalEntries(response.pagination.total || 0);
          } else {
            setTotalPages(1);
            setTotalEntries(response.data.length);
          }
        }
      } catch (err) {
        console.error('Error fetching orders:', err);
        if (err && typeof err === 'object' && 'response' in err) {
          const axiosError = err as { response?: { data?: { message?: string } } };
          setError(axiosError.response?.data?.message || 'Failed to load orders. Please try again.');
        } else {
          setError('Failed to load orders. Please try again.');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchOrders();
  }, [isAuthenticated, token, currentPage, entriesPerPage, searchQuery, dateFrom, dateTo, seller]);

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

  const handleExport = () => {
    const headers = ['O. Id', 'Customer Details', 'Address', 'O. Date', 'Status', 'Delivery Boy Assign Status', 'Amount'];
    const csvContent = [
      headers.join(','),
      ...filteredAndSortedOrders.map(order =>
        [
          order.orderNumber || '',
          order.customerName || '',
          order.deliveryAddress?.address || '',
          order.orderDate ? new Date(order.orderDate).toLocaleDateString() : '',
          order.status || '',
          order.deliveryBoyStatus || 'Not Assigned',
          `₹${order.total?.toFixed(2) || '0.00'}`
        ].join(',')
      )
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `received_orders_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportExcel = () => {
    const headers = ['O. Id', 'Customer Details', 'Address', 'O. Date', 'Status', 'Delivery Boy Assign Status', 'Amount'];
    const csvContent = [
      headers.join(','),
      ...filteredAndSortedOrders.map(order =>
        [
          order.orderNumber || '',
          order.customerName || '',
          order.deliveryAddress?.address || '',
          order.orderDate ? new Date(order.orderDate).toLocaleDateString() : '',
          order.status || '',
          order.deliveryBoyStatus || 'Not Assigned',
          `₹${order.total?.toFixed(2) || '0.00'}`
        ].join(',')
      )
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `received_orders_${new Date().toISOString().split('T')[0]}.xls`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportPDF = () => {
    const doc = new jsPDF();
    doc.setFont('helvetica');
    doc.setFontSize(16);
    doc.text('Speedoo - Received Orders Export', 14, 15);
    doc.setFontSize(10);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 22);

    let y = 30;
    const cols = ['O. Id', 'Customer', 'Address', 'Date', 'Status', 'Amount'];
    doc.setFont('helvetica', 'bold');
    let x = 14;
    cols.forEach((col, idx) => {
      let width = 25;
      if (idx === 1) width = 35;
      if (idx === 2) width = 50;
      doc.text(col, x, y);
      x += width;
    });

    y += 8;
    doc.line(14, y - 4, 195, y - 4);

    doc.setFont('helvetica', 'normal');
    filteredAndSortedOrders.forEach(order => {
      if (y > 280) {
        doc.addPage();
        y = 15;
      }
      let x = 14;
      
      const orderIdStr = String(order.orderNumber || "");
      const customerStr = String(order.customerName || "").substring(0, 18);
      const addressStr = String(order.deliveryAddress?.address || "-").substring(0, 25);
      const dateStr = order.orderDate ? new Date(order.orderDate).toLocaleDateString() : "-";
      const statusStr = String(order.status || "");
      const amountStr = `Rs.${order.total?.toFixed(2) || "0.00"}`;

      const row = [orderIdStr, customerStr, addressStr, dateStr, statusStr, amountStr];
      row.forEach((cell, idx) => {
        let width = 25;
        if (idx === 1) width = 35;
        if (idx === 2) width = 50;
        doc.text(cell, x, y);
        x += width;
      });
      y += 8;
    });

    doc.save(`received_orders_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const filteredAndSortedOrders = useMemo(() => {
    let filtered = [...orders];

    // Sort
    if (sortField) {
      filtered.sort((a, b) => {
        let aValue: string | number;
        let bValue: string | number;

        switch (sortField) {
          case 'orderId':
            aValue = a.orderNumber || '';
            bValue = b.orderNumber || '';
            break;
          case 'customerDetails':
            aValue = a.customerName || '';
            bValue = b.customerName || '';
            break;
          case 'address':
            aValue = a.deliveryAddress?.address || '';
            bValue = b.deliveryAddress?.address || '';
            break;
          case 'deliveryDate':
            aValue = a.estimatedDeliveryDate || '';
            bValue = b.estimatedDeliveryDate || '';
            break;
          case 'orderDate':
            aValue = a.orderDate || '';
            bValue = b.orderDate || '';
            break;
          case 'status':
            aValue = a.status || '';
            bValue = b.status || '';
            break;
          case 'deliveryBoyStatus':
            aValue = a.deliveryBoyStatus || '';
            bValue = b.deliveryBoyStatus || '';
            break;
          case 'amount':
            aValue = a.total || 0;
            bValue = b.total || 0;
            break;
          default:
            return 0;
        }

        if (typeof aValue === 'string') {
          aValue = aValue.toLowerCase();
        }
        if (typeof bValue === 'string') {
          bValue = bValue.toLowerCase();
        }

        if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return filtered;
  }, [orders, sortField, sortDirection]);

  const startIndex = (currentPage - 1) * parseInt(entriesPerPage);
  const endIndex = startIndex + parseInt(entriesPerPage);
  const paginatedOrders = filteredAndSortedOrders;

  const handlePreviousPage = () => {
    setCurrentPage(prev => Math.max(1, prev - 1));
  };

  const handleNextPage = () => {
    setCurrentPage(prev => Math.min(totalPages, prev + 1));
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Payment Pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'Received':
        return 'bg-blue-100 text-blue-800';
      case 'Processed':
        return 'bg-purple-100 text-purple-800';
      case 'Shipped':
        return 'bg-indigo-100 text-indigo-800';
      case 'Out For Delivery':
        return 'bg-orange-100 text-orange-800';
      case 'Delivered':
        return 'bg-green-100 text-green-800';
      case 'Cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-neutral-100 text-neutral-800';
    }
  };

  const getDeliveryBoyStatusColor = (status: string) => {
    switch (status) {
      case 'Assigned':
        return 'bg-green-100 text-green-800';
      case 'Not Assigned':
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
          
          <div className="flex items-center gap-2">
            <button onClick={() => window.history.back()} className="p-1 sm:p-2 text-neutral-600 hover:text-neutral-900 bg-neutral-100 hover:bg-neutral-200 rounded-lg transition-colors" aria-label="Go back">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
            </button>
            <h1 className="text-xl sm:text-2xl font-bold text-neutral-900">Orders List</h1>
          </div>

          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-xs sm:text-sm">
            <Link to="/admin" className="text-blue-600 hover:text-blue-700">
              Dashboard
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
          <div className="bg-green-600 text-white px-4 sm:px-6 py-2 sm:py-3">
            <h2 className="text-base sm:text-lg font-semibold">View Order List</h2>
          </div>

          {/* Filter and Action Bar */}
          <div className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 border-b border-neutral-200 bg-neutral-50">
            <div className="flex flex-col lg:flex-row flex-wrap items-start lg:items-center gap-3 sm:gap-4">
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
                    <Input
                      type="date"
                      ref={fromDateRef}
                      value={dateFrom}
                      onChange={(e) => {
                        setDateFrom(e.target.value);
                        setCurrentPage(1);
                      }}
                      max={dateTo || undefined}
                      className="border-none focus-visible:ring-0 h-8 text-xs w-28 p-0"
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
                    <Input
                      type="date"
                      ref={toDateRef}
                      value={dateTo}
                      onChange={(e) => {
                        setDateTo(e.target.value);
                        setCurrentPage(1);
                      }}
                      min={dateFrom || undefined}
                      className="border-none focus-visible:ring-0 h-8 text-xs w-28 p-0"
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

              {/* Sellers Filter */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 w-full lg:w-auto">
                <label className="text-xs sm:text-sm font-medium text-neutral-700 whitespace-nowrap">
                  Sellers
                </label>
                <select
                  value={seller}
                  onChange={(e) => {
                    setSeller(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full sm:w-auto px-3 py-2 border border-neutral-300 rounded text-xs sm:text-sm text-neutral-900 bg-white focus:outline-none focus:ring-1 focus:ring-green-500 focus:border-green-500"
                >
                  <option value="All Sellers">All Sellers</option>
                  {sellers.map((s) => (
                    <option key={s._id} value={s._id}>
                      {s.storeName || s.sellerName}
                    </option>
                  ))}
                </select>
              </div>

              {/* Status Filter */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 w-full lg:w-auto">
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
                  <option>Received</option>
                  <option>All Status</option>
                  <option>Payment Pending</option>
                  <option>Processed</option>
                  <option>Shipped</option>
                  <option>Out For Delivery</option>
                  <option>Delivered</option>
                  <option>Cancelled</option>
                </select>
              </div>

              {/* Entries Per Page */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 w-full lg:w-auto">
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

              {/* Export Button */}
              <div className="flex items-center gap-2 w-full lg:w-auto lg:ml-auto">
                <div className="relative">
                  <button
                    onClick={() => setIsExportDropdownOpen(!isExportDropdownOpen)}
                    className="flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white px-3 sm:px-4 py-2 rounded text-xs sm:text-sm font-medium transition-colors w-full sm:w-auto">
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                      className="flex-shrink-0">
                      <path
                        d="M21 15V19C21 20.1046 20.1046 21 19 21H5C3.89543 21 3 20.1046 3 19V15M7 10L12 15M12 15L17 10M12 15V3"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    Export
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg">
                      <path
                        d="M6 9L12 15L18 9"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Search Bar */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 w-full lg:w-auto lg:flex-1">
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
                  placeholder="Search by Order ID, Customer, or Amount"
                />
              </div>
            </div>
          </div>

          {/* Table Section */}
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-neutral-200">
              <thead className="bg-neutral-50">
                <tr>
                  <th
                    onClick={() => handleSort('orderId')}
                    className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider cursor-pointer hover:bg-neutral-100"
                  >
                    <div className="flex items-center gap-1">
                      O. Id
                      {sortField === 'orderId' && (
                        <svg
                          width="12"
                          height="12"
                          viewBox="0 0 24 24"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          {sortDirection === 'asc' ? (
                            <path d="M7 14L12 9L17 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          ) : (
                            <path d="M17 10L12 15L7 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          )}
                        </svg>
                      )}
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort('customerDetails')}
                    className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider cursor-pointer hover:bg-neutral-100"
                  >
                    <div className="flex items-center gap-1">
                      Customer Details
                      {sortField === 'customerDetails' && (
                        <svg
                          width="12"
                          height="12"
                          viewBox="0 0 24 24"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          {sortDirection === 'asc' ? (
                            <path d="M7 14L12 9L17 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          ) : (
                            <path d="M17 10L12 15L7 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          )}
                        </svg>
                      )}
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort('address')}
                    className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider cursor-pointer hover:bg-neutral-100"
                  >
                    <div className="flex items-center gap-1">
                      Address
                      {sortField === 'address' && (
                        <svg
                          width="12"
                          height="12"
                          viewBox="0 0 24 24"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          {sortDirection === 'asc' ? (
                            <path d="M7 14L12 9L17 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          ) : (
                            <path d="M17 10L12 15L7 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          )}
                        </svg>
                      )}
                    </div>
                  </th>

                  <th
                    onClick={() => handleSort('orderDate')}
                    className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider cursor-pointer hover:bg-neutral-100"
                  >
                    <div className="flex items-center gap-1">
                      O. Date
                      {sortField === 'orderDate' && (
                        <svg
                          width="12"
                          height="12"
                          viewBox="0 0 24 24"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          {sortDirection === 'asc' ? (
                            <path d="M7 14L12 9L17 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          ) : (
                            <path d="M17 10L12 15L7 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          )}
                        </svg>
                      )}
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort('status')}
                    className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider cursor-pointer hover:bg-neutral-100"
                  >
                    <div className="flex items-center gap-1">
                      Status
                      {sortField === 'status' && (
                        <svg
                          width="12"
                          height="12"
                          viewBox="0 0 24 24"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          {sortDirection === 'asc' ? (
                            <path d="M7 14L12 9L17 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          ) : (
                            <path d="M17 10L12 15L7 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          )}
                        </svg>
                      )}
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort('deliveryBoyStatus')}
                    className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider cursor-pointer hover:bg-neutral-100"
                  >
                    <div className="flex items-center gap-1">
                      Delivery Boy Assign Status
                      {sortField === 'deliveryBoyStatus' && (
                        <svg
                          width="12"
                          height="12"
                          viewBox="0 0 24 24"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          {sortDirection === 'asc' ? (
                            <path d="M7 14L12 9L17 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          ) : (
                            <path d="M17 10L12 15L7 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          )}
                        </svg>
                      )}
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort('amount')}
                    className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider cursor-pointer hover:bg-neutral-100"
                  >
                    <div className="flex items-center gap-1">
                      Amount
                      {sortField === 'amount' && (
                        <svg
                          width="12"
                          height="12"
                          viewBox="0 0 24 24"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          {sortDirection === 'asc' ? (
                            <path d="M7 14L12 9L17 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          ) : (
                            <path d="M17 10L12 15L7 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          )}
                        </svg>
                      )}
                    </div>
                  </th>
                  <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-neutral-200">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="px-4 sm:px-6 py-8 text-center text-sm text-neutral-500">
                      Loading orders...
                    </td>
                  </tr>
                ) : error ? (
                  <tr>
                    <td colSpan={8} className="px-4 sm:px-6 py-8 text-center text-sm text-red-600">
                      {error}
                    </td>
                  </tr>
                ) : paginatedOrders.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 sm:px-6 py-8 text-center text-sm text-neutral-500">
                      No data available in table
                    </td>
                  </tr>
                ) : (
                  paginatedOrders.map((order) => (
                    <tr key={order._id} className="hover:bg-neutral-50">
                      <td className="px-4 sm:px-6 py-3 text-sm text-neutral-900">{order.orderNumber}</td>
                      <td className="px-4 sm:px-6 py-3 text-sm text-neutral-600">
                        {order.customerName || (typeof order.customer === 'object' ? order.customer.name : '')}
                      </td>
                      <td className="px-4 sm:px-6 py-3 text-sm text-neutral-600">
                        {order.deliveryAddress?.address || '-'}
                      </td>

                      <td className="px-4 sm:px-6 py-3 text-sm text-neutral-600">
                        {order.orderDate ? new Date(order.orderDate).toLocaleDateString() : '-'}
                      </td>
                      <td className="px-4 sm:px-6 py-3">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(order.status)}`}>
                          {order.status}
                        </span>
                      </td>
                      <td className="px-4 sm:px-6 py-3">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getDeliveryBoyStatusColor(order.deliveryBoyStatus || 'Not Assigned')}`}>
                          {order.deliveryBoyStatus || 'Not Assigned'}
                        </span>
                      </td>
                      <td className="px-4 sm:px-6 py-3 text-sm text-neutral-900 font-medium">₹{order.total?.toFixed(2) || '0.00'}</td>
                      <td className="px-4 sm:px-6 py-3">
                        <Link to={`/admin/orders/${order._id}`}>
                          <button className="bg-teal-600 hover:bg-teal-700 text-white p-2 rounded transition-colors" aria-label="View order">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                              <path d="M1 12C1 12 5 4 12 4C19 4 23 12 23 12C23 12 19 20 12 20C5 20 1 12 1 12Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                              <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </button>
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          <div className="px-4 sm:px-6 py-3 bg-neutral-50 border-t border-neutral-200 flex flex-col sm:flex-row items-center justify-between gap-2">
            <div className="text-xs sm:text-sm text-neutral-700">
              Showing {totalEntries === 0 ? 0 : startIndex + 1} to {Math.min(endIndex, totalEntries)} of {totalEntries} entries
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={handlePreviousPage}
                disabled={currentPage === 1}
                className="px-2 py-1 border border-neutral-300 rounded text-xs sm:text-sm text-neutral-700 bg-white hover:bg-neutral-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                aria-label="Previous page"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M15 18L9 12L15 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              <button
                onClick={handleNextPage}
                disabled={currentPage === totalPages || totalPages === 0}
                className="px-2 py-1 border border-neutral-300 rounded text-xs sm:text-sm text-neutral-700 bg-white hover:bg-neutral-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                aria-label="Next page"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M9 18L15 12L9 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="text-center py-4 text-xs sm:text-sm text-neutral-600">
        Copyright © 2026. Developed By{' '}
        <Link to="/" className="text-blue-600 hover:text-blue-700">Speedoo - Your Order Our Priority
        </Link>
      </div>
    </div>
  );
}

