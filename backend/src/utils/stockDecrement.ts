import mongoose from "mongoose";
import Product from "../models/Product";

/**
 * Atomically check-and-decrement stock for a product (and its variation, if any),
 * preventing overselling via a $gte guard in the same findOneAndUpdate as the $inc.
 *
 * Extracted from customerOrderController.ts's createOrder item loop so the online
 * checkout flow and POS billing share one oversell-prevention implementation
 * instead of two copies that could drift.
 *
 * Returns the updated product document, or null if there wasn't enough stock.
 */
export const decrementProductStock = async (
  productId: string,
  qty: number,
  variationValue?: string | null,
  session?: mongoose.ClientSession | null
) => {
  let product;

  if (variationValue) {
    product = await Product.findOneAndUpdate(
      {
        _id: productId,
        $or: [
          {
            "variations._id": mongoose.isValidObjectId(variationValue)
              ? variationValue
              : new mongoose.Types.ObjectId(),
          },
          { "variations.value": variationValue },
          { "variations.title": variationValue },
          { "variations.pack": variationValue },
        ],
        "variations.stock": { $gte: qty },
      },
      { $inc: { "variations.$.stock": -qty, stock: -qty } },
      session ? { session, new: true } : { new: true }
    );
  }

  if (!product) {
    // Either no variationValue was given, or it didn't match any variation with enough stock.
    const checkProduct = await Product.findById(productId).session(session || null);

    if (checkProduct && checkProduct.variations && checkProduct.variations.length > 0) {
      const hasVariation = variationValue
        ? checkProduct.variations.some(
            (v: any) =>
              (v._id && v._id.toString() === variationValue) ||
              v.value === variationValue ||
              v.title === variationValue ||
              v.pack === variationValue
          )
        : false;

      if (variationValue && hasVariation) {
        // The variation exists but didn't have enough stock above.
        return null;
      }

      // No variation specified, or it's stale/invalid — fall back to the first variation.
      product = await Product.findOneAndUpdate(
        { _id: productId, "variations.0.stock": { $gte: qty } },
        { $inc: { "variations.0.stock": -qty, stock: -qty } },
        session ? { session, new: true } : { new: true }
      );
    } else {
      // No variations, just decrement top-level stock.
      product = await Product.findOneAndUpdate(
        { _id: productId, stock: { $gte: qty } },
        { $inc: { stock: -qty } },
        session ? { session, new: true } : { new: true }
      );
    }
  }

  return product;
};
