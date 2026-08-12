import Tax from "../models/Tax";
import AppSettings from "../models/AppSettings";

/**
 * Resolve the effective unit price for a product/variation.
 * Priority: Variation Discount -> Product Discount -> Variation Price -> Product Price
 * Extracted from customerCartController.ts's calculateItemPrice so online-order,
 * cart, and POS billing all price items identically.
 */
export const resolveItemUnitPrice = (product: any, variationSelector: any): number => {
  let variation = null;
  let variationId = variationSelector;

  // Handle if variationSelector is an object
  if (variationSelector && typeof variationSelector === "object" && variationSelector._id) {
    variationId = variationSelector._id;
  }

  if (variationId && product.variations?.length) {
    variation = product.variations.find(
      (v: any) =>
        (v._id && v._id.toString() === variationId.toString()) ||
        (v.id && v.id === variationId) ||
        v.value === variationId ||
        v.title === variationId ||
        v.pack === variationId
    );
  }

  let finalPrice = variation?.price || product.price || 0;

  if (variation?.discPrice && variation.discPrice > 0) {
    finalPrice = variation.discPrice;
  } else if (product.discPrice && product.discPrice > 0) {
    finalPrice = product.discPrice;
  }

  return finalPrice;
};

/**
 * Compute GST for a line item. No live order-total calculation wires up
 * tax anywhere in the codebase today (order.tax is always 0 online), so this
 * is new logic built on the existing Tax/AppSettings models rather than a
 * duplicate of something that already exists.
 *
 * Priority: product.tax (Tax.percentage) -> AppSettings.gstRate (if gstEnabled) -> 0.
 * Price is treated as tax-exclusive (tax is added on top of unitPrice * qty).
 */
export const calculateItemTax = async (
  product: any,
  unitPrice: number,
  quantity: number
): Promise<{ rate: number; amount: number }> => {
  let rate = 0;

  if (product.tax) {
    const taxDoc = await Tax.findById(product.tax);
    if (taxDoc && taxDoc.status === "Active") {
      rate = taxDoc.percentage || 0;
    }
  }

  if (!rate) {
    const settings = await AppSettings.getSettings();
    if (settings?.gstEnabled && settings.gstRate) {
      rate = settings.gstRate;
    }
  }

  const amount = Math.round(unitPrice * quantity * (rate / 100) * 100) / 100;
  return { rate, amount };
};
