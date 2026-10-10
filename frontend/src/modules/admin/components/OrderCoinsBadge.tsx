/**
 * Loyalty coins on an order, as stored by the server:
 *  - coins the customer earns on it (pending until delivery, then credited)
 *  - coins the customer redeemed on it and their ₹ value
 */

export interface OrderCoinFields {
  loyaltyCoinsToEarn?: number;
  loyaltyCoinsEarned?: number;
  loyaltyEarnStatus?: "None" | "Pending" | "Credited" | "Forfeited";
  loyaltyCoinsRedeemed?: number;
  loyaltyDiscount?: number;
  loyaltyRedeemStatus?: "None" | "Redeemed" | "Released" | "Forfeited";
}

export const earnText = (o: OrderCoinFields) => {
  const toEarn = o.loyaltyCoinsToEarn || 0;
  switch (o.loyaltyEarnStatus) {
    case "Credited":
      return { label: `+${o.loyaltyCoinsEarned || toEarn} earned`, detail: "Credited to wallet", tone: "bg-green-50 text-green-700" };
    case "Pending":
      return { label: `+${toEarn} to earn`, detail: "Credited on delivery", tone: "bg-yellow-50 text-yellow-800" };
    case "Forfeited":
      return toEarn > 0 ? { label: `${toEarn} not earned`, detail: "Order not delivered", tone: "bg-neutral-100 text-neutral-500" } : null;
    default:
      return null;
  }
};

export const usedText = (o: OrderCoinFields) => {
  const used = o.loyaltyCoinsRedeemed || 0;
  if (used <= 0) return null;
  const value = `₹${Number(o.loyaltyDiscount || 0).toFixed(2)}`;
  switch (o.loyaltyRedeemStatus) {
    case "Released":
      return { label: `${used} used (returned)`, detail: `${value} · payment not completed, coins restored`, tone: "bg-blue-50 text-blue-700" };
    case "Forfeited":
      return { label: `−${used} used`, detail: `${value} · order cancelled, non-refundable`, tone: "bg-red-50 text-red-700" };
    default:
      return { label: `−${used} used`, detail: `${value} discount`, tone: "bg-red-50 text-red-700" };
  }
};

/** Compact badges for order list tables */
export default function OrderCoinsBadge({ order }: { order: OrderCoinFields }) {
  const earn = earnText(order);
  const used = usedText(order);
  if (!earn && !used) return null;
  return (
    <div className="flex flex-col items-start gap-1 mt-1">
      {used && (
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium whitespace-nowrap ${used.tone}`} title={used.detail}>
          🪙 {used.label}
        </span>
      )}
      {earn && (
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium whitespace-nowrap ${earn.tone}`} title={earn.detail}>
          🪙 {earn.label}
        </span>
      )}
    </div>
  );
}
