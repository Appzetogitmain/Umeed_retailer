import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  adjustCustomerCoins,
  bulkUpdateProductCoins,
  getLoyaltyCustomers,
  getLoyaltyOverview,
  getLoyaltyProducts,
  getLoyaltySettings,
  getLoyaltyTransactions,
  reconcileLoyalty,
  runLoyaltyExpiry,
  TXN_LABELS,
  updateLoyaltySettings,
  updateProductCoins,
  LoyaltyCustomerRow,
  LoyaltyOverview,
  LoyaltyProductRow,
  LoyaltySettings,
  LoyaltyTransactionRow,
  LoyaltyTxnType,
} from "../../../services/api/admin/adminLoyaltyService";
import { getCategories, getSellers } from "../../../services/api/admin/adminProductService";

type Tab = "overview" | "settings" | "products" | "customers" | "ledger";

const TABS: { id: Tab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "settings", label: "Settings" },
  { id: "products", label: "Product Coins" },
  { id: "customers", label: "Customer Wallets" },
  { id: "ledger", label: "Ledger" },
];

const inputCls =
  "w-full px-3 py-2 border border-neutral-300 rounded focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none bg-white text-sm";
const btnPrimary =
  "px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed";
const btnSecondary =
  "px-3 py-2 border border-neutral-300 hover:bg-neutral-50 text-neutral-700 rounded text-sm font-medium disabled:opacity-50";

const money = (v: number | undefined) => `₹${(Number(v) || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
const num = (v: number | undefined) => (Number(v) || 0).toLocaleString("en-IN");
const fmtDate = (d?: string | null) =>
  d ? new Date(d).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";
const errMsg = (e: any, fallback: string) => e?.response?.data?.message || e?.message || fallback;

export default function AdminLoyalty() {
  const [tab, setTab] = useState<Tab>("overview");
  const [flash, setFlash] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const notify = (type: "success" | "error", text: string) => {
    setFlash({ type, text });
    window.setTimeout(() => setFlash(null), 4000);
  };

  return (
    <div className="flex flex-col h-full bg-gray-50">
      <div className="flex-1 p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-2">
            <button
              onClick={() => window.history.back()}
              className="p-1 sm:p-2 text-neutral-600 hover:text-neutral-900 bg-neutral-100 hover:bg-neutral-200 rounded-lg transition-colors"
              aria-label="Go back">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
            </button>
            <h1 className="text-2xl font-semibold text-neutral-800">Loyalty Coins</h1>
          </div>
          <div className="text-sm">
            <Link to="/admin" className="text-blue-600 hover:underline">Home</Link>
            <span className="text-neutral-400 mx-1">/</span>
            <span className="text-neutral-600">Loyalty Coins</span>
          </div>
        </div>

        {flash && (
          <div
            className={`mb-4 px-4 py-3 rounded-lg border text-sm ${flash.type === "success" ? "bg-green-50 border-green-200 text-green-800" : "bg-red-50 border-red-200 text-red-700"}`}>
            {flash.text}
          </div>
        )}

        <div className="flex gap-1 overflow-x-auto mb-4 border-b border-neutral-200">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 -mb-px transition-colors ${tab === t.id ? "border-teal-600 text-teal-700" : "border-transparent text-neutral-600 hover:text-neutral-900"}`}>
              {t.label}
            </button>
          ))}
        </div>

        {tab === "overview" && <OverviewTab notify={notify} />}
        {tab === "settings" && <SettingsTab notify={notify} />}
        {tab === "products" && <ProductsTab notify={notify} />}
        {tab === "customers" && <CustomersTab notify={notify} />}
        {tab === "ledger" && <LedgerTab />}
      </div>
    </div>
  );
}

type Notify = (type: "success" | "error", text: string) => void;

function Card({ title, children, right }: { title?: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-neutral-200 mb-6">
      {title && (
        <div className="px-4 sm:px-6 py-3 border-b border-neutral-200 flex items-center justify-between gap-2">
          <h2 className="text-base font-semibold text-neutral-800">{title}</h2>
          {right}
        </div>
      )}
      <div className="p-4 sm:p-6">{children}</div>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-white rounded-lg border border-neutral-200 p-4">
      <p className="text-xs font-medium text-neutral-500 uppercase tracking-wide">{label}</p>
      <p className="text-xl font-semibold text-neutral-900 mt-1">{value}</p>
      {sub && <p className="text-xs text-neutral-500 mt-0.5">{sub}</p>}
    </div>
  );
}

function Pager({ page, pages, total, onPage }: { page: number; pages: number; total: number; onPage: (p: number) => void }) {
  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-neutral-200 text-sm">
      <span className="text-neutral-600">{num(total)} records</span>
      <div className="flex items-center gap-2">
        <button className={btnSecondary} disabled={page <= 1} onClick={() => onPage(page - 1)}>Previous</button>
        <span className="text-neutral-600">Page {page} of {Math.max(1, pages)}</span>
        <button className={btnSecondary} disabled={page >= pages} onClick={() => onPage(page + 1)}>Next</button>
      </div>
    </div>
  );
}

// ============================== Overview ==============================

