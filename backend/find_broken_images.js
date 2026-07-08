const mongoose = require('mongoose');
const axios = require('axios');
require('dotenv').config({ path: 'd:/Appzeto/Umeed_retailer/backend/.env' });

const SELLER_MOBILE = '9111966732';

async function checkImage(url) {
  if (!url) return true; // Empty is considered broken/missing
  try {
    const res = await axios.head(url);
    return res.status >= 400;
  } catch (err) {
    return true; // Any error means broken
  }
}

async function main() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected.');

    // We don't have the models imported, so we will use mongoose.connection.db
    const db = mongoose.connection.db;
    
    // Find seller
    const seller = await db.collection('users').findOne({ mobile: SELLER_MOBILE, role: 'Seller' });
    if (!seller) {
      console.log('Seller not found.');
      process.exit(1);
    }
    
    console.log(`Found Seller: ${seller.sellerName} (${seller._id})`);

    // Find products
    const products = await db.collection('products').find({ sellerId: seller._id }).toArray();
    console.log(`Found ${products.length} products for this seller.`);

    const brokenProducts = [];

    for (const product of products) {
      let isBroken = false;
      const brokenUrls = [];

      if (await checkImage(product.mainImageUrl)) {
        isBroken = true;
        brokenUrls.push(product.mainImageUrl || 'EMPTY');
      }

      if (isBroken) {
        brokenProducts.push({
          id: product._id,
          name: product.productName,
          brokenUrls
        });
      }
    }

    console.log(`\n--- Found ${brokenProducts.length} products with broken main images ---`);
    for (const p of brokenProducts) {
      console.log(`- ${p.name} (Broken URL: ${p.brokenUrls.join(', ')})`);
    }

  } catch (err) {
    console.error('Error:', err);
  } finally {
    mongoose.disconnect();
  }
}

main();
