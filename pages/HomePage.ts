import { Page } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * Homepage.
 *
 * ADAPTED for Bellavita Organic. The homepage surfaces several "View all"
 * buttons linking to featured collections (e.g. /collections/bestsellers).
 * These are normal static links, so a plain `.click()` works — no marquee
 * workaround is needed.
 */
export class HomePage extends BasePage {
  private readonly main = this.page.locator('main').first();
  private readonly promoBannerLink = this.page
    .locator('main a.button--secondary[href*="/collections/"]')
    .first();

  // The hero banner is the first homepage section (a custom CSS slider). On the
  // desktop theme it renders as a static promotional banner image rather than
  // the mobile carousel-with-arrows the manual cases describe.
  private readonly heroBanner = this.page.locator('main section[id*="custom_css_slider"]').first();
  private readonly heroImage = this.heroBanner.locator('img').first();

  constructor(page: Page) {
    super(page);
  }

  async open(): Promise<void> {
    await this.goto('/');
  }

  async isLoaded(): Promise<boolean> {
    return this.main
      .waitFor({ state: 'visible' })
      .then(() => true)
      .catch(() => false);
  }

  /** Hero banner section is present and visible. */
  async isHeroBannerVisible(): Promise<boolean> {
    return this.heroBanner
      .waitFor({ state: 'visible' })
      .then(() => true)
      .catch(() => false);
  }

  /** Hero image actually decoded (guards against a broken/empty image). */
  async isHeroImageLoaded(): Promise<boolean> {
    await this.heroImage.scrollIntoViewIfNeeded().catch(() => {});
    return this.heroImage.evaluate(
      (img) => img instanceof HTMLImageElement && img.complete && img.naturalWidth > 0
    ).catch(() => false);
  }

  /** Number of dot/indicator controls in the hero slider (mobile shows 4). */
  async heroDotCount(): Promise<number> {
    return this.heroBanner
      .locator('[class*="dot"], [class*="indicator"], .slick-dots li')
      .count();
  }

  /** Number of prev/next arrow controls in the hero slider. */
  async heroArrowCount(): Promise<number> {
    return this.heroBanner
      .locator('[class*="arrow"], [class*="prev"], [class*="next"]')
      .count();
  }

  private readonly heroNextArrow = this.heroBanner.locator('button[class*="next-"]').first();
  private readonly heroDotButtons = this.heroBanner.locator('button[class*="dot-"]');

  /** Advance the hero slider one slide via the right/next arrow. */
  async clickHeroNextArrow(): Promise<void> {
    await this.heroNextArrow.scrollIntoViewIfNeeded().catch(() => {});
    await this.heroNextArrow.click();
  }

  /** Zero-based index of the currently active hero dot (-1 if none). */
  async activeHeroDotIndex(): Promise<number> {
    return this.heroDotButtons.evaluateAll((btns) =>
      btns.findIndex((b) => b.className.includes('active'))
    );
  }

  /** Total number of hero dot indicators. */
  async heroDotButtonCount(): Promise<number> {
    return this.heroDotButtons.count();
  }

  /** Whether a hero slide links to a product whose handle contains the fragment. */
  async hasHeroSlideForHandle(handleFragment: string): Promise<boolean> {
    return (await this.heroBanner.locator(`a[href*="${handleFragment}"]`).count()) > 0;
  }

  /**
   * Activate the hero slide linking to the given product handle. The slides are
   * stacked, so the target anchor sits beneath the active slide and a
   * coordinate click would land on whichever slide is on top. Dispatching the
   * anchor's own DOM click follows its real href regardless of slide position.
   */
  async clickHeroSlideByHandle(handleFragment: string): Promise<void> {
    const link = this.heroBanner.locator(`a[href*="${handleFragment}"]`).first();
    await link.evaluate((a) => (a as HTMLAnchorElement).click());
  }

  // BESTSELLERS / NEW ARRIVALS tab row. Tab buttons are `button.tab-2`; the
  // active tab carries `active-tab-2` and its panel is `.active-tab-content-2`.
  private tabButton(name: string) {
    return this.page.locator('button.tab-2', { hasText: name }).first();
  }
  private readonly activeTabPanel = this.page.locator('.tab-content-2.active-tab-content-2').first();

  /** Whether the named product tab (e.g. "BESTSELLERS") is the active tab. */
  async isTabActive(name: string): Promise<boolean> {
    return this.tabButton(name).evaluate((b) => b.classList.contains('active-tab-2'));
  }

  /** Click a product tab (e.g. "NEW ARRIVALS"). */
  async clickTab(name: string): Promise<void> {
    // The tab row sits under the sticky header, whose cart <summary> intercepts
    // pointer events even for a forced coordinate click; dispatch the button's
    // own DOM click, which the theme's tab handler is bound to, so activation
    // fires regardless of the overlay.
    await this.tabButton(name).evaluate((b) => (b as HTMLElement).click());
  }

  /** Number of product cards rendered in the currently active tab panel. */
  async activeTabProductCount(): Promise<number> {
    return this.activeTabPanel.locator('.grid__item').count();
  }

  /** Titles of the first `limit` product cards in the active tab panel. */
  async activeTabProductTitles(limit: number): Promise<string[]> {
    const titles = await this.activeTabPanel
      .locator('.grid__item .card__heading, .grid__item .card__information, .grid__item a')
      .allInnerTexts();
    return titles.map((t) => t.trim()).filter(Boolean).slice(0, limit);
  }

  private nthActiveTabCard(index: number) {
    return this.activeTabPanel.locator('.grid__item').nth(index);
  }

