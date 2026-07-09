import { useState, useEffect } from 'react';
import {
    getDeliveryBoys,
    updateDeliveryBoyStatus,
    updateDeliveryBoyAvailability,
    deleteDeliveryBoy,
    type DeliveryBoy,
} from '../../../services/api/admin/adminDeliveryService';
import { useAuth } from '../../../context/AuthContext';

export default function AdminManageDeliveryBoy() {
    const { isAuthenticated, token } = useAuth();
    const [deliveryBoys, setDeliveryBoys] = useState<DeliveryBoy[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [processing, setProcessing] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('All');
    const [availabilityFilter, setAvailabilityFilter] = useState('All');
    const [rowsPerPage, setRowsPerPage] = useState(10);
    const [currentPage, setCurrentPage] = useState(1);
    const [sortColumn, setSortColumn] = useState<string | null>(null);
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
    const [totalPages, setTotalPages] = useState(1);
    const [totalDeliveryBoys, setTotalDeliveryBoys] = useState(0);
    const [successMessage, setSuccessMessage] = useState('');
    const [selectedDeliveryBoy, setSelectedDeliveryBoy] = useState<DeliveryBoy | null>(null);
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
    const [rejectionReason, setRejectionReason] = useState('');
    const [showRejectInput, setShowRejectInput] = useState(false);

    // Debounce search term and fetch delivery boys
    useEffect(() => {
        if (!isAuthenticated || !token) {
            setLoading(false);
            return;
        }

        const fetchDeliveryBoys = async () => {
            try {
                setLoading(true);
                setError(null);

                const params: any = {
                    page: currentPage,
                    limit: rowsPerPage,
                    search: searchTerm || undefined,
                    sortBy: sortColumn || undefined,
                    sortOrder: sortDirection,
                };

                if (statusFilter !== 'All') {
                    params.status = statusFilter;
                }

                if (availabilityFilter !== 'All') {
                    params.available = availabilityFilter;
                }

                const response = await getDeliveryBoys(params);

                if (response.success) {
                    setDeliveryBoys(response.data);
                    // Update pagination info from backend
                    if (response.pagination) {
                        setTotalPages(response.pagination.pages);
                        setTotalDeliveryBoys(response.pagination.total);
                    }
                } else {
                    setError('Failed to load delivery boys');
                }
            } catch (err: any) {
                console.error('Error fetching delivery boys:', err);
                setError(err.response?.data?.message || 'Failed to load delivery boys. Please try again.');
            } finally {
                setLoading(false);
            }
        };

        // Debounce search term
        const timer = setTimeout(() => {
            fetchDeliveryBoys();
        }, searchTerm ? 500 : 0); // Immediate fetch if search is empty, debounce if typing

        return () => clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isAuthenticated, token, currentPage, rowsPerPage, searchTerm, statusFilter, availabilityFilter, sortColumn, sortDirection]);

    const handleSort = (column: string) => {
        // Map frontend column names to backend field names
        const columnMap: Record<string, string> = {
            'id': '_id',
            '_id': '_id',
            'name': 'name',
            'mobile': 'mobile',
            'city': 'city',
            'balance': 'balance',
            'cashCollected': 'cashCollected',
            'status': 'status',
            'available': 'available',
        };
        const backendColumn = columnMap[column] || column;
        
        if (sortColumn === backendColumn) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            setSortColumn(backendColumn);
            setSortDirection('asc');
        }
        setCurrentPage(1); // Reset to first page when sorting changes
    };

    const handleStatusChange = async (deliveryBoyId: string, newStatus: 'Active' | 'Inactive' | 'Rejected', reason?: string) => {
        try {
            setProcessing(deliveryBoyId);
            const response = await updateDeliveryBoyStatus(deliveryBoyId, newStatus, reason);

            if (response.success) {
                // Update local state
                setDeliveryBoys(deliveryBoys.map(deliveryBoy =>
                    deliveryBoy._id === deliveryBoyId ? { ...deliveryBoy, status: newStatus } : deliveryBoy
                ));
                setSuccessMessage(`Delivery boy status updated to ${newStatus} successfully!`);
                setError('');
                // Refresh list to get updated data
                const params: any = {
                    page: currentPage,
                    limit: rowsPerPage,
                    search: searchTerm,
                    sortBy: sortColumn || undefined,
                    sortOrder: sortDirection,
                };
                if (statusFilter !== 'All') params.status = statusFilter;
                if (availabilityFilter !== 'All') params.available = availabilityFilter;
                const refreshResponse = await getDeliveryBoys(params);
                if (refreshResponse.success && refreshResponse.data) {
                    setDeliveryBoys(refreshResponse.data);
                    if (refreshResponse.pagination) {
                        setTotalPages(refreshResponse.pagination.pages);
                        setTotalDeliveryBoys(refreshResponse.pagination.total);
                    }
                }
            } else {
                setError('Failed to update delivery boy status: ' + (response.message || 'Unknown error'));
                setSuccessMessage('');
            }
        } catch (err: any) {
            console.error('Error updating delivery boy status:', err);
            setError('Failed to update delivery boy status: ' + (err.response?.data?.message || 'Please try again.'));
            setSuccessMessage('');
        } finally {
            setProcessing(null);
        }
    };

    const handleAvailabilityChange = async (deliveryBoyId: string, newAvailability: 'Available' | 'Not Available') => {
        try {
            setProcessing(deliveryBoyId);
            const response = await updateDeliveryBoyAvailability(deliveryBoyId, newAvailability);

            if (response.success) {
                // Update local state
                setDeliveryBoys(deliveryBoys.map(deliveryBoy =>
                    deliveryBoy._id === deliveryBoyId ? { ...deliveryBoy, available: newAvailability } : deliveryBoy
                ));
                setSuccessMessage(`Delivery boy availability updated to ${newAvailability} successfully!`);
                setError('');
                // Refresh list to get updated data
                const params: any = {
                    page: currentPage,
                    limit: rowsPerPage,
                    search: searchTerm,
                    sortBy: sortColumn || undefined,
                    sortOrder: sortDirection,
                };
                if (statusFilter !== 'All') params.status = statusFilter;
                if (availabilityFilter !== 'All') params.available = availabilityFilter;
                const refreshResponse = await getDeliveryBoys(params);
                if (refreshResponse.success && refreshResponse.data) {
                    setDeliveryBoys(refreshResponse.data);
                    if (refreshResponse.pagination) {
                        setTotalPages(refreshResponse.pagination.pages);
                        setTotalDeliveryBoys(refreshResponse.pagination.total);
                    }
                }
            } else {
                setError('Failed to update delivery boy availability: ' + (response.message || 'Unknown error'));
                setSuccessMessage('');
            }
        } catch (err: any) {
            console.error('Error updating delivery boy availability:', err);
            setError('Failed to update delivery boy availability: ' + (err.response?.data?.message || 'Please try again.'));
            setSuccessMessage('');
        } finally {
            setProcessing(null);
        }
    };

    const handleDelete = async (deliveryBoyId: string) => {
        if (!window.confirm('Are you sure you want to delete this delivery boy? This action cannot be undone.')) {
            return;
        }

        try {
            setProcessing(deliveryBoyId);
            const response = await deleteDeliveryBoy(deliveryBoyId);

            if (response.success) {
                setSuccessMessage('Delivery boy deleted successfully!');
                setError('');
                // Refresh list
                const params: any = {
                    page: currentPage,
                    limit: rowsPerPage,
                    search: searchTerm,
                    sortBy: sortColumn || undefined,
                    sortOrder: sortDirection,
                };
                if (statusFilter !== 'All') params.status = statusFilter;
                if (availabilityFilter !== 'All') params.available = availabilityFilter;
                const refreshResponse = await getDeliveryBoys(params);
                if (refreshResponse.success && refreshResponse.data) {
                    setDeliveryBoys(refreshResponse.data);
                    if (refreshResponse.pagination) {
                        setTotalPages(refreshResponse.pagination.pages);
                        setTotalDeliveryBoys(refreshResponse.pagination.total);
                    }
                }
            } else {
                setError('Failed to delete delivery boy: ' + (response.message || 'Unknown error'));
                setSuccessMessage('');
            }
        } catch (err: any) {
            console.error('Error deleting delivery boy:', err);
            setError('Failed to delete delivery boy: ' + (err.response?.data?.message || 'Please try again.'));
            setSuccessMessage('');
        } finally {
            setProcessing(null);
        }
    };

    const handleExport = () => {
        const headers = ['Id', 'Name', 'Mobile', 'Address', 'City', 'Commission', 'Balance', 'Cash Collected', 'Status', 'Available'];
        const csvContent = [
            headers.join(','),
            ...deliveryBoys.map(deliveryBoy => [
                deliveryBoy._id.slice(-6),
                `"${deliveryBoy.name}"`,
                deliveryBoy.mobile,
                `"${deliveryBoy.address}"`,
                `"${deliveryBoy.city}"`,
                deliveryBoy.commissionType === 'Percentage'
                    ? `"Commission ${deliveryBoy.commission}%"`
                    : 'Fixed',
                deliveryBoy.balance,
                deliveryBoy.cashCollected,
                deliveryBoy.status,
                deliveryBoy.available
            ].join(','))
        ].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `delivery_boys_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const SortIcon = ({ column }: { column: string }) => {
        // Map frontend column names to backend field names for comparison
        const columnMap: Record<string, string> = {
            'id': '_id',
            '_id': '_id',
            'name': 'name',
            'mobile': 'mobile',
            'city': 'city',
            'balance': 'balance',
            'cashCollected': 'cashCollected',
            'status': 'status',
            'available': 'available',
        };
        const backendColumn = columnMap[column] || column;
        
        return (
            <span className="text-neutral-400 text-xs ml-1">
                {sortColumn === backendColumn ? (sortDirection === 'asc' ? '↑' : '↓') : '⇅'}
            </span>
        );
    };

    // Use backend data directly (already paginated, filtered, and sorted)
    const displayedDeliveryBoys = deliveryBoys;
    const startIndex = (currentPage - 1) * rowsPerPage;

    return (
        <div className="flex flex-col h-full bg-gray-50">
            {/* Page Content */}
            <div className="flex-1 p-6">
                {/* Main Panel */}
                <div className="bg-white rounded-lg shadow-sm border border-neutral-200">
                    {/* Header */}
                    <div className="bg-teal-600 text-white px-6 py-4 rounded-t-lg">
                        <h2 className="text-lg font-semibold">View Delivery Boy List</h2>
                    </div>

                    {/* Error Message */}
                    {error && (
                        <div className="p-4 bg-red-50 border-l-4 border-red-500 text-red-700 flex items-center justify-between">
                            <p className="text-sm">{error}</p>
                            <button
                                onClick={() => setError('')}
                                className="text-red-700 hover:text-red-900 ml-4 text-lg font-bold"
                                type="button"
                            >
                                ×
                            </button>
                        </div>
                    )}

                    {/* Success Message */}
                    {successMessage && (
                        <div className="p-4 bg-green-50 border-l-4 border-green-500 text-green-700 flex items-center justify-between">
                            <p className="text-sm">{successMessage}</p>
                            <button
                                onClick={() => setSuccessMessage('')}
                                className="text-green-700 hover:text-green-900 ml-4 text-lg font-bold"
                                type="button"
                            >
                                ×
                            </button>
                        </div>
                    )}

                    {/* Controls */}
                    <div className="p-4 border-b border-neutral-200 flex flex-col gap-4">
                        {/* Filters Row */}
                        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
                            {/* Status Filter */}
                            <div className="flex items-center gap-2">
                                <label className="text-sm text-neutral-700 whitespace-nowrap">Status:</label>
                                <select
                                    value={statusFilter}
                                    onChange={(e) => {
                                        setStatusFilter(e.target.value);
                                        setCurrentPage(1);
                                    }}
                                    className="px-3 py-2 border border-neutral-300 rounded text-sm bg-white focus:ring-1 focus:ring-teal-500 focus:outline-none"
                                >
                                    <option value="All">All Status</option>
                                    <option value="Active">Active</option>
                                    <option value="Inactive">Inactive</option>
                                </select>
                            </div>

                            {/* Availability Filter */}
                            <div className="flex items-center gap-2">
                                <label className="text-sm text-neutral-700 whitespace-nowrap">Availability:</label>
                                <select
                                    value={availabilityFilter}
                                    onChange={(e) => {
                                        setAvailabilityFilter(e.target.value);
                                        setCurrentPage(1);
                                    }}
                                    className="px-3 py-2 border border-neutral-300 rounded text-sm bg-white focus:ring-1 focus:ring-teal-500 focus:outline-none"
                                >
                                    <option value="All">All Availability</option>
                                    <option value="Available">Available</option>
                                    <option value="Not Available">Not Available</option>
                                </select>
                            </div>

                            {/* Search */}
                            <div className="flex items-center gap-2">
                                <label className="text-sm text-neutral-700 whitespace-nowrap">Search:</label>
                                <input
                                    type="text"
                                    className="px-3 py-2 border border-neutral-300 rounded text-sm focus:ring-1 focus:ring-teal-500 focus:outline-none min-w-[200px]"
                                    value={searchTerm}
                                    onChange={(e) => {
                                        setSearchTerm(e.target.value);
                                        setCurrentPage(1);
                                    }}
                                    placeholder="Search by name, mobile, address..."
                                />
                            </div>
                        </div>

                        {/* Controls Row */}
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                            <div className="flex items-center gap-2">
                                <span className="text-sm text-neutral-600">Show</span>
                                <select
                                    value={rowsPerPage}
                                    onChange={(e) => {
                                        setRowsPerPage(Number(e.target.value));
                                        setCurrentPage(1);
                                    }}
                                    className="bg-white border border-neutral-300 rounded py-1.5 px-3 text-sm focus:ring-1 focus:ring-teal-500 focus:outline-none cursor-pointer"
                                >
                                    <option value={10}>10</option>
                                    <option value={20}>20</option>
                                    <option value={50}>50</option>
                                    <option value={100}>100</option>
                                </select>
                                <span className="text-sm text-neutral-600">entries</span>
                            </div>

                            <button
                                onClick={handleExport}
                                className="bg-teal-600 hover:bg-teal-700 text-white px-3 py-1.5 rounded text-sm font-medium flex items-center gap-1 transition-colors"
                            >
                                Export
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="6 9 12 15 18 9"></polyline>
                                </svg>
                            </button>
                        </div>
                    </div>

                    {/* Table */}
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-neutral-50 text-xs font-bold text-neutral-800 border-b border-neutral-200">
                                    <th
                                        className="p-4 cursor-pointer hover:bg-neutral-100 transition-colors"
                                        onClick={() => handleSort('id')}
                                    >
                                        <div className="flex items-center">
                                            Id <SortIcon column="id" />
                                        </div>
                                    </th>
                                    <th
                                        className="p-4 cursor-pointer hover:bg-neutral-100 transition-colors"
                                        onClick={() => handleSort('name')}
                                    >
                                        <div className="flex items-center">
                                            Name <SortIcon column="name" />
                                        </div>
                                    </th>
                                    <th
                                        className="p-4 cursor-pointer hover:bg-neutral-100 transition-colors"
                                        onClick={() => handleSort('mobile')}
                                    >
                                        <div className="flex items-center">
                                            Mobile <SortIcon column="mobile" />
                                        </div>
                                    </th>
                                    <th className="p-4">
                                        Address
                                    </th>
                                    <th
                                        className="p-4 cursor-pointer hover:bg-neutral-100 transition-colors"
                                        onClick={() => handleSort('city')}
                                    >
                                        <div className="flex items-center">
                                            City <SortIcon column="city" />
                                        </div>
                                    </th>
                                    <th className="p-4">
                                        Commission
                                    </th>
                                    <th
                                        className="p-4 cursor-pointer hover:bg-neutral-100 transition-colors"
                                        onClick={() => handleSort('balance')}
                                    >
                                        <div className="flex items-center">
                                            Balance <SortIcon column="balance" />
                                        </div>
                                    </th>
                                    <th
                                        className="p-4 cursor-pointer hover:bg-neutral-100 transition-colors"
                                        onClick={() => handleSort('cashCollected')}
                                    >
                                        <div className="flex items-center">
                                            Cash Collected <SortIcon column="cashCollected" />
                                        </div>
                                    </th>
                                    <th
                                        className="p-4 cursor-pointer hover:bg-neutral-100 transition-colors"
                                        onClick={() => handleSort('status')}
                                    >
                                        <div className="flex items-center">
                                            Status <SortIcon column="status" />
                                        </div>
                                    </th>
                                    <th
                                        className="p-4 cursor-pointer hover:bg-neutral-100 transition-colors"
                                        onClick={() => handleSort('available')}
                                    >
                                        <div className="flex items-center">
                                            Available <SortIcon column="available" />
                                        </div>
                                    </th>
                                    <th className="p-4">
                                        Action
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr>
                                        <td colSpan={11} className="p-8 text-center">
                                            <div className="flex items-center justify-center">
                                                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-teal-600 mr-2"></div>
                                                Loading delivery boys...
                                            </div>
                                        </td>
                                    </tr>
                                ) : error ? (
                                    <tr>
                                        <td colSpan={11} className="p-8 text-center text-red-600">
                                            {error}
                                        </td>
                                    </tr>
                                ) : displayedDeliveryBoys.length === 0 ? (
                                    <tr>
                                        <td colSpan={11} className="p-8 text-center text-neutral-400">
                                            No delivery boys found.
                                        </td>
                                    </tr>
                                ) : (
                                    displayedDeliveryBoys.map((deliveryBoy) => (
                                        <tr key={deliveryBoy._id} className="hover:bg-neutral-50 transition-colors text-sm text-neutral-700 border-b border-neutral-200">
                                            <td className="p-4 align-middle">{deliveryBoy._id.slice(-6)}</td>
                                            <td className="p-4 align-middle">{deliveryBoy.name}</td>
                                            <td className="p-4 align-middle">{deliveryBoy.mobile}</td>
                                            <td className="p-4 align-middle">{deliveryBoy.address}</td>
                                            <td className="p-4 align-middle">{deliveryBoy.city}</td>
                                            <td className="p-4 align-middle">
                                                {deliveryBoy.commissionType === 'Percentage' ? (
                                                    <div className="text-xs">
                                                        <div className="font-medium">Commission {deliveryBoy.commission}%</div>
                                                        <div className="text-neutral-500 mt-1">
                                                            Min Amt: {deliveryBoy.minAmount}
                                                        </div>
                                                        <div className="text-neutral-500">
                                                            Max Amt: {deliveryBoy.maxAmount}
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <span className="text-xs">Fixed</span>
                                                )}
                                            </td>
                                            <td className="p-4 align-middle">₹{deliveryBoy.balance.toFixed(2)}</td>
                                            <td className="p-4 align-middle">₹{deliveryBoy.cashCollected.toFixed(2)}</td>
                                            <td className="p-4 align-middle">
                                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${deliveryBoy.status === 'Active'
                                                    ? 'bg-green-100 text-green-800'
                                                    : 'bg-red-100 text-red-800'
                                                    }`}>
                                                    {deliveryBoy.status}
                                                </span>
                                            </td>
                                            <td className="p-4 align-middle">
                                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${deliveryBoy.available === 'Available'
                                                    ? 'bg-green-100 text-green-800'
                                                    : 'bg-red-100 text-red-800'
                                                    }`}>
                                                    {deliveryBoy.available}
                                                </span>
                                            </td>
                                            <td className="p-4 align-middle">
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        onClick={() => {
                                                            setSelectedDeliveryBoy(deliveryBoy);
                                                            setIsDetailModalOpen(true);
                                                        }}
                                                        className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                                        title="View Details"
                                                    >
                                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                                                            <circle cx="12" cy="12" r="3"></circle>
                                                        </svg>
                                                    </button>
                                                    <button
                                                        onClick={() => handleStatusChange(deliveryBoy._id, deliveryBoy.status === 'Active' ? 'Inactive' : 'Active')}
                                                        disabled={processing === deliveryBoy._id}
                                                        className={`p-1.5 rounded transition-colors ${deliveryBoy.status === 'Active'
                                                            ? 'text-red-600 hover:bg-red-50'
                                                            : 'text-green-600 hover:bg-green-50'
                                                            }`}
                                                        title={deliveryBoy.status === 'Active' ? 'Deactivate' : 'Activate'}
                                                    >
                                                        {deliveryBoy.status === 'Active' ? (
                                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                                <circle cx="12" cy="12" r="10"></circle>
                                                                <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line>
                                                            </svg>
                                                        ) : (
                                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                                <polyline points="20 6 9 17 4 12"></polyline>
                                                            </svg>
                                                        )}
                                                    </button>
                                                    <button
                                                        onClick={() => handleAvailabilityChange(deliveryBoy._id, deliveryBoy.available === 'Available' ? 'Not Available' : 'Available')}
                                                        disabled={processing === deliveryBoy._id}
                                                        className={`p-1.5 rounded transition-colors ${deliveryBoy.available === 'Available'
                                                            ? 'text-yellow-600 hover:bg-yellow-50'
                                                            : 'text-green-600 hover:bg-green-50'
                                                            }`}
                                                        title={deliveryBoy.available === 'Available' ? 'Mark as Not Available' : 'Mark as Available'}
                                                    >
                                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                            <circle cx="12" cy="12" r="10"></circle>
                                                            <path d="M9 12l2 2 4-4"></path>
                                                        </svg>
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(deliveryBoy._id)}
                                                        disabled={processing === deliveryBoy._id}
                                                        className="p-1.5 text-red-600 hover:bg-red-50 disabled:text-neutral-400 disabled:cursor-not-allowed rounded transition-colors"
                                                        title="Delete"
                                                    >
                                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                            <polyline points="3 6 5 6 21 6"></polyline>
                                                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                                        </svg>
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination Footer */}
                    <div className="px-4 sm:px-6 py-3 border-t border-neutral-200 flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-0">
                        <div className="text-xs sm:text-sm text-neutral-700">
                            Showing {displayedDeliveryBoys.length > 0 ? startIndex + 1 : 0} to {Math.min(startIndex + displayedDeliveryBoys.length, totalDeliveryBoys)} of {totalDeliveryBoys} entries
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                                disabled={currentPage === 1}
                                className={`p-2 border border-teal-600 rounded ${currentPage === 1
                                    ? 'text-neutral-400 cursor-not-allowed bg-neutral-50'
                                    : 'text-teal-600 hover:bg-teal-50'
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
                            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                                let pageNum;
                                if (totalPages <= 5) {
                                    pageNum = i + 1;
                                } else if (currentPage <= 3) {
                                    pageNum = i + 1;
                                } else if (currentPage >= totalPages - 2) {
                                    pageNum = totalPages - 4 + i;
                                } else {
                                    pageNum = currentPage - 2 + i;
                                }
                                return (
                                    <button
                                        key={pageNum}
                                        onClick={() => setCurrentPage(pageNum)}
                                        className={`px-3 py-1.5 border border-teal-600 rounded font-medium text-sm ${currentPage === pageNum
                                            ? 'bg-teal-600 text-white'
                                            : 'text-teal-600 hover:bg-teal-50'
                                            }`}
                                    >
                                        {pageNum}
                                    </button>
                                );
                            })}
                            {totalPages > 5 && currentPage < totalPages - 2 && (
                                <span className="px-2 text-neutral-400">...</span>
                            )}
                            <button
                                onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                                disabled={currentPage === totalPages}
                                className={`p-2 border border-teal-600 rounded ${currentPage === totalPages
                                    ? 'text-neutral-400 cursor-not-allowed bg-neutral-50'
                                    : 'text-teal-600 hover:bg-teal-50'
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
            <footer className="text-center py-4 text-sm text-neutral-600 border-t border-neutral-200 bg-white">
                Copyright © 2026. Developed By{' '}
                <a href="#" className="text-blue-600 hover:underline">Speedoo - Your Order Our Priority</a>
            </footer>

            {/* Delivery Boy Detail Modal */}
            {isDetailModalOpen && selectedDeliveryBoy && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50 overflow-y-auto">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
                        {/* Modal Header */}
                        <div className="bg-teal-600 text-white px-6 py-4 flex items-center justify-between sticky top-0 z-10">
                            <h3 className="text-xl font-bold">Delivery Partner Details</h3>
                            <button 
                                onClick={() => setIsDetailModalOpen(false)}
                                className="text-white hover:text-neutral-200 transition-colors"
                            >
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="18" y1="6" x2="6" y2="18"></line>
                                    <line x1="6" y1="6" x2="18" y2="18"></line>
                                </svg>
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="p-6 space-y-8">
                            {/* Personal Info Section */}
                            <div>
                                <h4 className="text-teal-700 font-bold border-b border-teal-100 pb-2 mb-4 flex items-center gap-2">
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                                        <circle cx="12" cy="7" r="4"></circle>
                                    </svg>
                                    Personal Information
                                </h4>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    <div>
                                        <p className="text-xs text-neutral-500 uppercase font-bold tracking-wider">Full Name</p>
                                        <p className="text-neutral-800 font-medium">{selectedDeliveryBoy.name}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-neutral-500 uppercase font-bold tracking-wider">Mobile</p>
                                        <p className="text-neutral-800 font-medium">+91 {selectedDeliveryBoy.mobile}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-neutral-500 uppercase font-bold tracking-wider">Email</p>
                                        <p className="text-neutral-800 font-medium">{selectedDeliveryBoy.email || 'N/A'}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-neutral-500 uppercase font-bold tracking-wider">Date of Birth</p>
                                        <p className="text-neutral-800 font-medium">
                                            {selectedDeliveryBoy.dateOfBirth ? new Date(selectedDeliveryBoy.dateOfBirth).toLocaleDateString('en-IN', {
                                                day: '2-digit',
                                                month: 'long',
                                                year: 'numeric'
                                            }) : 'N/A'}
                                        </p>
                                    </div>
                                    <div className="md:col-span-2">
                                        <p className="text-xs text-neutral-500 uppercase font-bold tracking-wider">Full Address</p>
                                        <p className="text-neutral-800 font-medium">{selectedDeliveryBoy.address}, {selectedDeliveryBoy.city} - {selectedDeliveryBoy.pincode}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Vehicle & Commission Details */}
                            <div>
                                <h4 className="text-teal-700 font-bold border-b border-teal-100 pb-2 mb-4 flex items-center gap-2">
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <rect x="2" y="7" width="20" height="15" rx="2" ry="2"></rect>
                                        <polyline points="17 2 12 7 7 2"></polyline>
                                    </svg>
                                    Vehicle & Commission Details
                                </h4>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-neutral-50 p-4 rounded-lg border border-neutral-100">
                                    <div>
                                        <p className="text-xs text-neutral-500 uppercase font-bold tracking-wider">Vehicle Type</p>
                                        <p className="text-neutral-800 font-medium">{selectedDeliveryBoy.vehicleType || 'N/A'}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-neutral-500 uppercase font-bold tracking-wider">Vehicle Number</p>
                                        <p className="text-neutral-800 font-medium">{selectedDeliveryBoy.vehicleNumber || 'N/A'}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-neutral-500 uppercase font-bold tracking-wider">Bonus Type</p>
                                        <p className="text-neutral-800 font-medium">{selectedDeliveryBoy.bonusType || 'N/A'}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Bank Info Section */}
                            <div>
                                <h4 className="text-teal-700 font-bold border-b border-teal-100 pb-2 mb-4 flex items-center gap-2">
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <rect x="2" y="5" width="20" height="14" rx="2"></rect>
                                        <line x1="2" y1="10" x2="22" y2="10"></line>
                                    </svg>
                                    Bank Account Details
                                </h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-neutral-50 p-4 rounded-lg border border-neutral-100">
                                    <div>
                                        <p className="text-xs text-neutral-500 uppercase font-bold tracking-wider">Account Holder Name</p>
                                        <p className="text-neutral-800 font-medium">{selectedDeliveryBoy.accountName || 'N/A'}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-neutral-500 uppercase font-bold tracking-wider">Bank Name</p>
                                        <p className="text-neutral-800 font-medium">{selectedDeliveryBoy.bankName || 'N/A'}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-neutral-500 uppercase font-bold tracking-wider">Account Number</p>
                                        <p className="text-neutral-800 font-medium">{selectedDeliveryBoy.bankAccountNumber || (selectedDeliveryBoy as any).accountNumber || 'N/A'}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-neutral-500 uppercase font-bold tracking-wider">IFSC Code</p>
                                        <p className="text-neutral-800 font-medium font-mono">{selectedDeliveryBoy.ifscCode || 'N/A'}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Documents Section */}
                            <div>
                                <h4 className="text-teal-700 font-bold border-b border-teal-100 pb-2 mb-4 flex items-center gap-2">
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                        <polyline points="14 2 14 8 20 8"></polyline>
                                        <line x1="16" y1="13" x2="8" y2="13"></line>
                                        <line x1="16" y1="17" x2="8" y2="17"></line>
                                        <polyline points="10 9 9 9 8 9"></polyline>
                                    </svg>
                                    Uploaded Documents
                                </h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {/* Driving License */}
                                    <div className="border border-neutral-200 rounded-lg overflow-hidden group">
                                        <div className="bg-neutral-100 px-4 py-2 border-b border-neutral-200 flex justify-between items-center">
                                            <span className="text-sm font-bold text-neutral-700">Driving License</span>
                                            {selectedDeliveryBoy.drivingLicense && (
                                                <a 
                                                    href={selectedDeliveryBoy.drivingLicense} 
                                                    target="_blank" 
                                                    rel="noopener noreferrer"
                                                    className="text-teal-600 hover:text-teal-700 text-xs font-bold underline"
                                                >
                                                    View Full
                                                </a>
                                            )}
                                        </div>
                                        <div className="p-2 flex justify-center bg-neutral-50 min-h-[200px] items-center">
                                            {selectedDeliveryBoy.drivingLicense ? (
                                                selectedDeliveryBoy.drivingLicense.toLowerCase().endsWith('.pdf') ? (
                                                    <div className="flex flex-col items-center gap-2 text-neutral-500">
                                                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                                            <polyline points="14 2 14 8 20 8"></polyline>
                                                        </svg>
                                                        <span className="text-xs">PDF Document</span>
                                                    </div>
                                                ) : (
                                                    <img 
                                                        src={selectedDeliveryBoy.drivingLicense} 
                                                        alt="Driving License" 
                                                        className="max-h-[300px] rounded object-contain transition-transform group-hover:scale-[1.02]"
                                                    />
                                                )
                                            ) : (
                                                <span className="text-sm text-neutral-400 italic">Not Uploaded</span>
                                            )}
                                        </div>
                                    </div>

                                    {/* National ID */}
                                    <div className="border border-neutral-200 rounded-lg overflow-hidden group">
                                        <div className="bg-neutral-100 px-4 py-2 border-b border-neutral-200 flex justify-between items-center">
                                            <span className="text-sm font-bold text-neutral-700">National ID Card</span>
                                            {selectedDeliveryBoy.nationalIdentityCard && (
                                                <a 
                                                    href={selectedDeliveryBoy.nationalIdentityCard} 
                                                    target="_blank" 
                                                    rel="noopener noreferrer"
                                                    className="text-teal-600 hover:text-teal-700 text-xs font-bold underline"
                                                >
                                                    View Full
                                                </a>
                                            )}
                                        </div>
                                        <div className="p-2 flex justify-center bg-neutral-50 min-h-[200px] items-center">
                                            {selectedDeliveryBoy.nationalIdentityCard ? (
                                                selectedDeliveryBoy.nationalIdentityCard.toLowerCase().endsWith('.pdf') ? (
                                                    <div className="flex flex-col items-center gap-2 text-neutral-500">
                                                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                                            <polyline points="14 2 14 8 20 8"></polyline>
                                                        </svg>
                                                        <span className="text-xs">PDF Document</span>
                                                    </div>
                                                ) : (
                                                    <img 
                                                        src={selectedDeliveryBoy.nationalIdentityCard} 
                                                        alt="National ID Card" 
                                                        className="max-h-[300px] rounded object-contain transition-transform group-hover:scale-[1.02]"
                                                    />
                                                )
                                            ) : (
                                                <span className="text-sm text-neutral-400 italic">Not Uploaded</span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Status & Actions Section */}
                            <div className="bg-teal-50 p-6 rounded-xl border border-teal-100 flex flex-col sm:flex-row items-center justify-between gap-6">
                                <div className="flex items-center gap-4">
                                    <div>
                                        <p className="text-xs text-teal-600 uppercase font-bold tracking-wider">Current Status</p>
                                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-bold mt-1 ${
                                            selectedDeliveryBoy.status === 'Active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                                        }`}>
                                            {selectedDeliveryBoy.status}
                                        </span>
                                    </div>
                                    <div>
                                        <p className="text-xs text-teal-600 uppercase font-bold tracking-wider">Availability</p>
                                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-bold mt-1 ${
                                            selectedDeliveryBoy.available === 'Available' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                                        }`}>
                                            {selectedDeliveryBoy.available}
                                        </span>
                                    </div>
                                </div>
                                <div className="flex flex-wrap gap-3">
                                    {showRejectInput ? (
                                        <div className="flex flex-col gap-2 w-full sm:w-auto">
                                            <input 
                                                type="text"
                                                placeholder="Enter rejection reason..."
                                                value={rejectionReason}
                                                onChange={(e) => setRejectionReason(e.target.value)}
                                                className="px-3 py-2 border border-neutral-300 rounded focus:outline-none focus:border-red-500 text-sm"
                                            />
                                            <div className="flex gap-2 justify-end">
                                                <button
                                                    onClick={() => setShowRejectInput(false)}
                                                    className="px-3 py-1 bg-neutral-200 text-neutral-700 rounded hover:bg-neutral-300 text-sm font-bold transition-colors"
                                                >
                                                    Cancel
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        if (!rejectionReason.trim()) {
                                                            alert("Please provide a reason for rejection.");
                                                            return;
                                                        }
                                                        handleStatusChange(selectedDeliveryBoy._id, 'Rejected', rejectionReason);
                                                        setShowRejectInput(false);
                                                    }}
                                                    disabled={processing === selectedDeliveryBoy._id}
                                                    className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 text-sm font-bold transition-colors"
                                                >
                                                    Confirm Reject
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <>
                                            {selectedDeliveryBoy.status === 'Active' && (
                                                <button
                                                    onClick={() => handleStatusChange(selectedDeliveryBoy._id, 'Inactive')}
                                                    disabled={processing === selectedDeliveryBoy._id}
                                                    className="px-4 py-2 bg-amber-500 text-white rounded-lg font-bold text-sm hover:bg-amber-600 transition-all shadow-sm"
                                                >
                                                    Deactivate Rider
                                                </button>
                                            )}
                                            {(selectedDeliveryBoy.status === 'Inactive' || selectedDeliveryBoy.status === 'Rejected') && (
                                                <button
                                                    onClick={() => handleStatusChange(selectedDeliveryBoy._id, 'Active')}
                                                    disabled={processing === selectedDeliveryBoy._id}
                                                    className="px-4 py-2 bg-green-600 text-white rounded-lg font-bold text-sm hover:bg-green-700 transition-all shadow-sm"
                                                >
                                                    Approve & Activate
                                                </button>
                                            )}
                                            {selectedDeliveryBoy.status !== 'Rejected' && (
                                                <button
                                                    onClick={() => {
                                                        setRejectionReason('');
                                                        setShowRejectInput(true);
                                                    }}
                                                    disabled={processing === selectedDeliveryBoy._id}
                                                    className="px-4 py-2 bg-red-600 text-white rounded-lg font-bold text-sm hover:bg-red-700 transition-all shadow-sm"
                                                >
                                                    Reject Rider
                                                </button>
                                            )}
                                            <button
                                                onClick={() => handleAvailabilityChange(selectedDeliveryBoy._id, selectedDeliveryBoy.available === 'Available' ? 'Not Available' : 'Available')}
                                                disabled={processing === selectedDeliveryBoy._id}
                                                className="px-4 py-2 bg-neutral-600 text-white rounded-lg font-bold text-sm hover:bg-neutral-700 transition-all shadow-sm"
                                            >
                                                Toggle Availability
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="bg-neutral-50 px-6 py-4 border-t border-neutral-200 flex justify-end">
                            <button 
                                onClick={() => setIsDetailModalOpen(false)}
                                className="px-6 py-2 bg-neutral-200 text-neutral-700 rounded-lg font-bold text-sm hover:bg-neutral-300 transition-all"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

