import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  testMatch: /account.*\.spec\.ts$/,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    channel: process.env.PATHNET_TEST_BROWSER_CHANNEL ?? (process.platform === 'win32' ? 'msedge' : undefined),
    baseURL: process.env.PATHNET_TEST_URL || 'http://127.0.0.1:5176',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] }, testIgnore: /account-mobile\.spec\.ts$/ },
    { name: 'phone', use: { ...devices['Pixel 7'] }, testMatch: /account-mobile\.spec\.ts$/ },
  ],
})
