import mongoose from "mongoose";
import dotenv from "dotenv";
import Order from "../src/models/Order";
import path from "path";

dotenv.config({ path: path.join(__dirname, "../.env") });

async function runMigration() {
  try {
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      console.error("MONGODB_URI not found in env");
      process.exit(1);
    }
    
    await mongoose.connect(mongoUri);
    console.log("Connected to DB");

    const orders = await Order.find({});
    let updatedCount = 0;

    for (const order of orders) {
      if (order.orderNumber && order.orderNumber.length > 13) { // Old long format
        const date = order.createdAt || order.orderDate || new Date();
        const yy = date.getFullYear().toString().slice(2);
        const mm = (date.getMonth() + 1).toString().padStart(2, '0');
        const dd = date.getDate().toString().padStart(2, '0');
        const random = Math.floor(Math.random() * 10000).toString().padStart(4, "0");
        const newOrderNumber = `ORD${yy}${mm}${dd}${random}`;
        
        order.orderNumber = newOrderNumber;
        await order.save({ validateBeforeSave: false }); // Skip other validations if any
        updatedCount++;
      }
    }

    console.log(`Migration completed. Updated ${updatedCount} orders.`);
  } catch (error) {
    console.error("Migration failed:", error);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

runMigration();
