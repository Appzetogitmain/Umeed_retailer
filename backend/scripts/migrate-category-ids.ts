import mongoose from "mongoose";
import dotenv from "dotenv";
import Category from "../src/models/Category";
import SubCategory from "../src/models/SubCategory";
import HeaderCategory from "../src/models/HeaderCategory";

// Load environment variables
dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/umeed_retailer";

async function migrate() {
  try {
    console.log("Connecting to database:", MONGODB_URI);
    await mongoose.connect(MONGODB_URI);
    console.log("Database connected.");

    // Migrate Categories
    console.log("Migrating Categories...");
    const categories = await Category.find({ categoryId: { $exists: false } });
    console.log(`Found ${categories.length} categories without categoryId.`);
    for (const cat of categories) {
      await cat.save(); // pre-save hook will generate categoryId
    }
    console.log("Categories migrated successfully.");

    // Migrate SubCategories
    console.log("Migrating SubCategories...");
    const subCategories = await SubCategory.find({ subCategoryId: { $exists: false } });
    console.log(`Found ${subCategories.length} subcategories without subCategoryId.`);
    for (const subCat of subCategories) {
      await subCat.save(); // pre-save hook will generate subCategoryId
    }
    console.log("SubCategories migrated successfully.");

    // Migrate HeaderCategories
    console.log("Migrating HeaderCategories...");
    const headerCategories = await HeaderCategory.find({ headerCategoryId: { $exists: false } });
    console.log(`Found ${headerCategories.length} header categories without headerCategoryId.`);
    for (const headerCat of headerCategories) {
      await headerCat.save(); // pre-save hook will generate headerCategoryId
    }
    console.log("HeaderCategories migrated successfully.");

    console.log("Migration completed successfully.");
  } catch (error) {
    console.error("Migration failed:", error);
  } finally {
    await mongoose.disconnect();
    console.log("Database disconnected.");
  }
}

migrate();
