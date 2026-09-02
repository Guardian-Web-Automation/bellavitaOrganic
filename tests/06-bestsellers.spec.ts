import { test, expect } from '../fixtures/pages';

/**
 * Sheet "06 Bestsellers Page" — Smoke + High priority cases (Test Type = Both).
 *
 * DESKTOP suite. /collections/bestsellers is a standard collection page. Cases
 * keyed by manual Test Case ID; the sheet reaches the page via the hamburger
 * menu, but the destination is the same collection we open directly.
 *
 * NOTE: BV_BEST_POS_010 (add-to-cart) reads the cart via /cart.js, which the
 * store's Cloudflare rate-limit rule challenges (HTTP 429) under automation.
 * That case is authored but expected to be run from CI / a fresh IP — see the
 * "Anti-bot / Cloudflare" section of README.md.
 */
test.describe('06 Bestsellers — Smoke', () => {
  test.describe.configure({ timeout: 120_000 });

  test('BV_BEST_POS_001 — page loads with breadcrumb, heading, controls and grid', async ({
    collectionPage,
    page,
  }) => {
    await collectionPage.openByHandle('bestsellers');

    expect((await collectionPage.headingText()).toLowerCase()).toContain('bestseller');
    await expect
      .poll(() => collectionPage.productCardCount(), { timeout: 15_000 })
      .toBeGreaterThan(0);

    await expect(page.getByText(/^home$/i).filter({ visible: true }).first()).toBeVisible();
    await expect(page.getByText(/filter/i).filter({ visible: true }).first()).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText(/sort/i).filter({ visible: true }).first()).toBeVisible();
  });

  test('BV_BEST_POS_003 — the collection is genuinely filtered to bestsellers', async ({
    collectionPage,
    page,
  }) => {
    await collectionPage.openByHandle('bestsellers');
    const total = await (async () => {
      await expect
        .poll(() => collectionPage.productCardCount(), { timeout: 15_000 })
        .toBeGreaterThan(0);
      return collectionPage.productCardCount();
    })();

    // Every card carries a badge/ribbon (the collection is tagged, not the raw
    // catalogue).
    const badged = await page.locator('#product-grid .card-wrapper:has(.card__badge)').count();
    expect(badged).toBe(total);

    // A strong majority explicitly carry the "Bestseller" ribbon text. (A few
    // badges are image-based or other promo types, so this asserts the majority
    // rather than every single card.)
    const bestsellerTagged = await page
      .locator('#product-grid .card-wrapper', { hasText: /best ?seller/i })
      .count();
    expect(bestsellerTagged).toBeGreaterThanOrEqual(Math.ceil(total * 0.6));
  });

  test('BV_BEST_POS_009 — first card image opens its matching PDP', async ({
    collectionPage,
    productPage,
    page,
  }) => {
    await collectionPage.openByHandle('bestsellers');
    await expect
      .poll(() => collectionPage.productCardCount(), { timeout: 15_000 })
      .toBeGreaterThan(0);

    const handle = await collectionPage.productCardHandle(0);
    expect(handle).not.toBe('');

    await collectionPage.clickProductCard(0);

    // Identity check: the card image opens the SAME product's PDP with a real
    // title and a shown price. Exact card↔PDP price parity is not asserted (this
    // store shows MRP / sale / "From ₹…" prices on cards that legitimately differ
    // from the PDP default variant).
    await expect(page).toHaveURL(new RegExp(handle));
    expect((await productPage.titleText()).length).toBeGreaterThan(0);
    expect((await productPage.priceText()).replace(/\D/g, '').length).toBeGreaterThan(0);
  });

  test('BV_BEST_POS_010 — Add To Cart on the first card populates the cart at qty 1', async ({
    homePage,
    collectionPage,
    cartDrawer,
  }) => {
    // NOTE: This case reads the cart via /cart.js, which the store's Cloudflare
    // rate-limit rule challenges (HTTP 429, invisible JS managed challenge —
    // unsolvable by 2Captcha). It passes from CI / a fresh IP; see README
    // "Anti-bot / Cloudflare". Logic mirrors the verified Home POS_031.
    await homePage.open();
    await cartDrawer.clear();

    await collectionPage.openByHandle('bestsellers');
    await expect
      .poll(() => collectionPage.productCardCount(), { timeout: 15_000 })
      .toBeGreaterThan(0);
    const handle = await collectionPage.productCardHandle(0);

    await collectionPage.addToCartByCardIndex(0);

    await expect.poll(() => cartDrawer.itemCount(), { timeout: 15_000 }).toBe(1);
    expect(await cartDrawer.firstLineItemQuantity()).toBe('1');
    expect(await cartDrawer.firstLineItemHandle()).toBe(handle);
    expect(await cartDrawer.cartTotalCents()).toBeGreaterThan(0);
  });
});
