import { Page } from '@playwright/test';

export class BasePage {
  constructor(protected readonly page: Page) {}

  async goto(path: string = '/'): Promise<void> {
    // Many storefront themes pull in heavy marketing scripts/images, so the
    // default "load" wait is slow and flaky; DOM readiness is all tests need.
    await this.page.goto(path, { waitUntil: 'domcontentloaded' });
    await this.clearCloudflareChallenge();
  }

  /**
   * If Cloudflare re-challenges mid-run (e.g. cf_clearance expired), solve it so
   * the navigation the test just made actually lands on the app. No-op unless
   * TWO_CAPTCHA_API_KEY is configured. Lazy import avoids a circular dependency
   * (CloudflareChallenge extends BasePage).
   */
  protected async clearCloudflareChallenge(): Promise<void> {
    if (!process.env.TWO_CAPTCHA_API_KEY) return;
    const { CloudflareChallenge } = await import('./CloudflareChallenge');
    if (this instanceof CloudflareChallenge) return; // don't recurse
    const cloudflare = new CloudflareChallenge(this.page);
    if (await cloudflare.solveIfPresent()) {
      await this.page.waitForLoadState('domcontentloaded');
    }
  }

  async title(): Promise<string> {
    return this.page.title();
  }

  async currentUrl(): Promise<string> {
    return this.page.url();
  }
}
