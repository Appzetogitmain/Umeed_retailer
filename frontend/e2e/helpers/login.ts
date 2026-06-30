import { Page, expect } from '@playwright/test';
import { DEV_OTP } from './api';

type Role = 'customer' | 'seller' | 'delivery' | 'admin';

const LOGIN_URL: Record<Role, string> = {
  customer: '/login',
  seller: '/seller/login',
  delivery: '/delivery/login',
  admin: '/admin/login',
};

// Playwright matches RegExp patterns against the FULL url (incl. protocol/host),
// so these must not anchor with `^/` — anchor only at the end instead.
const POST_LOGIN_PATH: Record<Role, RegExp> = {
  customer: /\/(user\/home)?$/,
  seller: /\/seller\/?$/,
  delivery: /\/delivery\/?$/,
  admin: /\/admin\/?$/,
};

const SUBMIT_TEXT: Record<Role, RegExp> = {
  customer: /Proceed to Login/i,
  seller: /Continue/i,
  delivery: /Continue/i,
  admin: /Continue/i,
};

export async function loginAs(page: Page, role: Role, mobile: string) {
  await page.goto(LOGIN_URL[role]);

  const phoneInput = page.locator('#phone').or(page.locator('input[type="tel"]')).first();
  await phoneInput.click();
  await phoneInput.fill(mobile);

  await page.getByRole('button', { name: SUBMIT_TEXT[role] }).click();

  const otpBoxes = page.locator('input[type="text"][maxlength="1"]');
  await expect(otpBoxes.first()).toBeVisible({ timeout: 10_000 });
  await otpBoxes.first().click();
  await page.keyboard.type(DEV_OTP, { delay: 50 });

  await page.waitForURL(POST_LOGIN_PATH[role], { timeout: 15_000 });
}
