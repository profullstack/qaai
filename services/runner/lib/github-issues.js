/**
 * GitHub Issues Integration
 * 
 * Automatic and manual issue creation for test failures
 */

import { createIssue, searchIssues } from './github.js';

/**
 * Issue templates for different failure types
 */
const ISSUE_TEMPLATES = {
  test_failure: {
    title: (testName) => `Test Failure: ${testName}`,
    body: (data) => `
## Test Failure Report

**Test:** ${data.testName}
**Status:** Failed
**PR:** ${data.prUrl || 'N/A'}
**Run ID:** ${data.runId}
**Timestamp:** ${new Date(data.timestamp).toISOString()}

### Error Message

\`\`\`
${data.errorMessage}
\`\`\`

### Stack Trace

<details>
<summary>Click to expand</summary>

\`\`\`
${data.stackTrace || 'No stack trace available'}
\`\`\`

</details>

### Test Details

- **File:** ${data.testFile || 'Unknown'}
- **Duration:** ${data.duration ? `${data.duration}ms` : 'N/A'}
- **Retries:** ${data.retries || 0}

### Context

${data.context || 'No additional context provided'}

### Suggested Actions

${data.suggestions || '- Review the error message and stack trace\n- Check recent changes in the PR\n- Verify test environment configuration'}

---

*This issue was automatically created by QAAI*
*Run ID: ${data.runId}*
`,
    labels: ['test-failure', 'automated'],
  },

  flaky_test: {
    title: (testName) => `Flaky Test Detected: ${testName}`,
    body: (data) => `
## Flaky Test Report

**Test:** ${data.testName}
**Failure Rate:** ${data.failureRate}% (${data.failures}/${data.totalRuns} runs)
**First Failure:** ${new Date(data.firstFailure).toISOString()}
**Last Failure:** ${new Date(data.lastFailure).toISOString()}

### Recent Failures

${data.recentFailures.map((f, idx) => `
${idx + 1}. **Run ${f.runId}** - ${new Date(f.timestamp).toISOString()}
   - Error: ${f.errorMessage}
   - PR: ${f.prUrl || 'N/A'}
`).join('\n')}

### Analysis

This test has failed ${data.failures} times out of ${data.totalRuns} runs (${data.failureRate}% failure rate), indicating it may be flaky.

### Recommended Actions

- [ ] Review test for race conditions
- [ ] Check for timing dependencies
- [ ] Verify test isolation
- [ ] Add proper waits/retries if needed
- [ ] Consider splitting into smaller tests

---

*This issue was automatically created by QAAI*
*Detection threshold: ${data.threshold}% failure rate*
`,
    labels: ['flaky-test', 'automated', 'needs-investigation'],
  },

  multiple_failures: {
    title: (count) => `Multiple Test Failures (${count} tests)`,
    body: (data) => `
## Multiple Test Failures Report

**Failed Tests:** ${data.failedTests.length}
**PR:** ${data.prUrl || 'N/A'}
**Run ID:** ${data.runId}
**Timestamp:** ${new Date(data.timestamp).toISOString()}

### Failed Tests

${data.failedTests.map((test, idx) => `
${idx + 1}. **${test.name}**
   - File: ${test.file || 'Unknown'}
   - Error: ${test.errorMessage}
   - Duration: ${test.duration ? `${test.duration}ms` : 'N/A'}
`).join('\n')}

### Summary

- Total Tests: ${data.totalTests}
- Passed: ${data.passed}
- Failed: ${data.failed}
- Skipped: ${data.skipped}
- Duration: ${data.duration ? `${(data.duration / 1000).toFixed(2)}s` : 'N/A'}

### Common Patterns

${data.commonPatterns || 'No common patterns detected'}

### Suggested Actions

- Review all failed tests for common root cause
- Check if failures are related to recent changes
- Verify test environment and dependencies
- Consider if tests need to be updated

---

*This issue was automatically created by QAAI*
*Run ID: ${data.runId}*
`,
    labels: ['test-failure', 'multiple-failures', 'automated'],
  },

  manual: {
    title: (title) => title,
    body: (data) => `
## Manual Issue Report

${data.description}

### Details

${data.details || 'No additional details provided'}

### Related Information

- **PR:** ${data.prUrl || 'N/A'}
- **Run ID:** ${data.runId || 'N/A'}
- **Reported By:** ${data.reportedBy || 'Unknown'}
- **Timestamp:** ${new Date(data.timestamp).toISOString()}

---

*This issue was manually created via QAAI*
`,
    labels: ['manual', 'needs-triage'],
  },
};

