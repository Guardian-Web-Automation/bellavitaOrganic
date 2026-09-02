import { Page } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * Site header.
 *
 * ADAPTED for the Bellavita Organic store (custom "BVO/main" theme, a Dawn
 * derivative). Unlike the GNC "Horizon" theme there is no <store-header> custom
 * element — the header is a plain <header class="header">. Search is powered by
 * the third-party Wizzy app (an always-visible desktop search box whose form
 * submits to /pages/custom-search), and the cart is a <details>-based drawer
 * (<cart-drawer><details class="cart-drawer-container"><summary> + a lazily
 * rendered <mini-cart id="mini-cart">).
 */
export class HeaderComponent extends BasePage {
  private readonly container = this.page.locator('header.header').first();
  private readonly logoLink = this.container.locator('a.header__heading-link').first();
  // The desktop Wizzy search box is always visible in the header (placeholder
  // "Search for"); typing + Enter submits to /pages/custom-search?q=...
  private readonly searchInput = this.page
    .locator('input[name="q"].wizzy-search-input[placeholder="Search for"]')
    .first();
  // The cart drawer is opened by toggling its <summary>; the drawer is "open"
  // when the <details> gains the `open` attribute (#mini-cart is always present
  // in the DOM, so its mere presence is not a reliable open signal).
  private readonly cartToggle = this.page.locator('cart-drawer details.cart-drawer-container > summary').first();
  private readonly cartDrawerOpen = this.page.locator('cart-drawer details.cart-drawer-container[open]');

  constructor(page: Page) {
    super(page);
  }

  async isVisible(): Promise<boolean> {
    return this.container
      .waitFor({ state: 'visible' })
      .then(() => true)
      .catch(() => false);
  }

  async clickLogo(): Promise<void> {
    await this.logoLink.click();
  }

  async openSearch(): Promise<void> {
    // The desktop search box is always rendered; just focus it.
    await this.searchInput.click();
  }

  async search(term: string): Promise<void> {
    await this.searchInput.fill(term);
    await this.searchInput.press('Enter');
  }

  /** The always-visible desktop search box is present. */
  async isSearchInputVisible(): Promise<boolean> {
    return this.searchInput
      .waitFor({ state: 'visible' })
      .then(() => true)
      .catch(() => false);
  }

  /** Placeholder text of the desktop search input. */
  async searchPlaceholder(): Promise<string> {
    return (await this.searchInput.getAttribute('placeholder')) ?? '';
  }

  /** Type into the search box without submitting (to trigger suggestions). */
  async typeInSearch(term: string): Promise<void> {
    await this.searchInput.click();
    await this.searchInput.fill(term);
  }

  /**
   * Whether the Wizzy suggestions/results dropdown has opened. The widget mounts
   * a results panel (class contains "wizzy" + result/suggest, or an autocomplete
   * container) when a term is typed.
   */
  async hasSuggestionDropdown(): Promise<boolean> {
    const dropdown = this.page
      .locator(
        '.wizzy-search-results, [class*="wizzy" i][class*="result" i], [class*="wizzy" i][class*="suggest" i], [class*="autocomplete" i]'
      )
      .filter({ visible: true })
      .first();
    return dropdown
      .waitFor({ state: 'visible', timeout: 8_000 })
      .then(() => true)
      .catch(() => false);
  }

  async openCart(): Promise<void> {
    await this.cartToggle.click();
  }

  async isCartDrawerOpen(): Promise<boolean> {
    return this.cartDrawerOpen
      .waitFor({ state: 'attached' })
      .then(() => true)
      .catch(() => false);
  }

  async clickLogin(): Promise<void> {
    // This theme only exposes the account/login link inside the mobile menu
    // drawer — there is no visible desktop header entry point — so navigate to
    // the login destination directly rather than through a hidden control.
    await this.goto('/account/login');
  }
}
