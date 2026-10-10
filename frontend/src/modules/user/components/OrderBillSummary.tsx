interface OrderBillSummaryProps {
  order: any;
}

const money = (v: number | undefined) =>
  `₹${(Number(v) || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

const sequenceLabel = (n?: number) =>
  n === 1 ? "First order discount" : n === 2 ? "Second order discount" : `Order #${n} discount`;

/**
 * Bill breakdown exactly as stored on the order by the server
 * (subtotal, fees, platform-funded discounts, coins, total, coins earned).
 */
export default function OrderBillSummary({ order }: OrderBillSummaryProps) {
  if (!order) return null;
  const platformFee = order.platformFee ?? order.fees?.platformFee ?? 0;
  const deliveryFee = order.shipping ?? order.fees?.deliveryFee ?? 0;
  const total = order.total ?? order.totalAmount ?? 0;

  const earnLine = (() => {
    const toEarn = order.loyaltyCoinsToEarn || 0;
    switch (order.loyaltyEarnStatus) {
      case "Credited":
        return { text: `${order.loyaltyCoinsEarned} coins credited to your wallet`, tone: "text-green-700 bg-green-50" };
      case "Pending":
        return { text: `You'll earn ${toEarn} coins once this order is delivered`, tone: "text-yellow-800 bg-yellow-50" };
      case "Forfeited":
        return toEarn > 0 ? { text: `${toEarn} coins not earned (order not delivered)`, tone: "text-neutral-600 bg-neutral-50" } : null;
      default:
        return null;
    }
  })();

  return (
    <div className="mt-4 pt-4 border-t border-gray-200 space-y-1.5">
      <h3 className="text-sm font-bold text-gray-900 mb-1">Bill summary</h3>
      <Row label="Items total" value={money(order.subtotal)} />
      {platformFee > 0 && <Row label="Handling charge" value={money(platformFee)} />}
      <Row label="Delivery charge" value={deliveryFee > 0 ? money(deliveryFee) : "FREE"} />
      {(order.orderSequenceDiscount || 0) > 0 && (
        <Row
          label={`${sequenceLabel(order.orderSequenceNumber)} (${order.orderSequencePercent}%)`}
          value={`-${money(order.orderSequenceDiscount)}`}
          green
        />
      )}
      {(order.couponDiscount || 0) > 0 && (
        <Row label={`Coupon${order.couponCode ? ` (${order.couponCode})` : ""}`} value={`-${money(order.couponDiscount)}`} green />
      )}
      {(order.loyaltyDiscount || 0) > 0 && (
        <Row
          label={`Speedoo coins (${order.loyaltyCoinsRedeemed} used${order.loyaltyRedeemStatus === "Released" ? ", returned to wallet" : ""})`}
          value={`-${money(order.loyaltyDiscount)}`}
          green
        />
      )}
      <div className="flex justify-between pt-1.5 border-t border-gray-100">
        <span className="text-sm font-bold text-gray-900">Total paid</span>
        <span className="text-sm font-bold text-gray-900">{money(total)}</span>
      </div>
      {earnLine && <p className={`text-xs font-semibold rounded-lg px-2.5 py-1.5 ${earnLine.tone}`}>{earnLine.text}</p>}
    </div>
  );
}

function Row({ label, value, green }: { label: string; value: string; green?: boolean }) {
  return (
    <div className="flex justify-between text-xs">
      <span className="text-gray-600">{label}</span>
      <span className={green ? "font-medium text-green-700" : "font-medium text-gray-900"}>{value}</span>
    </div>
  );
}
