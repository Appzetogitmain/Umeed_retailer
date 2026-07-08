const Razorpay = require('razorpay'); 
const rzp = new Razorpay({ key_id: 'rzp_test_S2tOuYBZiOuLb4', key_secret: 'tiR3NbQKSBa5mrdKyZbsnh7x' }); 
rzp.orders.create({ amount: 100, currency: 'INR', receipt: 'receipt#1' })
  .then(console.log)
  .catch((err) => console.error(JSON.stringify(err, null, 2)));
