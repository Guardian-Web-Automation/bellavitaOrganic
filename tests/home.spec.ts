import { test, expect } from '../fixtures/pages';

test.describe('Home page', () => {
  test.beforeEach(async ({ homePage }) => {
    await homePage.open();
  });

  test('loads successfully', async ({ homePage, page }) => {
    // The store redirects www -> non-www, so match the bare host.
    await expect(page).toHaveURL(/bellavitaorganic\.com/);
    expect(await homePage.isLoaded()).toBeTruthy();
  });

  test('has a non-empty page title', async ({ homePage }) => {
    const title = await homePage.title();
    expect(title.length).toBeGreaterThan(0);
  });

  test('header is visible', async ({ headerComponent }) => {
    expect(await headerComponent.isVisible()).toBeTruthy();
  });
});
