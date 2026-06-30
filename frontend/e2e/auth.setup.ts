import { test as setup } from '@playwright/test';
import { TEST_USERS, ensureSellerRegistered, ensureDeliveryRegistered } from './helpers/api';
import { loginAs } from './helpers/login';

const authDir = 'e2e/.auth';

setup('authenticate as customer', async ({ page }) => {
  await loginAs(page, 'customer', TEST_USERS.customer.mobile);
  await page.context().storageState({ path: `${authDir}/customer.json` });
});

setup('authenticate as seller', async ({ page }) => {
  await ensureSellerRegistered();
  await loginAs(page, 'seller', TEST_USERS.seller.mobile);
  await page.context().storageState({ path: `${authDir}/seller.json` });
});

setup('authenticate as delivery', async ({ page }) => {
  await ensureDeliveryRegistered();
  await loginAs(page, 'delivery', TEST_USERS.delivery.mobile);
  await page.context().storageState({ path: `${authDir}/delivery.json` });
});

setup('authenticate as admin', async ({ page }) => {
  await loginAs(page, 'admin', TEST_USERS.admin.mobile);
  await page.context().storageState({ path: `${authDir}/admin.json` });
});
