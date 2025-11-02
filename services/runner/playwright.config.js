/**
 * Playwright Configuration
 * 
 * Enhanced configuration with retry and timeout settings.
 */

import { defineConfig, devices } from '@playwright/test';

/**
 * Read environment variables for configuration
 */
const config = {
  // Test directory
  testDir: './tests',
  
  // Maximum time one test can run
  timeout: parseInt(process.env.TEST_TIMEOUT || '30000', 10),
  
  // Test execution settings
  fullyParallel: process.env.PARALLEL === 'true',
  forbidOnly: !!process.env.CI,
  
  // Retry configuration
  retries: parseInt(process.env.TEST_RETRIES || '2', 10),
  
  // Number of workers
  workers: process.env.CI ? 1 : undefined,
  
  // Reporter configuration
  reporter: [
    ['list'],
    ['junit', { outputFile: 'test-results/results.xml' }],
    ['html', { outputFolder: 'test-results/html', open: 'never' }],
  ],
  
  // Shared settings for all projects
  use: {
    // Base URL
    baseURL: process.env.BASE_URL || 'http://localhost:3000',
    
    // Collect trace on failure
    trace: process.env.TRACE || 'on-first-retry',
    
    // Screenshot on failure
    screenshot: process.env.SCREENSHOT || 'only-on-failure',
    
    // Video on failure
    video: process.env.VIDEO || 'retain-on-failure',
    
    // Action timeout
    actionTimeout: parseInt(process.env.ACTION_TIMEOUT || '10000', 10),
    
    // Navigation timeout
    navigationTimeout: parseInt(process.env.NAVIGATION_TIMEOUT || '30000', 10),
    
    // Ignore HTTPS errors
    ignoreHTTPSErrors: process.env.IGNORE_HTTPS_ERRORS === 'true',
    
    // Viewport size
    viewport: { 
      width: parseInt(process.env.VIEWPORT_WIDTH || '1280', 10),
      height: parseInt(process.env.VIEWPORT_HEIGHT || '720', 10)
    },
  },
  
  // Configure projects for major browsers
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
    // Mobile viewports
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12'] },
    },
  ],
  
  // Web server configuration
  webServer: process.env.START_SERVER === 'true' ? {
    command: 'npm run dev',
    url: process.env.BASE_URL || 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  } : undefined,
};

export default defineConfig(config);