import { useState, useEffect } from "react";
import {
  getReturnRequests,
  updateReturnRequest,
  assignReturnDeliveryBoy,
  type MiscReturnRequest as ReturnRequest,
} from "../../../services/api/admin/adminMiscService";
import { getDeliveryBoys, type DeliveryBoy } from "../../../services/api/admin/adminDeliveryService";
import { useAuth } from "../../../context/AuthContext";
import useScrollLock from "../../../hooks/useScrollLock";

export default function AdminReturnRequest() {
  const { isAuthenticated, token } = useAuth();
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [selectedSeller, setSelectedSeller] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [entriesPerPage, setEntriesPerPage] = useState(10);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [returnRequests, setReturnRequests] = useState<ReturnRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Details Modal and Refund/Rider States
  const [selectedRequest, setSelectedRequest] = useState<ReturnRequest | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [deliveryBoys, setDeliveryBoys] = useState<DeliveryBoy[]>([]);
  const [loadingDeliveryBoys, setLoadingDeliveryBoys] = useState(false);
  const [selectedRiderId, setSelectedRiderId] = useState("");
  const [transactionIdInput, setTransactionIdInput] = useState("");
  const [submittingAction, setSubmittingAction] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  useScrollLock(showDetailsModal);

  // Fetch Delivery Boys for manual assignment
  useEffect(() => {
    if (showDetailsModal) {
      const fetchRiders = async () => {
        try {
          setLoadingDeliveryBoys(true);
          const res = await getDeliveryBoys({ status: "Active" });
          if (res.success && res.data) {
            setDeliveryBoys(res.data);
          }
        } catch (err) {
          console.error("Error loading delivery boys:", err);
        } finally {
          setLoadingDeliveryBoys(false);
        }
      };
      fetchRiders();
    }
  }, [showDetailsModal]);

  const handleOpenDetails = (request: ReturnRequest) => {
    setSelectedRequest(request);
    setShowDetailsModal(true);
    setModalError(null);
    setTransactionIdInput("");
    setSelectedRiderId(request.deliveryBoy?._id || request.deliveryBoy || "");
  };

  const handleAssignRider = async () => {
    if (!selectedRequest || !selectedRiderId) return;
    try {
      setSubmittingAction(true);
      setModalError(null);
      const res = await assignReturnDeliveryBoy(selectedRequest._id, selectedRiderId);
      if (res.success) {
        alert("Delivery rider assigned successfully!");
        // Update local state details
        setSelectedRequest(prev => prev ? { ...prev, deliveryBoy: selectedRiderId } : null);
        // Refresh requests list
        handleRefreshList();
      } else {
        setModalError(res.message || "Failed to assign delivery boy");
      }
    } catch (err: any) {
      setModalError(err.response?.data?.message || err.message || "Failed to assign delivery boy");
    } finally {
      setSubmittingAction(false);
    }
  };

  const handleProcessRefund = async () => {
    if (!selectedRequest) return;
    if (!transactionIdInput.trim()) {
      setModalError("Please enter offline bank transaction reference ID");
      return;
    }
    try {
      setSubmittingAction(true);
      setModalError(null);
      const res = await updateReturnRequest(selectedRequest._id, {
        status: "Refunded",
        transactionId: transactionIdInput.trim()
      });
      if (res.success) {
        alert("Refund processed successfully!");
        setShowDetailsModal(false);
        handleRefreshList();
      } else {
        setModalError(res.message || "Failed to process refund");
      }
    } catch (err: any) {
      setModalError(err.response?.data?.message || err.message || "Failed to process refund");
    } finally {
      setSubmittingAction(false);
    }
  };

  const handleAdminOverrideStatus = async (status: "Approved" | "Rejected") => {
    if (!selectedRequest) return;
    const reason = status === "Rejected" ? prompt("Enter rejection reason:") : null;
    if (status === "Rejected" && !reason) return;

    try {
      setSubmittingAction(true);
      setModalError(null);
      const res = await updateReturnRequest(selectedRequest._id, {
        status,
        adminNotes: reason || undefined
      });
      if (res.success) {
        alert(`Return status overridden to ${status} successfully!`);
        setShowDetailsModal(false);
        handleRefreshList();
      } else {
        setModalError(res.message || `Failed to update status to ${status}`);
      }
    } catch (err: any) {
      setModalError(err.response?.data?.message || err.message || `Failed to update status to ${status}`);
    } finally {
      setSubmittingAction(false);
    }
  };

  const handleRefreshList = async () => {
    const params: any = {
      page: currentPage,
      limit: entriesPerPage,
    };
    if (selectedStatus !== "all") params.status = selectedStatus;
    if (searchTerm) params.search = searchTerm;
    const response = await getReturnRequests(params);
    if (response.success) {
      setReturnRequests(response.data);
    }
  };

  // Fetch return requests on component mount
  useEffect(() => {
    if (!isAuthenticated || !token) {
      setLoading(false);
      return;
    }

    const fetchReturnRequests = async () => {
      try {
        setLoading(true);
        setError(null);

        const params: any = {
          page: currentPage,
          limit: entriesPerPage,
        };

        if (selectedStatus !== "all") {
          params.status = selectedStatus;
        }

        if (searchTerm) {
          params.search = searchTerm;
        }

        const response = await getReturnRequests(params);

        if (response.success) {
          setReturnRequests(response.data);
        } else {
          setError("Failed to load return requests");
        }
      } catch (err: any) {
        console.error("Error fetching return requests:", err);
        setError(
          err.response?.data?.message ||
          "Failed to load return requests. Please try again."
        );
      } finally {
        setLoading(false);
      }
    };

    fetchReturnRequests();
  }, [
    isAuthenticated,
    token,
    currentPage,
    entriesPerPage,
    selectedStatus,
    searchTerm,
  ]);

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  };

  // Note: Filtering is done server-side, so we just use the returnRequests as is
  const displayedRequests = returnRequests;

  // For pagination display (simplified - in real app, this would come from API)
  const totalPages = Math.ceil(displayedRequests.length / entriesPerPage);
  const startIndex = (currentPage - 1) * entriesPerPage;
  const endIndex = startIndex + entriesPerPage;

  const handleApproveReturn = async (requestId: string) => {
    try {
      setUpdating(requestId);
      const response = await updateReturnRequest(requestId, {
        status: "Approved",
      });

      if (response.success) {
        // Update local state
        setReturnRequests((requests) =>
          requests.map((req) =>
            req._id === requestId ? { ...req, status: "Approved" } : req
          )
        );
        alert("Return request approved successfully!");
      } else {
        alert(
          "Failed to approve return request: " +
          (response.message || "Unknown error")
        );
      }
    } catch (err: any) {
      console.error("Error approving return request:", err);
      alert(
        "Failed to approve return request: " +
        (err.response?.data?.message || "Please try again.")
      );
    } finally {
      setUpdating(null);
    }
  };

  const handleRejectReturn = async (requestId: string) => {
    const reason = prompt("Enter rejection reason:");
    if (!reason) return;

    try {
      setUpdating(requestId);
      const response = await updateReturnRequest(requestId, {
        status: "Rejected",
        adminNotes: reason,
      });

      if (response.success) {
        // Update local state
        setReturnRequests((requests) =>
          requests.map((req) =>
            req._id === requestId ? { ...req, status: "Rejected" } : req
          )
        );
        alert("Return request rejected successfully!");
      } else {
        alert(
          "Failed to reject return request: " +
          (response.message || "Unknown error")
        );
      }
    } catch (err: any) {
      console.error("Error rejecting return request:", err);
      alert(
        "Failed to reject return request: " +
        (err.response?.data?.message || "Please try again.")
      );
    } finally {
      setUpdating(null);
    }
  };

  const handleExport = () => {
    alert("Export functionality will be implemented here");
  };

  const handleClearDate = () => {
    setFromDate("");
    setToDate("");
  };

  const sellers = ["All Seller", "Seller 1", "Seller 2", "Seller 3"];

  const statuses = [
    "All Status",
    "Pending",
    "Approved",
    "Rejected",
    "Completed",
  ];

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0">
        
          <div className="flex items-center gap-2">
            <button onClick={() => window.history.back()} className="p-1 sm:p-2 text-neutral-600 hover:text-neutral-900 bg-neutral-100 hover:bg-neutral-200 rounded-lg transition-colors" aria-label="Go back">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
            </button>
            <h1 className="text-2xl font-semibold text-neutral-800">
          Return Request
        </h1>
          </div>
        <div className="text-sm text-neutral-600">
          <span className="text-teal-600 hover:text-teal-700 cursor-pointer">
            Home
          </span>
          <span className="mx-2">/</span>
          <span className="text-neutral-800">Return Request</span>
        </div>
      </div>

      {/* Main Content Card */}
      <div className="bg-white rounded-lg shadow-sm border border-neutral-200 overflow-hidden">
        {/* Green Header Bar */}
        <div className="bg-green-500 px-4 sm:px-6 py-3">
          <h2 className="text-white text-lg font-semibold">
            View Return Request
          </h2>
        </div>

        {/* Filters */}
        <div className="p-4 sm:p-6 border-b border-neutral-200">
          <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
            {/* Left Side Filters */}
            <div className="flex flex-col sm:flex-row gap-3 flex-1 flex-wrap">
              {/* From - To Date */}
              <div className="flex items-center gap-2">
                <label className="text-sm text-neutral-700 whitespace-nowrap">
                  From - To Date:
                </label>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="absolute left-3 top-1/2 transform -translate-y-1/2 text-neutral-400">
                      <rect
                        x="3"
                        y="4"
                        width="18"
                        height="18"
                        rx="2"
                        ry="2"></rect>
                      <line x1="16" y1="2" x2="16" y2="6"></line>
                      <line x1="8" y1="2" x2="8" y2="6"></line>
                      <line x1="3" y1="10" x2="21" y2="10"></line>
                    </svg>
                    <input
                      type="text"
                      value={fromDate}
                      onChange={(e) => setFromDate(e.target.value)}
                      placeholder="MM/DD/YYYY"
                      className="pl-10 pr-3 py-2 border border-neutral-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-green-500 focus:border-green-500 min-w-[140px]"
                    />
                  </div>
                  <span className="text-neutral-500">-</span>
                  <div className="relative">
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="absolute left-3 top-1/2 transform -translate-y-1/2 text-neutral-400">
                      <rect
                        x="3"
                        y="4"
                        width="18"
                        height="18"
                        rx="2"
                        ry="2"></rect>
                      <line x1="16" y1="2" x2="16" y2="6"></line>
                      <line x1="8" y1="2" x2="8" y2="6"></line>
                      <line x1="3" y1="10" x2="21" y2="10"></line>
                    </svg>
                    <input
                      type="text"
                      value={toDate}
                      onChange={(e) => setToDate(e.target.value)}
                      placeholder="MM/DD/YYYY"
                      className="pl-10 pr-3 py-2 border border-neutral-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-green-500 focus:border-green-500 min-w-[140px]"
                    />
                  </div>
                  <button
                    onClick={handleClearDate}
                    className="px-3 py-2 bg-neutral-700 hover:bg-neutral-800 text-white rounded text-sm transition-colors">
                    Clear
                  </button>
                </div>
              </div>

              {/* Filter by Seller */}
              <div className="flex items-center gap-2">
                <label className="text-sm text-neutral-700 whitespace-nowrap">
                  Filter by Seller:
                </label>
                <select
                  value={selectedSeller}
                  onChange={(e) => {
                    setSelectedSeller(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="px-3 py-2 border border-neutral-300 rounded text-sm bg-white focus:outline-none focus:ring-1 focus:ring-green-500 focus:border-green-500 min-w-[130px]">
                  {sellers.map((seller) => (
                    <option
                      key={seller}
                      value={seller === "All Seller" ? "all" : seller}>
                      {seller}
                    </option>
                  ))}
                </select>
              </div>

              {/* Filter by Status */}
              <div className="flex items-center gap-2">
                <label className="text-sm text-neutral-700 whitespace-nowrap">
                  Filter by Status:
                </label>
                <select
                  value={selectedStatus}
                  onChange={(e) => {
                    setSelectedStatus(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="px-3 py-2 border border-neutral-300 rounded text-sm bg-white focus:outline-none focus:ring-1 focus:ring-green-500 focus:border-green-500 min-w-[130px]">
                  {statuses.map((status) => (
                    <option
                      key={status}
                      value={status === "All Status" ? "all" : status}>
                      {status}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Right Side Controls */}
            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
              {/* Per Page */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-neutral-700">Per Page:</span>
                <select
                  value={entriesPerPage}
                  onChange={(e) => {
                    setEntriesPerPage(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="px-2 py-1 border border-neutral-300 rounded text-sm bg-white focus:outline-none focus:ring-1 focus:ring-green-500 focus:border-green-500">
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>

              {/* Export Button */}
              <button
                onClick={handleExport}
                className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded text-sm font-medium flex items-center gap-2 transition-colors">
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                  <polyline points="7 10 12 15 17 10"></polyline>
                  <line x1="12" y1="15" x2="12" y2="3"></line>
                </svg>
                Export
                <svg
                  width="10"
                  height="10"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round">
                  <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
              </button>

              {/* Search */}
              <div className="flex items-center gap-2">
                <label className="text-sm text-neutral-700">Search:</label>
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setCurrentPage(1);
                  }}
                  placeholder="Search:"
                  className="px-3 py-2 border border-neutral-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-green-500 focus:border-green-500 min-w-[150px]"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1400px]">
            <thead className="bg-neutral-50 border-b border-neutral-200">
              <tr>
                <th
                  className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-neutral-700 uppercase tracking-wider cursor-pointer hover:bg-neutral-100"
                  onClick={() => handleSort("orderItemId")}>
                  <div className="flex items-center gap-2">
                    Order Item Id
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      className="text-neutral-400">
                      <path
                        d="M7 10L12 5L17 10M7 14L12 19L17 14"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                </th>
                <th
                  className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-neutral-700 uppercase tracking-wider cursor-pointer hover:bg-neutral-100"
                  onClick={() => handleSort("user")}>
                  <div className="flex items-center gap-2">
                    User
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      className="text-neutral-400">
                      <path
                        d="M7 10L12 5L17 10M7 14L12 19L17 14"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                </th>
                <th
                  className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-neutral-700 uppercase tracking-wider cursor-pointer hover:bg-neutral-100"
                  onClick={() => handleSort("product")}>
                  <div className="flex items-center gap-2">
                    Product
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      className="text-neutral-400">
                      <path
                        d="M7 10L12 5L17 10M7 14L12 19L17 14"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                </th>
                <th
                  className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-neutral-700 uppercase tracking-wider cursor-pointer hover:bg-neutral-100"
                  onClick={() => handleSort("variant")}>
                  <div className="flex items-center gap-2">
                    Variant
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      className="text-neutral-400">
                      <path
                        d="M7 10L12 5L17 10M7 14L12 19L17 14"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                </th>
                <th
                  className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-neutral-700 uppercase tracking-wider cursor-pointer hover:bg-neutral-100"
                  onClick={() => handleSort("price")}>
                  <div className="flex items-center gap-2">
                    Price
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      className="text-neutral-400">
                      <path
                        d="M7 10L12 5L17 10M7 14L12 19L17 14"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                </th>
                <th
                  className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-neutral-700 uppercase tracking-wider cursor-pointer hover:bg-neutral-100"
                  onClick={() => handleSort("discPrice")}>
                  <div className="flex items-center gap-2">
                    Disc Price
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      className="text-neutral-400">
                      <path
                        d="M7 10L12 5L17 10M7 14L12 19L17 14"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                </th>
                <th
                  className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-neutral-700 uppercase tracking-wider cursor-pointer hover:bg-neutral-100"
                  onClick={() => handleSort("quantity")}>
                  <div className="flex items-center gap-2">
                    Quantity
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      className="text-neutral-400">
                      <path
                        d="M7 10L12 5L17 10M7 14L12 19L17 14"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                </th>
                <th
                  className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-neutral-700 uppercase tracking-wider cursor-pointer hover:bg-neutral-100"
                  onClick={() => handleSort("total")}>
                  <div className="flex items-center gap-2">
                    Total
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      className="text-neutral-400">
                      <path
                        d="M7 10L12 5L17 10M7 14L12 19L17 14"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                </th>
                <th
                  className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-neutral-700 uppercase tracking-wider cursor-pointer hover:bg-neutral-100"
                  onClick={() => handleSort("status")}>
                  <div className="flex items-center gap-2">
                    Status
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      className="text-neutral-400">
                      <path
                        d="M7 10L12 5L17 10M7 14L12 19L17 14"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                </th>
                <th
                  className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-neutral-700 uppercase tracking-wider cursor-pointer hover:bg-neutral-100"
                  onClick={() => handleSort("date")}>
                  <div className="flex items-center gap-2">
                    Date
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      className="text-neutral-400">
                      <path
                        d="M7 10L12 5L17 10M7 14L12 19L17 14"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                </th>
                <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-neutral-700 uppercase tracking-wider">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-neutral-200">
              {loading ? (
                <tr>
                  <td colSpan={11} className="px-4 sm:px-6 py-8 text-center">
                    <div className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-teal-600 mr-2"></div>
                      Loading return requests...
                    </div>
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td
                    colSpan={11}
                    className="px-4 sm:px-6 py-8 text-center text-red-600">
                    {error}
                  </td>
                </tr>
              ) : displayedRequests.length === 0 ? (
                <tr>
                  <td
                    colSpan={11}
                    className="px-4 sm:px-6 py-8 text-center text-sm text-neutral-500">
                    No return requests found
                  </td>
                </tr>
              ) : (
                displayedRequests.map((request) => (
                  <tr key={request._id} className="hover:bg-neutral-50">
                    <td className="px-4 sm:px-6 py-3 text-sm text-neutral-900">
                      {request.orderItemId}
                    </td>
                    <td className="px-4 sm:px-6 py-3 text-sm text-neutral-900 font-medium">
                      {request.userName}
                    </td>
                    <td className="px-4 sm:px-6 py-3 text-sm text-neutral-600">
                      {request.productName}
                    </td>
                    <td className="px-4 sm:px-6 py-3 text-sm text-neutral-600">
                      {request.variant || "-"}
                    </td>
                    <td className="px-4 sm:px-6 py-3 text-sm text-neutral-900">
                      ₹{request.price.toFixed(2)}
                    </td>
                    <td className="px-4 sm:px-6 py-3 text-sm text-neutral-900">
                      ₹{(request.discountedPrice || request.price).toFixed(2)}
                    </td>
                    <td className="px-4 sm:px-6 py-3 text-sm text-neutral-600">
                      {request.quantity}
                    </td>
                    <td className="px-4 sm:px-6 py-3 text-sm text-neutral-900 font-medium">
                      ₹{request.total.toFixed(2)}
                    </td>
                    <td className="px-4 sm:px-6 py-3">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${request.status === "Approved"
                          ? "bg-green-100 text-green-800"
                          : request.status === "Pending"
                            ? "bg-yellow-100 text-yellow-800"
                            : request.status === "Rejected"
                              ? "bg-red-100 text-red-800"
                              : "bg-blue-100 text-blue-800"
                          }`}>
                        {request.status}
                      </span>
                    </td>
                    <td className="px-4 sm:px-6 py-3 text-sm text-neutral-600">
                      {new Date(request.requestedAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 sm:px-6 py-3">
                      <button
                        onClick={() => handleOpenDetails(request)}
                        className="px-2.5 py-1.5 text-xs font-semibold bg-teal-50 hover:bg-teal-100 text-teal-700 rounded transition-colors"
                      >
                        Details
                      </button>
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
            Showing {startIndex + 1} to{" "}
            {Math.min(endIndex, displayedRequests.length)} of{" "}
            {displayedRequests.length} entries
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
              disabled={currentPage === 1 || totalPages === 0}
              className={`p-2 border border-green-300 rounded bg-white ${currentPage === 1 || totalPages === 0
                ? "text-neutral-400 cursor-not-allowed"
                : "text-neutral-700 hover:bg-green-50"
                }`}
              aria-label="Previous page">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg">
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
              onClick={() =>
                setCurrentPage((prev) => Math.min(totalPages, prev + 1))
              }
              disabled={currentPage === totalPages || totalPages === 0}
              className={`p-2 border border-green-300 rounded bg-white ${currentPage === totalPages || totalPages === 0
                ? "text-neutral-400 cursor-not-allowed"
                : "text-neutral-700 hover:bg-green-50"
                }`}
              aria-label="Next page">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg">
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

      {/* Return Request Details Modal */}
      {showDetailsModal && selectedRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50 overflow-y-auto font-sans">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col my-8">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200 bg-neutral-50 rounded-t-lg">
              <div>
                <h2 className="text-lg font-bold text-neutral-900">Return Request Details</h2>
                <p className="text-xs text-neutral-500 mt-0.5">Request ID: {selectedRequest._id}</p>
              </div>
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

            {/* Body */}
            <div className="p-6 overflow-y-auto flex-1 space-y-6">
              {modalError && (
                <div className="p-3.5 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
                  {modalError}
                </div>
              )}

              {/* Product and Order details */}
              <div className="bg-neutral-50 p-4 rounded-xl border border-neutral-200 space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-neutral-500 font-semibold uppercase">Product</p>
                    <p className="text-sm font-semibold text-neutral-800">{selectedRequest.productName}</p>
                  </div>
                  <div>
                    <p className="text-xs text-neutral-500 font-semibold uppercase">Variant</p>
                    <p className="text-sm font-semibold text-neutral-800">{selectedRequest.variant || "N/A"}</p>
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-2 pt-2 border-t border-neutral-200/60">
                  <div>
                    <p className="text-[10px] text-neutral-500 uppercase font-semibold">Price</p>
                    <p className="text-xs font-medium text-neutral-800">₹{selectedRequest.price?.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-neutral-500 uppercase font-semibold">Disc. Price</p>
                    <p className="text-xs font-medium text-neutral-800">₹{(selectedRequest.discountedPrice || selectedRequest.price)?.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-neutral-500 uppercase font-semibold">Qty</p>
                    <p className="text-xs font-semibold text-neutral-800">{selectedRequest.quantity}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-neutral-500 uppercase font-semibold">Total Amount</p>
                    <p className="text-xs font-bold text-green-700">₹{selectedRequest.total?.toFixed(2)}</p>
                  </div>
                </div>
              </div>

              {/* Customer Info */}
              <div className="grid grid-cols-2 gap-4 border-b border-neutral-100 pb-4">
                <div>
                  <p className="text-xs text-neutral-500 font-semibold uppercase">Customer Name</p>
                  <p className="text-sm font-medium text-neutral-800">{selectedRequest.userName || "N/A"}</p>
                </div>
                <div>
                  <p className="text-xs text-neutral-500 font-semibold uppercase">Customer Phone</p>
                  <p className="text-sm font-medium text-neutral-800">{selectedRequest.userPhone || "N/A"}</p>
                </div>
              </div>

              {/* Reason & Comments */}
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-neutral-500 font-semibold uppercase">Return Reason</p>
                  <span className="inline-block mt-1 px-3 py-1 bg-red-50 text-red-700 border border-red-100 font-bold rounded text-xs">
                    {selectedRequest.reason || "N/A"}
                  </span>
                </div>
                {selectedRequest.description && (
                  <div>
                    <p className="text-xs text-neutral-500 font-semibold uppercase">Customer Notes</p>
                    <div className="p-3 bg-neutral-50 border border-neutral-200 rounded text-sm text-neutral-700 mt-1">
                      {selectedRequest.description}
                    </div>
                  </div>
                )}
              </div>

              {/* Customer Uploaded Images */}
              {selectedRequest.images && selectedRequest.images.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs text-neutral-500 font-semibold uppercase">Customer Uploaded Images</p>
                  <div className="flex flex-wrap gap-2.5">
                    {selectedRequest.images.map((img: string, idx: number) => (
                      <a key={idx} href={img} target="_blank" rel="noopener noreferrer" className="relative w-20 h-20 rounded-lg border border-neutral-200 overflow-hidden hover:opacity-90 transition-opacity">
                        <img src={img} alt="customer upload" className="w-full h-full object-cover" />
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Payment details (Admin View) */}
              <div className="p-4 bg-teal-50/50 border border-teal-100 rounded-xl space-y-3">
                <p className="text-xs font-bold text-teal-900 uppercase tracking-wider">Refund Payout Details (Admin Only)</p>
                {selectedRequest.refundMethod === "UPI" ? (
                  <div>
                    <p className="text-xs text-neutral-500">Refund Method: <span className="font-semibold text-neutral-800">UPI Account</span></p>
                    <p className="text-sm font-bold text-teal-950 mt-1 select-all">UPI ID: {selectedRequest.upiId || "N/A"}</p>
                  </div>
                ) : selectedRequest.bankAccountInfo ? (
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <p className="text-neutral-500">Account Holder</p>
                      <p className="text-sm font-bold text-teal-950">{selectedRequest.bankAccountInfo.accountHolderName || "N/A"}</p>
                    </div>
                    <div>
                      <p className="text-neutral-500">Bank Name</p>
                      <p className="text-sm font-bold text-teal-950">{selectedRequest.bankAccountInfo.bankName || "N/A"}</p>
                    </div>
                    <div>
                      <p className="text-neutral-500">Account Number</p>
                      <p className="text-sm font-bold text-teal-950 select-all">{selectedRequest.bankAccountInfo.accountNumber || "N/A"}</p>
                    </div>
                    <div>
                      <p className="text-neutral-500">IFSC Code</p>
                      <p className="text-sm font-bold text-teal-950 select-all">{selectedRequest.bankAccountInfo.ifscCode || "N/A"}</p>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-neutral-500 font-medium">No payout details provided</p>
                )}
              </div>

              {/* Manual Rider Assignment (Show if Approved/Accepted) */}
              {(selectedRequest.status === "Approved" || selectedRequest.status === "Accepted") && (
                <div className="p-4 bg-neutral-50 border border-neutral-200 rounded-xl space-y-3">
                  <p className="text-xs font-bold text-neutral-700 uppercase tracking-wider">Assign Delivery Partner</p>
                  <div className="flex gap-2">
                    {loadingDeliveryBoys ? (
                      <span className="text-xs text-neutral-500">Loading delivery riders...</span>
                    ) : (
                      <select
                        value={selectedRiderId}
                        onChange={(e) => setSelectedRiderId(e.target.value)}
                        className="flex-1 border border-neutral-300 bg-white rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                        disabled={submittingAction}
                      >
                        <option value="">-- Broadcast to all riders --</option>
                        {deliveryBoys.map((db) => (
                          <option key={db._id} value={db._id}>
                            {db.name} ({db.mobile})
                          </option>
                        ))}
                      </select>
                    )}
                    <button
                      onClick={handleAssignRider}
                      disabled={submittingAction || loadingDeliveryBoys}
                      className="px-4 py-2.5 text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 rounded-xl transition-colors shrink-0"
                    >
                      Assign
                    </button>
                  </div>
                  {selectedRequest.deliveryBoy && (
                    <div className="text-xs text-neutral-600 flex justify-between items-center bg-white p-2.5 rounded-lg border border-neutral-200/80">
                      <span>Currently Assigned: <span className="font-bold text-neutral-800">{
                        typeof selectedRequest.deliveryBoy === 'object' ? selectedRequest.deliveryBoy.name : "Rider ID: " + selectedRequest.deliveryBoy
                      }</span></span>
                      <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-indigo-50 border border-indigo-100 text-indigo-700">
                        {selectedRequest.deliveryBoyStatus || "Pending"}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Refund input (Show if Approved or Completed) */}
              {(selectedRequest.status === "Approved" || selectedRequest.status === "Completed") && (
                <div className="p-4 bg-green-50/50 border border-green-200/80 rounded-xl space-y-3">
                  <p className="text-xs font-bold text-green-950 uppercase tracking-wider">Complete Refund (Offline Settlement)</p>
                  <p className="text-xs text-green-800 leading-relaxed font-medium">Please proceed bank/UPI transfer manually using payout details above. Once completed, enter the reference transaction ID below to mark refund as completed.</p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Enter offline transaction ID"
                      className="flex-1 border border-green-300 bg-white rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                      value={transactionIdInput}
                      onChange={(e) => setTransactionIdInput(e.target.value)}
                      disabled={submittingAction}
                    />
                    <button
                      onClick={handleProcessRefund}
                      disabled={submittingAction || !transactionIdInput.trim()}
                      className="px-4 py-2.5 text-xs font-bold text-white bg-green-600 hover:bg-green-700 rounded-xl transition-colors shrink-0 disabled:bg-neutral-300 disabled:cursor-not-allowed"
                    >
                      Mark Refunded
                    </button>
                  </div>
                </div>
              )}

              {/* If Refunded */}
              {selectedRequest.status === "Refunded" && (
                <div className="p-4 bg-green-50/50 border border-green-200/60 rounded-xl space-y-1.5 text-xs font-medium text-green-900">
                  <p className="text-xs font-bold uppercase tracking-wider">Refund Settlement Details</p>
                  <p>Refund Payout: <span className="font-semibold">{selectedRequest.refundMethod === "UPI" ? "UPI Account" : "Bank Transfer"}</span></p>
                  <p>Transaction ID: <span className="font-mono font-bold select-all bg-white border border-green-200 px-1 py-0.5 rounded text-[11px]">{selectedRequest.transactionId}</span></p>
                  {selectedRequest.refundedAt && <p>Date: {new Date(selectedRequest.refundedAt).toLocaleString()}</p>}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex justify-between items-center px-6 py-4 border-t border-neutral-200 bg-neutral-50 rounded-b-lg">
              <div className="flex gap-2">
                {selectedRequest.status === "Pending" && (
                  <>
                    <button
                      onClick={() => handleAdminOverrideStatus("Rejected")}
                      className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded transition-colors"
                      disabled={submittingAction}
                    >
                      Reject Request
                    </button>
                    <button
                      onClick={() => handleAdminOverrideStatus("Approved")}
                      className="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded transition-colors"
                      disabled={submittingAction}
                    >
                      Approve Return
                    </button>
                  </>
                )}
              </div>
              <button
                onClick={() => setShowDetailsModal(false)}
                className="px-4 py-2 text-sm font-medium text-neutral-700 bg-white border border-neutral-300 rounded hover:bg-neutral-50 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="text-center text-sm text-neutral-500 py-4">
        Copyright © 2026. Developed By{" "}<a href="#" className="text-teal-600 hover:text-teal-700">Speedoo - Your Order Our Priority</a>
      </div>
    </div>
  );
}
