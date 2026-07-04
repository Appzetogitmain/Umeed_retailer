import { test, expect } from '@playwright/test';
import { sweepRoute, SweepRoute } from './helpers/sweep';

const routes: SweepRoute[] = [
  { path: '/login' },
  { path: '/seller/login' },
  { path: '/seller/signup' },
  { path: '/delivery/login' },
  { path: '/delivery/signup' },
  { path: '/admin/login' },
  { path: '/privacy-policy' },
  { path: '/terms-and-conditions' },
  { path: '/seller/privacy-policy' },
  { path: '/seller/terms-and-conditions' },
  { path: '/delivery/privacy-policy' },
  { path: '/delivery/terms-and-conditions' },
];

test.describe('Public/auth pages — page sweep (unauthenticated)', () => {
  for (const route of routes) {
    test(`renders ${route.path}`, async ({ page }) => {
      await sweepRoute(page, route);
    });
  }
});

test.describe('Route guards redirect unauthenticated users to the right login page', () => {
  test('/seller/* redirects to /seller/login', async ({ page }) => {
    await page.goto('/seller');
    await page.waitForURL(/\/seller\/login\/?$/);
  });

  test('/delivery/* redirects to /delivery/login', async ({ page }) => {
    await page.goto('/delivery');
    await page.waitForURL(/\/delivery\/login\/?$/);
  });

  test('/admin/* redirects to /admin/login', async ({ page }) => {
    await page.goto('/admin');
    await page.waitForURL(/\/admin\/login\/?$/);
  });
});

test.describe('Public pages remain reachable for a logged-in seller (PublicRoute guard)', () => {
  test.use({ storageState: 'e2e/.auth/seller.json' });

  test('visiting /seller/login while authenticated redirects away from the login form', async ({ page }) => {
    await page.goto('/seller/login');
    await expect(page).not.toHaveURL(/\/seller\/login\/?$/, { timeout: 10_000 });
  });
});
