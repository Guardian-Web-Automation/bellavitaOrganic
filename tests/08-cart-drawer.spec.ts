import { test, expect } from '../fixtures/pages';

/**
 * Sheet "08 Cart Drawer" — Smoke + High priority cases (Test Type = Both).
 *
 * DESKTOP suite. The cart drawer exists on desktop, so these run under the
 * chromium project. Cases are keyed by manual Test Case ID. The cart is emptied
 * before cases that need a known starting state (via /cart/clear.js). Login is
 * out of scope (guest-only); no cart case here requires it.
 */
test.describe('08 Cart Drawer — Smoke', () => {
  // The storefront aggressively rate-limits sustained automation, so under load a
  // single navigation can take ~45s. Give cart tests extra headroom so they
  // complete (slowly) under throttle rather than tripping the 60s test timeout.
  test.describe.configure({ timeout: 150_000 });

  test('BV_CART_POS_001 — cart icon opens the drawer with title, close and prepaid strip', async ({
    homePage,
    headerComponent,
    cartDrawer,
  }) => {
    await homePage.open();
    await headerComponent.openCart();

    expect(await cartDrawer.isOpen()).toBeTruthy();
    expect(await cartDrawer.hasCartTitle()).toBeTruthy();
    expect(await cartDrawer.hasCloseControl()).toBeTruthy();
    expect(await cartDrawer.hasPrepaidStrip()).toBeTruthy();
  });

  test('BV_CART_POS_002 — close X dismisses the drawer', async ({
    homePage,
    headerComponent,
    cartDrawer,
  }) => {
    await homePage.open();
    await headerComponent.openCart();
    expect(await cartDrawer.isDrawerOpen()).toBeTruthy();

    await cartDrawer.close();

    // The drawer dismisses fully (no leftover open drawer / overlay).
    await expect.poll(() => cartDrawer.isDrawerOpen(), { timeout: 8_000 }).toBeFalsy();
  });

  test('BV_CART_POS_009 — empty cart shows the empty message and three collection buttons', async ({
    homePage,
    cartDrawer,
  }) => {
    await homePage.open();
    await cartDrawer.clear();
    await cartDrawer.open();

    // The drawer body renders the empty state after opening; poll for it.
    await expect.poll(() => cartDrawer.isEmptyMessageShown(), { timeout: 10_000 }).toBeTruthy();
    for (const label of ['Bestsellers', 'New Arrivals', 'All Perfumes']) {
      expect(await cartDrawer.hasEmptyStateButton(label), `${label} button should be present`).toBeTruthy();
    }
  });

  test('BV_CART_POS_011 — BESTSELLERS button in empty cart opens the collection', async ({
    homePage,
    cartDrawer,
    collectionPage,
    page,
  }) => {
    await homePage.open();
    await cartDrawer.clear();
    await cartDrawer.open();
    await expect.poll(() => cartDrawer.isEmptyMessageShown(), { timeout: 10_000 }).toBeTruthy();

    await cartDrawer.clickEmptyStateButton('Bestsellers');

    // The drawer closes (navigation) and the Bestsellers collection opens.
    await expect(page).toHaveURL(/\/collections\/bestsellers/);
    await expect
      .poll(() => collectionPage.productCardCount(), { timeout: 15_000 })
      .toBeGreaterThan(0);
  });

  test('BV_CART_POS_019 — add-to-cart on an empty-cart upsell populates the cart', async ({
    homePage,
    cartDrawer,
  }) => {
    const handle = 'bright-wonder';
    await homePage.open();
    await cartDrawer.clear();
    await cartDrawer.open();
    await expect.poll(() => cartDrawer.isEmptyMessageShown(), { timeout: 10_000 }).toBeTruthy();

    test.skip(
      !(await cartDrawer.hasUpsellCard(handle)),
      'Bright Wonder upsell card is not present in the empty cart drawer'
    );

    await cartDrawer.addUpsellToCart(handle);

    // The cart switches from empty to populated with one item.
    await expect.poll(() => cartDrawer.itemCount(), { timeout: 15_000 }).toBe(1);
    expect(await cartDrawer.isEmptyMessageShown()).toBeFalsy();
    expect(await cartDrawer.cartTotalCents()).toBeGreaterThan(0);
  });

  test('BV_CART_POS_029 — tapping a line-item thumbnail opens its PDP', async ({
    homePage,
    cartDrawer,
    productPage,
    page,
  }) => {
    await homePage.open();
    await cartDrawer.clear();
    await cartDrawer.addToCartByHandle('farahat');
    await cartDrawer.open();
    await expect.poll(() => cartDrawer.itemCount(), { timeout: 15_000 }).toBe(1);

    const handle = await cartDrawer.firstLineItemHandle();
    expect(handle).not.toBe('');
    await cartDrawer.clickFirstLineItemThumbnail();

    // The drawer closes (navigation) and that product's PDP opens.
    await expect(page).toHaveURL(new RegExp(handle));
    expect((await productPage.titleText()).length).toBeGreaterThan(0);
  });

  test('BV_CART_POS_031 — remove control removes a line and reduces the total', async ({
    homePage,
    cartDrawer,
  }) => {
    await homePage.open();
    await cartDrawer.clear();
    await cartDrawer.addToCartByHandle('farahat');
    await cartDrawer.addToCartByHandle('beast-mode-collection-for-men');
    await cartDrawer.open();
    await expect.poll(() => cartDrawer.itemCount(), { timeout: 15_000 }).toBe(2);
    const totalBefore = await cartDrawer.cartTotalCents();

    // NOTE: this theme's mini-cart has no dedicated remove control — removal is
    // driven through the line quantity to 0 (the framework does this via the
    // cart AJAX API deterministically). Asserts the line is gone and the total
    // drops.
    await cartDrawer.removeFirstLineItem();

    await expect.poll(() => cartDrawer.itemCount(), { timeout: 15_000 }).toBe(1);
    expect(await cartDrawer.cartTotalCents()).toBeLessThan(totalBefore);
  });

  test('BV_CART_POS_035 — plus stepper increments quantity and recalculates the total', async ({
    homePage,
    cartDrawer,
  }) => {
    await homePage.open();
    await cartDrawer.clear();
    await cartDrawer.addToCartByHandle('farahat');
    await cartDrawer.open();
    await expect.poll(() => cartDrawer.itemCount(), { timeout: 15_000 }).toBe(1);
    const totalAtQty1 = await cartDrawer.cartTotalCents();

    await cartDrawer.increaseFirstLineItemQuantity();

    // Quantity becomes 2 and the total is exactly twice the single-unit total.
    await expect.poll(() => cartDrawer.firstLineItemQuantity(), { timeout: 15_000 }).toBe('2');
    expect(await cartDrawer.cartTotalCents()).toBe(totalAtQty1 * 2);
  });

  test('BV_CART_POS_060 — filled-cart upsell add increases the total', async ({
    homePage,
    cartDrawer,
  }) => {
    const upsell = 'bright-wonder';
    await homePage.open();
    await cartDrawer.clear();
    await cartDrawer.addToCartByHandle('farahat');
    await cartDrawer.open();
    await expect.poll(() => cartDrawer.itemCount(), { timeout: 15_000 }).toBe(1);
    const totalBefore = await cartDrawer.cartTotalCents();
    const countBefore = await cartDrawer.itemCount();

    test.skip(
      !(await cartDrawer.hasUpsellCard(upsell)),
      'Bright Wonder upsell card is not present in the filled cart drawer'
    );
    await cartDrawer.addUpsellToCart(upsell);

    await expect.poll(() => cartDrawer.itemCount(), { timeout: 15_000 }).toBeGreaterThan(countBefore);
    expect(await cartDrawer.cartTotalCents()).toBeGreaterThan(totalBefore);
  });

  test('BV_CART_POS_068 — CHECKOUT button navigates toward checkout', async ({
    homePage,
    cartDrawer,
    page,
  }) => {
    await homePage.open();
    await cartDrawer.clear();
    await cartDrawer.addToCartByHandle('farahat');
    await cartDrawer.open();
    await expect.poll(() => cartDrawer.itemCount(), { timeout: 15_000 }).toBe(1);

    await cartDrawer.clickCheckout();

    // Navigates to the checkout flow (may pass through a login/kwikpass gate as a
    // guest, so match the checkout path family rather than a final summary).
    await expect(page).toHaveURL(/\/checkout|\/checkouts\//, { timeout: 30_000 });
  });

  test('BV_CART_EDG_072 — cart persists across a page reload', async ({
    homePage,
    cartDrawer,
    page,
  }) => {
    await homePage.open();
    await cartDrawer.clear();
    await cartDrawer.addToCartByHandle('farahat');
    await cartDrawer.addToCartByHandle('beast-mode-collection-for-men');
    await expect.poll(() => cartDrawer.itemCount(), { timeout: 15_000 }).toBe(2);
    const totalBefore = await cartDrawer.cartTotalCents();

    await page.reload({ waitUntil: 'domcontentloaded' });

    // Both items and the total are preserved after reload.
    expect(await cartDrawer.itemCount()).toBe(2);
    expect(await cartDrawer.cartTotalCents()).toBe(totalBefore);
  });

  // BV_CART_POS_044 / 045 / 066 (the "Birthday Sale buy 2 for Rs.799" offer
  // pricing) are intentionally NOT automated: that promotional offer is not
  // active on the current store (no birthday banner anywhere on home/menu, and
  // the named products/prices in the sheet no longer match live catalog), so the
  // Rs.799 offer total cannot be exercised. Recorded for traceability; re-enable
  // if the birthday offer returns.
});
