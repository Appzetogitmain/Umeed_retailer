import { Page, expect } from '@playwright/test';

export type SweepRoute = { path: string; expect?: RegExp | string };

/**
 * Navigates to a route and asserts the SPA actually rendered something
 * (catches the "blank page due to a synchronous JS crash" class of bug)
 * and that no uncaught page error fired during render.
 */
export async function sweepRoute(page: Page, route: SweepRoute) {
  const pageErrors: string[] = [];
  const onError = (err: Error) => pageErrors.push(err.message);
  page.on('pageerror', onError);

  try {
    const response = await page.goto(route.path, { waitUntil: 'load' });
    expect(response?.status(), `HTTP status for ${route.path}`).toBeLessThan(500);

    const root = page.locator('#root');
    await expect(root, `#root should render content for ${route.path}`).not.toBeEmpty({ timeout: 10_000 });

    const bodyText = await page.locator('body').innerText();
    expect(bodyText.trim().length, `body text should not be empty for ${route.path}`).toBeGreaterThan(0);

    if (route.expect) {
      await expect(page.getByText(route.expect).first()).toBeVisible({ timeout: 10_000 });
    }
  } finally {
    page.off('pageerror', onError);
  }

  expect(pageErrors, `no uncaught page errors on ${route.path}`).toEqual([]);
}

export async function sweepRoutes(page: Page, routes: SweepRoute[]) {
  for (const route of routes) {
    await sweepRoute(page, route);
  }
}