  /** Product handle (from href) of the nth card in the active tab panel. */
  async activeTabCardHandle(index: number): Promise<string> {
    const href = await this.nthActiveTabCard(index)
      .locator('a[href*="/products/"]')
      .first()
      .getAttribute('href');
    return (href ?? '').split('/products/')[1]?.split('?')[0] ?? '';
  }

  /** Digits of the nth active-tab card's price (e.g. "₹499.00" -> "499"). */
  async activeTabCardPriceDigits(index: number): Promise<string> {
    const txt = await this.nthActiveTabCard(index)
      .locator('.price .money, .money, .price-item')
      .first()
      .innerText();
    return (txt.match(/\d+/g) ?? []).join('');
  }

  /** The nth active-tab card's price in cents (e.g. "₹599.00" -> 59900). */
  async activeTabCardPriceCents(index: number): Promise<number> {
    const txt = await this.nthActiveTabCard(index)
      .locator('.price .money, .money, .price-item')
      .first()
      .innerText();
    const num = (txt.replace(/,/g, '').match(/\d+(\.\d+)?/) ?? ['0'])[0];
    return Math.round(parseFloat(num) * 100);
  }

  /**
   * Tap the product image/link of the nth card in the active tab panel. Cards in
   * the slider can be offset off-canvas, so dispatch the anchor's DOM click to
   * follow its real href regardless of position.
   */
  async clickActiveTabCardImage(index: number): Promise<void> {
    const link = this.nthActiveTabCard(index).locator('a[href*="/products/"]').first();
    await link.evaluate((a) => (a as HTMLAnchorElement).click());
  }

  /**
   * Tap "Add to cart" on the nth active-tab card. The control is a custom
   * <add-to-cart> element revealed on hover (the theme renders two A/B variants
   * per card, only one visible), so hover the card first and click the visible
   * one.
   */
  async clickActiveTabCardAddToCart(index: number): Promise<void> {
    const card = this.nthActiveTabCard(index);
    await card.scrollIntoViewIfNeeded().catch(() => {});
    await card.hover().catch(() => {});
    const add = card.locator('add-to-cart').filter({ visible: true }).first();
    await add.click({ force: true });
  }

  /**
   * Click the "View all" button in the currently active tab panel. Product cards
   * in the slider overlap the button and intercept pointer events, so dispatch
   * the anchor's DOM click to follow its real href.
   */
  async clickActiveTabViewAll(): Promise<void> {
    const link = this.activeTabPanel.locator('a', { hasText: /view all/i }).first();
    await link.evaluate((a) => (a as HTMLAnchorElement).click());
  }

  /** Whether a homepage tile/link points to the given collection handle. */
  async hasCollectionTile(handle: string): Promise<boolean> {
    return (await this.page.locator(`main a[href*="/collections/${handle}"]`).count()) > 0;
  }

  /**
   * Click a homepage tile linking to a collection (Luxury Categories, Shop By
   * Notes, etc.). Tiles are image links that can be overlaid by decorative
   * elements, so dispatch the anchor's DOM click to follow its real href.
   */
  async clickCollectionTile(handle: string): Promise<void> {
    const tile = this.page.locator(`main a[href*="/collections/${handle}"]`).first();
    await tile.evaluate((a) => (a as HTMLAnchorElement).click());
  }

  /** Click a homepage card/link pointing to a specific product handle. */
  async clickProductLink(handle: string): Promise<void> {
    const link = this.page.locator(`main a[href*="/products/${handle}"]`).first();
    await link.evaluate((a) => (a as HTMLAnchorElement).click());
  }

  /** A product card (with an add-to-cart control) for the given product handle. */
  private productCard(handle: string) {
    return this.page
      .locator('.card-wrapper', { has: this.page.locator(`a[href*="/products/${handle}"]`) })
      .filter({ has: this.page.locator('add-to-cart') })
      .first();
  }

  /** Whether a product card with an add-to-cart control exists for the handle. */
  async hasProductCard(handle: string): Promise<boolean> {
    return (await this.productCard(handle).count()) > 0;
  }

  /** Price in cents shown on the product card for the given handle. */
  async productCardPriceCents(handle: string): Promise<number> {
    const txt = await this.productCard(handle)
      .locator('.price .money, .money, .price-item')
      .first()
      .innerText();
    const num = (txt.replace(/,/g, '').match(/\d+(\.\d+)?/) ?? ['0'])[0];
    return Math.round(parseFloat(num) * 100);
  }

  /**
   * Tap "Add to cart" on the product card for the given handle. The control is a
   * hover-revealed <add-to-cart> custom element (two A/B variants rendered per
   * card, one visible), so hover the card and click the visible one.
   */
  async addToCartForProductCard(handle: string): Promise<void> {
    const card = this.productCard(handle);
    await card.scrollIntoViewIfNeeded().catch(() => {});
    await card.hover().catch(() => {});
    const add = card.locator('add-to-cart').filter({ visible: true }).first();
    await add.click({ force: true });
  }

  /**
   * A homepage section is present when its heading text is rendered. Matches the
   * BESTSELLERS / LUXURY CATEGORIES / CRAZY DEALS / SHOP BY NOTES headings.
   */
  async isSectionVisible(headingText: string): Promise<boolean> {
    const heading = this.page
      .getByRole('heading', { name: headingText, exact: false })
      .first();
    await heading.scrollIntoViewIfNeeded().catch(() => {});
    return heading
      .waitFor({ state: 'visible' })
      .then(() => true)
      .catch(() => false);
  }

  async clickPromoBannerLink(): Promise<void> {
    // The "View all" link sits in a tabbed section where an inactive tab's
    // product cards overlap it and intercept pointer events; force the click on
    // the anchor, which still navigates to the collection.
    await this.promoBannerLink.scrollIntoViewIfNeeded();
    await this.promoBannerLink.click({ force: true });
  }
}
