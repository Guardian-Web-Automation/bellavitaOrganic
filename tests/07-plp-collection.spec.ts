import { test, expect } from '../fixtures/pages';

/**
 * Sheet "07 PLP Collection Page" — Smoke + High priority cases (Test Type = Both).
 *
 * DESKTOP suite. Uses the custom PLP (shop-all-products as the representative
 * collection): category pills (button.plp-category-pill), a Filter panel
 * (button.plp-filter-btn -> .plp-filter-content) and a Sort panel
 * (button.plp-sort-btn). Cases keyed by manual Test Case ID.
 *
 * NOTE: add-to-cart cases (PLP_062, PLP_069) read the cart via /cart.js, which
 * the store's Cloudflare rate-limit rule challenges (HTTP 429) under automation;
 * they run from CI / a fresh IP — see README "Anti-bot / Cloudflare".
 */
const PLP = 'shop-all-products';

test.describe('07 PLP Collection — Smoke', () => {
  test.describe.configure({ timeout: 120_000 });

  test('BV_PLP_POS_001 — collection page loads with heading, controls, tabs and grid', async ({
    collectionPage,
    page,
  }) => {
    await collectionPage.openByHandle(PLP);
    await expect
      .poll(() => collectionPage.productCardCount(), { timeout: 15_000 })
      .toBeGreaterThan(0);

    expect((await collectionPage.headingText()).length).toBeGreaterThan(0);
    await expect(page.getByText(/^home$/i).filter({ visible: true }).first()).toBeVisible();

    // Filter + Sort controls and the category tab/pill row.
    expect(await collectionPage.hasFilterButton()).toBeTruthy();
    expect(await collectionPage.hasSortButton()).toBeTruthy();
    await expect(page.locator('button.plp-category-pill').first()).toBeVisible();
  });

  test('BV_PLP_POS_009 — Filter opens a panel with title, Reset, close and sections', async ({
    collectionPage,
    page,
  }) => {
    await collectionPage.openByHandle(PLP);
    expect(await collectionPage.hasFilterButton()).toBeTruthy();

    await collectionPage.openFilterPanel();

    const panel = page.locator('.plp-filter-content').first();
    await expect(panel).toBeVisible();
    await expect(panel.getByText(/^\s*filter\s*$/i).first()).toBeVisible();
    await expect(panel.getByText(/reset( filters?)?/i).first()).toBeVisible();
    expect(await panel.locator('[class*="close" i]').count()).toBeGreaterThan(0);

    // The filter sections are listed.
    for (const section of [/price/i, /perfume notes/i, /product type/i, /gender/i]) {
      await expect(panel.getByText(section).first()).toBeVisible();
    }
  });

  // BV_PLP_POS_011 (left-rail section switching refreshes the right pane) and
  // BV_PLP_POS_014 (Reset Filters clears applied options) are intentionally NOT
  // automated: the custom filter widget's section buttons
  // (button.plp-filter-category) do not respond to programmatic click events —
  // the right pane (.plp-filter-values) does not switch and no active-class
  // toggles — so these interactions cannot be driven reliably. The filter panel's
  // structure (title, Reset Filters control, close X, and all sections: Price,
  // Perfume Notes, Product Type, Gender) is verified by BV_PLP_POS_009. Recorded
  // for traceability; would need real user-gesture emulation to automate.

  test('BV_PLP_POS_041 — Sort opens a panel with the 7 ordering options', async ({
    collectionPage,
    page,
  }) => {
    await collectionPage.openByHandle(PLP);
    expect(await collectionPage.hasSortButton()).toBeTruthy();

    await collectionPage.openSortPanel();

    await expect(page.getByText(/^\s*sort\s*(by)?\s*$/i).filter({ visible: true }).first()).toBeVisible({
      timeout: 8_000,
    });

    // Exactly seven ordering options, none missing or duplicated. The radios are
    // custom-styled (the real inputs are visually hidden behind styled labels),
    // so count the inputs themselves rather than "visible" elements.
    await expect
      .poll(() => page.locator('input[type="radio"]').count(), { timeout: 8_000 })
      .toBe(7);

    // A couple of the known ordering options are present.
    await expect(page.getByText(/discount/i).filter({ visible: true }).first()).toBeVisible();
    await expect(page.getByText(/best seller/i).filter({ visible: true }).first()).toBeVisible();
  });

  test('BV_PLP_POS_053 — category tab selects and refreshes the grid', async ({
    collectionPage,
  }) => {
    await collectionPage.openByHandle(PLP);
    await expect
      .poll(() => collectionPage.productCardCount(), { timeout: 15_000 })
      .toBeGreaterThan(0);

    expect(await collectionPage.isCategoryPillActive('All')).toBeTruthy();
    const signature = async () =>
      `${await collectionPage.productCardCount()}::${(await collectionPage.firstProductHandles(200)).join('|')}`;
    const before = await signature();

    await collectionPage.clickCategoryPill('Fragrance');

    await expect
      .poll(() => collectionPage.isCategoryPillActive('Fragrance'), { timeout: 8_000 })
      .toBeTruthy();
    expect(await collectionPage.isCategoryPillActive('All')).toBeFalsy();
    await expect.poll(signature, { timeout: 10_000 }).not.toBe(before);
  });

  test('BV_PLP_POS_062 — Add To Cart on a simple product card opens the drawer at qty 1', async ({
    homePage,
    collectionPage,
    cartDrawer,
  }) => {
    // NOTE: reads the cart via /cart.js, which the store's Cloudflare rate-limit
    // rule challenges (HTTP 429) under automation; runs from CI / a fresh IP —
    // see README "Anti-bot / Cloudflare". Logic mirrors the verified POS_031.
    await homePage.open();
    await cartDrawer.clear();

    await collectionPage.openByHandle(PLP);
    await expect
      .poll(() => collectionPage.productCardCount(), { timeout: 15_000 })
      .toBeGreaterThan(0);
    const handle = await collectionPage.productCardHandle(0);

    await collectionPage.addToCartByCardIndex(0);

    // A simple product adds directly (no variant popup) to the cart drawer.
    await expect.poll(() => cartDrawer.itemCount(), { timeout: 15_000 }).toBe(1);
    expect(await cartDrawer.firstLineItemQuantity()).toBe('1');
    expect(await cartDrawer.firstLineItemHandle()).toBe(handle);
    expect(await cartDrawer.cartTotalCents()).toBeGreaterThan(0);
  });

  // BV_PLP_POS_063 (Select Variant popup via "Choose options") and
  // BV_PLP_POS_069 (select a shade + ADD TO CART in that popup) are intentionally
  // NOT automated: this store's PLP cards expose no "Choose options" CTA and no
  // Select Variant popup — variant products (e.g. lipstick shades) surface a
  // "View product" CTA that navigates to the PDP to choose a variant instead.
  // (069 would also read the cart via the Cloudflare-blocked /cart.js.) Recorded
  // for traceability.
});
