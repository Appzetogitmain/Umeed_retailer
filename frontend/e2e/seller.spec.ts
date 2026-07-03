import { test } from '@playwright/test';
import { sweepRoute, SweepRoute } from './helpers/sweep';

test.use({ storageState: 'e2e/.auth/seller.json' });

const routes: SweepRoute[] = [
  { path: '/seller' },
  { path: '/seller/orders' },
  { path: '/seller/category' },
  { path: '/seller/subcategory' },
  { path: '/seller/product/add' },
  { path: '/seller/product/taxes' },
  { path: '/seller/product/list' },
  { path: '/seller/product/stock' },
  { path: '/seller/return' },
  { path: '/seller/return-order' },
  { path: '/seller/wallet' },
  { path: '/seller/reports/sales' },
  { path: '/seller/account-settings' },
];

test.describe('Seller module — page sweep', () => {
  for (const route of routes) {
    test(`renders ${route.path}`, async ({ page }) => {
      await sweepRoute(page, route);
    });
  }
});

test.describe('Seller module — flows', () => {
  test('sidebar navigation reaches Orders', async ({ page }) => {
    await page.goto('/seller');
    await page.locator('header').getByRole('button', { name: /^Orders$/i }).click();
    await page.waitForURL(/\/seller\/orders\/?$/);
  });
});
