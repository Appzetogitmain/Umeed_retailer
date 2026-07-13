import mongoose from "mongoose";
import dotenv from "dotenv";
import Product from "../src/models/Product";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

const generateShortId = (prefix: string) => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = `${prefix}-`;
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

const runMigration = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI as string);
    console.log("Connected to database. Starting migration...");

    const products = await Product.find({});
    let updatedCount = 0;

    for (const product of products) {
      let needsUpdate = false;

      // Assign productId if missing
      if (!product.productId) {
        product.productId = generateShortId('PRD');
        needsUpdate = true;
      }

      // Assign variationId if missing
      if (product.variations && product.variations.length > 0) {
        for (const variation of product.variations) {
          if (!variation.variationId) {
            variation.variationId = generateShortId('VAR');
            needsUpdate = true;
          }
        }
      }

      if (needsUpdate) {
        await product.save({ validateBeforeSave: false }); // Skip validation just in case other fields are invalid
        updatedCount++;
      }
    }

    console.log(`Migration completed successfully! Updated ${updatedCount} products.`);
  } catch (error) {
    console.error("Migration failed:", error);
  } finally {
    await mongoose.disconnect();
    console.log("Disconnected from database.");
  }
};

runMigration();
