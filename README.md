# Bellavita Organic - Playwright Test Suite

Playwright + TypeScript test suite for https://www.bellavitaorganic.com/, using the Page Object Model (POM).

Scaffolded from the shared AI_SDLC brand framework, then tailored to this store.

## Setup

```bash
npm install
npx playwright install
```

Copy `.env.example` to `.env` and fill in the storefront password if the store is gated
(the scaffolder already seeds `.env` with `BASE_URL`):

```bash
cp .env.example .env
```

```
BASE_URL=https://bellavitaorganic.com/
STORE_PASSWORD=<storefront password, if the store is password-protected>
```

> The store is **open** (no password gate) and the canonical host is **non-www**
> (it 301-redirects `www.` → apex), so `BASE_URL` uses the apex domain.

## Anti-bot / Cloudflare

The storefront sits behind Cloudflare. Two distinct protections show up during automation:

1. **Turnstile "verify you are human" interstitial** — a *solvable* captcha widget that
   can gate the first page load. Set `TWO_CAPTCHA_API_KEY` in `.env` and it is solved
   automatically by `global-setup.ts` and on every navigation (`BasePage.clearCloudflareChallenge`
   → `pages/CloudflareChallenge.ts` → `utils/TwoCaptchaSolver.ts`). Optionally set
   `CF_TURNSTILE_SITEKEY` as a sitekey fallback.

   ```
   TWO_CAPTCHA_API_KEY=<your 2captcha key>
   ```

2. **Invisible JS "managed challenge" on the Shopify AJAX API paths** — under sustained
   automation from one IP, `/cart.js`, `/products/*.js` and `/cart/add.js` start returning
   **HTTP 429** with `cf-mitigated: challenge` and a *"Just a moment…"* page that has **no
   Turnstile widget/sitekey**. This is **not** a captcha, so 2Captcha cannot solve it —
   there is nothing to submit. Page *navigations* are not affected, only these XHR endpoints.

   The cart tests (`tests/08-cart-drawer.spec.ts`) and any card add-to-cart read the cart via
   `/cart.js`, so they are the ones affected. `CartDrawer` retries and, on a challenge,
   reloads to re-solve any Turnstile — but it cannot clear the invisible JS challenge. To run
   the cart suite reliably, run it from **CI or a fresh/residential IP**, pace the requests,
   or switch the cart page object to **navigation-based** operations (cart permalinks
   `/cart/{variant_id}:{qty}` + scraping the `/cart` page), which are not rate-limited.

If the store sits behind Shopify's storefront password gate, `global-setup.ts` unlocks it
once per test run and saves the authenticated session to `auth/storefront.json`, which all
tests reuse via `storageState` — no need to log in per test. If a Cloudflare "verify you are
human" challenge appears, set `TWO_CAPTCHA_API_KEY` (and optionally `CF_TURNSTILE_SITEKEY`).

## Running tests

```bash
npm test              # run all tests
npm run test:headed   # run with a visible browser
npm run test:ui       # Playwright's interactive UI mode
npm run test:home     # just the home page suite
npm run test:navigation
npm run test:search
npm run report        # open the last HTML report
npm run codegen       # launch Playwright codegen against the live site
```

Also runnable directly: `npx playwright test tests/pdp.spec.ts tests/cart.spec.ts tests/plp.spec.ts`.

## Structure

```
pages/               Page objects (one class per page/component)
  BasePage.ts          Shared navigation/title helpers
  StorePasswordPage.ts Shopify password-gate unlock flow
  CloudflareChallenge.ts Cloudflare Turnstile solver (via 2Captcha)
  HeaderComponent.ts   Site header: logo, search, cart, login
  HomePage.ts          Homepage
  SearchResultsPage.ts /search results page
  ProductPage.ts       Product detail page (PDP)
  CartDrawer.ts        Cart drawer
  CollectionPage.ts    Collection/PLP: product grid
fixtures/
  pages.ts             Playwright fixture wiring page objects into `test`
test-data/
  search-terms.ts      Search term fixtures
  products.ts          Product handle + variants, collection handles
tests/
  home.spec.ts  navigation.spec.ts  search.spec.ts
  pdp.spec.ts   cart.spec.ts        plp.spec.ts
utils/
  TwoCaptchaSolver.ts  2Captcha Turnstile client
global-setup.ts        Unlocks the storefront password gate once per run
```

## Theme notes

This store runs a **custom "BVO/main" theme** (a Dawn derivative), not the Horizon theme the
GNC baseline targets. The page objects were re-pointed against the live DOM during scaffolding;
the main adaptations were:

- **Header** is a plain `<header class="header">` (no `<store-header>`). The logo is
  `a.header__heading-link`.
- **Search** is powered by the third-party **Wizzy** app. Direct `/search?q=` still works and
  its page title (`Search: N results found for "…"`) is the reliable result-count signal, so
  `SearchResultsPage` reads the count from the title (Wizzy overrides the on-page grid). The
  header search box submits to Wizzy's own `/pages/custom-search`, which the header-search test
  asserts.
- **Cart** is a `<details>`-based mini-cart (`<cart-drawer>` → `#mini-cart`) with no
  `#cart-data` element and no dedicated remove control. `CartDrawer` reads counts/totals from
  Shopify's `/cart.js` (the drawer DOM re-renders and is polluted by cross-sell cards), and
  removes a line by stepping its quantity to 0.
- **PDP** price uses a custom fragrance template (`.pdp-price-sale .money`, with a fallback to
  Dawn's `.price-item--…`). Add-to-cart is `button[name="add"]`, which opens the mini-cart.
- **Login**: there is no visible desktop account link (it lives only in the mobile menu
  drawer), so `HeaderComponent.clickLogin()` navigates to `/account/login` directly.

### Tests removed / changed vs. the baseline

- The **PDP variant-switching test was removed** — the primary product
  (`white-oud-unisex-perfume`) has a single variant, so there is nothing to switch.
- URL assertions match the **apex host** (`bellavitaorganic.com`) since the store redirects
  `www.` away.

### Concurrency

The storefront is slow and throttles many concurrent connections from one IP, so
`playwright.config.ts` runs a **single worker locally** with one retry. The cart/PDP specs use
a **fresh, empty `storageState` per test** so their (session-scoped) carts don't collide.

If the theme changes, re-verify the selectors in `pages/` against the live DOM — the comments
in each page object call out the selectors most likely to be theme-specific.

## CI

No CI pipeline is configured yet. `playwright.config.ts` already branches on `process.env.CI`
for retries/workers if you wire one up later.
