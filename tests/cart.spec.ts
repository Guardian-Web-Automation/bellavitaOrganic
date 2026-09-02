import { test, expect } from '../fixtures/pages';
import { products } from '../test-data/products';

// The store keys the cart to the browser session, so tests sharing the default
// storageState would mutate one another's cart in parallel. Start each test from
// a fresh, empty session so every cart is isolated (the store is open — no
// password/Cloudflare — so no stored auth is needed).
test.use({ storageState: { cookies: [], origins: [] } });

test.describe('Cart', () => {
  test.beforeEach(async ({ productPage }) => {
    await productPage.openByHandle(products.primary.handle);
    await productPage.addToCart();
  });

  test('added item appears in the cart drawer with correct count and total', async ({ cartDrawer }) => {
    expect(await cartDrawer.isOpen()).toBeTruthy();
    expect(await cartDrawer.lineItemCount()).toBe(1);
    expect(await cartDrawer.itemCount()).toBe(1);
    expect(await cartDrawer.cartTotalCents()).toBeGreaterThan(0);
  });

  test('quantity selector respects the line item stock/order limit', async ({ cartDrawer, page }) => {
    const before = await cartDrawer.firstLineItemQuantity();
    const max = await cartDrawer.firstLineItemQuantityMax();

    await cartDrawer.increaseFirstLineItemQuantity();
    await page.waitForTimeout(1000);

    const after = await cartDrawer.firstLineItemQuantity();
    if (max === null || parseInt(before, 10) < parseInt(max, 10)) {
      expect(parseInt(after, 10)).toBe(parseInt(before, 10) + 1);
    } else {
      expect(parseInt(after, 10)).toBe(parseInt(before, 10));
    }
  });

  test('removing the only item empties the cart', async ({ cartDrawer }) => {
    await cartDrawer.removeFirstLineItem();
    expect(await cartDrawer.lineItemCount()).toBe(0);
    expect(await cartDrawer.itemCount()).toBe(0);
    expect(await cartDrawer.isEmpty()).toBeTruthy();
  });
});
