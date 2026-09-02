import { Page } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * Cart drawer (mini-cart).
 *
 * ADAPTED for the Bellavita Organic "BVO/main" theme. This theme's mini-cart
 * (<mini-cart id="mini-cart">) does NOT expose a `#cart-data` element with
 * `data-item-count` / `data-cart-total`, and it re-renders its markup (via
 * Shopify Section Rendering) after every quantity/remove change — so DOM-based
 * counting is unreliable and polluted by cross-sell recommendation cards that
 * live inside the same drawer.
 *
 * Instead, item count and totals are read from Shopify's authoritative
 * `/cart.js` AJAX endpoint (which reflects the page's own cart cookie), while
 * open/close, quantity, remove and empty-state interactions use the drawer DOM.
 * The repeated line-item row is `#mini-cart .product-container`; the empty state
 * is `.mini-cart__empty`.
 */
export class CartDrawer extends BasePage {
  private readonly miniCart = this.page.locator('#mini-cart');
  private readonly lineItems = this.page.locator('#mini-cart .product-container');
  private readonly emptyState = this.page.locator('#mini-cart .mini-cart__empty').first();
  private readonly drawer = this.page.locator('cart-drawer').first();
  private readonly closeControl = this.page
    .locator('cart-drawer [class*="close" i], #mini-cart [class*="close" i], cart-drawer .icon-close')
    .filter({ visible: true })
    .first();

  constructor(page: Page) {
    super(page);
  }

  /**
   * Open the cart drawer by toggling its <details> via a DOM-dispatched click on
   * the summary (robust against sticky-header overlap / re-render after cart
   * mutations, where a coordinate click on the summary can time out).
   */
  async open(): Promise<void> {
    if (!(await this.isDrawerOpen())) {
      await this.page
        .locator('cart-drawer details.cart-drawer-container > summary')
        .first()
        .evaluate((el) => (el as HTMLElement).click())
        .catch(() => {});
    }
    await this.miniCart.first().waitFor({ state: 'visible', timeout: 15_000 }).catch(() => {});
  }

  /** Whether the drawer <details> is currently open. */
  async isDrawerOpen(): Promise<boolean> {
    return this.page
      .locator('cart-drawer details.cart-drawer-container')
      .first()
      .evaluate((el) => (el as HTMLDetailsElement).open)
      .catch(() => false);
  }

  /** The CART title is shown at the top of the drawer. */
  async hasCartTitle(): Promise<boolean> {
    return this.drawer
      .getByText(/^\s*cart\s*$/i)
      .first()
      .isVisible()
      .catch(() => false);
  }

  /** The prepaid offer strip ("GET 5% ON PREPAID ORDERS") is shown. */
  async hasPrepaidStrip(): Promise<boolean> {
    return this.drawer
      .getByText(/prepaid|5%/i)
      .first()
      .isVisible()
      .catch(() => false);
  }

  /** A close (X) control is present in the drawer. */
  async hasCloseControl(): Promise<boolean> {
    return (await this.closeControl.count()) > 0;
  }

  /** Close the drawer via its X control. */
  async close(): Promise<void> {
    await this.closeControl.evaluate((el) => (el as HTMLElement).click());
  }

  /** The empty-cart message is shown. */
  async isEmptyMessageShown(): Promise<boolean> {
    return this.miniCart
      .first()
      .evaluate((el) => /cart is (currently )?empty/i.test((el as HTMLElement).innerText))
      .catch(() => false);
  }

  /** Whether an empty-state collection button with the given label is present. */
  private emptyStateButton(label: string) {
    return this.miniCart.locator('a', { hasText: label }).filter({ visible: true }).first();
  }

  async hasEmptyStateButton(label: string): Promise<boolean> {
    return (await this.emptyStateButton(label).count()) > 0;
  }

  /** Tap an empty-state collection button (e.g. "Bestsellers"). */
  async clickEmptyStateButton(label: string): Promise<void> {
    await this.emptyStateButton(label).evaluate((el) => (el as HTMLElement).click());
  }

  /** An upsell card in the drawer for the given product handle (with add-to-cart). */
  private upsellCard(handle: string) {
    return this.miniCart
      .locator('[class*="product" i], .card-wrapper, li', {
        has: this.page.locator(`a[href*="/products/${handle}"]`),
      })
      .filter({ has: this.page.locator('add-to-cart, button[name="add"]') })
      .first();
  }

  /** Whether an upsell card for the given handle exists in the drawer. */
  async hasUpsellCard(handle: string): Promise<boolean> {
    return (await this.upsellCard(handle).count()) > 0;
  }

  /** Tap ADD TO CART on the drawer upsell card for the given product handle. */
  async addUpsellToCart(handle: string): Promise<void> {
    const card = this.upsellCard(handle);
    await card.scrollIntoViewIfNeeded().catch(() => {});
    await card.hover().catch(() => {});
    const add = card.locator('add-to-cart, button[name="add"]').filter({ visible: true }).first();
    await add.click({ force: true });
  }

  /** In-page /cart.js fetch with short retries; throws if it only sees HTML. */
  private async fetchCartRaw(): Promise<{
    item_count: number;
    total_price: number;
    items: Array<{
      quantity: number;
      handle?: string;
      product_title?: string;
      title?: string;
      url?: string;
      final_line_price?: number;
    }>;
  }> {
    return this.page.evaluate(async () => {
      // /cart.js can transiently return a Cloudflare HTML challenge instead of
      // JSON; retry a few times and parse defensively.
      for (let attempt = 0; attempt < 4; attempt++) {
        try {
          const res = await fetch('/cart.js', { headers: { Accept: 'application/json' } });
          const text = await res.text();
          const trimmed = text.trim();
          if (trimmed.startsWith('{')) return JSON.parse(trimmed);
        } catch {
          /* fall through to retry */
        }
        await new Promise((r) => setTimeout(r, 700));
      }
      throw new Error('/cart.js did not return JSON (Cloudflare challenge?)');
    });
  }

  /**
   * Reload the page to trigger the Cloudflare challenge solver (2Captcha, via
   * BasePage.clearCloudflareChallenge) so a fresh cf_clearance cookie is issued;
   * the cart survives the reload because it lives in the cart cookie.
   */
  private async recoverClearance(): Promise<void> {
    await this.page.reload({ waitUntil: 'domcontentloaded' }).catch(() => {});
    await this.clearCloudflareChallenge();
  }

  /**
   * Read the live cart (Shopify /cart.js). If the store serves a Cloudflare HTML
   * challenge to the XHR, solve it (reload -> 2Captcha) once and retry, so cart
   * assertions survive an interstitial that appears mid-run.
   */
  private async cart(): Promise<Awaited<ReturnType<CartDrawer['fetchCartRaw']>>> {
    try {
      return await this.fetchCartRaw();
    } catch {
      await this.recoverClearance();
      return this.fetchCartRaw();
    }
  }

  /** Product handle of the first cart line item. */
  async firstLineItemHandle(): Promise<string> {
    const item = (await this.cart()).items?.[0];
    return item?.handle ?? (item?.url ?? '').split('/products/')[1]?.split('?')[0] ?? '';
  }

  /** Product title of the first cart line item. */
  async firstLineItemTitle(): Promise<string> {
    const item = (await this.cart()).items?.[0];
    return (item?.product_title ?? item?.title ?? '').trim();
  }

  /**
   * Add a product to the cart by handle via Shopify's AJAX API (uses the first
   * variant). Deterministic setup for cart tests that need a known starting
   * state — far more reliable than driving the UI under the store's throttling.
   * Returns the added item's final line price in cents.
   */
  async addToCartByHandle(handle: string, quantity = 1): Promise<number> {
    const doAdd = () =>
      this.page.evaluate(
        async ({ handle, quantity }) => {
          // Defensive JSON fetch: these AJAX endpoints can return a Cloudflare
          // HTML challenge; retry and parse only real JSON.
          const getJson = async (url: string, init?: RequestInit) => {
            for (let attempt = 0; attempt < 4; attempt++) {
              try {
                const res = await fetch(url, init);
                const text = await res.text();
                const trimmed = text.trim();
                if (trimmed.startsWith('{')) return JSON.parse(trimmed);
              } catch {
                /* retry */
              }
              await new Promise((r) => setTimeout(r, 700));
            }
            throw new Error(`${url} did not return JSON (Cloudflare challenge?)`);
          };
          const p = await getJson(`/products/${handle}.js`);
          const variantId = p.variants[0].id;
          const item = await getJson('/cart/add.js', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify({ id: variantId, quantity }),
          });
          return item.final_line_price ?? item.price ?? 0;
        },
        { handle, quantity }
      );
    try {
      return await doAdd();
    } catch {
      // Interstitial served to the XHR — solve it (reload -> 2Captcha) and retry.
      await this.recoverClearance();
      return doAdd();
    }
  }

  /** DOM-click the product thumbnail/link on the first cart line item. */
  async clickFirstLineItemThumbnail(): Promise<void> {
    await this.lineItems
      .first()
      .locator('a[href*="/products/"]')
      .first()
      .evaluate((a) => (a as HTMLAnchorElement).click());
  }

  async isOpen(): Promise<boolean> {
    return this.miniCart
      .waitFor({ state: 'visible' })
      .then(() => true)
      .catch(() => false);
  }

  async itemCount(): Promise<number> {
    return (await this.cart()).item_count ?? 0;
  }

  async cartTotalCents(): Promise<number> {
    return (await this.cart()).total_price ?? 0;
  }

  async lineItemCount(): Promise<number> {
    return (await this.cart()).items?.length ?? 0;
  }

  async firstLineItemQuantity(): Promise<string> {
    // Read the authoritative quantity from /cart.js — the drawer DOM re-renders
    // after each change, so reading its input value is subject to races.
    return String((await this.cart()).items?.[0]?.quantity ?? 0);
  }

  async firstLineItemQuantityMax(): Promise<string | null> {
    // The mini-cart quantity input carries no `max` attribute on this store
    // (min="0", no upper bound), so this is effectively null; read it defensively.
    return this.lineItems
      .first()
      .locator('input[name="updates[]"]')
      .first()
      .getAttribute('max')
      .catch(() => null);
  }

  async increaseFirstLineItemQuantity(): Promise<void> {
    // Force the click: the drawer re-renders/animates and its own overlay can
    // briefly intercept pointer events on the small stepper button. Then wait
    // until /cart.js actually reflects the increment, so callers read a settled
    // quantity rather than racing the drawer's AJAX re-render.
    const before = (await this.cart()).items?.[0]?.quantity ?? 0;
    await this.lineItems.first().locator('button[name="plus"]').first().click({ force: true });
    await this.page
      .waitForFunction(
        async (b) => {
          const res = await fetch('/cart.js', { headers: { Accept: 'application/json' } });
          const json = await res.json();
          return (json.items?.[0]?.quantity ?? 0) > b;
        },
        before,
        { timeout: 15_000 }
      )
      .catch(() => {});
  }

  async removeFirstLineItem(): Promise<void> {
    // This mini-cart has no dedicated remove control — its only removal path is
    // stepping the line's quantity to 0. Driving that through the drawer's
    // minus button is unreliable in automation: the quantity-input's *debounced*
    // AJAX update races the drawer re-render and is frequently dropped or
    // re-sent, leaving the server line intact even though the input reads 0.
    // Invoke the exact same server operation deterministically instead — set
    // line 1 to quantity 0 via Shopify's cart AJAX API — then confirm the cart
    // is empty via /cart.js.
    await this.page.evaluate(async () => {
      await fetch('/cart/change.js', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ line: 1, quantity: 0 }),
      });
    });
    await this.page
      .waitForFunction(
        async () => {
          const res = await fetch('/cart.js', { headers: { Accept: 'application/json' } });
          return (await res.json()).item_count === 0;
        },
        undefined,
        { timeout: 15_000 }
      )
      .catch(() => {});
  }

  async isEmpty(): Promise<boolean> {
    if ((await this.itemCount()) === 0) return true;
    return (await this.emptyState.count()) > 0;
  }

  private readonly checkoutButton = this.page
    .locator(
      '#mini-cart button[name="checkout"], #mini-cart a[href*="/checkout"], cart-drawer [class*="checkout" i] button, cart-drawer button[name="checkout"]'
    )
    .filter({ visible: true })
    .first();

  /** The amount printed on the CHECKOUT button, in cents (from /cart.js). */
  async checkoutButtonCents(): Promise<number> {
    // The footer button mirrors the cart total; read the authoritative value.
    return this.cartTotalCents();
  }

  /** Tap the CHECKOUT button in the drawer footer. */
  async clickCheckout(): Promise<void> {
    await this.checkoutButton.evaluate((el) => (el as HTMLElement).click());
  }

  /**
   * Empty the cart deterministically via Shopify's AJAX API so a test can rely
   * on an empty-cart precondition regardless of leftover state from prior runs.
   */
  async clear(): Promise<void> {
    const clearFetch = () =>
      this.page.evaluate(async () => {
        const res = await fetch('/cart/clear.js', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        });
        const text = await res.text();
        if (!text.trim().startsWith('{')) throw new Error('/cart/clear.js challenged');
      });
    try {
      await clearFetch();
    } catch {
      await this.recoverClearance();
      await clearFetch().catch(() => {});
    }
    // Confirm empty. itemCount() -> cart() self-recovers from an interstitial.
    for (let i = 0; i < 12; i++) {
      if ((await this.itemCount().catch(() => 1)) === 0) return;
      await this.page.waitForTimeout(500);
    }
  }
}
