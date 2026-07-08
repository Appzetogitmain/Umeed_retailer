const mongoose = require('mongoose');
require('dotenv').config();

async function main() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const Product = mongoose.model('Product', new mongoose.Schema({}, { strict: false }));
    const products = await Product.find({
      productName: { $regex: /^O/i }
    });
    
    console.log(`Found ${products.length} matching products:`);
    products.forEach(p => {
      console.log(`- ${p.productName} (ID: ${p._id}) - Image: ${p.mainImage}`);
    });
  } catch(e) {
    console.error(e);
  } finally {
    mongoose.disconnect();
  }
}
main();
