import mongoose from "mongoose";
import Inventory from "../models/Inventory";
import CartItem from "../models/CartItem";
import Wishlist from "../models/Wishlist";
import Review from "../models/Review";
import LowestPricesProduct from "../models/LowestPricesProduct";
import HomeSection from "../models/HomeSection";

/**
 * Remove all records in other collections that reference the given product IDs.
 * Called after products are deleted so stale references don't linger in
 * carts, wishlists, reviews, homepage sections, etc.
 * OrderItem is intentionally left untouched - it snapshots product details
 * at order time, so order history stays intact even after the product is gone.
 */
export const cleanupProductReferences = async (
  productIds: mongoose.Types.ObjectId[] | string[]
): Promise<void> => {
  if (!productIds || productIds.length === 0) return;

  await Promise.all([
    Inventory.deleteMany({ product: { $in: productIds } }),
    CartItem.deleteMany({ product: { $in: productIds } }),
    Review.deleteMany({ product: { $in: productIds } }),
    LowestPricesProduct.deleteMany({ product: { $in: productIds } }),
    Wishlist.updateMany(
      { products: { $in: productIds } },
      { $pull: { products: { $in: productIds } } }
    ),
    HomeSection.updateMany(
      { products: { $in: productIds } },
      { $pull: { products: { $in: productIds } } }
    ),
  ]);
};
