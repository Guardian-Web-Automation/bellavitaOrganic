import { test, expect } from '../fixtures/pages';

/**
 * Sheet "01 Search Page" — Smoke + High priority cases (Test Type = Both).
 *
 * Automated one case at a time, keyed by manual Test Case ID. Viewport target:
 * Desktop Chrome. The manual cases were authored against the mobile search
 * experience (a full-screen search popup with Trending/Best Sellers/Crazy Deal/
 * Luxury sections, bottom-sheet Sort/Filters). On desktop the store runs the
 * Wizzy search app as an always-visible header search box with a suggestions
 * dropdown, submitting to /pages/custom-search. Mobile-only affordances are
 * adapted to their desktop equivalents or noted where they do not exist.
 */
test.describe('01 Search Page — Smoke', () => {
  test.beforeEach(async ({ homePage }) => {
    await homePage.open();
  });

  test('BV_SRCH_001 — header search entry opens the search experience', async ({
    headerComponent,
    page,
  }) => {
    // Desktop adaptation: there is no mobile magnifier popup with Trending/Best
    // Sellers/Crazy Deal/Luxury sections. The desktop search entry is the
    // always-visible Wizzy header box (placeholder "Search for"); it opens the
    // search experience by taking the user to the Wizzy results page with
    // products — the desktop equivalent of "opening search".
    expect(await headerComponent.isSearchInputVisible()).toBeTruthy();
    expect((await headerComponent.searchPlaceholder()).toLowerCase()).toContain('search');

    await headerComponent.search('perfume');

    // The search experience opens: Wizzy custom-search results page with tiles.
    await expect(page).toHaveURL(/\/pages\/custom-search|[?&]q=perfume/);
    await expect
      .poll(() => page.locator('a[href*="/products/"]').filter({ visible: true }).count(), {
        timeout: 15_000,
      })
      .toBeGreaterThan(0);
  });
});
