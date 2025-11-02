/**
 * Runner Worker
 * 
 * Executes Playwright tests and captures artifacts.
 */

import { promises as fs } from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { getSupabaseClient } from '../lib/supabase.js';
import { parseJUnitXML, extractError } from '../lib/junit-parser.js';
import { uploadTestArtifacts, uploadJUnitXML, findArtifacts } from '../lib/artifacts.js';
import { parsePRUrl } from '../lib/github.js';
import { reportTestResults, createPendingCheck } from '../lib/github-checks.js';
import { autoCreateIssues } from '../lib/github-issues.js';

const execAsync = promisify(exec);

/**
 * Update run status
 */
async function updateRunStatus(runId, status, summary = null) {
  const supabase = getSupabaseClient();
  
  const updates = { status };
  
  if (summary) {
    updates.summary = summary;
  }
  
  if (status === 'running') {
    updates.started_at = new Date().toISOString();
  } else if (status === 'completed' || status === 'failed') {
    updates.completed_at = new Date().toISOString();
  }
  
  const { error } = await supabase
    .from('runs')
    .update(updates)
    .eq('id', runId);
  
  if (error) {
    throw new Error(`Failed to update run status: ${error.message}`);
  }
}

/**
 * Fetch test cases for a run
 */
async function fetchTestCases(runId) {
  const supabase = getSupabaseClient();
  
  const { data: run, error: runError } = await supabase
    .from('runs')
    .select('project_id, suite_id, plan_id')
    .eq('id', runId)
    .single();
  
  if (runError) {
    throw new Error(`Failed to fetch run: ${runError.message}`);
  }
  
  // Fetch test cases
  let query = supabase
    .from('test_cases')
    .select('*')
    .eq('status', 'active');
  
  if (run.plan_id) {
    query = query.eq('plan_id', run.plan_id);
  } else if (run.suite_id) {
    query = query.eq('suite_id', run.suite_id);
  } else {
    // Fetch all active tests for project
    query = query.eq('project_id', run.project_id);
  }
  
  const { data: testCases, error: testError } = await query;
  
  if (testError) {
    throw new Error(`Failed to fetch test cases: ${testError.message}`);
  }
  
  return { run, testCases };
}

/**
 * Prepare test environment
 */
async function prepareTestEnvironment(projectId, testCases) {
  const testsDir = path.join(process.cwd(), '..', 'playwright-tests', 'tests', projectId);
  
  // Ensure directory exists
  await fs.mkdir(testsDir, { recursive: true });
  
  console.log(`[Runner] Test directory: ${testsDir}`);
  console.log(`[Runner] Test cases: ${testCases.length}`);
  
  // Verify test files exist
  const missingFiles = [];
  for (const testCase of testCases) {
    const testPath = path.join(process.cwd(), '..', 'playwright-tests', testCase.file_path);
    try {
      await fs.access(testPath);
    } catch {
      missingFiles.push(testCase.file_path);
    }
  }
  
  if (missingFiles.length > 0) {
    console.warn(`[Runner] Missing test files: ${missingFiles.join(', ')}`);
  }
  
  return testsDir;
}

/**
 * Execute Playwright tests
 */
async function executeTests(projectId) {
  const workDir = path.join(process.cwd(), '..', 'playwright-tests');
  const resultsDir = path.join(workDir, 'test-results');
  const junitPath = path.join(resultsDir, 'results.xml');
  
  console.log(`[Runner] Executing Playwright tests...`);
  console.log(`[Runner] Working directory: ${workDir}`);
  
  // Ensure results directory exists
  await fs.mkdir(resultsDir, { recursive: true });
  
  // Build Playwright command
  const testPattern = `tests/${projectId}/**/*.spec.js`;
  const command = [
    'npx playwright test',
    testPattern,
    '--reporter=junit',
    `--output=${resultsDir}`,
    '--trace=on',
    '--video=on',
    '--screenshot=on',
  ].join(' ');
  
  console.log(`[Runner] Command: ${command}`);
  
  try {
    const { stdout, stderr } = await execAsync(command, {
      cwd: workDir,
      env: {
        ...process.env,
        PLAYWRIGHT_JUNIT_OUTPUT_NAME: junitPath,
      },
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer
    });
    
    if (stdout) {
      console.log(`[Runner] STDOUT:\n${stdout}`);
    }
    
    if (stderr) {
      console.log(`[Runner] STDERR:\n${stderr}`);
    }
    
  } catch (error) {
    // Playwright returns non-zero exit code if tests fail
    // This is expected, so we log but don't throw
    console.log(`[Runner] Tests completed with failures`);
    console.log(`[Runner] Exit code: ${error.code}`);
    
    if (error.stdout) {
      console.log(`[Runner] STDOUT:\n${error.stdout}`);
    }
    
    if (error.stderr) {
      console.log(`[Runner] STDERR:\n${error.stderr}`);
    }
  }
  
  return { resultsDir, junitPath };
}

