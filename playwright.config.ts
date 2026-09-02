import { defineConfig, devices } from '@playwright/test';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

export default defineConfig({
  testDir: './tests',
  // Bellavita's storefront is heavy (many marketing/analytics scripts), so
  // navigations and the AJAX cart are slow; give tests and actions more room.
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  // The storefront is slow and rate-limits sustained request volume from one IP
  // (navigations start timing out ~22s under load), so run a single worker
  // locally and retry twice to ride out transient throttling windows.
  retries: 2,
  workers: process.env.CI ? 2 : 1,
  reporter: [
    ['html', { open: 'never' }],
    ['list'],
  ],
  globalSetup: require.resolve('./global-setup'),
  use: {
    // Canonical host is non-www (the store 301-redirects www -> non-www); use it
    // directly to avoid a redirect on every navigation.
    baseURL: process.env.BASE_URL || 'https://bellavitaorganic.com/',
    storageState: path.join(__dirname, 'auth', 'storefront.json'),
    navigationTimeout: 45_000,
    actionTimeout: 20_000,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      // Desktop suite: runs everything under tests/ EXCEPT the mobile folder.
      name: 'chromium',
      testIgnore: /[\\/]mobile[\\/]/,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      // Mobile suite: the test pack was authored for the mobile UI (hamburger
      // drawer, bottom nav, search popup, bottom-sheet Sort/Filters). These
      // specs live in tests/mobile/ and run under an emulated Pixel 5.
      name: 'mobile-chromium',
      testMatch: /[\\/]mobile[\\/].*\.spec\.ts$/,
      use: { ...devices['Pixel 5'] },
    },
  ],
});
