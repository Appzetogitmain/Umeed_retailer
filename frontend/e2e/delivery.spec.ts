import { test } from '@playwright/test';
import { sweepRoute, SweepRoute } from './helpers/sweep';

test.use({ storageState: 'e2e/.auth/delivery.json' });

const routes: SweepRoute[] = [
  { path: '/delivery' },
  { path: '/delivery/orders' },
  { path: '/delivery/orders/pending' },
  { path: '/delivery/orders/all' },
  { path: '/delivery/orders/return' },
  { path: '/delivery/notifications' },
  { path: '/delivery/menu' },
  { path: '/delivery/profile' },
  { path: '/delivery/wallet' },
  { path: '/delivery/settings' },
  { path: '/delivery/support' },
  { path: '/delivery/faq' },
  { path: '/delivery/about' },
  { path: '/delivery/sellers-in-range' },
];

test.describe('Delivery module — page sweep', () => {
  for (const route of routes) {
    test(`renders ${route.path}`, async ({ page }) => {
      await sweepRoute(page, route);
    });
  }
});
