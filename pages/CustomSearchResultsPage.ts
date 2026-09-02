import { Page } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * Wizzy "custom search" results page (/pages/custom-search?q=...).
 *
 * MOBILE flow target. The mobile search popup and trending chips submit here.
 * The page renders a "<N> Results found for "<term>":" header, a product grid of
 * `.card-wrapper` tiles (N tiles), and Sort By / Filters controls.
 */
export class CustomSearchResultsPage extends BasePage {
  private readonly tiles = this.page.locator('.card-wrapper');

  constructor(page: Page) {
    super(page);
  }

  /** The "N Results found for "term":" header text, or '' if absent. */
  async resultHeaderText(): Promise<string> {
    return this.page
      .evaluate(() => {
        const m = document.body.innerText.match(/\d[\d,]*\s*Results?\s*found[^\n]*/i);
        return m ? m[0].trim() : '';
      })
      .catch(() => '');
  }

  /** The N parsed from the results header (0 if none). */
  async resultCount(): Promise<number> {
    const header = await this.resultHeaderText();
    const m = header.match(/([\d,]+)\s*Results?/i);
    return m ? parseInt(m[1].replace(/,/g, ''), 10) : 0;
  }

  /** Number of product tiles rendered in the grid. */
  async tileCount(): Promise<number> {
    return this.tiles.count();
  }

  private nthTile(index: number) {
    return this.tiles.nth(index);
  }

  /** Product handle of the nth tile. */
  async tileHandle(index: number): Promise<string> {
    const href = await this.nthTile(index)
      .locator('a[href*="/products/"]')
      .first()
      .getAttribute('href');
    return (href ?? '').split('/products/')[1]?.split('?')[0] ?? '';
  }

  /** Price in cents shown on the nth tile. */
  async tilePriceCents(index: number): Promise<number> {
    const txt = await this.nthTile(index)
      .locator('.price .money, .money, .price-item')
      .first()
      .innerText()
      .catch(() => '');
    const num = (txt.replace(/,/g, '').match(/\d+(\.\d+)?/) ?? ['0'])[0];
    return Math.round(parseFloat(num) * 100);
  }

  /** Tap the nth product tile's image/link (DOM click follows the real href). */
  async clickTile(index: number): Promise<void> {
    await this.nthTile(index)
      .locator('a[href*="/products/"]')
      .first()
      .evaluate((a) => (a as HTMLAnchorElement).click());
  }

  // Mobile toolbar controls (Wizzy custom-search): `button.csr-mob-toolbar-btn`.
  private toolbarButton(label: RegExp) {
    return this.page.locator('button.csr-mob-toolbar-btn', { hasText: label }).first();
  }

  /** Open the Sort By bottom sheet. */
  async openSort(): Promise<void> {
    await this.toolbarButton(/sort/i).click();
  }

  /** Open the Filters panel. */
  async openFilters(): Promise<void> {
    await this.toolbarButton(/filter/i).click();
  }
}
