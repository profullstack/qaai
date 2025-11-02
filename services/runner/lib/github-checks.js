/**
 * GitHub Checks Reporter
 * 
 * Posts test results to GitHub as check runs
 */

import { createCheckRun } from './github.js';

/**
 * Format test results for GitHub check run
 * 
 * @param {object} results - Test results
 * @returns {object} Formatted output
 */
function formatTestResults(results) {
  const { stats, tests } = results;
  
  const passed = stats.passes || 0;
  const failed = stats.failures || 0;
  const skipped = stats.pending || 0;
  const total = stats.tests || 0;
  
  // Build summary
  let summary = `## Test Results\n\n`;
  summary += `- ✅ **Passed:** ${passed}\n`;
  summary += `- ❌ **Failed:** ${failed}\n`;
  summary += `- ⏭️ **Skipped:** ${skipped}\n`;
  summary += `- 📊 **Total:** ${total}\n`;
  summary += `- ⏱️ **Duration:** ${(stats.duration / 1000).toFixed(2)}s\n\n`;
  
  // Add failure details if any
  if (failed > 0) {
    summary += `## Failed Tests\n\n`;
    
    const failedTests = tests.filter(t => t.state === 'failed');
    failedTests.forEach((test, idx) => {
      summary += `### ${idx + 1}. ${test.fullTitle}\n\n`;
      summary += `**Error:** ${test.err?.message || 'Unknown error'}\n\n`;
      
      if (test.err?.stack) {
        summary += `<details>\n<summary>Stack Trace</summary>\n\n`;
        summary += `\`\`\`\n${test.err.stack}\n\`\`\`\n\n`;
        summary += `</details>\n\n`;
      }
    });
  }
  
  // Add passed tests summary
  if (passed > 0) {
    summary += `## Passed Tests\n\n`;
    const passedTests = tests.filter(t => t.state === 'passed');
    passedTests.forEach(test => {
      summary += `- ✅ ${test.fullTitle}\n`;
    });
    summary += `\n`;
  }
  
  return {
    title: failed > 0 
      ? `${failed} test${failed > 1 ? 's' : ''} failed`
      : `All ${passed} tests passed`,
    summary,
  };
}

/**
 * Report test results to GitHub as a check run
 * 
 * @param {object} params - Parameters
 * @param {string} params.owner - Repository owner
 * @param {string} params.repo - Repository name
 * @param {string} params.headSha - Commit SHA
 * @param {object} params.results - Test results
 * @param {string} params.token - GitHub token
 * @param {string} params.checkName - Check run name (default: 'QAAI Tests')
 * @returns {Promise<object>} Check run info
 */
export async function reportTestResults({
  owner,
  repo,
  headSha,
  results,
  token,
  checkName = 'QAAI Tests',
}) {
  console.log(`[GitHub Checks] Reporting results for ${owner}/${repo}@${headSha}`);
  
  const { stats } = results;
  const failed = stats.failures || 0;
  
  // Determine conclusion
  const conclusion = failed > 0 ? 'failure' : 'success';
  
  // Format output
  const output = formatTestResults(results);
  
  // Create check run
  const check = await createCheckRun(
    owner,
    repo,
    {
      name: checkName,
      headSha,
      status: 'completed',
      conclusion,
      title: output.title,
      summary: output.summary,
    },
    token
  );
  
  console.log(`[GitHub Checks] Check run created: ${check.url}`);
  
  return check;
}

/**
 * Create a pending check run
 * 
 * @param {object} params - Parameters
 * @param {string} params.owner - Repository owner
 * @param {string} params.repo - Repository name
 * @param {string} params.headSha - Commit SHA
 * @param {string} params.token - GitHub token
 * @param {string} params.checkName - Check run name (default: 'QAAI Tests')
 * @returns {Promise<object>} Check run info
 */
export async function createPendingCheck({
  owner,
  repo,
  headSha,
  token,
  checkName = 'QAAI Tests',
}) {
  console.log(`[GitHub Checks] Creating pending check for ${owner}/${repo}@${headSha}`);
  
  const check = await createCheckRun(
    owner,
    repo,
    {
      name: checkName,
      headSha,
      status: 'in_progress',
    },
    token
  );
  
  console.log(`[GitHub Checks] Pending check created: ${check.id}`);
  
  return check;
}

/**
 * Update check run to in_progress
 * 
 * @param {object} params - Parameters
 * @param {string} params.owner - Repository owner
 * @param {string} params.repo - Repository name
 * @param {number} params.checkRunId - Check run ID
 * @param {string} params.token - GitHub token
 * @returns {Promise<object>} Updated check run
 */
export async function updateCheckToInProgress({
  owner,
  repo,
  checkRunId,
  token,
}) {
  console.log(`[GitHub Checks] Updating check ${checkRunId} to in_progress`);
  
  const url = `https://api.github.com/repos/${owner}/${repo}/check-runs/${checkRunId}`;
  
  const headers = {
    'Accept': 'application/vnd.github.v3+json',
    'Authorization': `Bearer ${token}`,
    'User-Agent': 'QAAI-Runner',
    'Content-Type': 'application/json',
  };
  
  const response = await fetch(url, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({
      status: 'in_progress',
    }),
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`GitHub API error: ${response.status} ${error}`);
  }
  
  return await response.json();
}

/**
 * Format test results as annotations for GitHub
 * 
 * @param {object} results - Test results
 * @param {number} maxAnnotations - Maximum annotations (default: 50)
 * @returns {Array} Annotations
 */
export function formatAnnotations(results, maxAnnotations = 50) {
  const { tests } = results;
  const annotations = [];
  
  const failedTests = tests.filter(t => t.state === 'failed');
  
  for (const test of failedTests.slice(0, maxAnnotations)) {
    annotations.push({
      path: test.file || 'unknown',
      start_line: 1,
      end_line: 1,
      annotation_level: 'failure',
      message: test.err?.message || 'Test failed',
      title: test.fullTitle,
      raw_details: test.err?.stack || '',
    });
  }
  
  return annotations;
}

/**
 * Report test results with annotations
 * 
 * @param {object} params - Parameters
 * @param {string} params.owner - Repository owner
 * @param {string} params.repo - Repository name
 * @param {string} params.headSha - Commit SHA
 * @param {object} params.results - Test results
 * @param {string} params.token - GitHub token
 * @param {string} params.checkName - Check run name
 * @returns {Promise<object>} Check run info
 */
export async function reportWithAnnotations({
  owner,
  repo,
  headSha,
  results,
  token,
  checkName = 'QAAI Tests',
}) {
  console.log(`[GitHub Checks] Reporting with annotations for ${owner}/${repo}@${headSha}`);
  
  const { stats } = results;
  const failed = stats.failures || 0;
  const conclusion = failed > 0 ? 'failure' : 'success';
  
  const output = formatTestResults(results);
  const annotations = formatAnnotations(results);
  
  const url = `https://api.github.com/repos/${owner}/${repo}/check-runs`;
  
  const headers = {
    'Accept': 'application/vnd.github.v3+json',
    'Authorization': `Bearer ${token}`,
    'User-Agent': 'QAAI-Runner',
    'Content-Type': 'application/json',
  };
  
  const body = {
    name: checkName,
    head_sha: headSha,
    status: 'completed',
    conclusion,
    output: {
      title: output.title,
      summary: output.summary,
      annotations,
    },
  };
  
  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`GitHub API error: ${response.status} ${error}`);
  }
  
  const created = await response.json();
  console.log(`[GitHub Checks] Check run with annotations created: ${created.html_url}`);
  
  return {
    id: created.id,
    url: created.html_url,
  };
}