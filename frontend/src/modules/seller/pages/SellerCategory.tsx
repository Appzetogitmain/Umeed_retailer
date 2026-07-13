import { useState, useEffect } from 'react';
import { getCategories, Category } from '../../../services/api/categoryService';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import * as XLSX from 'xlsx';

export default function SellerCategory() {
    const [categories, setCategories] = useState<Category[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string>('');
    const [searchTerm, setSearchTerm] = useState('');
    const [rowsPerPage, setRowsPerPage] = useState(10);
    const [currentPage, setCurrentPage] = useState(1);
    const [isExportDropdownOpen, setIsExportDropdownOpen] = useState(false);

    // Fetch categories from API
    useEffect(() => {
        const fetchCategories = async () => {
            setLoading(true);
            setError('');
            try {
                const params: any = { includeSubcategories: true };
                if (searchTerm) {
                    params.search = searchTerm;
                }

                const response = await getCategories(params);
                if (response.success && response.data) {
                    setCategories(response.data);
                } else {
                    setError(response.message || 'Failed to fetch categories');
                }
            } catch (err: any) {
                setError(err.response?.data?.message || err.message || 'Failed to fetch categories');
            } finally {
                setLoading(false);
            }
        };

        fetchCategories();
    }, [searchTerm]);

    // Client-side filtering for display (API handles search, but we can filter further if needed)
    const filteredCategories = categories.filter(cat =>
        cat.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const totalPages = Math.ceil(filteredCategories.length / rowsPerPage);
    const startIndex = (currentPage - 1) * rowsPerPage;
    const endIndex = startIndex + rowsPerPage;
    const currentCategories = filteredCategories.slice(startIndex, endIndex);

    const handleExportCSV = () => {
        const headers = ['ID', 'Category Name', 'Total Subcategory'];
        const csvContent = [
            headers.join(','),
            ...filteredCategories.map(cat => [
                cat._id,
                `"${cat.name}"`,
                cat.totalSubcategory || 0
            ].join(','))
        ].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `categories_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleExportExcel = () => {
        const worksheet = XLSX.utils.json_to_sheet(
            filteredCategories.map(cat => ({
                'ID': cat._id,
                'Category Name': cat.name,
                'Total Subcategory': cat.totalSubcategory || 0
            }))
        );
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Categories");
        XLSX.writeFile(workbook, `categories_${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    const handleExportPDF = () => {
        const doc = new jsPDF();
        
        doc.setFontSize(16);
        doc.text('Categories Report', 14, 15);
        doc.setFontSize(10);
        doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 22);

        const tableColumn = ["ID", "Category Name", "Total Subcategory"];
        const tableRows = filteredCategories.map(cat => [
            cat._id,
            cat.name,
            (cat.totalSubcategory || 0).toString()
        ]);

        (doc as any).autoTable({
            head: [tableColumn],
            body: tableRows,
            startY: 30,
            theme: 'striped',
            headStyles: { fillColor: [15, 118, 110] },
            styles: { fontSize: 8 }
        });

        doc.save(`categories_${new Date().toISOString().split('T')[0]}.pdf`);
    };

    // Reset pagination when search changes
    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, rowsPerPage]);

    return (
        <div className="flex flex-col h-full">
            {/* Page Header */}
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-semibold text-neutral-800">Category</h1>
                <div className="text-sm text-blue-500">
                    <span className="cursor-pointer hover:underline">Home</span> <span className="text-neutral-400">/</span> <span className="text-neutral-600">Dashboard</span>
                </div>
            </div>

            {/* Content Card */}
            <div className="bg-white rounded-lg shadow-sm border border-neutral-200 flex-1 flex flex-col">
                <div className="p-4 border-b border-neutral-100 font-medium text-neutral-700">
                    View Category
                </div>

                {/* Controls */}
                <div className="p-4 flex flex-col sm:flex-row justify-end items-center gap-2 sm:gap-4">
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                        <select
                            value={rowsPerPage}
                            onChange={(e) => setRowsPerPage(Number(e.target.value))}
                            className="bg-neutral-100 border-none rounded py-1.5 px-3 text-sm focus:ring-0 cursor-pointer"
                        >
                            <option value={10}>10</option>
                            <option value={20}>20</option>
                            <option value={50}>50</option>
                        </select>
                        <div className="relative">
                            <button
                                onClick={() => setIsExportDropdownOpen(!isExportDropdownOpen)}
                                className="bg-teal-700 hover:bg-teal-800 text-white px-3 py-1.5 rounded text-sm font-medium flex items-center gap-1 transition-colors w-full sm:w-auto justify-center"
                            >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                                Export
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="ml-1"><polyline points="6 9 12 15 18 9"></polyline></svg>
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

                        <div className="relative">
                            <input
                                type="text"
                                className="pl-3 pr-3 py-1.5 bg-neutral-100 border-none rounded text-sm focus:ring-1 focus:ring-teal-500 w-full sm:w-48"
                                placeholder="Search Categories..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>
                </div>

                {/* Loading and Error States */}
                {loading && (
                    <div className="flex items-center justify-center p-8">
                        <div className="text-neutral-500">Loading categories...</div>
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
                                    <th className="p-4 w-16 border border-neutral-200">
                                        <div className="flex items-center justify-between cursor-pointer">ID <span className="text-neutral-300 text-[10px]">⇅</span></div>
                                    </th>
                                    <th className="p-4 border border-neutral-200">
                                        <div className="flex items-center justify-between cursor-pointer">Category Name <span className="text-neutral-300 text-[10px]">⇅</span></div>
                                    </th>
                                    <th className="p-4 border border-neutral-200">
                                        <div className="flex items-center justify-between cursor-pointer">Category Image <span className="text-neutral-300 text-[10px]">⇅</span></div>
                                    </th>
                                    <th className="p-4 border border-neutral-200">
                                        <div className="flex items-center justify-between cursor-pointer">Total Subcategory <span className="text-neutral-300 text-[10px]">⇅</span></div>
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {currentCategories.length === 0 ? (
                                    <tr>
                                        <td colSpan={4} className="p-8 text-center text-neutral-500">
                                            No categories found
                                        </td>
                                    </tr>
                                ) : (
                                    currentCategories.map((category) => (
                                    <tr key={category._id} className="hover:bg-neutral-50 transition-colors text-sm text-neutral-700">
                                        <td className="p-4 align-middle border border-neutral-200">{category.categoryId || category._id}</td>
                                        <td className="p-4 align-middle border border-neutral-200">{category.name}</td>
                                        <td className="p-4 border border-neutral-200">
                                            <div className="w-16 h-12 bg-white border border-neutral-200 rounded p-1 flex items-center justify-center mx-auto">
                                                <img
                                                    src={category.image || '/assets/category-placeholder.png'}
                                                    alt={category.name}
                                                    className="max-w-full max-h-full object-contain"
                                                    onError={(e) => {
                                                        (e.target as HTMLImageElement).src = 'https://placehold.co/60x40?text=Img';
                                                    }}
                                                />
                                            </div>
                                        </td>
                                        <td className="p-4 align-middle border border-neutral-200">{category.totalSubcategory || 0}</td>
                                    </tr>
                                ))
                                )}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Pagination (Visual only mostly for now as per image doesn't show bottom) */}
                <div className="p-4 border-t border-neutral-100 mt-auto">
                    {/* Placeholder for potential pagination info if needed, or left empty as strictly per image top part */}
                </div>
            </div>
        </div>
    );
}
