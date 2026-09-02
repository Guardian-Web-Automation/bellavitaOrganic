import { test, expect } from '../fixtures/pages';

/**
 * Sheet "02 Home Page" — Smoke + High priority cases (Test Type = Both).
 *
 * Automated one case at a time. Cases are keyed by their manual Test Case ID.
 * Viewport target: Desktop Chrome (per project decision). The manual cases were
 * authored against the mobile UI, so mobile-only affordances (hero carousel
 * arrows/dots, the bottom navigation bar) are adapted to their desktop
 * equivalents or noted where they do not exist on desktop.
 */
test.describe('02 Home Page — Smoke', () => {
  test.beforeEach(async ({ homePage }) => {
    await homePage.open();
  });

  test('BV_HOME_POS_001 — home page loads with all major sections rendered', async ({
    homePage,
    page,
  }) => {
    // Loads without an error page.
    await expect(page).toHaveURL(/bellavitaorganic\.com/);
    expect(await homePage.isLoaded()).toBeTruthy();

    // Hero banner is rendered with a non-broken image.
    expect(await homePage.isHeroBannerVisible()).toBeTruthy();
    expect(await homePage.isHeroImageLoaded()).toBeTruthy();

    // Each major content section is rendered with its heading.
    // (The mobile-only bottom navigation bar does not exist on the desktop
    // theme, so it is intentionally not asserted here.)
    for (const section of ['BESTSELLERS', 'LUXURY CATEGORIES', 'CRAZY DEALS', 'SHOP BY NOTES']) {
      expect(await homePage.isSectionVisible(section), `${section} section should be visible`).toBeTruthy();
    }
  });

  test('BV_HOME_POS_008 — hero banner shows a slide with navigation controls', async ({
    homePage,
  }) => {
    // Hero banner renders its first slide with a decoded image.
    expect(await homePage.isHeroBannerVisible()).toBeTruthy();
    expect(await homePage.isHeroImageLoaded()).toBeTruthy();

    // Navigation affordances are present. The manual case (mobile) expects
    // exactly 4 dot indicators plus left/right arrows; the desktop slider
    // exposes its own control set, so we assert controls exist rather than the
    // mobile-specific count of 4.
    expect(await homePage.heroDotCount(), 'hero should show dot indicators').toBeGreaterThan(0);
    expect(await homePage.heroArrowCount(), 'hero should show navigation arrows').toBeGreaterThan(0);
  });

  test('BV_HOME_POS_009 — right arrow advances the hero to the next slide', async ({
    homePage,
  }) => {
    const total = await homePage.heroDotButtonCount();
    expect(total, 'hero should have dot indicators').toBeGreaterThan(1);

    const before = await homePage.activeHeroDotIndex();
    expect(before, 'a hero dot should be active').toBeGreaterThanOrEqual(0);

    await homePage.clickHeroNextArrow();

    // The active dot advances one position (wrapping at the end). Poll so the
    // slide transition has time to settle.
    await expect
      .poll(() => homePage.activeHeroDotIndex(), { timeout: 8_000 })
      .toBe((before + 1) % total);
  });

  test('BV_HOME_POS_013 — Bright Wonder hero slide opens its PDP at Rs.299', async ({
    homePage,
    productPage,
    page,
  }) => {
    const handle = 'bright-wonder';
    // Guard: the offer slide must still be in the live hero rotation. If the
    // merchandising changes this is an environment/data condition, not a defect.
    test.skip(
      !(await homePage.hasHeroSlideForHandle(handle)),
      'Bright Wonder slide is not present in the current hero rotation'
    );

    await homePage.clickHeroSlideByHandle(handle);

    // Lands on the Bright Wonder PDP, not the home page or a 404.
    await expect(page).toHaveURL(new RegExp(handle));
    expect((await productPage.titleText()).toLowerCase()).toContain('bright wonder');

    // Selling price matches the Rs.299 shown on the banner.
    expect(await productPage.priceText()).toContain('299');
  });

  test('BV_HOME_POS_021 — BESTSELLERS tab is active by default with cards shown', async ({
    homePage,
  }) => {
    // BESTSELLERS is the active tab; NEW ARRIVALS is inactive.
    expect(await homePage.isTabActive('BESTSELLERS')).toBeTruthy();
    expect(await homePage.isTabActive('NEW ARRIVALS')).toBeFalsy();

    // Product cards belonging to the bestsellers set render below the tabs.
    expect(await homePage.activeTabProductCount()).toBeGreaterThan(0);
  });

  test('BV_HOME_POS_022 — NEW ARRIVALS tab activates and refreshes the product set', async ({
    homePage,
  }) => {
    // Baseline: bestsellers titles with BESTSELLERS active.
    expect(await homePage.isTabActive('BESTSELLERS')).toBeTruthy();
    const bestsellerTitles = await homePage.activeTabProductTitles(2);
    expect(bestsellerTitles.length).toBeGreaterThan(0);

    // Switch to NEW ARRIVALS.
    await homePage.clickTab('NEW ARRIVALS');
    await expect
      .poll(() => homePage.isTabActive('NEW ARRIVALS'), { timeout: 8_000 })
      .toBeTruthy();
    expect(await homePage.isTabActive('BESTSELLERS')).toBeFalsy();

    // The carousel refreshes to a different product set.
    const newArrivalTitles = await homePage.activeTabProductTitles(2);
    expect(newArrivalTitles.length).toBeGreaterThan(0);
    expect(newArrivalTitles.join('|')).not.toBe(bestsellerTitles.join('|'));
  });

  test('BV_HOME_POS_029 — tapping a bestseller card image opens its matching PDP', async ({
    homePage,
    productPage,
    page,
  }) => {
    // NOTE: The sheet names "Beast Mode Perfume Gift Set @ Rs.499.00" as the
    // first bestseller card, but live merchandising has changed (the first card
    // is now a different product/price). Rather than hard-code stale data, this
    // asserts the case's invariant: tapping a bestseller card image opens THAT
    // product's PDP with a matching title and price.
    expect(await homePage.isTabActive('BESTSELLERS')).toBeTruthy();

    const handle = await homePage.activeTabCardHandle(0);
    const cardPrice = await homePage.activeTabCardPriceDigits(0);
    expect(handle, 'first bestseller card should have a product handle').not.toBe('');
    expect(cardPrice, 'first bestseller card should show a price').not.toBe('');

    await homePage.clickActiveTabCardImage(0);

    // Lands on that product's PDP with a real title and a matching price.
    await expect(page).toHaveURL(new RegExp(handle));
    expect((await productPage.titleText()).length).toBeGreaterThan(0);
    expect((await productPage.priceText()).replace(/\D/g, '')).toContain(cardPrice);
  });

  test('BV_HOME_POS_031 — add-to-cart on a bestseller card opens the drawer at qty 1', async ({
    homePage,
    cartDrawer,
  }) => {
    // NOTE: As with POS_029 the sheet's specific product/price (Beast Mode
    // Perfume Gift Set @ Rs.499) may differ from live merchandising, so this
    // anchors on the live first bestseller card and its own price.

    // Empty-cart precondition.
    await cartDrawer.clear();

    expect(await homePage.isTabActive('BESTSELLERS')).toBeTruthy();
    const cardCents = await homePage.activeTabCardPriceCents(0);
    expect(cardCents).toBeGreaterThan(0);

    await homePage.clickActiveTabCardAddToCart(0);

    // Cart reflects exactly this one product at quantity 1.
    await expect.poll(() => cartDrawer.itemCount(), { timeout: 15_000 }).toBe(1);
    expect(await cartDrawer.isOpen()).toBeTruthy();
    expect(await cartDrawer.firstLineItemQuantity()).toBe('1');

    // Checkout total equals the card's line price at qty 1 (both in cents).
    expect(await cartDrawer.cartTotalCents()).toBe(cardCents);
  });

  test('BV_HOME_POS_041 — VIEW ALL opens the bestsellers collection with more products', async ({
    homePage,
    collectionPage,
    page,
  }) => {
    expect(await homePage.isTabActive('BESTSELLERS')).toBeTruthy();
    const carouselCount = await homePage.activeTabProductCount();
    expect(carouselCount).toBeGreaterThan(0);

    await homePage.clickActiveTabViewAll();

    // Lands on the bestsellers collection page.
    await expect(page).toHaveURL(/\/collections\/bestsellers/);

    // The collection lists more products than the home carousel showed. Poll so
    // the grid has time to render after the navigation.
    await expect
      .poll(() => collectionPage.productCardCount(), { timeout: 15_000 })
      .toBeGreaterThan(carouselCount);
  });

  // BV_HOME_POS_045 (Buy Any 3 for Rs.1298 deals banner) is intentionally NOT
  // automated: that promotional banner is not present on the live desktop
  // homepage (no matching banner, link, or price text), so there is nothing to
  // exercise. Recorded here for traceability.

  test('BV_HOME_POS_049 — COSMETICS tile opens the cosmetics collection', async ({
    homePage,
    collectionPage,
    page,
  }) => {
    await homePage.clickCollectionTile('cosmetics');

    // Lands on the cosmetics collection with a matching heading and products.
    await expect(page).toHaveURL(/\/collections\/cosmetics/);
    expect((await collectionPage.headingText()).toLowerCase()).toContain('cosmetic');
    await expect
      .poll(() => collectionPage.productCardCount(), { timeout: 15_000 })
      .toBeGreaterThan(0);
  });

  test('BV_HOME_POS_060 — add-to-cart on the featured Farahat card opens the drawer at qty 1', async ({
    homePage,
    cartDrawer,
  }) => {
    const handle = 'farahat';
    test.skip(
      !(await homePage.hasProductCard(handle)),
      'Featured Farahat card is not present on the live homepage'
    );

    await cartDrawer.clear();

    const cardCents = await homePage.productCardPriceCents(handle); // ₹899.00 -> 89900
    expect(cardCents).toBeGreaterThan(0);

    await homePage.addToCartForProductCard(handle);

    // Cart reflects exactly Farahat at quantity 1.
    await expect.poll(() => cartDrawer.itemCount(), { timeout: 15_000 }).toBe(1);
    expect(await cartDrawer.isOpen()).toBeTruthy();
    expect(await cartDrawer.firstLineItemQuantity()).toBe('1');

    // Line/checkout total equals the card price at qty 1 (both in cents).
    expect(await cartDrawer.cartTotalCents()).toBe(cardCents);
  });

  test('BV_HOME_POS_066 — SELF LOVE KIT crazy-deal card opens its deal page', async ({
    homePage,
    page,
  }) => {
    const handle = 'self-love-kit';
    // The live card links to the self-love-kit bundle page (the sheet loosely
    // calls it a "deal page"); assert it navigates to that page, not home/404.
    // This is a custom build-your-box layout with no product__title/h1, so the
    // identity is asserted via URL and the document title.
    await homePage.clickProductLink(handle);

    await expect(page).toHaveURL(new RegExp(handle));
    expect((await page.title()).toLowerCase()).toContain('self love');
  });

  test('BV_HOME_POS_071 — ROSE note tile opens the rose fragrance collection', async ({
    homePage,
    collectionPage,
    page,
  }) => {
    await homePage.clickCollectionTile('rose');

    // Lands on the rose collection with a matching heading and products.
    await expect(page).toHaveURL(/\/collections\/rose/);
    expect((await collectionPage.headingText()).toLowerCase()).toContain('rose');
    await expect
      .poll(() => collectionPage.productCardCount(), { timeout: 15_000 })
      .toBeGreaterThan(0);
  });

  // BV_HOME_POS_076 (Shop All via bottom nav) and BV_HOME_POS_077 (Crazy Deals
  // via bottom nav) are intentionally NOT automated: the bottom navigation bar
  // is a mobile-only affordance and does not exist on the desktop theme, so
  // there is no control to tap. Recorded here for traceability.
});
