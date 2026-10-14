interface LoyaltyPointsBadgeProps {
  points: number;
  size?: 'sm' | 'md';
  className?: string;
}

/**
 * "★ Earn X Points on this item" pill shown on product cards, cart and checkout.
 * Points are the customer-facing name for loyalty coins.
 */
export default function LoyaltyPointsBadge({ points, size = 'md', className = '' }: LoyaltyPointsBadgeProps) {
  if (points <= 0) return null;
  const sizeClasses = size === 'sm' ? 'text-[9px] px-2 py-0.5 gap-0.5' : 'text-xs px-3 py-1 gap-1';
  return (
    <div
      className={`flex w-full items-center justify-center rounded-full bg-[#F3E8FF] text-[#7E22CE] font-semibold text-center leading-tight ${sizeClasses} ${className}`}
    >
      <span aria-hidden="true">★</span>
      <span>Earn {points} Points on this item</span>
    </div>
  );
}
