import { defineConfig } from 'playwright/test';

export default defineConfig({
  testDir: 'test/e2e',
  timeout: 30_000,
  reporter: 'list',
  use: { baseURL: 'http://localhost:4173' },
  webServer: {
    command: 'node tools/serve.js 4173',
    url: 'http://localhost:4173',
    reuseExistingServer: false,
  },
  projects: [
    {
      name: 'chromium',
      use: {
        browserName: 'chromium',
        launchOptions: { executablePath: '/usr/bin/chromium' },
        viewport: { width: 390, height: 844 },
        hasTouch: true,
      },
    },
    // WebKit is not listed: Playwright's build needs libicu74 and libflite1, which
    // this Arch-based machine lacks. Safari behaviour is proved on the iPhone instead.
  ],
});