/**
 * Process test results
 */
async function processResults(runId, junitPath, resultsDir) {
  console.log(`[Runner] Processing test results...`);
  
  // Read and parse JUnit XML
  const xmlContent = await fs.readFile(junitPath, 'utf-8');
  const results = await parseJUnitXML(xmlContent);
  
  console.log(`[Runner] Results: ${results.summary.passed}/${results.summary.total} passed`);
  
  // Upload JUnit XML
  const xmlStoragePath = await uploadJUnitXML(runId, junitPath);
  console.log(`[Runner] JUnit XML uploaded: ${xmlStoragePath}`);
  
  // Transform results to match expected format
  const transformedResults = {
    stats: {
      tests: results.summary.total,
      passes: results.summary.passed,
      failures: results.summary.failed,
      pending: results.summary.skipped,
      duration: results.summary.duration,
    },
    tests: results.tests.map(test => ({
      fullTitle: test.name,
      title: test.name.split(' ').pop(),
      file: test.file,
      duration: test.duration,
      state: test.status === 'passed' ? 'passed' : 'failed',
      err: test.status === 'failed' ? {
        message: test.error?.message || 'Test failed',
        stack: test.error?.stack || '',
      } : null,
    })),
  };
  
  return transformedResults;
}

/**
 * Save test results to database
 */
async function saveTestResults(runId, testCases, results) {
  const supabase = getSupabaseClient();
  
  console.log(`[Runner] Saving test results to database...`);
  
  const runTests = [];
  
  for (const result of results.tests) {
    // Find matching test case
    const testCase = testCases.find(tc => 
      result.name.includes(tc.name) || 
      result.file.includes(tc.file_path)
    );
    
    if (!testCase) {
      console.warn(`[Runner] No matching test case for: ${result.name}`);
      continue;
    }
    
    // Extract error information
    const error = extractError(result);
    
    runTests.push({
      run_id: runId,
      test_case_id: testCase.id,
      status: result.status,
      duration: result.duration,
      error_message: error?.message,
      error_stack: error?.stack,
      stdout: result.stdout,
      stderr: result.stderr,
    });
  }
  
  // Bulk insert run_tests
  const { error: insertError } = await supabase
    .from('run_tests')
    .insert(runTests);
  
  if (insertError) {
    throw new Error(`Failed to save test results: ${insertError.message}`);
  }
  
  console.log(`[Runner] Saved ${runTests.length} test results`);
  
  return runTests;
}

/**
 * Upload artifacts for each test
 */
async function uploadAllArtifacts(runId, results, resultsDir) {
  console.log(`[Runner] Uploading artifacts...`);
  
  const supabase = getSupabaseClient();
  let uploadedCount = 0;
  
  for (const result of results.tests) {
    try {
      // Find artifacts for this test
      const artifacts = await findArtifacts(resultsDir, result.name);
      
      if (Object.keys(artifacts).length === 0) {
        continue;
      }
      
      // Upload artifacts
      const uploaded = await uploadTestArtifacts(runId, result.name, artifacts);
      
      // Update run_tests with artifact paths
      const { error } = await supabase
        .from('run_tests')
        .update({
          trace_path: uploaded.trace,
          video_path: uploaded.video,
          screenshot_path: uploaded.screenshot,
          har_path: uploaded.har,
        })
        .eq('run_id', runId)
        .like('test_case_id', `%${result.name}%`); // Approximate match
      
      if (error) {
        console.error(`[Runner] Failed to update artifact paths:`, error);
      } else {
        uploadedCount++;
      }
      
    } catch (error) {
      console.error(`[Runner] Failed to upload artifacts for ${result.name}:`, error);
    }
  }
  
  console.log(`[Runner] Uploaded artifacts for ${uploadedCount} tests`);
}

/**
 * Clean up test environment
 */
async function cleanup(resultsDir) {
  try {
    console.log(`[Runner] Cleaning up test results directory...`);
    await fs.rm(resultsDir, { recursive: true, force: true });
  } catch (error) {
    console.error(`[Runner] Cleanup failed:`, error);
  }
}

