import { Page } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * Mobile search popup.
 *
 * MOBILE-ONLY. Tapping the header magnifier opens a full-screen search popup
 * (the URL gains ?bv-search-popup=1) with a "Search for your favourite products"
 * input, a back arrow and close control, a Trending Searches chip row, and a
 * Best Sellers section. Submitting or tapping a trending chip navigates to the
 * Wizzy results page at /pages/custom-search?q=...
 *
 * These interactions only run under the mobile-chromium project; on desktop the
 * search is an always-visible header box with no popup.
 */
export class SearchPopup extends BasePage {
  private readonly magnifier = this.page
    .locator('header [class*="search"] [class*="icon"]')
    .filter({ visible: true })
    .first();
  private readonly input = this.page.locator('input[name="q"]').filter({ visible: true }).first();
  private readonly backControl = this.page
    .locator('[class*="popup" i] [class*="back" i], [class*="search" i] [class*="back" i]')
    .filter({ visible: true })
    .first();
  private readonly closeControl = this.page
    .locator('[class*="popup" i] [class*="close" i], [class*="search" i] [class*="close" i]')
    .filter({ visible: true })
    .first();

  constructor(page: Page) {
    super(page);
  }

  /** Open the search popup via the header magnifier. */
  async open(): Promise<void> {
    await this.magnifier.click();
    // Popup is open when the search input is focusable/visible.
    await this.input.waitFor({ state: 'visible', timeout: 15_000 }).catch(() => {});
  }

  /** Whether the popup is open (visible search input). */
  async isOpen(): Promise<boolean> {
    return this.input
      .waitFor({ state: 'visible', timeout: 10_000 })
      .then(() => true)
      .catch(() => false);
  }

  async placeholder(): Promise<string> {
    return (await this.input.getAttribute('placeholder')) ?? '';
  }

  async hasBackControl(): Promise<boolean> {
    return (await this.backControl.count()) > 0;
  }

  async hasCloseControl(): Promise<boolean> {
    return (await this.closeControl.count()) > 0;
  }

  /** Whether a Trending Searches section is shown. */
  async hasTrendingSection(): Promise<boolean> {
    return this.page
      .getByText(/trending/i)
      .first()
      .isVisible()
      .catch(() => false);
  }

  private trendingChip(text: string) {
    return this.page
      .locator('[class*="trending" i] a, [class*="trending" i] button, [class*="chip" i]', { hasText: text })
      .filter({ visible: true })
      .first();
  }

  /** Tap a Trending Searches chip by its text (e.g. "CEO"). */
  async clickTrendingChip(text: string): Promise<void> {
    await this.trendingChip(text).click();
  }

  /** Type a term into the search input (no submit). */
  async type(term: string): Promise<void> {
    await this.input.click();
    await this.input.fill('');
    // Wizzy autocomplete listens for per-keystroke input events, so type the
    // term character-by-character rather than setting the value in one shot.
    await this.input.pressSequentially(term, { delay: 90 });
  }

  /** Submit the current term (device keyboard "search" key ~= Enter). */
  async submit(): Promise<void> {
    await this.input.press('Enter');
  }
}
