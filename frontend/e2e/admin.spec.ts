import { test } from '@playwright/test';
import { sweepRoute, SweepRoute } from './helpers/sweep';

test.use({ storageState: 'e2e/.auth/admin.json' });

const routes: SweepRoute[] = [
  { path: '/admin' },
  { path: '/admin/profile' },
  { path: '/admin/category' },
  { path: '/admin/category/header' },
  { path: '/admin/subcategory' },
  { path: '/admin/subcategory-order' },
  { path: '/admin/brand' },
  { path: '/admin/product/add' },
  { path: '/admin/product/taxes' },
  { path: '/admin/product/list' },
  { path: '/admin/manage-seller/list' },
  { path: '/admin/manage-seller/transaction' },
  { path: '/admin/delivery-boy/manage' },
  { path: '/admin/delivery-boy/fund-transfer' },
  { path: '/admin/delivery-boy/cash-collection' },
  { path: '/admin/manage-location/seller-location' },
  { path: '/admin/wallet' },
  { path: '/admin/coupon' },
  { path: '/admin/return' },
  { path: '/admin/withdrawals' },
  { path: '/admin/notification' },
  { path: '/admin/orders' },
  { path: '/admin/customers' },
  { path: '/admin/collect-cash' },
  { path: '/admin/payment-list' },
  { path: '/admin/sms-gateway' },
  { path: '/admin/system-user' },
  { path: '/admin/customer-app-policy' },
  { path: '/admin/delivery-app-policy' },
  { path: '/admin/billing-settings' },
  { path: '/admin/seller-app-policy' },
  { path: '/admin/users' },
  { path: '/admin/faq' },
  { path: '/admin/home-section' },
  { path: '/admin/bestseller-cards' },
  { path: '/admin/promo-strip' },
  { path: '/admin/lowest-prices' },
  { path: '/admin/shop-by-store' },
  { path: '/admin/banners' },
  { path: '/admin/orders/all' },
  { path: '/admin/orders/pending' },
  { path: '/admin/orders/received' },
  { path: '/admin/orders/processed' },
  { path: '/admin/orders/shipped' },
  { path: '/admin/orders/out-for-delivery' },
  { path: '/admin/orders/delivered' },
  { path: '/admin/orders/cancelled' },
  { path: '/admin/reviews' },
];

test.describe('Admin module — page sweep', () => {
  for (const route of routes) {
    test(`renders ${route.path}`, async ({ page }) => {
      await sweepRoute(page, route);
    });
  }
});