/**
 * Report results to GitHub
 */
async function reportToGitHub(run, results) {
  // Only report if this is a PR-triggered run
  if (!run.pr_url || !run.head_sha) {
    console.log(`[Runner] Skipping GitHub reporting (not a PR run)`);
    return;
  }

  try {
    const { owner, repo } = parsePRUrl(run.pr_url);
    const token = run.github_token || process.env.GITHUB_TOKEN;

    if (!token) {
      console.warn(`[Runner] No GitHub token available, skipping reporting`);
      return;
    }

    // Report test results as check run
    console.log(`[Runner] Reporting results to GitHub...`);
    const checkRun = await reportTestResults({
      owner,
      repo,
      headSha: run.head_sha,
      results,
      token,
    });

    console.log(`[Runner] Check run created: ${checkRun.url}`);

    // Auto-create issues for failures if enabled
    if (results.stats.failures > 0 && run.auto_create_issues !== false) {
      console.log(`[Runner] Auto-creating issues for failures...`);
      const issues = await autoCreateIssues({
        owner,
        repo,
        results,
        runId: run.id,
        prUrl: run.pr_url,
        token,
        options: {
          createForSingleFailure: results.stats.failures <= 2,
          createForMultipleFailures: results.stats.failures > 2,
          multipleFailuresThreshold: 3,
        },
      });

      console.log(`[Runner] Created ${issues.length} issue(s)`);
    }
  } catch (error) {
    console.error(`[Runner] Failed to report to GitHub:`, error);
    // Don't throw - GitHub reporting is not critical
  }
}

/**
 * Create pending check on GitHub
 */
async function createGitHubPendingCheck(run) {
  if (!run.pr_url || !run.head_sha) {
    return;
  }

  try {
    const { owner, repo } = parsePRUrl(run.pr_url);
    const token = run.github_token || process.env.GITHUB_TOKEN;

    if (!token) {
      return;
    }

    console.log(`[Runner] Creating pending check on GitHub...`);
    await createPendingCheck({
      owner,
      repo,
      headSha: run.head_sha,
      token,
    });
  } catch (error) {
    console.error(`[Runner] Failed to create pending check:`, error);
    // Don't throw - this is not critical
  }
}

/**
 * Run the runner worker
 *
 * @param {object} job - The job object from the queue
 * @param {number} job.id - Job ID
 * @param {string} job.kind - Job kind ('run')
 * @param {object} job.payload - Job payload
 * @param {string} job.payload.run_id - Run ID to execute tests for
 * @param {string} job.payload.project_id - Project ID
 */
export async function runRunner(job) {
  console.log(`[Runner] Starting runner for job ${job.id}`);
  console.log(`[Runner] Run ID: ${job.payload.run_id}`);
  
  const { run_id, project_id } = job.payload;
  
  let resultsDir = null;
  
  try {
    // Update run status to running
    await updateRunStatus(run_id, 'running');
    
    // Fetch test cases and run details
    const { run, testCases } = await fetchTestCases(run_id);
    
    if (testCases.length === 0) {
      throw new Error('No test cases found for this run');
    }

    // Create pending check on GitHub
    await createGitHubPendingCheck(run);
    
    // Prepare test environment
    await prepareTestEnvironment(project_id, testCases);
    
    // Execute tests
    const { resultsDir: resDir, junitPath } = await executeTests(project_id);
    resultsDir = resDir;
    
    // Process results
    const results = await processResults(run_id, junitPath, resultsDir);
    
    // Save results to database
    await saveTestResults(run_id, testCases, results);
    
    // Upload artifacts
    await uploadAllArtifacts(run_id, results, resultsDir);

    // Report to GitHub
    await reportToGitHub(run, results);
    
    // Update run status with summary
    const status = results.stats.failures > 0 ? 'failed' : 'completed';
    await updateRunStatus(run_id, status, results.stats);
    
    console.log(`[Runner] Job ${job.id} completed successfully`);
    console.log(`[Runner] Results: ${results.stats.passes}/${results.stats.tests} passed`);
    
    // Clean up
    await cleanup(resultsDir);
    
  } catch (error) {
    console.error(`[Runner] Error in runner worker:`, error);
    
    // Update run status to failed
    await updateRunStatus(run_id, 'failed', {
      error: error.message,
    }).catch(console.error);
    
    // Clean up on error
    if (resultsDir) {
      await cleanup(resultsDir);
    }
    
    throw error;
  }
}