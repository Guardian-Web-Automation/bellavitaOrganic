import { test, expect } from '../fixtures/pages';
import { searchTerms } from '../test-data/search-terms';

test.describe('Search', () => {
  test('searching a valid term returns results', async ({ searchResultsPage }) => {
    await searchResultsPage.openWithTerm(searchTerms.valid);
    expect(await searchResultsPage.hasResults()).toBeTruthy();
  });

  test('searching a nonsense term shows no results', async ({ searchResultsPage }) => {
    await searchResultsPage.openWithTerm(searchTerms.nonsense);
    expect(await searchResultsPage.hasResults()).toBeFalsy();
  });

  test('search from header navigates to search results', async ({ homePage, headerComponent, page }) => {
    await homePage.open();
    await headerComponent.search(searchTerms.valid);
    // The header uses the Wizzy search app, whose form submits to a custom
    // results page (/pages/custom-search?q=...) rather than native /search.
    await expect(page).toHaveURL(/\/pages\/custom-search|[?&]q=/);
  });
});
