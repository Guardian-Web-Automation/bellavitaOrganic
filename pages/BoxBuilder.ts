import { Page } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * "Build Your Box" / Crazy Deals box builder.
 *
 * Lives on a deal's product page (e.g. /products/upb-ultimate-perfume-box). The
 * builder shows a "Choose Any N" heading, a progress counter (a <strong> reading
 * "0/3"), a grid of product tiles each with an add control (button[class*=plus])
 * that turns into a +/- quantity stepper, and — once the target is met — an
 * unlocked state with a PAY NOW control and a "Your Box" summary panel.
 *
 * The builder is client-side state, so add/remove/quantity are exercised via the
 * DOM without hitting the (Cloudflare-rate-limited) cart AJAX. Only PAY NOW hands
 * off to checkout.
 */
export class BoxBuilder extends BasePage {
  private readonly addControls = this.page.locator('button[class*="plus" i]');

  constructor(page: Page) {
    super(page);
  }

  /** Open the Ultimate Perfume Box builder (the representative deal). */
  async openUltimatePerfumeBox(): Promise<void> {
    await this.goto('/products/upb-ultimate-perfume-box');
    await this.page.getByText(/choose any 3/i).first().waitFor({ state: 'visible', timeout: 20_000 }).catch(() => {});
  }

  /** Current progress count (the "N" in the "N/3" counter), or -1 if not found. */
  async progressCount(): Promise<number> {
    return this.page
      .evaluate(() => {
        const els = Array.from(document.querySelectorAll('*')) as HTMLElement[];
        for (const e of els) {
          if (e.offsetParent === null) continue;
          const own = Array.from(e.childNodes)
            .filter((n) => n.nodeType === 3)
            .map((n) => n.textContent || '')
            .join('')
            .trim();
          const m = own.match(/^(\d+)\s*(?:of|\/)\s*3\b/i);
          if (m) return parseInt(m[1], 10);
        }
        // Fallback: first "/3" match anywhere in the body.
        const m = document.body.innerText.match(/(\d+)\s*(?:of|\/)\s*3\b/i);
        return m ? parseInt(m[1], 10) : -1;
      })
      .catch(() => -1);
  }

  /** Number of visible add (+) controls. */
  async addControlCount(): Promise<number> {
    return this.addControls.filter({ visible: true }).count();
  }

  /** Click the nth visible add (+) control to put that product in the box. */
  async clickAdd(index = 0): Promise<void> {
    await this.addControls.filter({ visible: true }).nth(index).click({ force: true });
  }

  /** Whether a quantity stepper (a control showing a numeric qty) is present. */
  async hasQuantityStepper(): Promise<boolean> {
    return (await this.page.locator('[class*="qty" i], [class*="stepper" i], button[class*="minus" i]').filter({ visible: true }).count()) > 0;
  }

  /** Whether the PAY NOW control is shown (unlocked state). */
  async hasPayNow(): Promise<boolean> {
    return this.page
      .getByText(/pay now/i)
      .filter({ visible: true })
      .first()
      .isVisible()
      .catch(() => false);
  }
}
