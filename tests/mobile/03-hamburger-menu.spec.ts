import { test, expect } from '../../fixtures/pages';

/**
 * Sheet "03 Hamburger Menu" — Smoke + High priority cases (Test Type = Both).
 *
 * MOBILE suite (emulated Pixel 5). The hamburger drawer is hidden on desktop
 * widths, so these cases run only under the mobile-chromium project. Cases are
 * keyed by manual Test Case ID. Login-required cases (e.g. MENU_009) are skipped
 * per project decision (guest-only); the guest-visible equivalents are asserted.
 */
test.describe('03 Hamburger Menu — Smoke (mobile)', () => {
  test.beforeEach(async ({ homePage }) => {
    await homePage.open();
  });

  test('BV_MENU_POS_001 — hamburger opens the side drawer with menu content', async ({
    menuDrawer,
  }) => {
    await menuDrawer.open();

    // The drawer slides open over the page.
    expect(await menuDrawer.isOpen()).toBeTruthy();
    expect(await menuDrawer.isVisible()).toBeTruthy();

    // It has a close (X) control.
    expect(await menuDrawer.hasCloseControl()).toBeTruthy();

    // Guest adaptation: the manual case lists MY ORDERS / TRACK ORDERS tiles,
    // which are the logged-in header variant; a guest session shows the "Log in"
    // account entry instead. Assert the guest-visible account entry plus the
    // navigable menu items that are always present.
    expect((await menuDrawer.accountLinkText()).toLowerCase()).toContain('log');
    const items = (await menuDrawer.topLevelItemTexts()).map((t) => t.toLowerCase());
    expect(items.some((t) => t.includes('shop all'))).toBeTruthy();
    expect(items.some((t) => t.includes('bestseller'))).toBeTruthy();
  });

  test('BV_MENU_POS_002 — X control closes the drawer and restores the page', async ({
    menuDrawer,
  }) => {
    await menuDrawer.open();
    expect(await menuDrawer.isVisible()).toBeTruthy();

    await menuDrawer.close();

    // The drawer closes: the theme clears its `menu-mobile--open` body flag and
    // the panel is no longer shown (no leftover overlay / frozen scroll). Note:
    // the theme's close animation hides the drawer but leaves the native
    // <details open> attribute set, so the user-visible closed signal is the
    // body flag, which is what we assert.
    await expect.poll(() => menuDrawer.isVisible(), { timeout: 8_000 }).toBeFalsy();
  });

  test('BV_MENU_POS_026 — SHOP ALL opens the Shop All Products page', async ({
    menuDrawer,
    collectionPage,
    page,
  }) => {
    await menuDrawer.open();
    await menuDrawer.clickTopLevelItem('Shop All');

    // The drawer closes (navigation) and the Shop All Products page opens.
    await expect(page).toHaveURL(/\/collections\/shop-all-products/);
    expect((await collectionPage.headingText()).toLowerCase()).toContain('shop all');

    // Filter and Sort controls are present.
    await expect(page.getByText(/filter/i).first()).toBeVisible();
    await expect(page.getByText(/sort/i).first()).toBeVisible();
  });

  test('BV_MENU_POS_027 — BESTSELLERS opens the Bestsellers collection page', async ({
    menuDrawer,
    collectionPage,
    page,
  }) => {
    await menuDrawer.open();
    await menuDrawer.clickTopLevelItem('Bestsellers');

    // The Bestsellers collection opens with a matching heading and products.
    await expect(page).toHaveURL(/\/collections\/bestsellers/);
    expect((await collectionPage.headingText()).toLowerCase()).toContain('bestseller');
    await expect
      .poll(() => collectionPage.productCardCount(), { timeout: 15_000 })
      .toBeGreaterThan(0);

    // Filter and Sort controls are present.
    await expect(page.getByText(/filter/i).first()).toBeVisible();
    await expect(page.getByText(/sort/i).first()).toBeVisible();
  });

  test('BV_MENU_POS_031 — PERFUMES accordion expands to reveal its sub-items', async ({
    menuDrawer,
  }) => {
    await menuDrawer.open();

    // Collapsed initially.
    expect(await menuDrawer.isAccordionExpanded('Perfumes')).toBeFalsy();

    await menuDrawer.expandAccordion('Perfumes');

    // Expanded (chevron rotates via the <details> open state).
    expect(await menuDrawer.isAccordionExpanded('Perfumes')).toBeTruthy();

    // Sub-items include the expected perfume categories.
    const subs = (await menuDrawer.accordionSubItemTexts('Perfumes')).map((t) => t.toLowerCase());
    for (const expected of ['all perfumes', 'men', 'women', 'unisex', 'oud collection', 'attars']) {
      expect(subs.some((s) => s.includes(expected)), `sub-item "${expected}" should be present`).toBeTruthy();
    }
  });

  test('BV_MENU_POS_033 — ALL PERFUMES sub-item opens the all-perfumes collection', async ({
    menuDrawer,
    collectionPage,
    page,
  }) => {
    await menuDrawer.open();
    await menuDrawer.expandAccordion('Perfumes');
    await menuDrawer.clickAccordionSubItem('Perfumes', 'All Perfumes');

    // The drawer closes (navigation) and the all-perfumes collection opens.
    await expect(page).toHaveURL(/\/collections\/luxury-perfumes/);
    expect((await collectionPage.headingText()).toLowerCase()).toContain('perfume');
    await expect
      .poll(() => collectionPage.productCardCount(), { timeout: 15_000 })
      .toBeGreaterThan(0);
  });

  // BV_MENU_POS_009 (MY ORDERS while logged in -> account/orders area) is
  // intentionally NOT automated: it requires an authenticated customer session,
  // which is out of scope per the guest-only decision. Recorded for traceability.

  // BV_MENU_POS_010 (guest taps MY ORDERS -> login popup) is intentionally NOT
  // automated: the guest drawer has no MY ORDERS/TRACK ORDERS tiles (those are
  // the logged-in variant), and this store's login is a third-party Kwikpass
  // popup that is not reliably automatable as a guest. The intent (orders gated
  // behind login) is covered by MENU_001 asserting the guest "Log in" entry.

  // BV_MENU_POS_022 (8th Birthday Sale banner -> offer page) is intentionally
  // NOT automated: no birthday/8th-anniversary banner is present in the current
  // drawer (no matching banner image, link, or Rs.799/Rs.1399 text), so there is
  // nothing to tap. Recorded for traceability.

  // BV_MENU_POS_016 (PERFUMES category tile -> perfumes collection) is
  // intentionally NOT automated: there is no direct-nav PERFUMES image tile in
  // the drawer — "Perfumes" exists only as an accordion (tapping it expands, it
  // does not navigate). The navigation to /collections/luxury-perfumes from the
  // menu is covered by MENU_031 (expand) + MENU_033 (sub-item -> collection).
});
