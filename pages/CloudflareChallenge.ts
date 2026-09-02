import { Page } from '@playwright/test';
import { BasePage } from './BasePage';
import { TwoCaptchaSolver } from '../utils/TwoCaptchaSolver';

/**
 * Handles Cloudflare's "Verify you are human" / Turnstile challenge that can sit
 * in front of the storefront during automated runs.
 *
 * Flow:
 *   1. Detect whether a challenge is currently on the page.
 *   2. Pull the Turnstile sitekey out of the widget (or an env override).
 *   3. Ask 2Captcha to solve it.
 *   4. Inject the returned token into the response field(s) and submit.
 *
 * Requires TWO_CAPTCHA_API_KEY in the environment. If a sitekey can't be
 * auto-detected, set CF_TURNSTILE_SITEKEY as a fallback (copy it from the
 * `<div class="cf-turnstile" data-sitekey="...">` on the live challenge page).
 */
export class CloudflareChallenge extends BasePage {
  private readonly turnstileWidget = this.page.locator('.cf-turnstile, [data-sitekey]');
  private readonly challengeForm = this.page.locator('#challenge-form');

  constructor(page: Page) {
    super(page);
  }

  /**
   * True if the current page looks like a Cloudflare challenge/interstitial.
   */
  async isPresent(): Promise<boolean> {
    // Interstitial pages use the "Just a moment..." title and a challenge form;
    // embedded Turnstile shows the widget container / turnstile iframe.
    const title = await this.page.title().catch(() => '');
    if (/just a moment|attention required|verify you are human/i.test(title)) {
      return true;
    }

    const markers = this.page.locator(
      '#challenge-form, .cf-turnstile, iframe[src*="challenges.cloudflare.com"]'
    );
    return (await markers.count()) > 0;
  }

  /**
   * Solve the challenge if one is present. No-op (returns false) when there's
   * nothing to solve. Returns true once a token has been submitted.
   */
  async solveIfPresent(): Promise<boolean> {
    if (!(await this.isPresent())) {
      return false;
    }

    const apiKey = process.env.TWO_CAPTCHA_API_KEY;
    if (!apiKey) {
      throw new Error(
        'A Cloudflare challenge is present but TWO_CAPTCHA_API_KEY is not set. ' +
          'Add it to your .env file (see .env.example).'
      );
    }

    const sitekey = await this.resolveSitekey();
    if (!sitekey) {
      // No Turnstile widget/sitekey means this is Cloudflare's *invisible* JS
      // "managed challenge" (title "Just a moment...", no cf-turnstile widget),
      // not a solvable captcha. 2Captcha cannot help here — there is nothing to
      // submit. Rather than throw (which would abort the navigation), give the
      // browser's own JS challenge a chance to auto-clear, then report whether
      // it did. The real fix for a persistent block of this kind is anti-bot
      // fingerprint evasion / lower request rate / a different IP — see README.
      const cleared = await this.page
        .waitForFunction(() => !/just a moment|verifying your connection|connection needs to be verified/i.test(document.title + ' ' + (document.body?.innerText || '')), undefined, { timeout: 20_000 })
        .then(() => true)
        .catch(() => false);
      return cleared;
    }

    const userAgent = await this.page.evaluate(() => navigator.userAgent);
    const pageurl = this.page.url();

    const solver = new TwoCaptchaSolver({ apiKey });
    const token = await solver.solveTurnstile({ sitekey, pageurl, userAgent });

    await this.injectTokenAndSubmit(token);

    // The challenge either reloads or hands control back to the app; wait for it
    // to clear rather than assuming an instant transition.
    await this.page
      .waitForFunction(
        () =>
          !document.querySelector('#challenge-form') &&
          !document.querySelector('iframe[src*="challenges.cloudflare.com"]'),
        undefined,
        { timeout: 30_000 }
      )
      .catch(() => {
        /* best-effort: caller re-checks state */
      });

    return true;
  }

  /**
   * Find the Turnstile sitekey from the widget attribute, the turnstile iframe
   * URL, or the CF_TURNSTILE_SITEKEY env override.
   */
  private async resolveSitekey(): Promise<string | undefined> {
    // 1. Explicit data-sitekey attribute on the widget container.
    const fromAttr = await this.turnstileWidget
      .first()
      .getAttribute('data-sitekey')
      .catch(() => null);
    if (fromAttr) return fromAttr;

    // 2. Parse it out of the turnstile iframe src, which embeds the sitekey.
    const iframeSrc = await this.page
      .locator('iframe[src*="challenges.cloudflare.com"]')
      .first()
      .getAttribute('src')
      .catch(() => null);
    if (iframeSrc) {
      const match = iframeSrc.match(/\/(0x[0-9A-Za-z]+)\//);
      if (match) return match[1];
    }

    // 3. Manual fallback.
    return process.env.CF_TURNSTILE_SITEKEY || undefined;
  }

  /**
   * Write the solved token into the Turnstile response field(s), fire the
   * callback if the page registered one, and submit the challenge form.
   */
  private async injectTokenAndSubmit(token: string): Promise<void> {
    await this.page.evaluate((value) => {
      const names = ['cf-turnstile-response', 'g-recaptcha-response'];
      for (const name of names) {
        document
          .querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(`[name="${name}"]`)
          .forEach((field) => {
            field.value = value;
            field.dispatchEvent(new Event('input', { bubbles: true }));
            field.dispatchEvent(new Event('change', { bubbles: true }));
          });
      }

      // If the site wired up a Turnstile callback via window, invoke it so any
      // app-side state updates before we submit.
      const cb = (window as unknown as { tsCallback?: (t: string) => void }).tsCallback;
      if (typeof cb === 'function') {
        cb(value);
      }
    }, token);

    if (await this.challengeForm.isVisible().catch(() => false)) {
      await this.challengeForm.evaluate((form) => (form as HTMLFormElement).submit());
    }
  }
}