function OverviewTab({ notify }: { notify: Notify }) {
  const [data, setData] = useState<LoyaltyOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [mismatches, setMismatches] = useState<any[] | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await getLoyaltyOverview();
      if (res.success) setData(res.data);
    } catch (e) {
      notify("error", errMsg(e, "Failed to load overview"));
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const runReconcile = async (fix: boolean) => {
    if (fix && !window.confirm("Reset mismatched customer balances to the ledger value?")) return;
    setBusy(true);
    try {
      const res = await reconcileLoyalty(fix);
      setMismatches(res.data.mismatches);
      notify(res.data.mismatches.length ? "error" : "success", res.message);
      if (fix) load();
    } catch (e) {
      notify("error", errMsg(e, "Reconcile failed"));
    } finally {
      setBusy(false);
    }
  };

  const runExpiry = async () => {
    setBusy(true);
    try {
      const res = await runLoyaltyExpiry();
      notify("success", res.message);
      load();
    } catch (e) {
      notify("error", errMsg(e, "Expiry run failed"));
    } finally {
      setBusy(false);
    }
  };

  if (loading && !data) return <p className="text-neutral-500 text-sm">Loading…</p>;
  if (!data) return null;
  const l = data.ledger;
  const issued = (l.EARN?.coins || 0) + (l.ADMIN_CREDIT?.coins || 0);
  const cpr = data.config.coinsPerRupee;

  return (
    <>
      {!data.config.enabled && (
        <div className="mb-4 px-4 py-3 rounded-lg border bg-yellow-50 border-yellow-200 text-yellow-800 text-sm">
          The loyalty program is turned off. Customers can't earn or use coins and no first/second-order discounts apply.
        </div>
      )}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Stat label="Outstanding coins" value={num(data.outstandingCoins)} sub={`${money(data.outstandingValue)} liability · ${num(data.customersWithCoins)} customers`} />
        <Stat label="Coins issued" value={num(issued)} sub={`Earned ${num(l.EARN?.coins)} · Admin ${num(l.ADMIN_CREDIT?.coins)}`} />
        <Stat label="Coins redeemed" value={num(l.REDEEM?.coins)} sub={`${money(l.REDEEM?.value)} across ${num(l.REDEEM?.count)} orders`} />
        <Stat label="Pending to credit" value={num(data.pendingEarnCoins)} sub={`${num(data.pendingEarnOrders)} undelivered orders`} />
        <Stat label="Expired" value={num(l.EXPIRE?.coins)} sub={`${num(data.expiringIn30Days)} expiring in 30 days`} />
        <Stat label="Reversed / released" value={`${num(l.EARN_REVERSAL?.coins)} / ${num(l.REDEEM_RELEASE?.coins)}`} sub="Returns / unpaid orders" />
        <Stat label="Admin debits" value={num(l.ADMIN_DEBIT?.coins)} />
        <Stat label="Products earning coins" value={num(data.productsWithCoins)} sub={`${cpr} coins = ₹1`} />
      </div>

      <Card title="Discounts funded by Speedoo (placed orders)">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Stat label="First/second order" value={money(data.discounts.orderSequence)} sub={`${num(data.discounts.firstOrderCount)} first · ${num(data.discounts.secondOrderCount)} second`} />
          <Stat label="Coupons" value={money(data.discounts.coupon)} sub={`${num(data.discounts.couponOrders)} orders`} />
          <Stat label="Loyalty coins" value={money(data.discounts.loyalty)} sub={`${num(data.discounts.coinOrders)} orders`} />
          <Stat label="Total" value={money(data.discounts.total)} sub="Seller payouts are not reduced" />
        </div>
      </Card>

      <Card title="Maintenance">
        <p className="text-sm text-neutral-600 mb-3">
          <b>Reconcile</b> checks every customer's balance against the ledger (credits − debits) and against unspent credits.
          <b> Run expiry</b> expires due coins now (it also runs automatically every hour).
        </p>
        <div className="flex flex-wrap gap-2">
          <button className={btnSecondary} disabled={busy} onClick={() => runReconcile(false)}>Check balances</button>
          {mismatches && mismatches.length > 0 && (
            <button className={btnPrimary} disabled={busy} onClick={() => runReconcile(true)}>Fix balances from ledger</button>
          )}
          <button className={btnSecondary} disabled={busy || !data.config.expiryEnabled} onClick={runExpiry}>Run expiry now</button>
          <button className={btnSecondary} disabled={busy} onClick={load}>Refresh</button>
        </div>
        {mismatches && mismatches.length > 0 && (
          <div className="overflow-x-auto mt-4">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="bg-neutral-50 text-xs font-bold text-neutral-800 border-b">
                  <th className="p-2">Customer</th><th className="p-2">Stored</th><th className="p-2">Ledger</th><th className="p-2">Unspent credits</th>
                </tr>
              </thead>
              <tbody>
                {mismatches.map((m) => (
                  <tr key={m.customerId} className="border-b">
                    <td className="p-2">{m.name} ({m.phone})</td>
                    <td className="p-2">{m.storedBalance}</td>
                    <td className="p-2">{m.ledgerBalance}</td>
                    <td className="p-2">{m.lotRemaining}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}

// ============================== Settings ==============================

function Toggle({ label, help, checked, onChange }: { label: string; help?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-start gap-3 cursor-pointer">
      <input type="checkbox" className="mt-1 w-4 h-4 accent-teal-600" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>
        <span className="block text-sm font-medium text-neutral-800">{label}</span>
        {help && <span className="block text-xs text-neutral-500">{help}</span>}
      </span>
    </label>
  );
}

function Field({ label, help, children }: { label: string; help?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-neutral-700 mb-1">{label}</label>
      {children}
      {help && <p className="text-xs text-neutral-500 mt-1">{help}</p>}
    </div>
  );
}

function SettingsTab({ notify }: { notify: Notify }) {
  const [form, setForm] = useState<LoyaltySettings | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getLoyaltySettings()
      .then((res) => res.success && setForm(res.data))
      .catch((e) => notify("error", errMsg(e, "Failed to load settings")));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!form) return <p className="text-neutral-500 text-sm">Loading…</p>;
  const set = <K extends keyof LoyaltySettings>(k: K, v: LoyaltySettings[K]) => setForm({ ...form, [k]: v });
  const setTier = (i: number, k: keyof LoyaltySettings["orderDiscounts"][number], v: number) => {
    const tiers = form.orderDiscounts.map((t, idx) => (idx === i ? { ...t, [k]: v } : t));
    set("orderDiscounts", tiers);
  };

  const save = async () => {
    setSaving(true);
    try {
      const res = await updateLoyaltySettings(form);
      setForm(res.data);
      notify("success", res.message || "Settings saved");
    } catch (e) {
      notify("error", errMsg(e, "Failed to save settings"));
    } finally {
      setSaving(false);
    }
  };

  const example = Math.max(0, Math.floor((500 * form.maxRedeemPercent) / 100));

  return (
    <>
      <Card title="Program">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Toggle label="Loyalty program enabled" help="Master switch for coins and first/second-order discounts" checked={form.enabled} onChange={(v) => set("enabled", v)} />
          <Toggle label="Customers earn coins" help="Credited when an order is delivered" checked={form.earnEnabled} onChange={(v) => set("earnEnabled", v)} />
          <Toggle label="Customers can redeem coins" help="Use coins as a discount at checkout" checked={form.redeemEnabled} onChange={(v) => set("redeemEnabled", v)} />
        </div>
      </Card>

      <Card title="Redemption">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Field label="Coins per ₹1" help="10 means 10 coins = ₹1">
            <input type="number" min={1} step={1} className={inputCls} value={form.coinsPerRupee} onChange={(e) => set("coinsPerRupee", Number(e.target.value))} />
          </Field>
          <Field label="Max redeem (% of order amount)" help={`On a ₹500 order, up to ₹${example} can be paid with coins`}>
            <input type="number" min={0} max={100} step={0.5} className={inputCls} value={form.maxRedeemPercent} onChange={(e) => set("maxRedeemPercent", Number(e.target.value))} />
          </Field>
          <Field label="Minimum balance to redeem (coins)" help="0 = no minimum">
            <input type="number" min={0} step={1} className={inputCls} value={form.minRedeemCoins} onChange={(e) => set("minRedeemCoins", Number(e.target.value))} />
          </Field>
        </div>
        <p className="text-xs text-neutral-500 mt-3">
          Coins are redeemed in whole rupees. The cap applies to the order amount after first/second-order and coupon discounts, including fees.
        </p>
      </Card>

      <Card title="Expiry">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
          <Toggle label="Coins expire" help="Unspent coins expire after the set number of days" checked={form.expiryEnabled} onChange={(v) => set("expiryEnabled", v)} />
          <Field label="Expire after (days)" help="Applies to coins credited after you save. Oldest coins are used first.">
            <input type="number" min={1} step={1} className={inputCls} disabled={!form.expiryEnabled} value={form.expiryDays} onChange={(e) => set("expiryDays", Number(e.target.value))} />
          </Field>
        </div>
      </Card>

      <Card title="Coin & cancellation policy">
        <ul className="text-sm text-neutral-700 space-y-1 list-disc pl-5">
          <li>Coins can only be redeemed from the coin wallet at checkout.</li>
          <li>Redeemed coins are non-refundable: they are not credited back on returns, exchanges or cancellations. Refunds cover only the amount actually paid.</li>
          <li>Customers cannot cancel an order (or any product in it) once it is placed.</li>
          <li>If an online payment fails or is abandoned before the order is placed, the order is voided and any coins reserved for it are restored automatically (unpaid orders are voided after 30 minutes).</li>
        </ul>
      </Card>

      <Card
        title="First / second order discounts"
        right={
          <button
            className={btnSecondary}
            onClick={() => {
              const next = (form.orderDiscounts.reduce((m, t) => Math.max(m, t.orderNumber), 0) || 0) + 1;
              set("orderDiscounts", [...form.orderDiscounts, { orderNumber: next, percent: 0, maxDiscount: 0, minOrderValue: 0 }]);
            }}>
            + Add tier
          </button>
        }>
        <Toggle label="Order-sequence discounts enabled" checked={form.orderDiscountsEnabled} onChange={(v) => set("orderDiscountsEnabled", v)} />
        <div className="overflow-x-auto mt-4">
          <table className="w-full text-left text-sm min-w-[560px]">
            <thead>
              <tr className="bg-neutral-50 text-xs font-bold text-neutral-800 border-b">
                <th className="p-2">Customer's order #</th>
                <th className="p-2">Discount %</th>
                <th className="p-2">Max discount ₹ (0 = no cap)</th>
                <th className="p-2">Min order ₹ (0 = none)</th>
                <th className="p-2"></th>
              </tr>
            </thead>
            <tbody>
              {form.orderDiscounts.map((t, i) => (
                <tr key={i} className="border-b">
                  <td className="p-2"><input type="number" min={1} className={inputCls} value={t.orderNumber} onChange={(e) => setTier(i, "orderNumber", Number(e.target.value))} /></td>
                  <td className="p-2"><input type="number" min={0} max={100} step={0.5} className={inputCls} value={t.percent} onChange={(e) => setTier(i, "percent", Number(e.target.value))} /></td>
                  <td className="p-2"><input type="number" min={0} className={inputCls} value={t.maxDiscount} onChange={(e) => setTier(i, "maxDiscount", Number(e.target.value))} /></td>
                  <td className="p-2"><input type="number" min={0} className={inputCls} value={t.minOrderValue} onChange={(e) => setTier(i, "minOrderValue", Number(e.target.value))} /></td>
                  <td className="p-2">
                    <button className="text-red-600 text-sm hover:underline" onClick={() => set("orderDiscounts", form.orderDiscounts.filter((_, idx) => idx !== i))}>Remove</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-neutral-500 mt-3">
          Applied on the items total. Cancelled, rejected and unpaid online orders don't count towards a customer's order number. Combines with coupons and coins.
        </p>
      </Card>

      <div className="flex justify-end">
        <button className={btnPrimary} disabled={saving} onClick={save}>{saving ? "Saving…" : "Save settings"}</button>
      </div>
    </>
  );
}

// ============================== Product coins ==============================

function ProductsTab({ notify }: { notify: Notify }) {
  const [rows, setRows] = useState<LoyaltyProductRow[]>([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [filters, setFilters] = useState({ search: "", category: "", seller: "", coinType: "" });
  const [loading, setLoading] = useState(false);
  const [edits, setEdits] = useState<Record<string, { type: string; value: string }>>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [categories, setCategories] = useState<{ _id: string; name: string }[]>([]);
  const [sellers, setSellers] = useState<{ _id: string; storeName: string }[]>([]);
  const [bulk, setBulk] = useState({ type: "fixed", value: "", scope: "selected", onlyUnconfigured: false });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getCategories({ includeChildren: false })
      .then((r) => r.success && setCategories(r.data.map((c) => ({ _id: c._id, name: c.name }))))
      .catch(() => {});
    getSellers()
      .then((r) => r.success && setSellers(r.data.map((s) => ({ _id: s._id, storeName: s.storeName || s.sellerName }))))
      .catch(() => {});
  }, []);

  const load = async (page = 1) => {
    setLoading(true);
    try {
      const res = await getLoyaltyProducts({ ...filters, page, limit: 20 });
      setRows(res.data);
      setPagination({ page: res.pagination.page, pages: res.pagination.pages, total: res.pagination.total });
      setEdits({});
      setSelected(new Set());
    } catch (e) {
      notify("error", errMsg(e, "Failed to load products"));
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    const t = setTimeout(() => load(1), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  const editOf = (p: LoyaltyProductRow) => edits[p._id] || { type: p.loyaltyCoinType, value: String(p.loyaltyCoinValue || "") };

  const saveRow = async (p: LoyaltyProductRow) => {
    const e = editOf(p);
    try {
      await updateProductCoins(p._id, { loyaltyCoinType: e.type, loyaltyCoinValue: e.type === "none" ? 0 : Number(e.value) });
      notify("success", `Coins updated for ${p.productName}`);
      load(pagination.page);
    } catch (err) {
      notify("error", errMsg(err, "Failed to update product"));
    }
  };

  const applyBulk = async () => {
    const value = bulk.type === "none" ? 0 : Number(bulk.value);
    const payload: any = { loyaltyCoinType: bulk.type, loyaltyCoinValue: value, onlyUnconfigured: bulk.onlyUnconfigured };
    let desc = "";
    if (bulk.scope === "selected") {
      if (selected.size === 0) return notify("error", "Select at least one product");
      payload.productIds = Array.from(selected);
      desc = `${selected.size} selected product(s)`;
    } else {
      if (!filters.category && !filters.seller) {
        if (!window.confirm("No category or seller filter is set. Apply to ALL products?")) return;
        payload.applyToAll = true;
        desc = "ALL products";
      } else {
        payload.category = filters.category || undefined;
        payload.seller = filters.seller || undefined;
        desc = "all products in the current category/seller filter";
      }
    }
    const rule = bulk.type === "none" ? "no coins" : bulk.type === "fixed" ? `${value} coins per unit` : `${value}% back as coins`;
    if (!window.confirm(`Set ${rule} on ${desc}?`)) return;
    setBusy(true);
    try {
      const res = await bulkUpdateProductCoins(payload);
      notify("success", res.message);
      load(1);
    } catch (e) {
      notify("error", errMsg(e, "Bulk update failed"));
    } finally {
      setBusy(false);
    }
  };

  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r._id));

  return (
    <>
      <Card title="Bulk set coins">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
          <Field label="Apply to">
            <select className={inputCls} value={bulk.scope} onChange={(e) => setBulk({ ...bulk, scope: e.target.value })}>
              <option value="selected">Selected products ({selected.size})</option>
              <option value="filter">All matching category/seller filter</option>
            </select>
          </Field>
          <Field label="Coin type">
            <select className={inputCls} value={bulk.type} onChange={(e) => setBulk({ ...bulk, type: e.target.value })}>
              <option value="fixed">Fixed coins per unit</option>
              <option value="percent">% of price as coins</option>
              <option value="none">No coins</option>
            </select>
          </Field>
          <Field label={bulk.type === "percent" ? "Percent (%)" : "Coins per unit"}>
            <input type="number" min={0} step={bulk.type === "percent" ? 0.5 : 1} className={inputCls} disabled={bulk.type === "none"} value={bulk.value} onChange={(e) => setBulk({ ...bulk, value: e.target.value })} />
          </Field>
          <label className="flex items-center gap-2 text-sm text-neutral-700 pb-2">
            <input type="checkbox" className="accent-teal-600" checked={bulk.onlyUnconfigured} onChange={(e) => setBulk({ ...bulk, onlyUnconfigured: e.target.checked })} />
            Only products without coins
          </label>
          <button className={btnPrimary} disabled={busy} onClick={applyBulk}>Apply</button>
        </div>
        <p className="text-xs text-neutral-500 mt-3">
          Fixed: coins earned per unit bought. Percent: that % of the item price is given back as coins (e.g. 5% on ₹100 at 10 coins/₹1 = 50 coins). Coins are credited on delivery and paid for by Speedoo, not the seller.
        </p>
      </Card>

      <div className="bg-white rounded-lg shadow-sm border border-neutral-200">
        <div className="p-4 border-b border-neutral-200 grid grid-cols-1 md:grid-cols-4 gap-3">
          <input className={inputCls} placeholder="Search product or SKU" value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })} />
          <select className={inputCls} value={filters.category} onChange={(e) => setFilters({ ...filters, category: e.target.value })}>
            <option value="">All categories</option>
            {categories.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
          </select>
          <select className={inputCls} value={filters.seller} onChange={(e) => setFilters({ ...filters, seller: e.target.value })}>
            <option value="">All sellers</option>
            {sellers.map((s) => <option key={s._id} value={s._id}>{s.storeName}</option>)}
          </select>
          <select className={inputCls} value={filters.coinType} onChange={(e) => setFilters({ ...filters, coinType: e.target.value })}>
            <option value="">Any coin setting</option>
            <option value="configured">With coins</option>
            <option value="none">Without coins</option>
            <option value="fixed">Fixed</option>
            <option value="percent">Percent</option>
          </select>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm min-w-[860px]">
            <thead>
              <tr className="bg-neutral-50 text-xs font-bold text-neutral-800 border-b border-neutral-200">
                <th className="p-3">
                  <input
                    type="checkbox"
                    className="accent-teal-600"
                    checked={allSelected}
                    onChange={(e) => setSelected(e.target.checked ? new Set(rows.map((r) => r._id)) : new Set())}
                  />
                </th>
                <th className="p-3">Product</th>
                <th className="p-3">Seller</th>
                <th className="p-3">Price</th>
                <th className="p-3">Coin type</th>
                <th className="p-3">Value</th>
                <th className="p-3">Earns / unit</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="p-8 text-center text-neutral-400">Loading…</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={8} className="p-8 text-center text-neutral-400">No products found</td></tr>
              ) : (
                rows.map((p) => {
                  const e = editOf(p);
                  const dirty = !!edits[p._id];
                  return (
                    <tr key={p._id} className="border-b border-neutral-100 hover:bg-neutral-50">
                      <td className="p-3">
                        <input
                          type="checkbox"
                          className="accent-teal-600"
                          checked={selected.has(p._id)}
                          onChange={(ev) => {
                            const next = new Set(selected);
                            if (ev.target.checked) next.add(p._id);
                            else next.delete(p._id);
                            setSelected(next);
                          }}
                        />
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          {p.mainImage && <img src={p.mainImage} alt="" className="w-9 h-9 rounded object-cover border" />}
                          <div className="min-w-0">
                            <p className="font-medium text-neutral-900 truncate max-w-[220px]">{p.productName}</p>
                            <p className="text-xs text-neutral-500">{p.category?.name || ""}{p.sku ? ` · ${p.sku}` : ""}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-3 text-neutral-700">{p.seller?.storeName || p.seller?.sellerName || "—"}</td>
                      <td className="p-3">{money(p.unitPrice)}</td>
                      <td className="p-3">
                        <select
                          className={inputCls}
                          value={e.type}
                          onChange={(ev) => setEdits({ ...edits, [p._id]: { ...e, type: ev.target.value } })}>
                          <option value="none">None</option>
                          <option value="fixed">Fixed</option>
                          <option value="percent">Percent</option>
                        </select>
                      </td>
                      <td className="p-3 w-28">
                        <input
                          type="number"
                          min={0}
                          step={e.type === "percent" ? 0.5 : 1}
                          disabled={e.type === "none"}
                          className={inputCls}
                          value={e.type === "none" ? "" : e.value}
                          placeholder={e.type === "percent" ? "%" : "coins"}
                          onChange={(ev) => setEdits({ ...edits, [p._id]: { ...e, value: ev.target.value } })}
                        />
                      </td>
                      <td className="p-3 whitespace-nowrap">
                        {p.coinsPerUnit > 0 ? `${num(p.coinsPerUnit)} (${money(p.coinsValuePerUnit)})` : "—"}
                      </td>
                      <td className="p-3">
                        <button className={btnPrimary} disabled={!dirty} onClick={() => saveRow(p)}>Save</button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <Pager page={pagination.page} pages={pagination.pages} total={pagination.total} onPage={(pg) => load(pg)} />
      </div>
    </>
  );
}

// ============================== Customers ==============================

function CustomersTab({ notify }: { notify: Notify }) {
  const [rows, setRows] = useState<LoyaltyCustomerRow[]>([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("balance");
  const [onlyWithCoins, setOnlyWithCoins] = useState(true);
  const [loading, setLoading] = useState(false);
  const [adjusting, setAdjusting] = useState<LoyaltyCustomerRow | null>(null);
  const [historyFor, setHistoryFor] = useState<LoyaltyCustomerRow | null>(null);

  const load = async (page = 1) => {
    setLoading(true);
    try {
      const res = await getLoyaltyCustomers({ search, sort, onlyWithCoins, page, limit: 20 });
      setRows(res.data);
      setPagination({ page: res.pagination.page, pages: res.pagination.pages, total: res.pagination.total });
    } catch (e) {
      notify("error", errMsg(e, "Failed to load customers"));
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    const t = setTimeout(() => load(1), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, sort, onlyWithCoins]);

  if (historyFor) {
    return (
      <>
        <button className={`${btnSecondary} mb-4`} onClick={() => setHistoryFor(null)}>← Back to customers</button>
        <h3 className="text-lg font-semibold text-neutral-800 mb-3">
          {historyFor.name} ({historyFor.phone}) · {num(historyFor.loyaltyCoins)} coins
        </h3>
        <LedgerTab customerId={historyFor._id} />
      </>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-neutral-200">
      <div className="p-4 border-b border-neutral-200 grid grid-cols-1 md:grid-cols-3 gap-3 items-center">
        <input className={inputCls} placeholder="Search name, phone or email" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select className={inputCls} value={sort} onChange={(e) => setSort(e.target.value)}>
          <option value="balance">Sort: Highest balance</option>
          <option value="earned">Sort: Most earned</option>
          <option value="redeemed">Sort: Most redeemed</option>
          <option value="name">Sort: Name</option>
        </select>
        <label className="flex items-center gap-2 text-sm text-neutral-700">
          <input type="checkbox" className="accent-teal-600" checked={onlyWithCoins} onChange={(e) => setOnlyWithCoins(e.target.checked)} />
          Only customers with coins
        </label>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm min-w-[820px]">
          <thead>
            <tr className="bg-neutral-50 text-xs font-bold text-neutral-800 border-b border-neutral-200">
              <th className="p-3">Customer</th>
              <th className="p-3">Balance</th>
              <th className="p-3">Earned</th>
              <th className="p-3">Redeemed</th>
              <th className="p-3">Expired</th>
              <th className="p-3">Admin +/−</th>
              <th className="p-3">Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="p-8 text-center text-neutral-400">Loading…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={7} className="p-8 text-center text-neutral-400">No customers found</td></tr>
            ) : (
              rows.map((c) => (
                <tr key={c._id} className="border-b border-neutral-100 hover:bg-neutral-50">
                  <td className="p-3">
                    <p className="font-medium text-neutral-900">{c.name}</p>
                    <p className="text-xs text-neutral-500">{c.phone}{c.email ? ` · ${c.email}` : ""}</p>
                  </td>
                  <td className="p-3 font-semibold">{num(c.loyaltyCoins)} <span className="text-xs text-neutral-500 font-normal">({money(c.coinValue)})</span></td>
                  <td className="p-3">{num(c.loyaltyStats?.totalEarned)}</td>
                  <td className="p-3">{num(c.loyaltyStats?.totalRedeemed)}</td>
                  <td className="p-3">{num(c.loyaltyStats?.totalExpired)}</td>
                  <td className="p-3">+{num(c.loyaltyStats?.totalAdminCredited)} / −{num(c.loyaltyStats?.totalAdminDebited)}</td>
                  <td className="p-3">
                    <div className="flex gap-2">
                      <button className={btnSecondary} onClick={() => setHistoryFor(c)}>History</button>
                      <button className={btnPrimary} onClick={() => setAdjusting(c)}>Adjust</button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <Pager page={pagination.page} pages={pagination.pages} total={pagination.total} onPage={(pg) => load(pg)} />

      {adjusting && (
        <AdjustModal
          customer={adjusting}
          onClose={() => setAdjusting(null)}
          onDone={(msg) => {
            setAdjusting(null);
            notify("success", msg);
            load(pagination.page);
          }}
          onError={(msg) => notify("error", msg)}
        />
      )}
    </div>
  );
}

function AdjustModal({
  customer,
  onClose,
  onDone,
  onError,
}: {
  customer: LoyaltyCustomerRow;
  onClose: () => void;
  onDone: (msg: string) => void;
  onError: (msg: string) => void;
}) {
  const [direction, setDirection] = useState<"CREDIT" | "DEBIT">("CREDIT");
  const [coins, setCoins] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  // One id per modal session: a double click can never apply the adjustment twice
  const requestId = useMemo(() => `${customer._id}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`, [customer._id]);

  const coinsNum = Math.floor(Number(coins));
  const valid = coinsNum > 0 && note.trim().length > 0 && (direction === "CREDIT" || coinsNum <= customer.loyaltyCoins);
  const after = direction === "CREDIT" ? customer.loyaltyCoins + (coinsNum || 0) : customer.loyaltyCoins - (coinsNum || 0);

  const submit = async () => {
    if (!valid) return;
    setSaving(true);
    try {
      const res = await adjustCustomerCoins(customer._id, { direction, coins: coinsNum, note: note.trim(), requestId });
      onDone(res.message || "Coins updated");
    } catch (e) {
      onError(errMsg(e, "Failed to adjust coins"));
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="bg-teal-600 text-white px-5 py-3 rounded-t-lg">
          <h3 className="font-semibold">Adjust coins · {customer.name}</h3>
          <p className="text-xs opacity-90">Current balance: {num(customer.loyaltyCoins)} coins</p>
        </div>
        <div className="p-5 space-y-4">
          <div className="flex gap-2">
            {(["CREDIT", "DEBIT"] as const).map((d) => (
              <button
                key={d}
                onClick={() => setDirection(d)}
                className={`flex-1 py-2 rounded border text-sm font-medium ${direction === d ? (d === "CREDIT" ? "bg-green-50 border-green-500 text-green-700" : "bg-red-50 border-red-500 text-red-700") : "border-neutral-300 text-neutral-600"}`}>
                {d === "CREDIT" ? "Add coins" : "Deduct coins"}
              </button>
            ))}
          </div>
          <Field label="Coins">
            <input type="number" min={1} step={1} className={inputCls} value={coins} onChange={(e) => setCoins(e.target.value)} />
          </Field>
          <Field label="Reason (shown in ledger)">
            <input className={inputCls} value={note} maxLength={200} placeholder="e.g. Goodwill for delayed delivery" onChange={(e) => setNote(e.target.value)} />
          </Field>
          {coinsNum > 0 && (
            <p className={`text-sm ${after < 0 ? "text-red-600" : "text-neutral-600"}`}>
              {after < 0 ? "Cannot deduct more than the current balance" : `New balance will be ${num(after)} coins`}
            </p>
          )}
        </div>
        <div className="px-5 py-3 border-t flex justify-end gap-2">
          <button className={btnSecondary} onClick={onClose}>Cancel</button>
          <button className={btnPrimary} disabled={!valid || saving} onClick={submit}>{saving ? "Saving…" : "Confirm"}</button>
        </div>
      </div>
    </div>
  );
}

// ============================== Ledger ==============================

function LedgerTab({ customerId }: { customerId?: string }) {
  const [rows, setRows] = useState<LoyaltyTransactionRow[]>([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [totals, setTotals] = useState({ creditCoins: 0, debitCoins: 0, creditValue: 0, debitValue: 0 });
  const [filters, setFilters] = useState({ type: "", direction: "", search: "", orderNumber: "", from: "", to: "" });
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  const params = (page: number, limit: number) => ({ ...filters, customerId, page, limit });

  const load = async (page = 1) => {
    setLoading(true);
    try {
      const res = await getLoyaltyTransactions(params(page, 25));
      setRows(res.data);
      setTotals(res.totals);
      setPagination({ page: res.pagination.page, pages: res.pagination.pages, total: res.pagination.total });
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    const t = setTimeout(() => load(1), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, customerId]);

  const exportCsv = async () => {
    setExporting(true);
    try {
      const res = await getLoyaltyTransactions(params(1, 1000));
      const header = ["Date", "Customer", "Phone", "Type", "Direction", "Coins", "Value (Rs)", "Balance before", "Balance after", "Order", "Expires", "Note"];
      const esc = (v: any) => `"${String(v ?? "").replace(/"/g, '""')}"`;
      const lines = res.data.map((r) =>
        [
          new Date(r.createdAt).toISOString(),
          r.customer?.name,
          r.customer?.phone,
          TXN_LABELS[r.type] || r.type,
          r.direction,
          r.coins,
          r.rupeeValue,
          r.balanceBefore,
          r.balanceAfter,
          r.orderNumber,
          r.expiresAt ? new Date(r.expiresAt).toISOString().slice(0, 10) : "",
          r.note,
        ].map(esc).join(",")
      );
      const blob = new Blob([[header.map(esc).join(","), ...lines].join("\n")], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `loyalty-ledger-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-neutral-200">
      <div className="p-4 border-b border-neutral-200 grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {!customerId && (
          <input className={inputCls} placeholder="Customer name / phone" value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })} />
        )}
        <input className={inputCls} placeholder="Order number" value={filters.orderNumber} onChange={(e) => setFilters({ ...filters, orderNumber: e.target.value })} />
        <select className={inputCls} value={filters.type} onChange={(e) => setFilters({ ...filters, type: e.target.value })}>
          <option value="">All types</option>
          {(Object.keys(TXN_LABELS) as LoyaltyTxnType[]).map((t) => <option key={t} value={t}>{TXN_LABELS[t]}</option>)}
        </select>
        <select className={inputCls} value={filters.direction} onChange={(e) => setFilters({ ...filters, direction: e.target.value })}>
          <option value="">Credit & debit</option>
          <option value="CREDIT">Credits</option>
          <option value="DEBIT">Debits</option>
        </select>
        <input type="date" className={inputCls} value={filters.from} onChange={(e) => setFilters({ ...filters, from: e.target.value })} />
        <input type="date" className={inputCls} value={filters.to} onChange={(e) => setFilters({ ...filters, to: e.target.value })} />
      </div>
      <div className="px-4 py-3 border-b border-neutral-200 flex flex-wrap items-center justify-between gap-3 text-sm">
        <div className="flex flex-wrap gap-4 text-neutral-700">
          <span>Credits: <b className="text-green-700">+{num(totals.creditCoins)}</b> ({money(totals.creditValue)})</span>
          <span>Debits: <b className="text-red-700">−{num(totals.debitCoins)}</b> ({money(totals.debitValue)})</span>
          <span>Net: <b>{num(totals.creditCoins - totals.debitCoins)}</b></span>
        </div>
        <button className={btnSecondary} disabled={exporting} onClick={exportCsv}>{exporting ? "Exporting…" : "Export CSV"}</button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm min-w-[960px]">
          <thead>
            <tr className="bg-neutral-50 text-xs font-bold text-neutral-800 border-b border-neutral-200">
              <th className="p-3">Date</th>
              {!customerId && <th className="p-3">Customer</th>}
              <th className="p-3">Type</th>
              <th className="p-3">Coins</th>
              <th className="p-3">Value</th>
              <th className="p-3">Balance</th>
              <th className="p-3">Order</th>
              <th className="p-3">Details</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} className="p-8 text-center text-neutral-400">Loading…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={8} className="p-8 text-center text-neutral-400">No transactions</td></tr>
            ) : (
              rows.map((r) => (
                <tr key={r._id} className="border-b border-neutral-100 align-top hover:bg-neutral-50">
                  <td className="p-3 whitespace-nowrap text-neutral-600">{fmtDate(r.createdAt)}</td>
                  {!customerId && (
                    <td className="p-3">
                      <p className="font-medium text-neutral-900">{r.customer?.name || "—"}</p>
                      <p className="text-xs text-neutral-500">{r.customer?.phone}</p>
                    </td>
                  )}
                  <td className="p-3">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${r.direction === "CREDIT" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
                      {TXN_LABELS[r.type] || r.type}
                    </span>
                    <p className="text-[11px] text-neutral-400 mt-1">{r.actorType}</p>
                  </td>
                  <td className={`p-3 font-semibold ${r.direction === "CREDIT" ? "text-green-700" : "text-red-700"}`}>
                    {r.direction === "CREDIT" ? "+" : "−"}{num(r.coins)}
                  </td>
                  <td className="p-3">{money(r.rupeeValue)}</td>
                  <td className="p-3 whitespace-nowrap text-neutral-600">{num(r.balanceBefore)} → <b className="text-neutral-900">{num(r.balanceAfter)}</b></td>
                  <td className="p-3">
                    {r.order ? <Link to={`/admin/orders/${r.order}`} className="text-blue-600 hover:underline">{r.orderNumber || "View"}</Link> : "—"}
                  </td>
                  <td className="p-3 text-xs text-neutral-600 max-w-[280px]">
                    {r.note && <p>{r.note}</p>}
                    {r.items && r.items.length > 0 && (
                      <p className="text-neutral-500">{r.items.map((i) => `${i.productName} ×${i.quantity}: ${i.coins}`).join(", ")}</p>
                    )}
                    {r.direction === "CREDIT" && r.expiresAt && (
                      <p className={r.expired ? "text-red-600" : "text-orange-600"}>
                        {r.expired ? "Expired" : `Expires ${new Date(r.expiresAt).toLocaleDateString("en-IN")}`} · {num(r.remainingCoins)} unspent
                      </p>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <Pager page={pagination.page} pages={pagination.pages} total={pagination.total} onPage={(pg) => load(pg)} />
    </div>
  );
}
