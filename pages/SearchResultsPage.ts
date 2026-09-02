import { Page } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * Search results page (/search?q=...).
 *
 * ADAPTED for Bellavita Organic. The store runs the third-party Wizzy search
 * app, which hijacks the on-page rendering of the native Shopify search results
 * (injecting its own `st-*` DOM), so counting native product cards is
 * unreliable. However, the native Shopify search page still sets a document
 * title of the form `Search: N results found for "<term>"`, where N is
 * accurate. This page object reads that count from the title, which is
 * server-rendered and available immediately.
 *
 * (The header search box submits to Wizzy's own /pages/custom-search page —
 * that navigation is covered separately in tests/search.spec.ts.)
 */
export class SearchResultsPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  async openWithTerm(term: string): Promise<void> {
    await this.goto(`/search?q=${encodeURIComponent(term)}`);
    await this.page.waitForFunction(() => /results found for/i.test(document.title)).catch(() => {});
  }

  /** Parse the "N results found" count out of the native search page title. */
  async resultCount(): Promise<number> {
    const title = await this.page.title();
    const match = title.match(/([\d,]+)\s+results?\s+found/i);
    return match ? parseInt(match[1].replace(/,/g, ''), 10) : 0;
  }

  async hasResults(): Promise<boolean> {
    return (await this.resultCount()) > 0;
  }

  async showsNoResultsMessage(): Promise<boolean> {
    return (await this.resultCount()) === 0;
  }

  async headingText(): Promise<string | null> {
    return this.page.title();
  }
}
