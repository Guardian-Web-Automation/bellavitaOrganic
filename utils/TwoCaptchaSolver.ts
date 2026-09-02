/**
 * Minimal 2Captcha client for solving Cloudflare Turnstile challenges.
 *
 * Uses the plain HTTP in.php / res.php API (https://2captcha.com/api-docs), so
 * no extra npm dependency is required — Node 18+ `fetch` is enough.
 *
 * Only the Turnstile method is implemented, since that's what Cloudflare serves
 * on these storefronts. See:
 *   https://2captcha.com/api-docs/cloudflare-turnstile
 */

const IN_URL = 'https://2captcha.com/in.php';
const RES_URL = 'https://2captcha.com/res.php';

export interface TurnstileTask {
  /** The Turnstile widget sitekey (data-sitekey / `sitekey` param). */
  sitekey: string;
  /** The full URL of the page hosting the challenge. */
  pageurl: string;
  /** Turnstile `action` param, if the widget defines one. */
  action?: string;
  /** Turnstile `cData` param, if the widget defines one. */
  cdata?: string;
  /** `chlPageData` from an interstitial challenge, if available. */
  pagedata?: string;
  /** User agent of the browser solving the challenge (must match the request). */
  userAgent?: string;
}

export interface TwoCaptchaOptions {
  apiKey: string;
  /** How long to wait for a solution before giving up (ms). Default 180s. */
  timeoutMs?: number;
  /** How often to poll for the result (ms). Default 5s. */
  pollIntervalMs?: number;
}

export class TwoCaptchaError extends Error {}

export class TwoCaptchaSolver {
  private readonly apiKey: string;
  private readonly timeoutMs: number;
  private readonly pollIntervalMs: number;

  constructor(options: TwoCaptchaOptions) {
    if (!options.apiKey) {
      throw new TwoCaptchaError(
        'TwoCaptchaSolver requires an API key. Set TWO_CAPTCHA_API_KEY in your .env file.'
      );
    }
    this.apiKey = options.apiKey;
    this.timeoutMs = options.timeoutMs ?? 180_000;
    this.pollIntervalMs = options.pollIntervalMs ?? 5_000;
  }

  /**
   * Submit a Turnstile challenge and poll until 2Captcha returns a token.
   * Resolves to the `cf-turnstile-response` token string.
   */
  async solveTurnstile(task: TurnstileTask): Promise<string> {
    const captchaId = await this.submit(task);
    return this.poll(captchaId);
  }

  private async submit(task: TurnstileTask): Promise<string> {
    const params = new URLSearchParams({
      key: this.apiKey,
      method: 'turnstile',
      sitekey: task.sitekey,
      pageurl: task.pageurl,
      json: '1',
    });
    if (task.action) params.set('action', task.action);
    if (task.cdata) params.set('data', task.cdata);
    if (task.pagedata) params.set('pagedata', task.pagedata);
    if (task.userAgent) params.set('useragent', task.userAgent);

    const res = await fetch(IN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });
    const data = (await res.json()) as { status: number; request: string };

    if (data.status !== 1) {
      throw new TwoCaptchaError(`2Captcha rejected the task: ${data.request}`);
    }
    return data.request;
  }

  private async poll(captchaId: string): Promise<string> {
    const deadline = Date.now() + this.timeoutMs;
    const params = new URLSearchParams({
      key: this.apiKey,
      action: 'get',
      id: captchaId,
      json: '1',
    });

    while (Date.now() < deadline) {
      await delay(this.pollIntervalMs);

      const res = await fetch(`${RES_URL}?${params.toString()}`);
      const data = (await res.json()) as { status: number; request: string };

      if (data.status === 1) {
        return data.request;
      }
      if (data.request !== 'CAPCHA_NOT_READY') {
        throw new TwoCaptchaError(`2Captcha failed to solve challenge: ${data.request}`);
      }
    }

    throw new TwoCaptchaError(
      `2Captcha did not return a solution within ${this.timeoutMs / 1000}s (id=${captchaId}).`
    );
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
