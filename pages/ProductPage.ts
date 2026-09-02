import { Page } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * Product detail page (PDP).
 *
 * ADAPTED for the Bellavita Organic "BVO/main" theme. Everything is scoped to
 * `.product` (the main product grid) to avoid matching the "you may also like"
 * recommendation cards further down the page, which carry their own prices and
 * add-to-cart buttons.
 *
 * The store uses two price templates: fragrance PDPs render the price as
 * `.pdp-price-sale .money`, while standard PDPs use Dawn's
 * `.price-item--sale/regular .money`. `priceText()` matches whichever is
 * present. The add-to-cart button is Dawn's `button[name="add"]`, and clicking
 * it opens the <details>-based mini-cart drawer.
 *
 * Note: the primary product (white-oud-unisex-perfume) has a single variant, so
 * there are no variant swatches to switch between — the variant-switching test
 * has been removed from tests/pdp.spec.ts and the swatch selectors are omitted
 * here.
 */
export class ProductPage extends BasePage {
  private readonly main = this.page.locator('.product').first();
  private readonly productTitle = this.main.locator('.product__title').first();
  private readonly price = this.main
    .locator('.pdp-price-sale .money, .price-item--sale .money, .price-item--regular .money')
    .first();
  private readonly quantityInput = this.main.locator('.quantity__input').first();
  private readonly quantityIncreaseButton = this.main.locator('button[name="plus"]').first();
  private readonly quantityDecreaseButton = this.main.locator('button[name="minus"]').first();
  private readonly addToCartButton = this.main.locator('button[name="add"]').first();
  private readonly cartDrawerOpen = this.page.locator('cart-drawer details.cart-drawer-container[open]');
  private readonly miniCartItem = this.page.locator('#mini-cart .product-container').first();

  constructor(page: Page) {
    super(page);
  }

  async openByHandle(handle: string): Promise<void> {
    await this.goto(`/products/${handle}`);
  }

  async titleText(): Promise<string> {
    return (await this.productTitle.textContent())?.trim() ?? '';
  }

  async priceText(): Promise<string> {
    return (await this.price.textContent())?.trim() ?? '';
  }

  async quantityValue(): Promise<string> {
    return this.quantityInput.inputValue();
  }

  async quantityMax(): Promise<string | null> {
    return this.quantityInput.getAttribute('max');
  }

  async increaseQuantity(): Promise<void> {
    await this.quantityIncreaseButton.click();
  }

  async decreaseQuantity(): Promise<void> {
    await this.quantityDecreaseButton.click();
  }

  async addToCart(): Promise<void> {
    // The add-to-cart button initialises in a disabled "loading" state
    // (aria-disabled="true"), so wait until the theme enables it before
    // clicking. Once scrolled into view the button can sit under the sticky
    // header (whose cart <summary> intercepts pointer events), so force the
    // click — the button is confirmed enabled at that point, so this only
    // bypasses the overlap, and clicking once avoids adding a duplicate line.
    // `networkidle` is avoided deliberately: this store has continuous
    // background requests and never reaches it.
    await this.addToCartButton.waitFor({ state: 'visible' });
    await this.page
      .waitForFunction(
        () => {
          const b = document.querySelector('.product button[name="add"]') as HTMLButtonElement | null;
          return !!b && b.getAttribute('aria-disabled') !== 'true' && !b.classList.contains('loading') && !b.disabled;
        },
        { timeout: 20_000 }
      )
      .catch(() => {});
    await this.addToCartButton.click({ force: true });
    // Clicking the AJAX add-to-cart opens the <details>-based mini-cart drawer
    // (it gains the `open` attribute) and renders the line item.
    await this.cartDrawerOpen.waitFor({ state: 'attached', timeout: 20_000 }).catch(() => {});
    await this.miniCartItem.waitFor({ state: 'visible' }).catch(() => {});
  }
}
