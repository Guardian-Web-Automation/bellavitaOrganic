import { test, expect } from '../fixtures/pages';
import { collections } from '../test-data/products';

test.describe('Collection page (PLP)', () => {
  test.beforeEach(async ({ collectionPage }) => {
    await collectionPage.openByHandle(collections.primary);
  });

  test('renders a grid of product cards', async ({ collectionPage }) => {
    expect(await collectionPage.productCardCount()).toBeGreaterThan(0);
  });

  test('clicking a product card navigates to its product detail page', async ({ collectionPage, page }) => {
    await collectionPage.clickProductCard(0);
    await expect(page).toHaveURL(/\/products\//);
  });
});
