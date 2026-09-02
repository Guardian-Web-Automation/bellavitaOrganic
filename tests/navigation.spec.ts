import { test, expect } from '../fixtures/pages';
import { searchTerms } from '../test-data/search-terms';

test.describe('Navigation', () => {
  test.beforeEach(async ({ homePage }) => {
    await homePage.open();
  });

  test('clicking the logo returns to the home page', async ({ headerComponent, page }) => {
    // The Wizzy search page is slow to reach full `load`; DOM readiness suffices.
    await page.goto(`/search?q=${encodeURIComponent(searchTerms.valid)}`, { waitUntil: 'domcontentloaded' });
    await headerComponent.clickLogo();
    // Host redirects www -> non-www; match the bare host at the site root.
    await expect(page).toHaveURL(/bellavitaorganic\.com\/?$/);
  });

  test('opening the cart shows the cart drawer', async ({ headerComponent }) => {
    await headerComponent.openCart();
    expect(await headerComponent.isCartDrawerOpen()).toBeTruthy();
  });

  test('login link goes to customer authentication', async ({ headerComponent, page }) => {
    await headerComponent.clickLogin();
    // The store links to /account/login, which Shopify may keep as-is (classic
    // accounts) or redirect to shopify.com/authentication (new customer accounts).
    await expect(page).toHaveURL(/\/account\/login|customer_authentication|shopify\.com\/authentication/);
  });

  test('clicking a promo banner link navigates to the collection', async ({ homePage, page }) => {
    await homePage.clickPromoBannerLink();
    await expect(page).toHaveURL(/\/collections\//);
  });
});
