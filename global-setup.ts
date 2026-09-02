import { chromium, FullConfig } from '@playwright/test';
import path from 'path';
import dotenv from 'dotenv';
import { StorePasswordPage } from './pages/StorePasswordPage';
import { CloudflareChallenge } from './pages/CloudflareChallenge';

dotenv.config();

const AUTH_FILE = path.join(__dirname, 'auth', 'storefront.json');

export default async function globalSetup(config: FullConfig): Promise<void> {
  const baseURL = config.projects[0].use.baseURL as string;
  const storePassword = process.env.STORE_PASSWORD;

  const browser = await chromium.launch();
  const page = await browser.newPage();

  // The storefront is slow and rate-limits sustained traffic, so the very first
  // navigation can be slow. Use a generous timeout and retry a couple of times
  // so a transient stall here doesn't abort the whole run before setup finishes.
  let lastError: unknown;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      await page.goto(baseURL, { waitUntil: 'domcontentloaded', timeout: 60_000 });
      lastError = undefined;
      break;
    } catch (err) {
      lastError = err;
      if (attempt < 3) await page.waitForTimeout(5_000);
    }
  }
  if (lastError) {
    await browser.close();
    throw lastError;
  }

  // Cloudflare may serve a Turnstile "verify you are human" challenge before the
  // storefront (or its password gate) is reachable. Solve it via 2Captcha first.
  const cloudflare = new CloudflareChallenge(page);
  if (await cloudflare.solveIfPresent()) {
    await page.waitForLoadState('domcontentloaded');
  }

  const passwordPage = new StorePasswordPage(page);
  if (await passwordPage.isShown()) {
    if (!storePassword) {
      await browser.close();
      throw new Error(
        'Store is password-protected but STORE_PASSWORD is not set. Add it to a .env file (see .env.example).'
      );
    }
    await passwordPage.unlock(storePassword);
  }

  await page.context().storageState({ path: AUTH_FILE });
  await browser.close();
}
