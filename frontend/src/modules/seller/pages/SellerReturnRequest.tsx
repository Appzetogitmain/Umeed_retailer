import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import {
    getReturnRequests,
    ReturnRequest,
    GetReturnRequestsParams,
    getReturnRequestById,
    updateReturnStatus
} from '../../../services/api/returnService';

export default function SellerReturnRequest() {
    const [returnRequests, setReturnRequests] = useState<ReturnRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string>('');
    const [fromDate, setFromDate] = useState('12/06/2025');
    const [toDate, setToDate] = useState('12/06/2025');
    const [statusFilter, setStatusFilter] = useState('All Status');
    const [searchTerm, setSearchTerm] = useState('');
    const [rowsPerPage, setRowsPerPage] = useState(10);
    const [currentPage, setCurrentPage] = useState(1);
    const [sortColumn, setSortColumn] = useState<string | null>(null);
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
    const [exportDropdownOpen, setExportDropdownOpen] = useState(false);

    // View Details Modal States
    const [selectedRequest, setSelectedRequest] = useState<ReturnRequest | null>(null);
    const [requestDetails, setRequestDetails] = useState<any | null>(null);
    const [loadingDetails, setLoadingDetails] = useState(false);
    const [showDetailsModal, setShowDetailsModal] = useState(false);
    const [processingStatus, setProcessingStatus] = useState(false);
    const [modalError, setModalError] = useState('');

    const handleViewDetails = async (request: ReturnRequest) => {
        setSelectedRequest(request);
        setShowDetailsModal(true);
        setLoadingDetails(true);
        setModalError('');
        setRequestDetails(null);
        try {
            const response = await getReturnRequestById(request.id);
            if (response.success && response.data) {
                setRequestDetails(response.data);
            } else {
                setModalError(response.message || 'Failed to load details');
            }
        } catch (err: any) {
            setModalError(err.response?.data?.message || err.message || 'Failed to load return details');
        } finally {
            setLoadingDetails(false);
        }
    };

    const handleUpdateStatus = async (status: 'Approved' | 'Rejected') => {
        if (!selectedRequest) return;
        setProcessingStatus(true);
        setModalError('');
        try {
            const response = await updateReturnStatus(selectedRequest.id, { status });
            if (response.success) {
                alert(`Return request ${status.toLowerCase()} successfully`);
                setShowDetailsModal(false);
                // Refresh list
                const params: GetReturnRequestsParams = {
                    page: currentPage,
                    limit: rowsPerPage,
                    sortBy: sortColumn || 'returnDate',
                    sortOrder: sortDirection,
                };
                if (statusFilter !== 'All Status') params.status = statusFilter;
                if (searchTerm) params.search = searchTerm;
                const listRes = await getReturnRequests(params);
                if (listRes.success && listRes.data) {
                    setReturnRequests(listRes.data);
                }
            } else {
                setModalError(response.message || `Failed to update status to ${status}`);
            }
        } catch (err: any) {
            setModalError(err.response?.data?.message || err.message || `Failed to update status to ${status}`);
        } finally {
            setProcessingStatus(false);
        }
    };

    // Fetch return requests from API
    useEffect(() => {
        const fetchReturnRequests = async () => {
            setLoading(true);
            setError('');
            try {
                const params: GetReturnRequestsParams = {
                    page: currentPage,
                    limit: rowsPerPage,
                    sortBy: sortColumn || 'returnDate',
                    sortOrder: sortDirection,
                };

                // Parse date range
                if (fromDate && toDate && fromDate !== '12/06/2025') {
                    params.dateFrom = fromDate;
                    params.dateTo = toDate;
                }

                // Add status filter
                if (statusFilter !== 'All Status') {
                    params.status = statusFilter;
                }

                // Add search
                if (searchTerm) {
                    params.search = searchTerm;
                }

                const response = await getReturnRequests(params);
                if (response.success && response.data) {
                    setReturnRequests(response.data);
                } else {
                    setError(response.message || 'Failed to fetch return requests');
                }
            } catch (err: any) {
                setError(err.response?.data?.message || err.message || 'Failed to fetch return requests');
            } finally {
                setLoading(false);
            }
        };

        fetchReturnRequests();
    }, [fromDate, toDate, statusFilter, searchTerm, currentPage, rowsPerPage, sortColumn, sortDirection]);

    // Prevent background scrolling when modal is open
    const scrollLockTargets = useRef<{ el: HTMLElement; original: string }[]>([]);
    useEffect(() => {
        if (showDetailsModal) {
            // Lock ALL scrollable ancestors
            const targets: { el: HTMLElement; original: string }[] = [];
            // body
            targets.push({ el: document.body, original: document.body.style.overflow });
            document.body.style.overflow = 'hidden';
            // html
            const html = document.documentElement;
            targets.push({ el: html, original: html.style.overflow });
            html.style.overflow = 'hidden';
            // main element inside SellerLayout
            const mainEl = document.querySelector('main');
            if (mainEl instanceof HTMLElement) {
                targets.push({ el: mainEl, original: mainEl.style.overflow });
                mainEl.style.overflow = 'hidden';
            }
            // root div (#root)
            const rootEl = document.getElementById('root');
            if (rootEl) {
                targets.push({ el: rootEl, original: rootEl.style.overflow });
                rootEl.style.overflow = 'hidden';
            }
            scrollLockTargets.current = targets;
        } else {
            // Restore all
            scrollLockTargets.current.forEach(({ el, original }) => {
                el.style.overflow = original;
            });
            scrollLockTargets.current = [];
        }
        return () => {
            scrollLockTargets.current.forEach(({ el, original }) => {
                el.style.overflow = original;
            });
            scrollLockTargets.current = [];
        };
    }, [showDetailsModal]);

    // Client-side pagination (can be moved to backend later)
    const totalPages = Math.ceil(returnRequests.length / rowsPerPage);
    const startIndex = (currentPage - 1) * rowsPerPage;
    const endIndex = startIndex + rowsPerPage;
    const displayedRequests = returnRequests.slice(startIndex, endIndex);

    const handleSort = (column: string) => {
        if (sortColumn === column) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            setSortColumn(column);
            setSortDirection('asc');
        }
    };

    const SortIcon = ({ column }: { column: string }) => (
        <span className="text-neutral-300 text-[10px]">
            {sortColumn === column ? (sortDirection === 'asc' ? '↑' : '↓') : '⇅'}
        </span>
    );

    const handleClearDates = () => {
        setFromDate('');
        setToDate('');
    };

    return (
        <div className="flex flex-col h-full min-h-screen bg-neutral-50">
            {/* Top Navigation/Header */}
            <div className="bg-white border-b border-neutral-200 px-4 sm:px-6 py-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <h1 className="text-2xl font-semibold text-neutral-900">Return Request</h1>
                    <div className="flex items-center gap-2 text-sm">
                        <Link to="/seller" className="text-blue-600 hover:text-blue-700">
                            Home
                        </Link>
                        <span className="text-neutral-400">/</span>
                        <span className="text-neutral-900">Return Request</span>
                    </div>
                </div>
            </div>

            {/* Content Card */}
            <div className="flex-1 p-4 sm:p-6">
                <div className="bg-white rounded-lg shadow-sm border border-neutral-200 flex flex-col">
                    {/* Section Header - Green Banner */}
                    <div className="bg-green-600 text-white px-4 sm:px-6 py-3 rounded-t-lg">
                        <h2 className="text-lg sm:text-xl font-semibold">View Return Request</h2>
                    </div>

                    {/* Controls Panel */}
                    <div className="p-4 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 border-b border-neutral-100">
                        {/* Left Side: Date Range and Status Filter */}
                        <div className="flex flex-col sm:flex-row gap-3 flex-1">
                            {/* Date Range Filter */}
                            <div className="flex items-center gap-2">
                                <label className="text-sm text-neutral-600 whitespace-nowrap">From - To Date:</label>
                                <div className="flex items-center bg-white border border-neutral-300 rounded overflow-hidden focus-within:ring-1 focus-within:ring-green-500">
                                    <div className="pl-3 pr-2 text-neutral-400 flex items-center justify-center">
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                                            <line x1="16" y1="2" x2="16" y2="6"></line>
                                            <line x1="8" y1="2" x2="8" y2="6"></line>
                                            <line x1="3" y1="10" x2="21" y2="10"></line>
                                        </svg>
                                    </div>
                                    <input
                                        type="date"
                                        value={fromDate}
                                        max={toDate || undefined}
                                        onChange={(e) => {
                                            setFromDate(e.target.value);
                                            setCurrentPage(1);
                                        }}
                                        className="py-1.5 px-1 text-sm focus:outline-none w-28 sm:w-32 bg-transparent [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:cursor-pointer relative"
                                    />
                                    <span className="text-neutral-400 text-sm">-</span>
                                    <input
                                        type="date"
                                        value={toDate}
                                        min={fromDate || undefined}
                                        onChange={(e) => {
                                            setToDate(e.target.value);
                                            setCurrentPage(1);
                                        }}
                                        className="py-1.5 px-1 text-sm focus:outline-none w-28 sm:w-32 bg-transparent [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:cursor-pointer relative"
                                    />
                                </div>
                                <button
                                    onClick={handleClearDates}
                                    className="px-3 py-1.5 bg-neutral-700 hover:bg-neutral-800 text-white text-sm rounded transition-colors"
                                >
                                    Clear
                                </button>
                            </div>

                            {/* Status Filter */}
                            <div className="flex items-center gap-2">
                                <label className="text-sm text-neutral-600 whitespace-nowrap">Filter by Status:</label>
                                <select
                                    value={statusFilter}
                                    onChange={(e) => setStatusFilter(e.target.value)}
                                    className="px-3 py-2 bg-white border border-neutral-300 rounded text-sm focus:ring-1 focus:ring-green-500 focus:outline-none cursor-pointer"
                                >
                                    <option value="All Status">All Status</option>
                                    <option value="Pending">Pending</option>
                                    <option value="Approved">Approved</option>
                                    <option value="Rejected">Rejected</option>
                                    <option value="Completed">Completed</option>
                                </select>
                            </div>
                        </div>

                        {/* Right Side: Per Page, Export, Search */}
                        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                            {/* Per Page */}
                            <div className="flex items-center gap-2">
                                <span className="text-sm text-neutral-600">Per Page:</span>
                                <select
                                    value={rowsPerPage}
                                    onChange={(e) => {
                                        setRowsPerPage(Number(e.target.value));
                                        setCurrentPage(1);
                                    }}
                                    className="bg-white border border-neutral-300 rounded py-1.5 px-3 text-sm focus:ring-1 focus:ring-green-500 focus:outline-none cursor-pointer"
                                >
                                    <option value={10}>10</option>
                                    <option value={20}>20</option>
                                    <option value={50}>50</option>
                                    <option value={100}>100</option>
                                </select>
                            </div>

                            {/* Export Button */}
                            <div className="relative">
                                <button
                                    onClick={() => setExportDropdownOpen(!exportDropdownOpen)}
                                    className="bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded text-sm font-medium flex items-center gap-1 transition-colors"
                                >
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                        <polyline points="7 10 12 15 17 10"></polyline>
                                        <line x1="12" y1="15" x2="12" y2="3"></line>
                                    </svg>
                                    Export
                                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="ml-1">
                                        <polyline points="6 9 12 15 18 9"></polyline>
                                    </svg>
                                </button>
                                {exportDropdownOpen && (
                                    <div className="absolute right-0 mt-1 w-32 bg-white border border-neutral-200 rounded shadow-lg z-10 py-1">
                                        <button
                                            onClick={() => {
                                                setExportDropdownOpen(false);
                                                const headers = ['Order Item Id', 'Product', 'Variant', 'Price', 'Disc Price', 'Quantity', 'Total', 'Status', 'Date'];
                                                const csvContent = [
                                                    headers.join(','),
                                                    ...returnRequests.map(request => [
                                                        request.orderItemId,
                                                        `"${request.product}"`,
                                                        `"${request.variant}"`,
                                                        request.price,
                                                        request.discPrice,
                                                        request.quantity,
                                                        request.total,
                                                        `"${request.status}"`,
                                                        request.date
                                                    ].join(','))
                                                ].join('\n');
                                                const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                                                const link = document.createElement('a');
                                                link.href = URL.createObjectURL(blob);
                                                link.download = `return_requests_${new Date().toISOString().split('T')[0]}.csv`;
                                                link.click();
                                            }}
                                            className="w-full text-left px-4 py-2 text-sm hover:bg-neutral-100"
                                        >
                                            Export as CSV
                                        </button>
                                        <button onClick={() => { setExportDropdownOpen(false); alert('PDF Export not implemented yet'); }} className="w-full text-left px-4 py-2 text-sm hover:bg-neutral-100">Export as PDF</button>
                                        <button onClick={() => { setExportDropdownOpen(false); alert('Excel Export not implemented yet'); }} className="w-full text-left px-4 py-2 text-sm hover:bg-neutral-100">Export as Excel</button>
                                    </div>
                                )}
                            </div>

                            {/* Search */}
                            <div className="relative">
                                <input
                                    type="text"
                                    className="pl-3 pr-3 py-1.5 bg-neutral-100 border-none rounded text-sm focus:ring-1 focus:ring-green-500 w-full sm:w-48"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    placeholder="Search:"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Loading and Error States */}
                    {loading && (
                        <div className="flex items-center justify-center p-8">
                            <div className="text-neutral-500">Loading return requests...</div>
                        </div>
                    )}
                    {error && !loading && (
                        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg m-4">
                            {error}
                        </div>
                    )}

                    {/* Table */}
                    {!loading && !error && (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse border border-neutral-200">
                            <thead>
                                <tr className="bg-neutral-50 text-xs font-bold text-neutral-800">
                                    <th
                                        className="p-4 border border-neutral-200 cursor-pointer hover:bg-neutral-100 transition-colors"
                                        onClick={() => handleSort('orderItemId')}
                                    >
                                        <div className="flex items-center gap-1">
                                            Order Item Id
                                            <SortIcon column="orderItemId" />
                                        </div>
                                    </th>
                                    <th
                                        className="p-4 border border-neutral-200 cursor-pointer hover:bg-neutral-100 transition-colors"
                                        onClick={() => handleSort('product')}
                                    >
                                        <div className="flex items-center gap-1">
                                            Product
                                            <SortIcon column="product" />
                                        </div>
                                    </th>
                                    <th
                                        className="p-4 border border-neutral-200 cursor-pointer hover:bg-neutral-100 transition-colors"
                                        onClick={() => handleSort('variant')}
                                    >
                                        <div className="flex items-center gap-1">
                                            Variant
                                            <SortIcon column="variant" />
                                        </div>
                                    </th>
                                    <th
                                        className="p-4 border border-neutral-200 cursor-pointer hover:bg-neutral-100 transition-colors"
                                        onClick={() => handleSort('price')}
                                    >
                                        <div className="flex items-center gap-1">
                                            Price
                                            <SortIcon column="price" />
                                        </div>
                                    </th>
                                    <th
                                        className="p-4 border border-neutral-200 cursor-pointer hover:bg-neutral-100 transition-colors"
                                        onClick={() => handleSort('discPrice')}
                                    >
                                        <div className="flex items-center gap-1">
                                            Disc Price
                                            <SortIcon column="discPrice" />
                                        </div>
                                    </th>
                                    <th
                                        className="p-4 border border-neutral-200 cursor-pointer hover:bg-neutral-100 transition-colors"
                                        onClick={() => handleSort('quantity')}
                                    >
                                        <div className="flex items-center gap-1">
                                            Quantity
                                            <SortIcon column="quantity" />
                                        </div>
                                    </th>
                                    <th
                                        className="p-4 border border-neutral-200 cursor-pointer hover:bg-neutral-100 transition-colors"
                                        onClick={() => handleSort('total')}
                                    >
                                        <div className="flex items-center gap-1">
                                            Total
                                            <SortIcon column="total" />
                                        </div>
                                    </th>
                                    <th
                                        className="p-4 border border-neutral-200 cursor-pointer hover:bg-neutral-100 transition-colors"
                                        onClick={() => handleSort('status')}
                                    >
                                        <div className="flex items-center gap-1">
                                            Status
                                            <SortIcon column="status" />
                                        </div>
                                    </th>
                                    <th
                                        className="p-4 border border-neutral-200 cursor-pointer hover:bg-neutral-100 transition-colors"
                                        onClick={() => handleSort('date')}
                                    >
                                        <div className="flex items-center gap-1">
                                            Date
                                            <SortIcon column="date" />
                                        </div>
                                    </th>
                                    <th className="p-4 border border-neutral-200">
                                        <div className="flex items-center gap-1">
                                            Action
                                        </div>
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {displayedRequests.length === 0 ? (
                                    <tr>
                                        <td colSpan={10} className="p-8 text-center text-neutral-500">
                                            No data available in table
                                        </td>
                                    </tr>
                                ) : (
                                    displayedRequests.map((request, index) => (
                                        <tr key={index} className="hover:bg-neutral-50">
                                            <td className="p-4 border border-neutral-200 text-sm text-neutral-900">{request.orderItemId}</td>
                                            <td className="p-4 border border-neutral-200 text-sm text-neutral-900">{request.product}</td>
                                            <td className="p-4 border border-neutral-200 text-sm text-neutral-900">{request.variant}</td>
                                            <td className="p-4 border border-neutral-200 text-sm text-neutral-900">₹{(request.price || 0).toFixed(2)}</td>
                                            <td className="p-4 border border-neutral-200 text-sm text-neutral-900">₹{(request.discPrice || 0).toFixed(2)}</td>
                                            <td className="p-4 border border-neutral-200 text-sm text-neutral-900">{request.quantity || 0}</td>
                                            <td className="p-4 border border-neutral-200 text-sm text-neutral-900">₹{(request.total || 0).toFixed(2)}</td>
                                            <td className="p-4 border border-neutral-200 text-sm text-neutral-900">{request.status}</td>
                                            <td className="p-4 border border-neutral-200 text-sm text-neutral-900">{request.date}</td>
                                            <td className="p-4 border border-neutral-200 text-sm text-neutral-900">
                                                <button
                                                    onClick={() => handleViewDetails(request)}
                                                    className="text-green-600 hover:text-green-700 text-xs font-semibold bg-green-50 px-2.5 py-1 rounded transition-colors"
                                                >
                                                    View Details
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                    )}

                    {/* Pagination Footer */}
                    <div className="p-4 border-t border-neutral-100 flex flex-col sm:flex-row justify-between items-center gap-4">
                        <div className="text-sm text-neutral-600">
                            Showing {returnRequests.length === 0 ? 0 : startIndex + 1} to {Math.min(endIndex, returnRequests.length)} of {returnRequests.length} entries
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                disabled={currentPage === 1 || totalPages === 0}
                                className="w-8 h-8 flex items-center justify-center border border-green-300 rounded hover:bg-green-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="15 18 9 12 15 6"></polyline>
                                </svg>
                            </button>
                            <button
                                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                                disabled={currentPage === totalPages || totalPages === 0}
                                className="w-8 h-8 flex items-center justify-center border border-green-300 rounded hover:bg-green-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="9 18 15 12 9 6"></polyline>
                                </svg>
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* View Details Modal */}
            {showDetailsModal && selectedRequest && createPortal(
                <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black bg-opacity-50" style={{ overscrollBehavior: 'contain' }}>
                    <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col">
                        {/* Modal Header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200 bg-neutral-50 rounded-t-lg">
                            <h2 className="text-lg font-semibold text-neutral-900">Return Request Details</h2>
                            <button
                                onClick={() => setShowDetailsModal(false)}
                                className="text-neutral-400 hover:text-neutral-600 transition-colors"
                            >
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="18" y1="6" x2="6" y2="18"></line>
                                    <line x1="6" y1="6" x2="18" y2="18"></line>
                                </svg>
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="p-6 overflow-y-auto flex-1 space-y-6">
                            {loadingDetails ? (
                                <div className="flex flex-col items-center justify-center py-12">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mb-2"></div>
                                    <p className="text-sm text-neutral-500">Loading details...</p>
                                </div>
                            ) : modalError ? (
                                <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
                                    {modalError}
                                </div>
                            ) : requestDetails ? (
                                <div className="space-y-6">
                                    {/* Product and Order Info */}
                                    <div className="bg-neutral-50 p-4 rounded-lg border border-neutral-200 space-y-3">
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <p className="text-xs text-neutral-500 font-semibold uppercase">Product Name</p>
                                                <p className="text-sm font-medium text-neutral-800">{requestDetails.productName || selectedRequest.product}</p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-neutral-500 font-semibold uppercase">Variant</p>
                                                <p className="text-sm font-medium text-neutral-800">{requestDetails.variantTitle || selectedRequest.variant || "N/A"}</p>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-4 gap-2 pt-2 border-t border-neutral-200/60">
                                            <div>
                                                <p className="text-[10px] text-neutral-500 uppercase font-semibold">Price</p>
                                                <p className="text-xs font-semibold text-neutral-800">₹{(requestDetails.price || selectedRequest.price || 0).toFixed(2)}</p>
                                            </div>
                                            <div>
                                                <p className="text-[10px] text-neutral-500 uppercase font-semibold">Disc. Price</p>
                                                <p className="text-xs font-semibold text-neutral-800">₹{(requestDetails.discPrice || selectedRequest.discPrice || 0).toFixed(2)}</p>
                                            </div>
                                            <div>
                                                <p className="text-[10px] text-neutral-500 uppercase font-semibold">Qty</p>
                                                <p className="text-xs font-semibold text-neutral-800">{requestDetails.quantity || selectedRequest.quantity}</p>
                                            </div>
                                            <div>
                                                <p className="text-[10px] text-neutral-500 uppercase font-semibold">Total</p>
                                                <p className="text-xs font-bold text-green-700">₹{(requestDetails.total || selectedRequest.total || 0).toFixed(2)}</p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Customer and Request Info */}
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <p className="text-xs text-neutral-500 font-semibold uppercase">Customer Name</p>
                                            <p className="text-sm font-medium text-neutral-800">{requestDetails.customerName || "N/A"}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-neutral-500 font-semibold uppercase">Customer Phone</p>
                                            <p className="text-sm font-medium text-neutral-800">{requestDetails.customerPhone || "N/A"}</p>
                                        </div>
                                    </div>

                                    <div>
                                        <p className="text-xs text-neutral-500 font-semibold uppercase">Return Reason</p>
                                        <p className="text-sm font-semibold text-red-700 bg-red-50 border border-red-100 rounded px-2.5 py-1.5 mt-1 inline-block">
                                            {requestDetails.reason || "N/A"}
                                        </p>
                                    </div>

                                    {requestDetails.description && (
                                        <div>
                                            <p className="text-xs text-neutral-500 font-semibold uppercase mb-1">Customer Description</p>
                                            <div className="p-3 bg-neutral-50 rounded border border-neutral-200 text-sm text-neutral-700">
                                                {requestDetails.description}
                                            </div>
                                        </div>
                                    )}

                                    {/* Uploaded Images */}
                                    {requestDetails.images && requestDetails.images.length > 0 && (
                                        <div>
                                            <p className="text-xs text-neutral-500 font-semibold uppercase mb-2">Customer Uploaded Images</p>
                                            <div className="flex flex-wrap gap-3">
                                                {requestDetails.images.map((imgUrl: string, idx: number) => (
                                                    <a key={idx} href={imgUrl} target="_blank" rel="noopener noreferrer" className="relative block w-24 h-24 rounded-lg border border-neutral-200 overflow-hidden hover:opacity-90 transition-opacity">
                                                        <img src={imgUrl} alt={`Uploaded ${idx + 1}`} className="w-full h-full object-cover" />
                                                    </a>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Request Timeline Status */}
                                    <div className="flex justify-between items-center py-2 border-t border-b border-neutral-100">
                                        <span className="text-xs text-neutral-500 font-semibold uppercase">Current Status</span>
                                        <span className={`px-2.5 py-1 rounded text-xs font-bold uppercase tracking-wider border ${
                                            requestDetails.status === "Pending" ? "bg-yellow-50 text-yellow-700 border-yellow-100" :
                                            requestDetails.status === "Approved" ? "bg-blue-50 text-blue-700 border-blue-100" :
                                            requestDetails.status === "Rejected" ? "bg-red-50 text-red-700 border-red-100" :
                                            "bg-green-50 text-green-700 border-green-100"
                                        }`}>
                                            {requestDetails.status}
                                        </span>
                                    </div>
                                </div>
                            ) : null}
                        </div>

                        {/* Modal Footer */}
                        <div className="flex justify-end gap-3 px-6 py-4 border-t border-neutral-200 bg-neutral-50 rounded-b-lg">
                            <button
                                onClick={() => setShowDetailsModal(false)}
                                className="px-4 py-2 text-sm font-medium text-neutral-700 bg-white border border-neutral-300 rounded hover:bg-neutral-50 transition-colors"
                                disabled={processingStatus}
                            >
                                Close
                            </button>
                            {requestDetails && requestDetails.status === 'Pending' && (
                                <>
                                    <button
                                        onClick={() => handleUpdateStatus('Rejected')}
                                        className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded transition-colors"
                                        disabled={processingStatus}
                                    >
                                        {processingStatus ? 'Processing...' : 'Reject Request'}
                                    </button>
                                    <button
                                        onClick={() => handleUpdateStatus('Approved')}
                                        className="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded transition-colors"
                                        disabled={processingStatus}
                                    >
                                        {processingStatus ? 'Processing...' : 'Approve Return'}
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            , document.body)}

            {/* Footer */}
            <footer className="px-4 sm:px-6 py-4 text-center bg-white border-t border-neutral-200">
                <p className="text-xs sm:text-sm text-neutral-600">
                    Copyright © 2026. Developed By{" "}<span className="font-semibold text-teal-600">Speedoo - Your Order Our Priority</span>
                </p>
            </footer>
        </div>
    );
}

