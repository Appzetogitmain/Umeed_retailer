import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  getLoyaltyHistory,
  getLoyaltySummary,
  LOYALTY_TYPE_LABELS,
  LoyaltyHistoryRow,
  LoyaltySummary,
} from "../../services/api/customerLoyaltyService";

type Filter = "ALL" | "CREDIT" | "DEBIT";

const formatDate = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "";

export default function LoyaltyCoins() {
  const navigate = useNavigate();
  const [summary, setSummary] = useState<LoyaltySummary | null>(null);
  const [rows, setRows] = useState<LoyaltyHistoryRow[]>([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [filter, setFilter] = useState<Filter>("ALL");
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getLoyaltySummary()
      .then((res) => res.success && setSummary(res.data))
      .catch(() => setError("Could not load your coins. Please try again."));
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getLoyaltyHistory({ page: 1, limit: 20, direction: filter === "ALL" ? undefined : filter })
      .then((res) => {
        if (cancelled || !res.success) return;
        setRows(res.data);
        setPage(1);
        setPages(res.pagination.pages || 1);
      })
      .catch(() => !cancelled && setError("Could not load coin history."))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [filter]);

  const loadMore = async () => {
    if (page >= pages || loadingMore) return;
    setLoadingMore(true);
    try {
      const res = await getLoyaltyHistory({ page: page + 1, limit: 20, direction: filter === "ALL" ? undefined : filter });
      if (res.success) {
        setRows((prev) => [...prev, ...res.data]);
        setPage(page + 1);
        setPages(res.pagination.pages || 1);
      }
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <div className="pb-24 md:pb-8 bg-gradient-to-br from-white via-yellow-50/30 to-purple-50/30 min-h-screen">
      <div className="bg-[#9048A5] sticky top-0 z-10 shadow-sm">
        <div className="px-4 py-3 flex items-center gap-4 max-w-2xl mx-auto w-full">
          <button
            onClick={() => navigate(-1)}
            className="text-white p-1 rounded-full hover:bg-black/10 transition-colors"
            aria-label="Back">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M15 18L9 12L15 6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <h1 className="text-white text-lg font-bold">Speedoo Coins</h1>
        </div>
      </div>

      <div className="px-4 max-w-2xl mx-auto">
        {/* Balance card */}
        <div className="mt-4 rounded-2xl bg-gradient-to-r from-[#FFC107] to-[#B95F15] p-5 text-white shadow-md">
          <p className="text-xs font-semibold uppercase tracking-wider opacity-90">Available coins</p>
          <p className="text-4xl font-extrabold mt-1">{summary ? summary.balance.toLocaleString("en-IN") : "—"}</p>
          <p className="text-sm font-medium mt-1 opacity-95">
            {summary ? `Worth ₹${summary.balanceValue.toLocaleString("en-IN")}` : ""}
          </p>
          {summary && summary.expiringSoon.coins > 0 && (
            <p className="mt-3 text-xs font-semibold bg-white/20 rounded-lg px-2.5 py-1.5 inline-block">
              {summary.expiringSoon.coins} coins expire by {formatDate(summary.expiringSoon.nextExpiry)}
            </p>
          )}
        </div>

        {/* How it works */}
        {summary && (
          <div className="mt-4 bg-white rounded-2xl border border-neutral-100 p-4 shadow-sm">
            <h2 className="text-[11px] font-bold text-neutral-500 uppercase tracking-[0.1em] mb-2">How coins work</h2>
            <ul className="space-y-1.5 text-xs text-neutral-700">
              <li>• {summary.coinsPerRupee} coins = ₹1 discount at checkout.</li>
              {summary.earnEnabled && <li>• Earn coins on eligible products once your order is delivered.</li>}
              {summary.redeemEnabled && (
                <li>
                  • Use coins for up to {summary.maxRedeemPercent}% of your order amount
                  {summary.minRedeemCoins > 0 ? ` (minimum ${summary.minRedeemCoins} coins)` : ""}.
                </li>
              )}
              <li>• Coins used on an order are non-refundable and are kept separate from refunds.</li>
              {summary.expiryEnabled && <li>• Coins expire {summary.expiryDays} days after they are credited.</li>}
            </ul>
            <div className="grid grid-cols-3 gap-2 mt-3">
              <Stat label="Earned" value={(summary.stats.totalEarned || 0) + (summary.stats.totalAdminCredited || 0)} />
              <Stat label="Used" value={summary.stats.totalRedeemed || 0} />
              <Stat label="Expired" value={summary.stats.totalExpired || 0} />
            </div>
          </div>
        )}

        {/* History */}
        <div className="mt-4 flex items-center justify-between">
          <h2 className="text-[11px] font-bold text-neutral-500 uppercase tracking-[0.1em]">Coin history</h2>
          <div className="flex gap-1">
            {(["ALL", "CREDIT", "DEBIT"] as Filter[]).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border ${filter === f ? "bg-[#9048A5] text-white border-[#9048A5]" : "bg-white text-neutral-600 border-neutral-200"}`}>
                {f === "ALL" ? "All" : f === "CREDIT" ? "Earned" : "Used"}
              </button>
            ))}
          </div>
        </div>

        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

        <div className="mt-2 bg-white rounded-2xl border border-neutral-100 shadow-sm divide-y divide-neutral-50">
          {loading ? (
            <p className="p-6 text-center text-sm text-neutral-400">Loading…</p>
          ) : rows.length === 0 ? (
            <p className="p-6 text-center text-sm text-neutral-400">No coin activity yet. Shop to start earning!</p>
          ) : (
            rows.map((r) => (
              <div key={r._id} className="flex items-start justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-neutral-900">{LOYALTY_TYPE_LABELS[r.type] || r.type}</p>
                  <p className="text-[11px] text-neutral-500">
                    {formatDate(r.createdAt)}
                    {r.orderNumber ? ` · #${r.orderNumber}` : ""}
                  </p>
                  {r.note && (r.type === "ADMIN_CREDIT" || r.type === "ADMIN_DEBIT") && (
                    <p className="text-[11px] text-neutral-500 truncate">{r.note}</p>
                  )}
                  {r.direction === "CREDIT" && r.expiresAt && (r.remainingCoins || 0) > 0 && (
                    <p className="text-[11px] text-orange-600">
                      {r.remainingCoins} left · expires {formatDate(r.expiresAt)}
                    </p>
                  )}
                </div>
                <div className="text-right flex-shrink-0">
                  <p className={`text-sm font-bold ${r.direction === "CREDIT" ? "text-green-600" : "text-red-600"}`}>
                    {r.direction === "CREDIT" ? "+" : "-"}
                    {r.coins}
                  </p>
                  <p className="text-[11px] text-neutral-400">Bal {r.balanceAfter}</p>
                </div>
              </div>
            ))
          )}
        </div>

        {page < pages && !loading && (
          <button
            onClick={loadMore}
            disabled={loadingMore}
            className="w-full mt-3 py-2.5 text-sm font-semibold text-[#9048A5] bg-white rounded-xl border border-neutral-200">
            {loadingMore ? "Loading…" : "Load more"}
          </button>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-neutral-50 py-2 text-center">
      <p className="text-sm font-bold text-neutral-900">{value.toLocaleString("en-IN")}</p>
      <p className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wide">{label}</p>
    </div>
  );
}
