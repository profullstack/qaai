/**
 * Playwright Configuration for QAAI Runner
 * 
 * This configuration is used by the runner service to execute
 * generated E2E tests with proper settings for CI/CD environments.
 */

import { defineConfig } from '@playwright/test';

export default defineConfig({
  // Test timeout (60 seconds)
  timeout: 60_000,
  
  // Retry failed tests once
  retries: 1,
  
  // Run tests in parallel
  workers: process.env.RUNNER_CONCURRENCY 
    ? parseInt(process.env.RUNNER_CONCURRENCY, 10) 
    : 3,
  
  // Reporter configuration
  reporter: [
    ['list'],
    ['junit', { outputFile: 'results/junit.xml' }],
    ['html', { outputFolder: 'results/html', open: 'never' }],
  ],
  
  // Global test configuration
  use: {
    // Run in headless mode (can be overridden)
    headless: process.env.PLAYWRIGHT_HEADLESS !== 'false',
    
    // Capture trace on first retry
    trace: 'on-first-retry',
    
    // Capture video on failure
    video: 'retain-on-failure',
    
    // Capture screenshot on failure
    screenshot: 'only-on-failure',
    
    // Base URL for tests
    baseURL: process.env.APP_BASE_URL || process.env.APP_BASE_URL_DEFAULT || 'http://localhost:3000',
    
    // Browser viewport
    viewport: { width: 1280, height: 720 },
    
    // Ignore HTTPS errors (for local development)
    ignoreHTTPSErrors: true,
    
    // Action timeout
    actionTimeout: 10_000,
    
    // Navigation timeout
    navigationTimeout: 30_000,
  },
  
  // Test directory
  testDir: '../../packages/playwright-tests',
  
  // Output directory for test artifacts
  outputDir: 'results/test-results',
  
  // Projects for different browsers (start with Chromium only)
  projects: [
    {
      name: 'chromium',
      use: {
        browserName: 'chromium',
      },
    },
    // Uncomment to add more browsers
    // {
    //   name: 'firefox',
    //   use: {
    //     browserName: 'firefox',
    //   },
    // },
    // {
    //   name: 'webkit',
    //   use: {
    //     browserName: 'webkit',
    //   },
    // },
  ],
  
  // Web server configuration (if needed for local testing)
  // webServer: {
  //   command: 'npm run start',
  //   port: 3000,
  //   timeout: 120_000,
  //   reuseExistingServer: !process.env.CI,
  // },
});