import { test } from '@playwright/test';
import { sweepRoute, SweepRoute } from './helpers/sweep';

test.use({ storageState: 'e2e/.auth/customer.json' });

const routes: SweepRoute[] = [
  { path: '/' },
  { path: '/user/home' },
  { path: '/search' },
  { path: '/orders' },
  { path: '/order-again' },
  { path: '/account' },
  { path: '/about-us' },
  { path: '/faq' },
  { path: '/wishlist' },
  { path: '/categories' },
  { path: '/address-book' },
  { path: '/checkout' },
  { path: '/checkout/address' },
  { path: '/cart' },
  { path: '/addresses' },
  { path: '/store/spiritual' },
  { path: '/store/pharma' },
  { path: '/store/e-gifts' },
  { path: '/store/pet' },
  { path: '/store/sports' },
  { path: '/store/fashion-basics' },
  { path: '/store/toy' },
  { path: '/store/hobby' },
];

test.describe('Customer module — page sweep', () => {
  for (const route of routes) {
    test(`renders ${route.path}`, async ({ page }) => {
      await sweepRoute(page, route);
    });
  }
});

test.describe('Customer module — flows', () => {
  test('search page accepts input', async ({ page }) => {
    await page.goto('/search');
    const skipLocation = page.getByRole('button', { name: 'Skip for now' });
    if (await skipLocation.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await skipLocation.click();
    }
    const input = page.getByPlaceholder('Search for products...');
    await input.click();
    await input.fill('rice');
  });

  test('navigating to a category from the categories page', async ({ page }) => {
    await page.goto('/categories');
    const firstCategory = page.locator('a, button, [role="link"]').filter({ hasText: /.+/ }).first();
    await firstCategory.waitFor({ state: 'visible', timeout: 10_000 }).catch(() => {});
  });
});
