const API_BASE = 'http://localhost:5050/api/v1';

export const TEST_USERS = {
  customer: { mobile: '9555500001' },
  seller: {
    mobile: '9555500002',
    sellerName: 'E2E Seller',
    email: 'e2e-seller@example.com',
    storeName: 'E2E Store',
    category: 'E2E Grocery',
    latitude: 12.9716,
    longitude: 77.5946,
  },
  delivery: {
    mobile: '9555500003',
    name: 'E2E Delivery',
    email: 'e2e-delivery@example.com',
    password: 'E2ETest@123',
    address: '123 Test Street',
    city: 'Bengaluru',
  },
  admin: { mobile: '9000000001' },
};

export const DEV_OTP = '9999';

async function post(path: string, body: unknown) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.json();
}

export async function ensureSellerRegistered() {
  const u = TEST_USERS.seller;
  await post('/auth/seller/register', u).catch(() => {});
}

export async function ensureDeliveryRegistered() {
  const u = TEST_USERS.delivery;
  await post('/auth/delivery/register', u).catch(() => {});
}
