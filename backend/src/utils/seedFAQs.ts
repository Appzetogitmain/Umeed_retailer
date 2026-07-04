import FAQ from "../models/FAQ";

export async function seedFAQs() {
  try {
    const count = await FAQ.countDocuments();
    if (count > 0) {
      console.log("FAQs already exist. Skipping seed.");
      return;
    }

    const defaultFaqs = [
      // Customer FAQs
      {
        question: 'How do I place an order?',
        answer: 'Browse products, add them to your cart, go to checkout, add address and pay.',
        userType: 'Customer',
        status: 'Active',
        order: 1,
        category: 'General'
      },
      {
        question: 'What are the delivery charges?',
        answer: 'Delivery charges vary based on distance and order value. You can view the delivery fee at checkout before placing the order.',
        userType: 'Customer',
        status: 'Active',
        order: 2,
        category: 'Delivery'
      },
      {
        question: 'Can I cancel my order?',
        answer: 'Yes, you can cancel your order before it is accepted by the store. Once accepted, cancellations may not be allowed.',
        userType: 'Customer',
        status: 'Active',
        order: 3,
        category: 'Orders'
      },
      // Delivery Partner FAQs
      {
        question: 'How do I accept a new order?',
        answer: 'When you receive a new order notification, tap on it to view order details. Click "Accept Order" to confirm.',
        userType: 'Delivery Partner',
        status: 'Active',
        order: 1,
        category: 'General'
      },
      {
        question: 'What should I do if I cannot deliver an order?',
        answer: 'Contact the customer first. If unable to reach them, mark the order as "Unable to Deliver" and contact support.',
        userType: 'Delivery Partner',
        status: 'Active',
        order: 2,
        category: 'Delivery'
      },
      {
        question: 'How are my earnings calculated?',
        answer: 'You earn ₹25 per successful delivery. Additional bonuses may apply for special orders or peak hours.',
        userType: 'Delivery Partner',
        status: 'Active',
        order: 3,
        category: 'Earnings'
      },
      {
        question: 'How do I update my profile information?',
        answer: 'Go to Menu > Profile and tap "Edit Profile" to update your personal details, vehicle information, etc.',
        userType: 'Delivery Partner',
        status: 'Active',
        order: 4,
        category: 'Account'
      }
    ];

    await FAQ.insertMany(defaultFaqs);
    console.log("Default FAQs seeded successfully.");
  } catch (error) {
    console.error("Error seeding FAQs:", error);
  }
}
