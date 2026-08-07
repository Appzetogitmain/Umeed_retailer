import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as xlsx from 'xlsx';
import { validateBulkProducts, importBulkProducts } from '../../../services/api/productService';

export default function SellerBulkUpload() {
  const navigate = useNavigate();
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [zipFile, setZipFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Validation results
  const [validatedData, setValidatedData] = useState<any>(null);
  const [step, setStep] = useState<1 | 2>(1); // 1: Upload, 2: Preview

  const handleDownloadTemplate = () => {
    const wb = xlsx.utils.book_new();
    
    // ── Products Sheet ──────────────────────────────────────────────────────
    const productsData = [{
      // === PRODUCT SECTION ===
      "Product Name": "Example Apple",               // required
      "Header Category": "Grocery",                  // name of header category (e.g. Grocery, Electronics)
      "Category": "Fruits",                          // name of category under the header category
      "SubCategory": "Fresh Fruits",                 // name of subcategory (optional)
      "Sub-SubCategory": "",                         // name of sub-subcategory (optional)
      "Publish": "Yes",                              // Yes or No
      "Brand": "FreshFarms",                         // brand name (optional)
      "Tags": "fruit, healthy, fresh",               // comma-separated tags

      // === VARIATION SECTION ===
      "Variation Type": "Weight",                    // Size | Weight | Color | Pack | Variant | Options

      // === OTHER DETAILS SECTION ===
      "Manufacturer": "Fresh Co.",                   // optional
      "Made In": "India",                            // optional
      "Weight (kg)": 1,                              // required — product shipping weight in kg
      "Tax Name": "",                                // tax name as in system (optional, e.g. GST 5%)
      "Is Returnable": "No",                         // Yes or No
      "Max Return Days": "",                         // number, leave blank if not returnable
      "FSSAI Lic No": "",                            // 14-digit number (optional)
      "Total Allowed Quantity": 10,                  // max qty per order, leave blank if no limit

      // === PRICING & INVENTORY (Optional if using Variations sheet) ===
      "Price": 60,
      "Discounted Price": 55,
      "Stock": 100,

      // === DESCRIPTIONS ===
      "Small Description": "Fresh red apples sourced from Himachal Pradesh.",
      "Description": "Crisp, juicy red apples.",    // full description (optional)

      // === SEO ===
      "SEO Title": "",                               // optional
      "SEO Keywords": "",                            // optional
      "SEO Image Alt": "",                           // optional
      "SEO Description": "",                         // optional

      // === IMAGES ===
      "Main Image": "apple.jpg",                     // filename inside ZIP (required for images)
      "Gallery Images": "apple_side.jpg, apple_top.jpg", // comma-separated filenames (optional)

      // === SHOP BY STORE ===
      "Shop By Store Only": "No",                    // Yes or No
      "Shop Name": "",                               // required only if Shop By Store Only = Yes
    }];

    const productsSheet = xlsx.utils.json_to_sheet(productsData);
    // Set column widths for better readability
    productsSheet['!cols'] = Array(Object.keys(productsData[0]).length).fill({ wch: 22 });
    xlsx.utils.book_append_sheet(wb, productsSheet, "Products");

    // ── Variations Sheet ────────────────────────────────────────────────────
    // Each row = one variation for a product.
    // Link to product using "Product Name" (must match exactly).
    // If a product has multiple variations, add multiple rows with the same Product Name.
    const variationsData = [{
      "Product Name": "Example Apple",   // must match Product Name in Products sheet
      "Variation Type": "Weight",        // Size | Weight | Color | Pack | Variant | Options
      "Title": "500g",                   // variation label e.g. 500g, Red, Large
      "Price": 60,                       // required
      "Discounted Price": 55,            // 0 if no discount
      "Stock": 100,                      // required
      "SKU": "APP-500G",                 // optional, must be unique if provided
    }, {
      "Product Name": "Example Apple",
      "Variation Type": "Weight",
      "Title": "1kg",
      "Price": 100,
      "Discounted Price": 90,
      "Stock": 50,
      "SKU": "APP-1KG",
    }];

    const variationsSheet = xlsx.utils.json_to_sheet(variationsData);
    variationsSheet['!cols'] = Array(Object.keys(variationsData[0]).length).fill({ wch: 20 });
    xlsx.utils.book_append_sheet(wb, variationsSheet, "Variations");

    // ── Instructions Sheet ──────────────────────────────────────────────────
    const instructionsData = [
      { "Field": "Product Name", "Required": "Yes", "Notes": "Product title (max 100 chars)" },
      { "Field": "Header Category", "Required": "Yes", "Notes": "Must match an existing Header Category name exactly" },
      { "Field": "Category", "Required": "Yes", "Notes": "Must match an existing Category name exactly" },
      { "Field": "SubCategory", "Required": "No", "Notes": "Must match an existing SubCategory name exactly" },
      { "Field": "Sub-SubCategory", "Required": "No", "Notes": "Must match an existing Sub-SubCategory name exactly" },
      { "Field": "Publish", "Required": "No", "Notes": "Yes or No (default: No)" },
      { "Field": "Brand", "Required": "No", "Notes": "Must match an existing Brand name exactly" },
      { "Field": "Tags", "Required": "No", "Notes": "Comma-separated (e.g. fresh, organic, healthy)" },
      { "Field": "Variation Type", "Required": "Yes", "Notes": "One of: Size | Weight | Color | Pack | Variant | Options" },
      { "Field": "Weight (kg)", "Required": "Yes", "Notes": "Shipping weight in kg (e.g. 1.5)" },
      { "Field": "Tax Name", "Required": "No", "Notes": "Tax name as configured in system" },
      { "Field": "Is Returnable", "Required": "No", "Notes": "Yes or No" },
      { "Field": "Max Return Days", "Required": "No", "Notes": "Number of days for return window" },
      { "Field": "FSSAI Lic No", "Required": "No", "Notes": "14-digit FSSAI number (food products)" },
      { "Field": "Total Allowed Quantity", "Required": "No", "Notes": "Max qty per order. Leave blank for no limit." },
      { "Field": "Small Description", "Required": "No", "Notes": "Short description (max 500 chars)" },
      { "Field": "Description", "Required": "No", "Notes": "Full product description" },
      { "Field": "Price", "Required": "Conditional", "Notes": "Required if no variations are provided" },
      { "Field": "Discounted Price", "Required": "No", "Notes": "0 if no discount" },
      { "Field": "Stock", "Required": "Conditional", "Notes": "Required if no variations are provided" },
      { "Field": "Main Image", "Required": "No", "Notes": "Filename in ZIP (e.g. apple.jpg). Must be inside uploaded ZIP." },
      { "Field": "Gallery Images", "Required": "No", "Notes": "Comma-separated filenames in ZIP" },
      { "Field": "Shop By Store Only", "Required": "No", "Notes": "Yes or No. If Yes, product only shows in Shop By Store." },
      { "Field": "Shop Name", "Required": "Conditional", "Notes": "Required if Shop By Store Only = Yes" },
      { "Field": "--- VARIATIONS ---", "Required": "", "Notes": "" },
      { "Field": "Product Name", "Required": "Yes", "Notes": "Must exactly match the Product Name in the Products sheet" },
      { "Field": "Variation Type", "Required": "Yes", "Notes": "Size | Weight | Color | Pack | Variant | Options" },
      { "Field": "Title", "Required": "Yes", "Notes": "Variation label (e.g. 500g, Red, XL)" },
      { "Field": "Price", "Required": "Yes", "Notes": "Selling price" },
      { "Field": "Discounted Price", "Required": "No", "Notes": "0 if no discount" },
      { "Field": "Stock", "Required": "Yes", "Notes": "Available stock quantity" },
      { "Field": "SKU", "Required": "No", "Notes": "Must be unique across all products" },
    ];
    const instructionsSheet = xlsx.utils.json_to_sheet(instructionsData);
    instructionsSheet['!cols'] = [{ wch: 25 }, { wch: 12 }, { wch: 60 }];
    xlsx.utils.book_append_sheet(wb, instructionsSheet, "Instructions");

    xlsx.writeFile(wb, "bulk_products_template.xlsx");
  };

  const handleValidate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!excelFile) {
      setError("Please select an Excel file.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("excelFile", excelFile);
      if (zipFile) {
        formData.append("imagesZip", zipFile);
      }

      const response = await validateBulkProducts(formData);
      if (response.success && response.data) {
        setValidatedData(response.data);
        setStep(2);
      } else {
        setError(response.message || "Failed to validate products");
      }
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    if (!validatedData || !validatedData.validProducts.length) return;
    
    setLoading(true);
    setError(null);
    try {
      const response = await importBulkProducts(validatedData.validProducts);
      if (response.success) {
        navigate('/seller/product/list');
      } else {
        setError(response.message || "Failed to import products");
      }
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-neutral-50/50 p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-800">Bulk Upload Products</h1>
          <div className="text-sm text-neutral-500 mt-1">
            <span className="text-teal-600 cursor-pointer" onClick={() => navigate('/seller/dashboard')}>Dashboard</span>
            <span className="mx-2">/</span>
            <span className="text-teal-600 cursor-pointer" onClick={() => navigate('/seller/product/list')}>Products</span>
            <span className="mx-2">/</span>
            <span>Bulk Upload</span>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6 text-red-700">
          <p>{error}</p>
        </div>
      )}

      {step === 1 ? (
        <div className="bg-white rounded-xl shadow-sm border border-neutral-200 overflow-hidden max-w-4xl">
          <div className="border-b border-neutral-100 p-6">
            <h2 className="text-lg font-medium text-neutral-800">Step 1: Upload Files</h2>
            <p className="text-sm text-neutral-500 mt-1">Upload your products data and images.</p>
          </div>
          
          <div className="p-6">
            <div className="mb-8">
              <h3 className="text-sm font-medium text-neutral-700 mb-2">1. Download Template</h3>
              <p className="text-sm text-neutral-600 mb-4">Download the sample Excel template and fill it with your product details. Ensure you follow the exact column names.</p>
              <button 
                onClick={handleDownloadTemplate}
                className="bg-neutral-100 hover:bg-neutral-200 text-neutral-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
                Download Sample Excel
              </button>
            </div>

            <hr className="border-neutral-100 mb-8" />

            <form onSubmit={handleValidate}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                <div>
                  <h3 className="text-sm font-medium text-neutral-700 mb-2">2. Upload Excel File <span className="text-red-500">*</span></h3>
                  <div className="border-2 border-dashed border-neutral-300 rounded-lg p-6 text-center hover:bg-neutral-50 transition-colors">
                    <input 
                      type="file" 
                      accept=".xlsx, .xls"
                      onChange={(e) => setExcelFile(e.target.files?.[0] || null)}
                      className="hidden" 
                      id="excel-upload"
                    />
                    <label htmlFor="excel-upload" className="cursor-pointer flex flex-col items-center">
                      <svg className="w-8 h-8 text-teal-500 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                      <span className="text-sm font-medium text-neutral-700">{excelFile ? excelFile.name : 'Choose Excel file'}</span>
                      <span className="text-xs text-neutral-500 mt-1">.xlsx, .xls format</span>
                    </label>
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-medium text-neutral-700 mb-2">3. Upload Images (ZIP) <span className="text-neutral-400 text-xs">(Optional)</span></h3>
                  <div className="border-2 border-dashed border-neutral-300 rounded-lg p-6 text-center hover:bg-neutral-50 transition-colors">
                    <input 
                      type="file" 
                      accept=".zip"
                      onChange={(e) => setZipFile(e.target.files?.[0] || null)}
                      className="hidden" 
                      id="zip-upload"
                    />
                    <label htmlFor="zip-upload" className="cursor-pointer flex flex-col items-center">
                      <svg className="w-8 h-8 text-teal-500 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"></path></svg>
                      <span className="text-sm font-medium text-neutral-700">{zipFile ? zipFile.name : 'Choose ZIP file'}</span>
                      <span className="text-xs text-neutral-500 mt-1">Contains product images</span>
                    </label>
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <button 
                  type="submit"
                  disabled={loading || !excelFile}
                  className="bg-teal-600 hover:bg-teal-700 text-white px-6 py-2.5 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {loading ? 'Validating...' : 'Validate & Preview'}
                  {!loading && <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path></svg>}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-neutral-200 overflow-hidden flex-1 flex flex-col">
          <div className="border-b border-neutral-100 p-6 flex justify-between items-center">
            <div>
              <h2 className="text-lg font-medium text-neutral-800">Step 2: Preview & Import</h2>
              <p className="text-sm text-neutral-500 mt-1">Review the validation results before importing.</p>
            </div>
            <button 
              onClick={() => setStep(1)}
              className="text-sm text-neutral-600 hover:text-neutral-900 font-medium"
            >
              ← Back to Upload
            </button>
          </div>
          
          {validatedData && (
            <div className="p-6 flex-1 overflow-y-auto">
              <div className="grid grid-cols-3 gap-6 mb-8">
                <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-4 text-center">
                  <div className="text-sm text-neutral-500 font-medium mb-1">Total Products Found</div>
                  <div className="text-3xl font-bold text-neutral-800">{validatedData.summary.total}</div>
                </div>
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                  <div className="text-sm text-green-600 font-medium mb-1">Valid (Ready)</div>
                  <div className="text-3xl font-bold text-green-700">{validatedData.summary.validCount}</div>
                </div>
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
                  <div className="text-sm text-red-600 font-medium mb-1">Invalid (Errors)</div>
                  <div className="text-3xl font-bold text-red-700">{validatedData.summary.invalidCount}</div>
                </div>
              </div>

              {validatedData.invalidProducts.length > 0 && (
                <div className="mb-8">
                  <h3 className="text-base font-medium text-red-700 mb-4 flex items-center gap-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
                    Rows with Errors
                  </h3>
                  <div className="border border-neutral-200 rounded-lg overflow-hidden">
                    <table className="w-full text-sm text-left">
                      <thead className="bg-neutral-50 text-neutral-700">
                        <tr>
                          <th className="px-4 py-3 border-b">Row</th>
                          <th className="px-4 py-3 border-b">Product Name</th>
                          <th className="px-4 py-3 border-b">Errors</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-200">
                        {validatedData.invalidProducts.map((item: any, idx: number) => (
                          <tr key={idx} className="hover:bg-neutral-50/50">
                            <td className="px-4 py-3 text-neutral-500 font-medium">{item.rowNumber}</td>
                            <td className="px-4 py-3 font-medium text-neutral-800">{item.data["Product Name"] || 'N/A'}</td>
                            <td className="px-4 py-3">
                              <ul className="list-disc list-inside text-red-600 text-xs space-y-1">
                                {item.errors.map((err: string, i: number) => (
                                  <li key={i}>{err}</li>
                                ))}
                              </ul>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="flex justify-between items-center pt-6 border-t border-neutral-200">
                <p className="text-sm text-neutral-500">
                  Only the <span className="font-semibold text-green-600">{validatedData.summary.validCount} valid products</span> will be imported.
                </p>
                <button
                  onClick={handleImport}
                  disabled={loading || validatedData.summary.validCount === 0}
                  className="bg-teal-600 hover:bg-teal-700 text-white px-6 py-2.5 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {loading ? 'Importing...' : 'Import Valid Products'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
