import { defineConfig } from '@playwright/test';

const FRONTEND_PORT = 4173;
const SERVER_PORT = 8877;

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  retries: 0,
  workers: 1,
  timeout: 45_000,
  expect: {
    timeout: 10_000,
  },
  reporter: [
    ['list'],
    ['html', { open: 'never' }],
  ],
  use: {
    baseURL: `http://127.0.0.1:${FRONTEND_PORT}`,
    headless: true,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  // Launch the API server in dev-header-auth mode so tests can use
  // x-user-uid headers without needing real Firebase ID tokens. This flag is
  // a no-op in production deployments — it only affects the E2E run.
  // Set LUMINA_E2E_SKIP_SERVER=1 to skip auto-start (e.g. when running the
  // server manually under a debugger).
  webServer: process.env.LUMINA_E2E_SKIP_SERVER ? undefined : [
    {
      command: 'node server/index.js',
      port: SERVER_PORT,
      reuseExistingServer: true,
      timeout: 60_000,
      env: {
        PORT: String(SERVER_PORT),
        NODE_ENV: 'development',
        LUMINA_ALLOW_DEV_HEADER_AUTH: 'true',
      },
    },
  ],
});
