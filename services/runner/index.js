/**
 * QAAI Runner Service
 * 
 * Background worker service that processes jobs from the queue:
 * - plan: AI test planning from PR diffs
 * - generate: Test code generation
 * - run: Playwright test execution
 */

import 'dotenv/config';
import { acquireJob, markJobDone, markJobError, getJobStats } from './lib/jobs.js';
import { testConnection } from './lib/supabase.js';
import { runPlanner } from './workers/planner.js';
import { runGenerator } from './workers/generator.js';
import { runRunner } from './workers/runner.js';

const POLL_INTERVAL = parseInt(process.env.RUNNER_POLL_INTERVAL_MS || '3000', 10);
const STATS_INTERVAL = 60000; // Log stats every minute

/**
 * Process a single job from the queue
 */
async function processJob() {
  try {
    // Acquire next job
    const job = await acquireJob();
    
    if (!job) {
      // No jobs available
      return;
    }
    
    console.log(`[${new Date().toISOString()}] Processing job ${job.id} of type "${job.kind}"`);
    console.log(`Payload:`, JSON.stringify(job.payload, null, 2));
    
    // Process based on job type
    switch (job.kind) {
      case 'plan':
        await runPlanner(job);
        break;
        
      case 'generate':
        await runGenerator(job);
        break;
        
      case 'run':
        await runRunner(job);
        break;
        
      default:
        throw new Error(`Unknown job kind: ${job.kind}`);
    }
    
    // Mark as completed
    await markJobDone(job.id);
    console.log(`[${new Date().toISOString()}] Job ${job.id} completed successfully`);
    
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error processing job:`, error);
    
    if (job?.id) {
      const errorMessage = error.stack || error.message || 'Unknown error';
      await markJobError(job.id, errorMessage);
    }
  }
}

/**
 * Main polling loop
 */
async function startPolling() {
  console.log(`[${new Date().toISOString()}] Starting job polling (interval: ${POLL_INTERVAL}ms)`);
  
  while (true) {
    await processJob();
    await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL));
  }
}

/**
 * Log job statistics periodically
 */
async function logStats() {
  const stats = await getJobStats();
  console.log(`[${new Date().toISOString()}] Job Stats:`, stats);
}

/**
 * Initialize and start the runner service
 */
async function main() {
  console.log('='.repeat(60));
  console.log('QAAI Runner Service');
  console.log('='.repeat(60));
  console.log(`Node Version: ${process.version}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Poll Interval: ${POLL_INTERVAL}ms`);
  console.log(`Worker Concurrency: ${process.env.RUNNER_CONCURRENCY || 3}`);
  console.log('='.repeat(60));
  
  // Test database connection
  console.log('Testing database connection...');
  const connected = await testConnection();
  
  if (!connected) {
    console.error('Failed to connect to database. Exiting.');
    process.exit(1);
  }
  
  console.log('Database connection successful!');
  console.log('='.repeat(60));
  
  // Log stats periodically
  setInterval(logStats, STATS_INTERVAL);
  
  // Start polling for jobs
  await startPolling();
}

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('\n[${new Date().toISOString()}] SIGTERM received, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('\n[${new Date().toISOString()}] SIGINT received, shutting down gracefully...');
  process.exit(0);
});

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Start the service
main().catch((error) => {
  console.error('Fatal error starting runner service:', error);
  process.exit(1);
});