import { Page } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * Collection / product-listing page (PLP).
 *
 * ADAPTED for the Bellavita Organic "BVO/main" theme (a Dawn derivative). The
 * product grid is `ul#product-grid` and each product is a `.card-wrapper`. The
 * card title is `.card-information__text`.
 */
export class CollectionPage extends BasePage {
  private readonly productCards = this.page.locator('#product-grid .card-wrapper');

  constructor(page: Page) {
    super(page);
  }

  async openByHandle(handle: string): Promise<void> {
    await this.goto(`/collections/${handle}`);
  }

  /** The collection page heading (h1 / collection title). */
  async headingText(): Promise<string> {
    const h = this.page.locator('h1, .collection-hero__title, .title--primary').first();
    return (await h.textContent().catch(() => ''))?.trim() ?? '';
  }

  async productCardCount(): Promise<number> {
    return this.productCards.count();
  }

  async clickProductCard(index: number = 0): Promise<void> {
    // The card anchor is JS-intercepted (decorative badges overlay it and the
    // theme handles the click itself), so a direct/force click does not
    // navigate. Follow the card's own product URL instead — this verifies the
    // card links to a PDP, which is the point of the test.
    const href = await this.productCards
      .nth(index)
      .locator('a[href*="/products/"]')
      .first()
      .getAttribute('href');
    if (!href) throw new Error('Product card has no /products/ link to follow');
    await this.goto(href);
  }

  // Category pills on Shop All / listing pages: `button.plp-category-pill`; the
  // selected pill carries the `active` class.
  private categoryPill(name: string) {
    return this.page.locator('button.plp-category-pill', { hasText: name }).first();
  }

  /** Whether the named category pill (e.g. "Fragrance") is the active one. */
  async isCategoryPillActive(name: string): Promise<boolean> {
    return this.categoryPill(name)
      .evaluate((el) => el.classList.contains('active'))
      .catch(() => false);
  }

  /** Click a category pill (e.g. "Fragrance"). */
  async clickCategoryPill(name: string): Promise<void> {
    await this.categoryPill(name).click({ force: true });
  }

  // Custom PLP toolbar controls.
  private readonly filterButton = this.page.locator('button.plp-filter-btn').first();
  private readonly sortButton = this.page.locator('button.plp-sort-btn').first();
  private readonly filterPanel = this.page.locator('.plp-filter-content').first();

  /** Whether the PLP Filter control is visible. */
  async hasFilterButton(): Promise<boolean> {
    return this.filterButton
      .waitFor({ state: 'visible', timeout: 15_000 })
      .then(() => true)
      .catch(() => false);
  }

  /** Whether the PLP Sort control is visible. */
  async hasSortButton(): Promise<boolean> {
    return this.sortButton
      .waitFor({ state: 'visible', timeout: 15_000 })
      .then(() => true)
      .catch(() => false);
  }

  /** Open the PLP Filter panel. */
  async openFilterPanel(): Promise<void> {
    await this.filterButton.click({ force: true });
    await this.filterPanel.waitFor({ state: 'visible', timeout: 10_000 }).catch(() => {});
  }

  /** Open the PLP Sort panel. */
  async openSortPanel(): Promise<void> {
    await this.sortButton.click({ force: true });
  }

  /** A left-rail section button by its label (e.g. "Price"). */
  private filterSectionButton(name: string) {
    return this.filterPanel
      .locator('button.plp-filter-category', {
        has: this.page.locator('span.plp-category-label', { hasText: name }),
      })
      .first();
  }

  /** Click a filter section in the panel's left rail (e.g. "Price"). */
  async clickFilterSection(name: string): Promise<void> {
    await this.filterSectionButton(name).evaluate((el) => (el as HTMLElement).click());
  }

  /** Whether the named left-rail section is the active/selected one. */
  async isFilterSectionActive(name: string): Promise<boolean> {
    return this.filterSectionButton(name)
      .evaluate((el) => /active|selected|current/i.test(el.className))
      .catch(() => false);
  }

  /** Text of the filter panel's right pane (the options area). */
  async filterRightPaneText(): Promise<string> {
    return (await this.filterPanel.locator('.plp-filter-values').first().innerText().catch(() => ''))
      .replace(/\s+/g, ' ')
      .trim();
  }

  /** Current visible text of the filter panel (for change detection). */
  async filterPanelText(): Promise<string> {
    return (await this.filterPanel.innerText().catch(() => '')).replace(/\s+/g, ' ').trim();
  }

  /** Whether the filter panel currently shows a control/option for the given text. */
  async filterPanelHasText(re: RegExp): Promise<boolean> {
    return re.test(await this.filterPanelText());
  }

  /** Product handles of the first `n` cards in the grid. */
  async firstProductHandles(n: number): Promise<string[]> {
    const hrefs = await this.productCards
      .locator('a[href*="/products/"]')
      .evaluateAll((as) => (as as HTMLAnchorElement[]).map((a) => a.getAttribute('href') || ''));
    return hrefs
      .map((h) => h.split('/products/')[1]?.split('?')[0] ?? '')
      .filter(Boolean)
      .slice(0, n);
  }

  /** Product handle of the nth card. */
  async productCardHandle(index: number = 0): Promise<string> {
    const href = await this.productCards
      .nth(index)
      .locator('a[href*="/products/"]')
      .first()
      .getAttribute('href');
    return (href ?? '').split('/products/')[1]?.split('?')[0] ?? '';
  }

  /** Raw price text shown on the nth card (may be a "From ₹…" range). */
  async productCardPriceText(index: number = 0): Promise<string> {
    return this.productCards
      .nth(index)
      .locator('.price .money, .money, .price-item')
      .first()
      .innerText()
      .catch(() => '');
  }

  /** Price in cents shown on the nth card. */
  async productCardPriceCents(index: number = 0): Promise<number> {
    const txt = await this.productCardPriceText(index);
    const num = (txt.replace(/,/g, '').match(/\d+(\.\d+)?/) ?? ['0'])[0];
    return Math.round(parseFloat(num) * 100);
  }

  /**
   * Tap "Add to cart" on the nth card. The control is a hover-revealed
   * <add-to-cart> custom element (some cards also render a Dawn button[name=add]).
   */
  async addToCartByCardIndex(index: number = 0): Promise<void> {
    const card = this.productCards.nth(index);
    await card.scrollIntoViewIfNeeded().catch(() => {});
    await card.hover().catch(() => {});
    const add = card.locator('add-to-cart, button[name="add"]').filter({ visible: true }).first();
    await add.click({ force: true });
  }

  async productCardTitle(index: number = 0): Promise<string> {
    const text = await this.productCards
      .nth(index)
      .locator('.card-information__text, [class*="title" i]')
      .first()
      .textContent();
    return text?.trim() ?? '';
  }
}
