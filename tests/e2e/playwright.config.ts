import { defineConfig } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const mockServerScript = path.resolve(__dirname, 'helpers/mock-server.ts');

/**
 * R.U.B.I. 2.0 Playwright End-to-End Test Configuration
 *
 * Implements 4-tier test architecture:
 * - Tier 1: Core Feature Verification
 * - Tier 2: Boundary & Corner Cases
 * - Tier 3: Cross-Pipeline Flow Integration
 * - Tier 4: Real-World Meeting Scenarios
 *
 * Configured with fake media stream flags for deterministic Web Audio
 * and MediaRecorder offline testing across mobile (320px, 375px, 430px)
 * and desktop (1280px) viewports.
 */
const config: Parameters<typeof defineConfig>[0] = {
  testDir: '.',
  testMatch: /.*\.spec\.ts$/,
  timeout: 30000,
  expect: {
    timeout: 5000,
  },
  workers: 1, // Deterministic sequential execution against mock server state
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['json', { outputFile: 'test-results.json' }],
  ],

  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    permissions: ['microphone'],
    launchOptions: {
      args: [
        '--use-fake-ui-for-media-stream',
        '--use-fake-device-for-media-stream',
        '--allow-file-access-from-files',
      ],
    },
  },

  projects: [
    {
      name: 'desktop-1280',
      use: {
        viewport: { width: 1280, height: 800 },
        browserName: 'chromium',
      },
    },
    {
      name: 'mobile-320',
      use: {
        viewport: { width: 320, height: 568 },
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148',
        isMobile: true,
        hasTouch: true,
        browserName: 'chromium',
      },
    },
    {
      name: 'mobile-375',
      use: {
        viewport: { width: 375, height: 667 },
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148',
        isMobile: true,
        hasTouch: true,
        browserName: 'chromium',
      },
    },
    {
      name: 'mobile-430',
      use: {
        viewport: { width: 430, height: 932 },
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148',
        isMobile: true,
        hasTouch: true,
        browserName: 'chromium',
      },
    },
  ],

  webServer: {
    command: process.env.PLAYWRIGHT_WEB_COMMAND || `node --import tsx "${mockServerScript}"`,
    url: 'http://127.0.0.1:5173',
    reuseExistingServer: true,
    timeout: 15000,
  },
};

if (process.env.CI) {
  config.workers = 1;
}

export default defineConfig(config);