/**
 * Create an issue for a test failure
 * 
 * @param {object} params - Parameters
 * @param {string} params.owner - Repository owner
 * @param {string} params.repo - Repository name
 * @param {string} params.testName - Test name
 * @param {object} params.data - Test failure data
 * @param {string} params.token - GitHub token
 * @param {boolean} params.checkDuplicates - Check for duplicate issues (default: true)
 * @returns {Promise<object>} Created issue or existing duplicate
 */
export async function createTestFailureIssue({
  owner,
  repo,
  testName,
  data,
  token,
  checkDuplicates = true,
}) {
  console.log(`[GitHub Issues] Creating test failure issue for: ${testName}`);

  // Check for duplicates
  if (checkDuplicates) {
    const searchQuery = `"${testName}" label:test-failure is:open`;
    const existingIssues = await searchIssues(owner, repo, searchQuery, token);

    if (existingIssues.length > 0) {
      console.log(`[GitHub Issues] Found existing issue: #${existingIssues[0].number}`);
      return {
        number: existingIssues[0].number,
        url: existingIssues[0].html_url,
        isDuplicate: true,
      };
    }
  }

  const template = ISSUE_TEMPLATES.test_failure;
  const issue = await createIssue(
    owner,
    repo,
    {
      title: template.title(testName),
      body: template.body({ testName, ...data }),
      labels: template.labels,
    },
    token
  );

  return {
    ...issue,
    isDuplicate: false,
  };
}

/**
 * Create an issue for a flaky test
 * 
 * @param {object} params - Parameters
 * @param {string} params.owner - Repository owner
 * @param {string} params.repo - Repository name
 * @param {string} params.testName - Test name
 * @param {object} params.data - Flaky test data
 * @param {string} params.token - GitHub token
 * @returns {Promise<object>} Created issue
 */
export async function createFlakyTestIssue({
  owner,
  repo,
  testName,
  data,
  token,
}) {
  console.log(`[GitHub Issues] Creating flaky test issue for: ${testName}`);

  // Check for existing flaky test issue
  const searchQuery = `"${testName}" label:flaky-test is:open`;
  const existingIssues = await searchIssues(owner, repo, searchQuery, token);

  if (existingIssues.length > 0) {
    console.log(`[GitHub Issues] Found existing flaky test issue: #${existingIssues[0].number}`);
    return {
      number: existingIssues[0].number,
      url: existingIssues[0].html_url,
      isDuplicate: true,
    };
  }

  const template = ISSUE_TEMPLATES.flaky_test;
  const issue = await createIssue(
    owner,
    repo,
    {
      title: template.title(testName),
      body: template.body({ testName, ...data }),
      labels: template.labels,
    },
    token
  );

  return {
    ...issue,
    isDuplicate: false,
  };
}

/**
 * Create an issue for multiple test failures
 * 
 * @param {object} params - Parameters
 * @param {string} params.owner - Repository owner
 * @param {string} params.repo - Repository name
 * @param {object} params.data - Multiple failures data
 * @param {string} params.token - GitHub token
 * @returns {Promise<object>} Created issue
 */
export async function createMultipleFailuresIssue({
  owner,
  repo,
  data,
  token,
}) {
  console.log(`[GitHub Issues] Creating multiple failures issue`);

  const template = ISSUE_TEMPLATES.multiple_failures;
  const issue = await createIssue(
    owner,
    repo,
    {
      title: template.title(data.failedTests.length),
      body: template.body(data),
      labels: template.labels,
    },
    token
  );

  return issue;
}

