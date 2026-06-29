import React, { useState, useMemo, useEffect, useRef } from "react";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import "jspdf-autotable";
import {
  getAllCustomers,
  getCustomerById,
  updateCustomerStatus,
  type Customer,
} from "../../../services/api/admin/adminCustomerService";
import { useAuth } from "../../../context/AuthContext";

type SortField =
  | "id"
  | "name"
  | "email"
  | "phone"
  | "registrationDate"
  | "status"
  | "totalOrders"
  | "totalSpent";
type SortDirection = "asc" | "desc";

export default function AdminManageCustomer() {
  const { isAuthenticated, token } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [statusFilter, setStatusFilter] = useState<"Active" | "Inactive" | undefined>(
    undefined
  );
  const [entriesPerPage, setEntriesPerPage] = useState("10");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalEntries, setTotalEntries] = useState(0);
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [isExportDropdownOpen, setIsExportDropdownOpen] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);
  const fromDateRef = useRef<HTMLInputElement>(null);
  const toDateRef = useRef<HTMLInputElement>(null);
  
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (exportRef.current && !exportRef.current.contains(event.target as Node)) {
        setIsExportDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Prevent background scrolling when modal is open
  useEffect(() => {
    const handleScrollPrevent = (e: Event) => {
      e.preventDefault();
    };

    if (isModalOpen) {
      document.body.style.overflow = "hidden";
      window.addEventListener("wheel", handleScrollPrevent, { passive: false });
      window.addEventListener("touchmove", handleScrollPrevent, { passive: false });
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
      window.removeEventListener("wheel", handleScrollPrevent);
      window.removeEventListener("touchmove", handleScrollPrevent);
    };
  }, [isModalOpen]);

  // Fetch customers on component mount
  useEffect(() => {
    if (!isAuthenticated || !token) {
      setLoading(false);
      return;
    }

    const fetchCustomers = async () => {
      try {
        setLoading(true);
        setError(null);

        const params: any = {
          page: currentPage,
          limit: parseInt(entriesPerPage),
        };
        if (dateFrom) params.startDate = dateFrom;
        if (dateTo) params.endDate = dateTo;

        if (statusFilter) {
          params.status = statusFilter;
        }

        if (searchQuery) {
          params.search = searchQuery;
        }

        const response = await getAllCustomers(params);
        if (response.success) {
          setCustomers(response.data);
          if (response.pagination) {
            setTotalPages(response.pagination.pages);
            setTotalEntries(response.pagination.total);
          } else {
            setTotalPages(Math.ceil(response.data.length / parseInt(entriesPerPage)));
            setTotalEntries(response.data.length);
          }
        }
      } catch (err) {
        console.error("Error fetching customers:", err);
        if (err && typeof err === "object" && "response" in err) {
          const axiosError = err as {
            response?: { data?: { message?: string } };
          };
          setError(
            axiosError.response?.data?.message ||
            "Failed to load customers. Please try again."
          );
        } else {
          setError("Failed to load customers. Please try again.");
        }
      } finally {
        setLoading(false);
      }
    };

    fetchCustomers();
  }, [
    isAuthenticated,
    token,
    currentPage,
    entriesPerPage,
    statusFilter,
    searchQuery,
  ]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const handleView = (customer: Customer) => {
    setSelectedCustomer(customer);
    setIsEditMode(false);
    setIsModalOpen(true);
  };

  const handleEdit = (customer: Customer) => {
    setSelectedCustomer(customer);
    setIsEditMode(true);
    setIsModalOpen(true);
  };

  const handleStatusChange = async (newStatus: "Active" | "Inactive") => {
    if (!selectedCustomer) return;

    try {
      setUpdatingStatus(true);
      const response = await updateCustomerStatus(selectedCustomer._id, { status: newStatus });
      if (response.success) {
        setCustomers(prev => prev.map(c => c._id === selectedCustomer._id ? { ...c, status: newStatus } : c));
        setSelectedCustomer({ ...selectedCustomer, status: newStatus });
        alert("Customer status updated successfully!");
        if (isEditMode) setIsModalOpen(false);
      }
    } catch (err) {
      console.error("Error updating status:", err);
      alert("Failed to update status. Please try again.");
    } finally {
      setUpdatingStatus(false);
    }
  };

  const filteredAndSortedCustomers = useMemo(() => {
    let filtered = [...customers];

    if (sortField) {
      filtered = [...filtered].sort((a, b) => {
        let aValue: string | number;
        let bValue: string | number;

        switch (sortField) {
          case "id":
            aValue = a._id || "";
            bValue = b._id || "";
            break;
          case "name":
            aValue = a.name || "";
            bValue = b.name || "";
            break;
          case "email":
            aValue = a.email || "";
            bValue = b.email || "";
            break;
          case "phone":
            aValue = a.phone || "";
            bValue = b.phone || "";
            break;
          case "registrationDate":
            aValue = a.registrationDate || "";
            bValue = b.registrationDate || "";
            break;
          case "status":
            aValue = a.status || "";
            bValue = b.status || "";
            break;
          case "totalOrders":
            aValue = a.totalOrders || 0;
            bValue = b.totalOrders || 0;
            break;
          case "totalSpent":
            aValue = a.totalSpent || 0;
            bValue = b.totalSpent || 0;
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

        if (sortDirection === "asc") {
          return aValue > bValue ? 1 : aValue < bValue ? -1 : 0;
        } else {
          return aValue < bValue ? 1 : aValue > bValue ? -1 : 0;
        }
      });
    }

    return filtered;
  }, [customers, sortField, sortDirection]);

  const startIndex = (currentPage - 1) * Number(entriesPerPage);
  const displayedCustomers = filteredAndSortedCustomers;

  const formatCustomerForExport = (customer: Customer) => ({
    "ID": customer._id.slice(-6),
    "Name": customer.name,
    "Email": customer.email,
    "Phone": customer.phone,
    "Registration Date": customer.registrationDate ? new Date(customer.registrationDate).toLocaleDateString() : "-",
    "Status": customer.status,
    "Ref Code": customer.refCode,
    "Total Orders": customer.totalOrders,
    "Total Spent": customer.totalSpent.toFixed(2)
  });

  const handleExportCSV = () => {
    const data = filteredAndSortedCustomers.map(formatCustomerForExport);
    const headers = Object.keys(data[0] || {}).join(",");
    const rows = data.map(obj => Object.values(obj).join(",")).join("\n");
    const blob = new Blob([headers + "\n" + rows], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.setAttribute("download", `customers_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setIsExportDropdownOpen(false);
  };

  const handleExportExcel = () => {
    const data = filteredAndSortedCustomers.map(formatCustomerForExport);
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Customers");
    XLSX.writeFile(workbook, `customers_${new Date().toISOString().split("T")[0]}.xlsx`);
    setIsExportDropdownOpen(false);
  };

  const handleExportPDF = () => {
    const data = filteredAndSortedCustomers.map(formatCustomerForExport);
    const headers = Object.keys(data[0] || {});
    const rows = data.map(obj => Object.values(obj));
    const doc = new jsPDF();
    doc.text("Customers List", 14, 15);
    (doc as any).autoTable({
      head: [headers],
      body: rows,
      startY: 20,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [13, 148, 136] }
    });
    doc.save(`customers_${new Date().toISOString().split("T")[0]}.pdf`);
    setIsExportDropdownOpen(false);
  };

  const SortIcon = ({ field }: { field: SortField }) => (
    <span className="text-neutral-300 text-[10px]">
      {sortField === field ? (sortDirection === "asc" ? "↑" : "↓") : "⇅"}
    </span>
  );

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="bg-white px-4 sm:px-6 py-4 border-b border-neutral-200">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-neutral-900">
              Manage Customer
            </h1>
          </div>
          <div className="text-sm text-neutral-600">
            <span className="text-blue-600">Home</span> /{" "}
            <span className="text-neutral-900">Manage Customer</span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className={`flex-1 p-4 sm:p-6 bg-neutral-50 ${isModalOpen ? "overflow-hidden" : "overflow-y-auto"}`}>
        <div className="bg-white rounded-lg shadow-sm border border-neutral-200 overflow-hidden">
          {/* Filters */}
          <div className="p-4 sm:p-6 border-b border-neutral-200 bg-neutral-50">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">
                  From Date
                </label>
                <div className="flex items-center gap-2 bg-white border border-neutral-300 rounded px-2 py-1.5 focus-within:ring-2 focus-within:ring-teal-500 focus-within:border-teal-500 transition-shadow">
                  <input
                    type="date"
                    ref={fromDateRef}
                    value={dateFrom}
                    onChange={(e) => {
                      setDateFrom(e.target.value);
                      setCurrentPage(1);
                    }}
                    max={dateTo || undefined}
                    className="w-full text-sm border-none bg-transparent focus:outline-none text-neutral-700 p-0"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">
                  To Date
                </label>
                <div className="flex items-center gap-2 bg-white border border-neutral-300 rounded px-2 py-1.5 focus-within:ring-2 focus-within:ring-teal-500 focus-within:border-teal-500 transition-shadow">
                  <input
                    type="date"
                    ref={toDateRef}
                    value={dateTo}
                    onChange={(e) => {
                      setDateTo(e.target.value);
                      setCurrentPage(1);
                    }}
                    min={dateFrom || undefined}
                    className="w-full text-sm border-none bg-transparent focus:outline-none text-neutral-700 p-0"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">
                  Status
                </label>
                <select
                  value={statusFilter || "All"}
                  onChange={(e) => {
                    const val = e.target.value;
                    setStatusFilter(val === "All" ? undefined : (val as "Active" | "Inactive"));
                    setCurrentPage(1);
                  }}
                  className="w-full px-3 py-2 text-sm border border-neutral-300 rounded focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-white">
                  <option value="All">All</option>
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">
                  Show
                </label>
                <select
                  value={entriesPerPage}
                  onChange={(e) => {
                    setEntriesPerPage(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full px-3 py-2 text-sm border border-neutral-300 rounded focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-white">
                  <option value="10">10</option>
                  <option value="20">20</option>
                  <option value="50">50</option>
                  <option value="100">100</option>
                </select>
              </div>
              <div className="flex items-end relative" ref={exportRef}>
                <button
                  onClick={() => setIsExportDropdownOpen(!isExportDropdownOpen)}
                  className="w-full bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded text-sm font-medium transition-colors flex items-center justify-center gap-2"
                >
                  Export
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`transition-transform ${isExportDropdownOpen ? "rotate-180" : ""}`}>
                    <polyline points="6 9 12 15 18 9"></polyline>
                  </svg>
                </button>
                {isExportDropdownOpen && (
                  <div className="absolute top-full mt-1 right-0 w-40 bg-white border border-neutral-200 rounded-md shadow-lg z-50 overflow-hidden">
                    <button onClick={handleExportCSV} className="w-full text-left px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-50 transition-colors">
                      Export as CSV
                    </button>
                    <button onClick={handleExportExcel} className="w-full text-left px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-50 transition-colors">
                      Export as Excel
                    </button>
                    <button onClick={handleExportPDF} className="w-full text-left px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-50 transition-colors">
                      Export as PDF
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Search */}
          <div className="p-4 sm:p-6 border-b border-neutral-200">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 text-sm">
                Search:
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full pl-14 pr-3 py-2 bg-neutral-100 border-none rounded text-sm focus:ring-1 focus:ring-teal-500"
                placeholder="Search by name, email, phone, or ref code..."
              />
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-neutral-50 text-xs font-bold text-neutral-800">
                  <th
                    className="p-4 border border-neutral-200 cursor-pointer hover:bg-neutral-100 transition-colors"
                    onClick={() => handleSort("id")}>
                    <div className="flex items-center justify-between">
                      ID <SortIcon field="id" />
                    </div>
                  </th>
                  <th
                    className="p-4 border border-neutral-200 cursor-pointer hover:bg-neutral-100 transition-colors"
                    onClick={() => handleSort("name")}>
                    <div className="flex items-center justify-between">
                      Name <SortIcon field="name" />
                    </div>
                  </th>
                  <th
                    className="p-4 border border-neutral-200 cursor-pointer hover:bg-neutral-100 transition-colors"
                    onClick={() => handleSort("email")}>
                    <div className="flex items-center justify-between">
                      Email <SortIcon field="email" />
                    </div>
                  </th>
                  <th
                    className="p-4 border border-neutral-200 cursor-pointer hover:bg-neutral-100 transition-colors"
                    onClick={() => handleSort("phone")}>
                    <div className="flex items-center justify-between">
                      Phone <SortIcon field="phone" />
                    </div>
                  </th>
                  <th
                    className="p-4 border border-neutral-200 cursor-pointer hover:bg-neutral-100 transition-colors"
                    onClick={() => handleSort("registrationDate")}>
                    <div className="flex items-center justify-between">
                      Registration Date <SortIcon field="registrationDate" />
                    </div>
                  </th>
                  <th
                    className="p-4 border border-neutral-200 cursor-pointer hover:bg-neutral-100 transition-colors"
                    onClick={() => handleSort("status")}>
                    <div className="flex items-center justify-between">
                      Status <SortIcon field="status" />
                    </div>
                  </th>
                  <th className="p-4 border border-neutral-200">Ref Code</th>
                  <th
                    className="p-4 border border-neutral-200 cursor-pointer hover:bg-neutral-100 transition-colors"
                    onClick={() => handleSort("totalOrders")}>
                    <div className="flex items-center justify-between">
                      Total Orders <SortIcon field="totalOrders" />
                    </div>
                  </th>
                  <th
                    className="p-4 border border-neutral-200 cursor-pointer hover:bg-neutral-100 transition-colors"
                    onClick={() => handleSort("totalSpent")}>
                    <div className="flex items-center justify-between">
                      Total Spent <SortIcon field="totalSpent" />
                    </div>
                  </th>
                  <th className="p-4 border border-neutral-200">Action</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td
                      colSpan={11}
                      className="p-8 text-center text-neutral-400 border border-neutral-200">
                      Loading customers...
                    </td>
                  </tr>
                ) : error ? (
                  <tr>
                    <td
                      colSpan={11}
                      className="p-8 text-center text-red-600 border border-neutral-200">
                      {error}
                    </td>
                  </tr>
                ) : displayedCustomers.length === 0 ? (
                  <tr>
                    <td
                      colSpan={11}
                      className="p-8 text-center text-neutral-400 border border-neutral-200">
                      No customers found.
                    </td>
                  </tr>
                ) : (
                  displayedCustomers.map((customer) => (
                    <tr
                      key={customer._id}
                      className="hover:bg-neutral-50 transition-colors text-sm text-neutral-700">
                      <td className="p-4 border border-neutral-200">
                        {customer._id.slice(-6)}
                      </td>
                      <td className="p-4 border border-neutral-200">
                        {customer.name}
                      </td>
                      <td className="p-4 border border-neutral-200">
                        {customer.email}
                      </td>
                      <td className="p-4 border border-neutral-200">
                        {customer.phone}
                      </td>
                      <td className="p-4 border border-neutral-200">
                        {customer.registrationDate
                          ? new Date(customer.registrationDate).toLocaleString()
                          : "-"}
                      </td>
                      <td className="p-4 border border-neutral-200">
                        <span
                          className={`px-2 py-1 rounded text-xs font-medium ${customer.status === "Active"
                            ? "bg-green-100 text-green-800"
                            : "bg-red-100 text-red-800"
                            }`}>
                          {customer.status}
                        </span>
                      </td>
                      <td className="p-4 border border-neutral-200">
                        {customer.refCode}
                      </td>
                      <td className="p-4 border border-neutral-200">
                        {customer.totalOrders}
                      </td>
                      <td className="p-4 border border-neutral-200">
                        ₹{customer.totalSpent.toFixed(2)}
                      </td>
                      <td className="p-4 border border-neutral-200">
                        <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleEdit(customer)}
                              className="p-1.5 bg-green-600 hover:bg-green-700 text-white rounded transition-colors"
                              title="Edit">
                              <svg
                                width="14"
                                height="14"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
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

          {/* Pagination */}
          <div className="px-4 sm:px-6 py-3 border-t border-neutral-200 flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-0">
            <div className="text-xs sm:text-sm text-neutral-700">
              Showing {totalEntries === 0 ? 0 : startIndex + 1} to{" "}
              {Math.min(startIndex + Number(entriesPerPage), totalEntries)} of{" "}
              {totalEntries} entries
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className={`p-2 border border-teal-600 rounded ${currentPage === 1
                  ? "text-neutral-400 cursor-not-allowed bg-neutral-50"
                  : "text-teal-600 hover:bg-teal-50"
                  }`}>
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2">
                  <path d="M15 18L9 12L15 6"></path>
                </svg>
              </button>
              <button className="px-3 py-1.5 border border-teal-600 bg-teal-600 text-white rounded font-medium text-sm">
                {currentPage}
              </button>
              <button
                onClick={() =>
                  setCurrentPage((prev) => Math.min(totalPages, prev + 1))
                }
                disabled={currentPage === totalPages}
                className={`p-2 border border-teal-600 rounded ${currentPage === totalPages
                  ? "text-neutral-400 cursor-not-allowed bg-neutral-50"
                  : "text-teal-600 hover:bg-teal-50"
                  }`}>
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2">
                  <path d="M9 18L15 12L9 6"></path>
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
 
      {/* Customer Modal */}
      {isModalOpen && selectedCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-md overflow-hidden">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200">
              <h3 className="text-lg font-bold text-neutral-900">
                {isEditMode ? "Edit Customer Status" : "Customer Details"}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-neutral-400 hover:text-neutral-600 transition-colors">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-neutral-500 uppercase tracking-wider mb-1">Full Name</label>
                    <p className="text-sm font-medium text-neutral-900">{selectedCustomer.name}</p>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-neutral-500 uppercase tracking-wider mb-1">Email</label>
                    <p className="text-sm font-medium text-neutral-900">{selectedCustomer.email}</p>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-neutral-500 uppercase tracking-wider mb-1">Phone</label>
                    <p className="text-sm font-medium text-neutral-900">{selectedCustomer.phone}</p>
                  </div>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-neutral-500 uppercase tracking-wider mb-1">Status</label>
                    {isEditMode ? (
                      <select
                        value={selectedCustomer.status}
                        onChange={(e) => handleStatusChange(e.target.value as "Active" | "Inactive")}
                        disabled={updatingStatus}
                        className="mt-1 block w-full px-3 py-2 text-sm border border-neutral-300 rounded focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white">
                        <option value="Active">Active</option>
                        <option value="Inactive">Inactive</option>
                      </select>
                    ) : (
                      <span className={`px-2 py-1 rounded text-xs font-medium ${selectedCustomer.status === "Active" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
                        {selectedCustomer.status}
                      </span>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-neutral-500 uppercase tracking-wider mb-1">Registration Date</label>
                    <p className="text-sm font-medium text-neutral-900">
                      {selectedCustomer.registrationDate ? new Date(selectedCustomer.registrationDate).toLocaleString() : "-"}
                    </p>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-neutral-500 uppercase tracking-wider mb-1">Wallet Amount</label>
                    <p className="text-sm font-medium text-neutral-900">₹{selectedCustomer.walletAmount?.toFixed(2) || "0.00"}</p>
                  </div>
                </div>
              </div>
 
              <div className="mt-8 pt-6 border-t border-neutral-200">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-neutral-50 p-4 rounded-lg">
                    <p className="text-xs text-neutral-500 mb-1">Total Orders</p>
                    <p className="text-xl font-bold text-neutral-900">{selectedCustomer.totalOrders}</p>
                  </div>
                  <div className="bg-neutral-50 p-4 rounded-lg">
                    <p className="text-xs text-neutral-500 mb-1">Total Spent</p>
                    <p className="text-xl font-bold text-neutral-900">₹{selectedCustomer.totalSpent.toFixed(2)}</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="px-6 py-4 bg-neutral-50 border-t border-neutral-200 flex justify-end">
              <button
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-neutral-700 bg-white border border-neutral-300 rounded hover:bg-neutral-100 transition-colors">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
