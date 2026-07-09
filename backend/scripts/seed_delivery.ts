import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import Delivery from '../src/models/Delivery';
import Order from '../src/models/Order';
import Return from '../src/models/Return';
import Notification from '../src/models/Notification';
import Otp from '../src/models/Otp';
import bcrypt from 'bcrypt';

dotenv.config({ path: path.join(__dirname, '../.env') });

async function seed() {
  console.log("Connecting to:", process.env.MONGODB_URI);
  await mongoose.connect(process.env.MONGODB_URI as string);
  console.log('Connected to DB');

  // 1. Delivery Boy
  let delivery = await Delivery.findOne({ mobile: '9111966732' });
  if (!delivery) {
    delivery = new Delivery({
      name: 'Demo Partner',
      mobile: '9111966732',
      email: 'demo@partner.com',
      password: '123456',
      status: 'Active',
      isOnline: true,
      balance: 440.00,
      cashCollected: 0,
      pendingAdminPayout: 0
    });
  } else {
    delivery.name = 'Demo Partner';
    delivery.password = '123456'; 
    delivery.status = 'Active';
    delivery.isOnline = true;
  }
  await delivery.save();
  console.log('Delivery partner seeded:', delivery._id);

  // update/create OTP for login
  await Otp.findOneAndUpdate(
    { mobile: '9111966732', userType: 'Delivery' },
    { otp: '1234', expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), isVerified: true },
    { upsert: true, new: true }
  );

  // 2. Clear old Notifications
  await Notification.deleteMany({ recipientType: 'Delivery', recipientId: delivery._id });
  console.log('Old notifications deleted.');

  // 3. Add 4 new Notifications
  const notifications = [
    {
      recipientType: 'Delivery',
      recipientId: delivery._id,
      title: 'Welcome!',
      message: 'Welcome to the Delivery Partner program. Have a great day!',
      type: 'Info',
      isRead: false
    },
    {
      recipientType: 'Delivery',
      recipientId: delivery._id,
      title: 'New Area Assigned',
      message: 'You have been assigned a new delivery zone. Check your map.',
      type: 'System',
      isRead: false
    },
    {
      recipientType: 'Delivery',
      recipientId: delivery._id,
      title: 'Bonus Received',
      message: 'You have received a performance bonus of ₹100.',
      type: 'Success',
      isRead: false
    },
    {
      recipientType: 'Delivery',
      recipientId: delivery._id,
      title: 'Important Update',
      message: 'Please update your vehicle documents before the end of the month.',
      type: 'Warning',
      isRead: false
    }
  ];
  await Notification.insertMany(notifications);
  console.log('New notifications added.');

  // 4. Assign Orders
  const existingOrders = await Order.find().limit(20);
  console.log(`Found ${existingOrders.length} orders in DB`);

  let count = 0;
  for (const order of existingOrders) {
    if (count < 5) {
      order.deliveryBoy = delivery._id;
      order.deliveryBoyStatus = 'Assigned';
      order.status = 'Pending';
      order.assignedAt = new Date();
    } else if (count < 10) {
      order.deliveryBoy = delivery._id;
      order.deliveryBoyStatus = 'Delivered';
      order.status = 'Delivered';
      order.assignedAt = new Date(Date.now() - 24 * 60 * 60 * 1000);
      order.deliveredAt = new Date();
    } else {
      break;
    }
    await order.save();
    count++;
  }
  console.log(`Assigned ${Math.min(count, 10)} orders to delivery boy.`);

  // 5. Assign Return Orders
  const existingReturns = await Return.find().limit(10);
  console.log(`Found ${existingReturns.length} return orders in DB`);
  
  count = 0;
  for (const ret of existingReturns) {
    if (count < 3) {
      ret.deliveryBoy = delivery._id;
      ret.deliveryBoyStatus = 'Pending';
      ret.pickupScheduled = new Date();
      await ret.save();
      count++;
    } else {
      break;
    }
  }
  
  // If no return orders, create mock ones based on existing orders
  if (count === 0 && existingOrders.length > 0) {
     for (let i = 0; i < Math.min(3, existingOrders.length); i++) {
        const order = existingOrders[i];
        if (order.items && order.items.length > 0) {
            const newReturn = new Return({
                order: order._id,
                orderItem: order.items[0],
                customer: order.customer,
                reason: "Defective product",
                status: "Pending",
                sellerApprovalStatus: "Pending",
                adminApprovalStatus: "Pending",
                refundMethod: "Bank",
                quantity: 1,
                deliveryBoy: delivery._id,
                deliveryBoyStatus: "Pending",
                pickupScheduled: new Date()
            });
            await newReturn.save();
            count++;
        }
     }
  }
  
  console.log(`Assigned/Created ${count} return orders to delivery boy.`);

  await mongoose.disconnect();
}

seed().catch(err => {
  console.error(err);
  mongoose.disconnect();
});