/**
 * Create a manual issue
 * 
 * @param {object} params - Parameters
 * @param {string} params.owner - Repository owner
 * @param {string} params.repo - Repository name
 * @param {string} params.title - Issue title
 * @param {object} params.data - Issue data
 * @param {string[]} params.labels - Additional labels
 * @param {string} params.token - GitHub token
 * @returns {Promise<object>} Created issue
 */
export async function createManualIssue({
  owner,
  repo,
  title,
  data,
  labels = [],
  token,
}) {
  console.log(`[GitHub Issues] Creating manual issue: ${title}`);

  const template = ISSUE_TEMPLATES.manual;
  const issue = await createIssue(
    owner,
    repo,
    {
      title: template.title(title),
      body: template.body(data),
      labels: [...template.labels, ...labels],
    },
    token
  );

  return issue;
}

/**
 * Analyze test results and create issues automatically
 * 
 * @param {object} params - Parameters
 * @param {string} params.owner - Repository owner
 * @param {string} params.repo - Repository name
 * @param {object} params.results - Test results
 * @param {string} params.runId - Run ID
 * @param {string} params.prUrl - PR URL
 * @param {string} params.token - GitHub token
 * @param {object} params.options - Options
 * @returns {Promise<Array>} Created issues
 */
export async function autoCreateIssues({
  owner,
  repo,
  results,
  runId,
  prUrl,
  token,
  options = {},
}) {
  const {
    createForSingleFailure = true,
    createForMultipleFailures = true,
    multipleFailuresThreshold = 3,
  } = options;

  console.log(`[GitHub Issues] Auto-creating issues for run ${runId}`);

  const { stats, tests } = results;
  const failedTests = tests.filter(t => t.state === 'failed');
  const createdIssues = [];

  // If multiple failures, create a single issue
  if (createForMultipleFailures && failedTests.length >= multipleFailuresThreshold) {
    const issue = await createMultipleFailuresIssue({
      owner,
      repo,
      data: {
        failedTests: failedTests.map(t => ({
          name: t.fullTitle,
          file: t.file,
          errorMessage: t.err?.message || 'Unknown error',
          duration: t.duration,
        })),
        runId,
        prUrl,
        timestamp: Date.now(),
        totalTests: stats.tests,
        passed: stats.passes,
        failed: stats.failures,
        skipped: stats.pending,
        duration: stats.duration,
      },
      token,
    });

    createdIssues.push(issue);
  } else if (createForSingleFailure) {
    // Create individual issues for each failure
    for (const test of failedTests) {
      const issue = await createTestFailureIssue({
        owner,
        repo,
        testName: test.fullTitle,
        data: {
          runId,
          prUrl,
          timestamp: Date.now(),
          errorMessage: test.err?.message || 'Unknown error',
          stackTrace: test.err?.stack,
          testFile: test.file,
          duration: test.duration,
        },
        token,
      });

      createdIssues.push(issue);
    }
  }

  console.log(`[GitHub Issues] Created ${createdIssues.length} issue(s)`);

  return createdIssues;
}

/**
 * Add a comment to an existing issue
 * 
 * @param {object} params - Parameters
 * @param {string} params.owner - Repository owner
 * @param {string} params.repo - Repository name
 * @param {number} params.issueNumber - Issue number
 * @param {string} params.comment - Comment body
 * @param {string} params.token - GitHub token
 * @returns {Promise<object>} Created comment
 */
export async function addIssueComment({
  owner,
  repo,
  issueNumber,
  comment,
  token,
}) {
  console.log(`[GitHub Issues] Adding comment to issue #${issueNumber}`);

  const url = `https://api.github.com/repos/${owner}/${repo}/issues/${issueNumber}/comments`;

  const headers = {
    'Accept': 'application/vnd.github.v3+json',
    'Authorization': `Bearer ${token}`,
    'User-Agent': 'QAAI-Runner',
    'Content-Type': 'application/json',
  };

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({ body: comment }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`GitHub API error: ${response.status} ${error}`);
  }

  const created = await response.json();
  console.log(`[GitHub Issues] Comment added: ${created.html_url}`);

  return {
    id: created.id,
    url: created.html_url,
  };
}