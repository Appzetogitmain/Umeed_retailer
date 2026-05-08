const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

// Load environment from backend .env file
dotenv.config({ path: path.join(__dirname, '../../.env') });

function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in kilometers
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

const connectDB = async () => {
    const uri = process.env.MONGODB_URI;
    console.log('Connecting to database:', uri);
    try {
        await mongoose.connect(uri);
        console.log('MongoDB Connected Successfully\n');
    } catch (error) {
        console.error('Error connecting to database:', error.message);
        process.exit(1);
    }
};

const inspectRider = async () => {
    await connectDB();
    try {
        const db = mongoose.connection;
        const Delivery = db.collection('deliveries');
        const SellerCollection = db.collection('sellers');

        // Find Vishal Patel by mobile
        const mobileNum = "9111966732";
        const rider = await Delivery.findOne({ mobile: mobileNum });

        if (!rider) {
            console.log('❌ Rider Vishal Patel (9111966732) NOT found!');
            return;
        }

        const [riderLng, riderLat] = rider.location?.coordinates || [0, 0];
        console.log(`Rider Vishal Patel Location: Lat=${riderLat}, Lng=${riderLng}\n`);

        console.log('Approved Sellers and their distance from Vishal Patel:');
        console.log('========================================================');
        const sellers = await SellerCollection.find({ status: 'Approved' }).toArray();
        
        sellers.forEach(seller => {
            let lat = null;
            let lng = null;

            if (seller.location && seller.location.coordinates) {
                lng = seller.location.coordinates[0];
                lat = seller.location.coordinates[1];
            } else {
                lat = seller.latitude ? parseFloat(seller.latitude) : null;
                lng = seller.longitude ? parseFloat(seller.longitude) : null;
            }

            if (lat && lng && !isNaN(lat) && !isNaN(lng)) {
                const distance = calculateDistance(riderLat, riderLng, lat, lng);
                const radius = seller.serviceRadiusKm || 10;
                const inRange = distance <= radius;
                
                console.log(`- Store: "${seller.storeName}"`);
                console.log(`  Location: Lat=${lat}, Lng=${lng}`);
                console.log(`  Distance: ${distance.toFixed(2)} km (Service Radius: ${radius} km)`);
                console.log(`  Is Rider in Range? ${inRange ? '✅ YES' : '❌ NO'}`);
            } else {
                console.log(`- Store: "${seller.storeName}" has ⚠️ NO VALID LOCATION DATA!`);
            }
            console.log('--------------------------------------------------------');
        });

    } catch (error) {
        console.error('Error during inspection:', error);
    } finally {
        await mongoose.disconnect();
    }
};

inspectRider();
