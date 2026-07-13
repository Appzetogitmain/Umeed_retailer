import mongoose from 'mongoose';
import Product from './src/models/Product';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/umeed_retailer');
  const p = await Product.findOne({productId: 'PRD-SG5128'});
  if (!p) {
    console.log('Product not found');
    process.exit(0);
  }
  
  try {
    p.markModified('variations');
    await p.save();
    console.log('Product saved successfully!');
  } catch (e: any) {
    console.error('Save Error:');
    if (e.errors) {
      Object.keys(e.errors).forEach(key => {
        console.error(`- ${key}: ${e.errors[key].message}`);
      });
    } else {
      console.error(e.message);
    }
  }
  process.exit(0);
}

run();
