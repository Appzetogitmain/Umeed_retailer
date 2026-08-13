import { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getProducts, Product, ProductVariation } from '../../../services/api/productService';
import { createPosSale, CreatePosSaleItem, searchPosCustomers, PosCustomer } from '../../../services/api/posService';

interface CartLine {
  key: string; // productId + variationId
  productId: string;
  variationId?: string;
  name: string;
  variationLabel?: string;
  unitPrice: number;
  availableStock: number;
  quantity: number;
}

const resolveUnitPrice = (product: Product, variation?: ProductVariation): number => {
  if (variation) {
    if (variation.discPrice && variation.discPrice > 0) return variation.discPrice;
    return variation.price || 0;
  }
  if (product.discPrice && product.discPrice > 0) return product.discPrice;
  return product.price || 0;
};

export default function SellerPOS() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<Product[]>([]);
  const [searching, setSearching] = useState(false);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'Card' | 'UPI'>('Cash');
  const [discountType, setDiscountType] = useState<'flat' | 'percent'>('flat');
  const [discountValue, setDiscountValue] = useState('');
  const [taxType, setTaxType] = useState<'flat' | 'percent'>('percent');
  const [taxValue, setTaxValue] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [addedFlash, setAddedFlash] = useState<Record<string, boolean>>({});
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerResults, setCustomerResults] = useState<PosCustomer[]>([]);
  const [searchingCustomer, setSearchingCustomer] = useState(false);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<PosCustomer | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const customerDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    searchInputRef.current?.focus();
  }, []);

  const runSearch = useCallback((query: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) {
      setResults([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const response = await getProducts({ search: query, limit: 20, status: 'published' });
        if (response.success) {
          setResults(response.data);
        }
      } catch {
        // Non-fatal: leave results as-is
      } finally {
        setSearching(false);
      }
    }, 300);
  }, []);

  useEffect(() => {
    runSearch(search);
  }, [search, runSearch]);

  const runCustomerSearch = useCallback((query: string) => {
    if (customerDebounceRef.current) clearTimeout(customerDebounceRef.current);
    if (!query.trim()) {
      setCustomerResults([]);
      setShowCustomerDropdown(false);
      return;
    }
    customerDebounceRef.current = setTimeout(async () => {
      setSearchingCustomer(true);
      setShowCustomerDropdown(true);
      try {
        const response = await searchPosCustomers(query);
        if (response.success) {
          setCustomerResults(response.data);
        }
      } catch {
      } finally {
        setSearchingCustomer(false);
      }
    }, 300);
  }, []);

  const selectCustomer = (customer: PosCustomer) => {
    setSelectedCustomer(customer);
    setCustomerName(customer.name);
    setCustomerPhone(customer.phone || '');
    setCustomerEmail(customer.email || '');
    setCustomerSearch(customer.name);
    setCustomerResults([]);
    setShowCustomerDropdown(false);
  };

  const clearSelectedCustomer = () => {
    setSelectedCustomer(null);
    setCustomerName('');
    setCustomerPhone('');
    setCustomerEmail('');
    setCustomerSearch('');
  };

  const addToCart = (product: Product, variation?: ProductVariation) => {
    const key = variation ? `${product._id}:${variation._id}` : product._id;
    const stock = variation ? variation.stock ?? 0 : product.stock ?? 0;

    setCart((prev) => {
      const existing = prev.find((line) => line.key === key);
      if (existing) {
        return prev.map((line) =>
          line.key === key
            ? { ...line, quantity: Math.min(line.quantity + 1, Math.max(stock, line.quantity + 1)) }
            : line
        );
      }
      return [
        ...prev,
        {
          key,
          productId: product._id,
          variationId: variation?._id,
          name: product.productName,
          variationLabel: variation?.title || variation?.value,
          unitPrice: resolveUnitPrice(product, variation),
          availableStock: stock,
          quantity: 1,
        },
      ];
    });
    setError('');

    setAddedFlash((prev) => ({ ...prev, [key]: true }));
    setTimeout(() => {
      setAddedFlash((prev) => ({ ...prev, [key]: false }));
    }, 1000);
  };

  const updateQuantity = (key: string, quantity: number) => {
    setCart((prev) =>
      prev.map((line) => (line.key === key ? { ...line, quantity: Math.max(1, quantity) } : line))
    );
  };

  const removeLine = (key: string) => {
    setCart((prev) => prev.filter((line) => line.key !== key));
  };

  const subtotal = cart.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);
  const discountNum = parseFloat(discountValue) || 0;
  const taxNum = parseFloat(taxValue) || 0;
  const estimatedDiscount =
    discountNum > 0
      ? Math.min(discountType === 'percent' ? subtotal * (discountNum / 100) : discountNum, subtotal)
      : 0;
  const afterDiscount = Math.max(0, subtotal - estimatedDiscount);
  const estimatedTax = taxNum > 0
    ? (taxType === 'percent' ? afterDiscount * (taxNum / 100) : taxNum)
    : 0;
  const estimatedTotal = Math.max(0, afterDiscount + estimatedTax);

  const handleCompleteSale = async () => {
    if (cart.length === 0) {
      setError('Add at least one item to the cart');
      return;
    }
    setSubmitting(true);
    setError('');
    setSuccessMessage('');

    try {
      const items: CreatePosSaleItem[] = cart.map((line) => ({
        productId: line.productId,
        variationId: line.variationId,
        quantity: line.quantity,
      }));

      const response = await createPosSale({
        items,
        paymentMethod,
        discount: discountNum > 0 ? { type: discountType, value: discountNum } : undefined,
        manualTax: taxNum > 0 ? { type: taxType, value: taxNum } : undefined,
        customerName: customerName || undefined,
        customerEmail: customerEmail || undefined,
        customerPhone: customerPhone || undefined,
        notes: notes || undefined,
      });

      if (response.success) {
        setSuccessMessage(`Sale completed. Order #${response.data.orderNumber}`);
        setCart([]);
        setCustomerName('');
        setCustomerEmail('');
        setCustomerPhone('');
        setCustomerSearch('');
        setSelectedCustomer(null);
        setDiscountValue('');
        setTaxValue('');
        setNotes('');
        setTimeout(() => {
          navigate(`/seller/pos/history/${response.data.id}`);
        }, 1200);
      } else {
        setError(response.message || 'Failed to complete sale');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to complete sale');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6 -mx-3 sm:-mx-4 md:-mx-6 -mt-3 sm:-mt-4 md:-mt-6">
      <div className="bg-white border-b border-neutral-200 px-3 sm:px-4 md:px-6 py-3 sm:py-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-0">
          <h1 className="text-xl sm:text-2xl font-bold text-neutral-900">New POS Sale</h1>
          <div className="flex items-center gap-2 text-xs sm:text-sm">
            <Link to="/seller" className="text-blue-600 hover:text-blue-700">Home</Link>
            <span className="text-neutral-500">/</span>
            <Link to="/seller/pos/history" className="text-blue-600 hover:text-blue-700">POS</Link>
            <span className="text-neutral-500">/</span>
            <span className="text-neutral-700">New Sale</span>
          </div>
        </div>
      </div>

      <div className="px-3 sm:px-4 md:px-6 grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Product search & picker */}
        <div className="lg:col-span-2 bg-white rounded-lg shadow-sm border border-neutral-200 overflow-hidden">
          <div className="bg-green-600 text-white px-4 sm:px-6 py-2 sm:py-3">
            <h2 className="text-base sm:text-lg font-semibold">Find Products</h2>
          </div>
          <div className="p-3 sm:p-4">
            <input
              ref={searchInputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by product name, SKU, or scan barcode"
              className="w-full px-3 py-2 border border-neutral-300 rounded text-sm text-neutral-900 bg-white focus:outline-none focus:ring-1 focus:ring-green-500 focus:border-green-500"
            />

            <div className="mt-3 max-h-[28rem] overflow-y-auto divide-y divide-neutral-100">
              {searching && <div className="py-6 text-center text-sm text-neutral-500">Searching...</div>}
              {!searching && search && results.length === 0 && (
                <div className="py-6 text-center text-sm text-neutral-500">No products found</div>
              )}
              {!searching &&
                results.map((product) => {
                  const hasVariations = product.variations && product.variations.length > 0;
                  if (!hasVariations) {
                    const stock = product.stock ?? 0;
                    return (
                      <div key={product._id} className="flex items-center justify-between py-2 gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-neutral-900 truncate">{product.productName}</p>
                          <p className="text-xs text-neutral-500">
                            ₹{resolveUnitPrice(product).toFixed(2)} &middot; Stock: {stock}
                          </p>
                        </div>
                        <button
                          disabled={stock <= 0}
                          onClick={() => addToCart(product)}
                          className={`px-3 py-1.5 rounded text-xs font-medium transition-colors min-w-[60px] ${
                            stock <= 0
                              ? 'bg-neutral-100 text-neutral-400 cursor-not-allowed'
                              : addedFlash[product._id]
                              ? 'bg-emerald-700 text-white shadow-inner scale-95'
                              : 'bg-green-600 hover:bg-green-700 text-white'
                          }`}
                        >
                          {stock <= 0 ? 'Out of stock' : addedFlash[product._id] ? 'Added ✓' : 'Add'}
                        </button>
                      </div>
                    );
                  }
                  return (
                    <div key={product._id} className="py-2">
                      <p className="text-sm font-medium text-neutral-900 truncate mb-1.5">{product.productName}</p>
                      <div className="space-y-1.5">
                        {product.variations.map((variation) => {
                          const stock = variation.stock ?? 0;
                          return (
                            <div
                              key={variation._id || variation.value}
                              className="flex items-center justify-between pl-3 gap-3"
                            >
                              <div className="min-w-0">
                                <p className="text-xs text-neutral-700 truncate">
                                  {variation.title || variation.value}
                                </p>
                                <p className="text-xs text-neutral-500">
                                  ₹{resolveUnitPrice(product, variation).toFixed(2)} &middot; Stock: {stock}
                                </p>
                              </div>
                              <button
                                disabled={stock <= 0}
                                onClick={() => addToCart(product, variation)}
                                className={`px-3 py-1.5 rounded text-xs font-medium transition-colors min-w-[60px] ${
                                  stock <= 0
                                    ? 'bg-neutral-100 text-neutral-400 cursor-not-allowed'
                                    : addedFlash[`${product._id}:${variation._id}`]
                                    ? 'bg-emerald-700 text-white shadow-inner scale-95'
                                    : 'bg-green-600 hover:bg-green-700 text-white'
                                }`}
                              >
                                {stock <= 0 ? 'Out of stock' : addedFlash[`${product._id}:${variation._id}`] ? 'Added ✓' : 'Add'}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>

        {/* Cart & checkout */}
        <div className="bg-white rounded-lg shadow-sm border border-neutral-200 overflow-hidden flex flex-col">
          <div className="bg-green-600 text-white px-4 sm:px-6 py-2 sm:py-3">
            <h2 className="text-base sm:text-lg font-semibold">Bill</h2>
          </div>

          <div className="p-3 sm:p-4 flex-1 overflow-y-auto max-h-96">
            {cart.length === 0 ? (
              <p className="text-sm text-neutral-500 text-center py-6">Cart is empty</p>
            ) : (
              <div className="space-y-3">
                {cart.map((line) => (
                  <div key={line.key} className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-neutral-900 truncate">{line.name}</p>
                      {line.variationLabel && (
                        <p className="text-xs text-neutral-500">{line.variationLabel}</p>
                      )}
                      <p className="text-xs text-neutral-500">₹{line.unitPrice.toFixed(2)} each</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min={1}
                        max={line.availableStock || undefined}
                        value={line.quantity}
                        onChange={(e) => updateQuantity(line.key, parseInt(e.target.value) || 1)}
                        className="w-14 px-2 py-1 border border-neutral-300 rounded text-xs text-center"
                      />
                      <button
                        onClick={() => removeLine(line.key)}
                        className="text-red-500 hover:text-red-700 text-xs px-1"
                        aria-label="Remove"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="border-t border-neutral-200 p-3 sm:p-4 space-y-3">
            <div className="relative">
              <input
                type="text"
                placeholder="Search registered customer..."
                value={customerSearch}
                onChange={(e) => {
                  if (selectedCustomer) clearSelectedCustomer();
                  setCustomerSearch(e.target.value);
                  runCustomerSearch(e.target.value);
                }}
                onFocus={() => {
                  if (customerResults.length > 0) setShowCustomerDropdown(true);
                }}
                onBlur={() => setTimeout(() => setShowCustomerDropdown(false), 150)}
                className={`w-full px-2 py-1.5 border rounded text-xs focus:outline-none focus:ring-1 focus:ring-green-500 ${selectedCustomer ? 'border-green-500 bg-green-50 text-green-800 font-medium' : 'border-green-300 bg-green-50'}`}
              />
              {selectedCustomer && (
                <button
                  type="button"
                  onClick={clearSelectedCustomer}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-red-500 text-xs"
                  title="Clear selected customer"
                >
                  ✕
                </button>
              )}
              {showCustomerDropdown && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-neutral-200 rounded shadow-lg max-h-40 overflow-y-auto">
                  {searchingCustomer ? (
                    <div className="p-2 text-xs text-center text-neutral-500">Searching...</div>
                  ) : customerResults.length === 0 ? (
                    <div className="p-2 text-xs text-center text-neutral-500">No matching customer</div>
                  ) : (
                    customerResults.map((c) => (
                      <div
                        key={c._id}
                        onMouseDown={(e) => {
                          e.preventDefault(); // prevent blur from closing dropdown before click
                          selectCustomer(c);
                        }}
                        className="px-3 py-2 hover:bg-green-50 cursor-pointer border-b border-neutral-100 last:border-0"
                      >
                        <p className="text-xs font-medium text-neutral-900">{c.name}</p>
                        <p className="text-[10px] text-neutral-500">{c.phone} &middot; {c.email || 'No email'}</p>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
            
            {!selectedCustomer && (
              <div className="text-[10px] font-semibold text-neutral-500 uppercase">Or Enter Manually:</div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                placeholder="Customer name (optional)"
                value={customerName}
                onChange={(e) => { setSelectedCustomer(null); setCustomerName(e.target.value); }}
                readOnly={!!selectedCustomer}
                className={`px-2 py-1.5 border rounded text-xs ${selectedCustomer ? 'border-green-400 bg-green-50 text-green-900 font-medium cursor-default' : 'border-neutral-300'}`}
              />
              <input
                type="text"
                placeholder="Phone (optional)"
                value={customerPhone}
                onChange={(e) => { setSelectedCustomer(null); setCustomerPhone(e.target.value.replace(/\D/g, '').slice(0, 10)); }}
                readOnly={!!selectedCustomer}
                className={`px-2 py-1.5 border rounded text-xs ${selectedCustomer ? 'border-green-400 bg-green-50 text-green-900 font-medium cursor-default' : 'border-neutral-300'}`}
              />
            </div>
            
            <input
              type="email"
              placeholder="Email (optional)"
              value={customerEmail}
              onChange={(e) => { setSelectedCustomer(null); setCustomerEmail(e.target.value); }}
              readOnly={!!selectedCustomer}
              className={`w-full px-2 py-1.5 border rounded text-xs ${selectedCustomer ? 'border-green-400 bg-green-50 text-green-900 font-medium cursor-default' : 'border-neutral-300'}`}
            />

            <div className="grid grid-cols-2 gap-2">
              <select
                value={taxType}
                onChange={(e) => setTaxType(e.target.value as 'flat' | 'percent')}
                className="px-2 py-1.5 border border-neutral-300 rounded text-xs bg-white"
              >
                <option value="percent">Tax %</option>
                <option value="flat">Tax ₹</option>
              </select>
              <input
                type="number"
                min={0}
                placeholder="0"
                value={taxValue}
                onChange={(e) => setTaxValue(e.target.value)}
                className="px-2 py-1.5 border border-neutral-300 rounded text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <select
                value={discountType}
                onChange={(e) => setDiscountType(e.target.value as 'flat' | 'percent')}
                className="px-2 py-1.5 border border-neutral-300 rounded text-xs bg-white"
              >
                <option value="flat">Discount ₹</option>
                <option value="percent">Discount %</option>
              </select>
              <input
                type="number"
                min={0}
                placeholder="0"
                value={discountValue}
                onChange={(e) => setDiscountValue(e.target.value)}
                className="px-2 py-1.5 border border-neutral-300 rounded text-xs"
              />
            </div>

            <div className="flex gap-2">
              {(['Cash', 'Card', 'UPI'] as const).map((method) => (
                <button
                  key={method}
                  onClick={() => setPaymentMethod(method)}
                  className={`flex-1 px-2 py-1.5 rounded text-xs font-medium border transition-colors ${
                    paymentMethod === method
                      ? 'bg-green-600 border-green-600 text-white'
                      : 'bg-white border-neutral-300 text-neutral-700 hover:bg-neutral-50'
                  }`}
                >
                  {method}
                </button>
              ))}
            </div>

            <div className="text-sm space-y-1 pt-1 border-t border-neutral-100">
              <div className="flex justify-between text-neutral-600">
                <span>Subtotal</span>
                <span>₹{subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-neutral-600">
                <span>Discount</span>
                <span>- ₹{estimatedDiscount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-neutral-600">
                <span>Tax</span>
                <span>+ ₹{estimatedTax.toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-semibold text-neutral-900 text-base pt-1 border-t border-neutral-100">
                <span>Total</span>
                <span>₹{estimatedTotal.toFixed(2)}</span>
              </div>
            </div>

            {error && <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded p-2">{error}</div>}
            {successMessage && (
              <div className="text-xs text-green-700 bg-green-50 border border-green-200 rounded p-2">
                {successMessage}
              </div>
            )}

            <button
              onClick={handleCompleteSale}
              disabled={submitting || cart.length === 0}
              className={`w-full py-2.5 rounded text-sm font-semibold transition-colors ${
                submitting || cart.length === 0
                  ? 'bg-neutral-200 text-neutral-400 cursor-not-allowed'
                  : 'bg-green-600 hover:bg-green-700 text-white'
              }`}
            >
              {submitting ? 'Processing...' : 'Complete Sale'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
