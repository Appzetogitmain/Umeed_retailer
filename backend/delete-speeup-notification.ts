import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Notification from './src/models/Notification';

dotenv.config();

const run = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI as string);
        console.log('Connected to MongoDB');

        const result = await Notification.deleteMany({ title: /speeup/i });
        console.log(`Deleted ${result.deletedCount} 'speeup' notifications.`);
        
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
};

run();
