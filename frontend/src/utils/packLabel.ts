// "Default" is the placeholder variant name given to products created without
// real variations (e.g. bulk upload), so it is never shown to customers.
const isPlaceholder = (value: unknown): boolean =>
  value === undefined || value === null || String(value).trim() === '' || /^default$/i.test(String(value).trim());

/**
 * Pack/size label for a product: first variant's value or title, then the
 * product's pack, skipping placeholder names. Returns '' when there is none.
 */
export const getPackLabel = (product: any): string => {
  const variant = product?.variations?.[0];
  const candidates = [variant?.value, variant?.title, product?.pack];
  const label = candidates.find((c) => !isPlaceholder(c));
  return label ? String(label) : '';
};
