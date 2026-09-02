import { Page } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * Mobile hamburger menu drawer.
 *
 * MOBILE-ONLY. On the Bellavita "BVO/main" theme the hamburger drawer is a
 * standard Dawn <header-drawer>: a <details class="menu-drawer-container"> whose
 * <summary class="header__icon--menu" aria-label="Menu"> toggles the drawer
 * (#menu-drawer). It is hidden on desktop widths, so these interactions only run
 * under the mobile-chromium project (emulated Pixel 5).
 *
 * Structure (confirmed against the live store):
 *  - toggle:      header-drawer summary.header__icon--menu
 *  - open state:  details.menu-drawer-container[open]
 *  - drawer:      #menu-drawer
 *  - account:     a.menu-drawer__account  (guest: "Log in" -> /account/login)
 *  - close:       drawer-close-button (top-level) / .menu-drawer__close-button (submenu)
 *  - top links:   ul.menu-drawer__menu > li > a.menu-drawer__menu-item
 *                   Crazy Deals -> /pages/build-a-box
 *                   Shop All    -> /collections/shop-all-products
 *                   Bestsellers -> /collections/bestsellers
 *  - accordions:  ul.menu-drawer__menu > li > details (e.g. "Perfumes")
 *                   submenu: #link-perfumes a.menu-drawer__menu-item
 */
export class MenuDrawer extends BasePage {
  private readonly container = this.page.locator('header-drawer details.menu-drawer-container').first();
  private readonly toggle = this.container.locator('summary.header__icon--menu').first();
  private readonly toggleIcon = this.toggle.locator('.header__icon--summary').first();
  private readonly drawer = this.page.locator('#menu-drawer').first();
  private readonly accountLink = this.drawer.locator('a.menu-drawer__account').first();
  private readonly closeButton = this.drawer.locator('drawer-close-button').first();
  private readonly topLevelItems = this.drawer.locator('ul.menu-drawer__menu > li > a.menu-drawer__menu-item');

  constructor(page: Page) {
    super(page);
  }

  /** Open the hamburger drawer (toggles the <details>). */
  async open(): Promise<void> {
    if (!(await this.isOpen())) {
      // Prefer a real click on the visible hamburger icon span, which triggers
      // <header-drawer>'s own open handler (adds the animation classes). Fall
      // back to a DOM-dispatched summary click (<header-drawer> is
      // display:contents, so the summary reports a zero-size box and a
      // coordinate click can fail "not visible").
      const clickedIcon = await this.toggleIcon
        .click({ timeout: 5_000 })
        .then(() => true)
        .catch(() => false);
      if (!clickedIcon || !(await this.isOpen())) {
        await this.toggle.evaluate((el) => (el as HTMLElement).click());
      }
    }
    // The theme sets `menu-mobile--open` on <body> when the drawer is shown.
    // (#menu-drawer itself is a 0x0 wrapper; the visible panel is an inner
    // container, so wait on the theme's own open-state signal instead.)
    await this.page
      .waitForFunction(() => document.body.classList.contains('menu-mobile--open'), undefined, {
        timeout: 15_000,
      })
      .catch(() => {});
  }

  /** Whether the drawer is currently open (native <details> open attribute). */
  async isOpen(): Promise<boolean> {
    return this.container
      .evaluate((el) => (el as HTMLDetailsElement).open)
      .catch(() => false);
  }

  /** Whether the drawer is shown, per the theme's `menu-mobile--open` body flag. */
  async isVisible(): Promise<boolean> {
    return this.page
      .evaluate(() => document.body.classList.contains('menu-mobile--open'))
      .catch(() => false);
  }

  /** Close the drawer via its close (X) control. */
  async close(): Promise<void> {
    await this.closeButton.evaluate((el) => (el as HTMLElement).click());
  }

  /** Whether a top-level close (X) control is present in the drawer. */
  async hasCloseControl(): Promise<boolean> {
    return (await this.closeButton.count()) > 0;
  }

  /** Text of the guest account link (e.g. "Log in"). */
  async accountLinkText(): Promise<string> {
    return (await this.accountLink.textContent().catch(() => ''))?.trim() ?? '';
  }

  /** Tap the account / log-in link in the drawer header. */
  async clickAccountLink(): Promise<void> {
    await this.accountLink.evaluate((el) => (el as HTMLElement).click());
  }

  /** Titles of the top-level menu items (direct links, excludes accordions). */
  async topLevelItemTexts(): Promise<string[]> {
    return (await this.topLevelItems.allInnerTexts()).map((t) => t.trim()).filter(Boolean);
  }

  /** Tap a top-level menu link by its visible text (e.g. "Shop All"). */
  async clickTopLevelItem(text: string): Promise<void> {
    await this.drawer
      .locator('ul.menu-drawer__menu > li > a.menu-drawer__menu-item', { hasText: text })
      .first()
      .evaluate((el) => (el as HTMLElement).click());
  }

  /** An accordion row (a top-level <details>) whose label matches `label`. */
  private accordion(label: string) {
    return this.drawer
      .locator('ul.menu-drawer__menu > li > details', {
        has: this.page.locator('summary', { hasText: label }),
      })
      .first();
  }

  /** Whether the named accordion (e.g. "Perfumes") is expanded. */
  async isAccordionExpanded(label: string): Promise<boolean> {
    return this.accordion(label)
      .evaluate((el) => (el as HTMLDetailsElement).open)
      .catch(() => false);
  }

  /** Expand the named accordion by tapping its summary row. */
  async expandAccordion(label: string): Promise<void> {
    if (!(await this.isAccordionExpanded(label))) {
      await this.accordion(label)
        .locator('summary')
        .first()
        .evaluate((el) => (el as HTMLElement).click());
    }
  }

  /** Sub-item texts revealed under an expanded accordion. */
  async accordionSubItemTexts(label: string): Promise<string[]> {
    return (
      await this.accordion(label).locator('.menu-drawer__submenu a.menu-drawer__menu-item').allInnerTexts()
    )
      .map((t) => t.trim())
      .filter(Boolean);
  }

  /** Tap a sub-item under an expanded accordion by its text (e.g. "All Perfumes"). */
  async clickAccordionSubItem(label: string, subItemText: string): Promise<void> {
    await this.accordion(label)
      .locator('.menu-drawer__submenu a.menu-drawer__menu-item', { hasText: subItemText })
      .first()
      .evaluate((el) => (el as HTMLElement).click());
  }
}
