/**
 * Run this script ON the VPS after deploying to fix all localhost:5000 image URLs
 * in MongoDB to point to the live backend URL.
 *
 * Usage on VPS:
 *   node scripts/fix-image-urls.js
 *
 * Make sure MONGODB_URI and BACKEND_URL are set in your .env before running.
 */

require('dotenv').config();
const mongoose = require('mongoose');

const OLD_URL = 'http://localhost:5000';
const NEW_URL = (process.env.BACKEND_URL || '').replace(/\/$/, '');

if (!NEW_URL || NEW_URL.includes('localhost')) {
  console.error('❌ Set BACKEND_URL in .env to your live URL first (e.g. http://31.97.233.97:5000)');
  process.exit(1);
}

console.log(`🔄 Replacing "${OLD_URL}" → "${NEW_URL}"`);

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('✅ MongoDB connected');

  const collections = ['products', 'categories', 'subcategories', 'sellers', 'users', 'banners'];

  for (const collName of collections) {
    const coll = mongoose.connection.collection(collName);
    const docs = await coll.find({}).toArray();
    let updated = 0;

    for (const doc of docs) {
      const originalJson = JSON.stringify(doc);
      const fixedJson = originalJson.split(OLD_URL).join(NEW_URL);

      if (fixedJson !== originalJson) {
        const fixedDoc = JSON.parse(fixedJson);
        // Remove _id so we can use it as filter
        const { _id, ...rest } = fixedDoc;
        await coll.updateOne({ _id }, { $set: rest });
        updated++;
      }
    }

    if (updated > 0) {
      console.log(`  ✅ ${collName}: fixed ${updated} documents`);
    } else {
      console.log(`  ⏭️  ${collName}: no localhost URLs found`);
    }
  }

  console.log('\n🎉 Done! All image URLs updated.');
  await mongoose.disconnect();
}

run().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
