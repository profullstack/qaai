/**
 * GitHub API Utilities
 * 
 * Functions for interacting with GitHub API:
 * - Fetch PR diffs
 * - Get file contents
 * - Create issues
 * - Post check runs
 */

/**
 * Parse GitHub PR URL to extract owner, repo, and PR number
 * 
 * @param {string} prUrl - GitHub PR URL (e.g., https://github.com/owner/repo/pull/123)
 * @returns {object} Parsed PR info
 */
export function parsePRUrl(prUrl) {
  const match = prUrl.match(/github\.com\/([^\/]+)\/([^\/]+)\/pull\/(\d+)/);
  
  if (!match) {
    throw new Error(`Invalid GitHub PR URL: ${prUrl}`);
  }
  
  return {
    owner: match[1],
    repo: match[2],
    prNumber: parseInt(match[3], 10),
  };
}

/**
 * Fetch PR diff from GitHub
 * 
 * @param {string} prUrl - GitHub PR URL
 * @param {string} token - GitHub token (optional, for private repos)
 * @returns {Promise<string>} PR diff in unified format
 */
export async function fetchPRDiff(prUrl, token = null) {
  const { owner, repo, prNumber } = parsePRUrl(prUrl);
  
  const url = `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}`;
  
  const headers = {
    'Accept': 'application/vnd.github.v3.diff',
    'User-Agent': 'QAAI-Runner',
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  console.log(`[GitHub] Fetching PR diff: ${owner}/${repo}#${prNumber}`);
  
  const response = await fetch(url, { headers });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`GitHub API error: ${response.status} ${error}`);
  }
  
  const diff = await response.text();
  console.log(`[GitHub] Fetched diff (${diff.length} bytes)`);
  
  return diff;
}

/**
 * Fetch PR metadata from GitHub
 * 
 * @param {string} prUrl - GitHub PR URL
 * @param {string} token - GitHub token (optional)
 * @returns {Promise<object>} PR metadata
 */
export async function fetchPRMetadata(prUrl, token = null) {
  const { owner, repo, prNumber } = parsePRUrl(prUrl);
  
  const url = `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}`;
  
  const headers = {
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent': 'QAAI-Runner',
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  console.log(`[GitHub] Fetching PR metadata: ${owner}/${repo}#${prNumber}`);
  
  const response = await fetch(url, { headers });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`GitHub API error: ${response.status} ${error}`);
  }
  
  const pr = await response.json();
  
  return {
    title: pr.title,
    body: pr.body,
    state: pr.state,
    author: pr.user.login,
    baseBranch: pr.base.ref,
    headBranch: pr.head.ref,
    headSha: pr.head.sha,
    createdAt: pr.created_at,
    updatedAt: pr.updated_at,
    changedFiles: pr.changed_files,
    additions: pr.additions,
    deletions: pr.deletions,
  };
}

/**
 * Fetch file contents from GitHub repository
 * 
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @param {string} path - File path
 * @param {string} ref - Git ref (branch, tag, or commit SHA)
 * @param {string} token - GitHub token (optional)
 * @returns {Promise<string>} File contents
 */
export async function fetchFileContents(owner, repo, path, ref = 'main', token = null) {
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${ref}`;
  
  const headers = {
    'Accept': 'application/vnd.github.v3.raw',
    'User-Agent': 'QAAI-Runner',
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  console.log(`[GitHub] Fetching file: ${owner}/${repo}/${path}@${ref}`);
  
  const response = await fetch(url, { headers });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`GitHub API error: ${response.status} ${error}`);
  }
  
  return await response.text();
}

/**
 * Create a GitHub issue
 * 
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @param {object} issue - Issue data
 * @param {string} issue.title - Issue title
 * @param {string} issue.body - Issue body
 * @param {string[]} issue.labels - Issue labels
 * @param {string} token - GitHub token (required)
 * @returns {Promise<object>} Created issue
 */
export async function createIssue(owner, repo, issue, token) {
  if (!token) {
    throw new Error('GitHub token is required to create issues');
  }
  
  const url = `https://api.github.com/repos/${owner}/${repo}/issues`;
  
  const headers = {
    'Accept': 'application/vnd.github.v3+json',
    'Authorization': `Bearer ${token}`,
    'User-Agent': 'QAAI-Runner',
    'Content-Type': 'application/json',
  };
  
  console.log(`[GitHub] Creating issue: ${owner}/${repo} - ${issue.title}`);
  
  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      title: issue.title,
      body: issue.body,
      labels: issue.labels || [],
    }),
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`GitHub API error: ${response.status} ${error}`);
  }
  
  const created = await response.json();
  console.log(`[GitHub] Issue created: #${created.number}`);
  
  return {
    number: created.number,
    url: created.html_url,
    id: created.id,
  };
}

/**
 * Create or update a GitHub check run
 * 
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @param {object} check - Check run data
 * @param {string} check.name - Check name
 * @param {string} check.headSha - Commit SHA
 * @param {string} check.status - Status (queued, in_progress, completed)
 * @param {string} check.conclusion - Conclusion (success, failure, etc.)
 * @param {string} check.title - Title
 * @param {string} check.summary - Summary
 * @param {string} token - GitHub token (required)
 * @returns {Promise<object>} Check run
 */
export async function createCheckRun(owner, repo, check, token) {
  if (!token) {
    throw new Error('GitHub token is required to create check runs');
  }
  
  const url = `https://api.github.com/repos/${owner}/${repo}/check-runs`;
  
  const headers = {
    'Accept': 'application/vnd.github.v3+json',
    'Authorization': `Bearer ${token}`,
    'User-Agent': 'QAAI-Runner',
    'Content-Type': 'application/json',
  };
  
  const body = {
    name: check.name,
    head_sha: check.headSha,
    status: check.status,
  };
  
  if (check.status === 'completed') {
    body.conclusion = check.conclusion;
    body.output = {
      title: check.title,
      summary: check.summary,
    };
  }
  
  console.log(`[GitHub] Creating check run: ${owner}/${repo} - ${check.name}`);
  
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
  console.log(`[GitHub] Check run created: ${created.id}`);
  
  return {
    id: created.id,
    url: created.html_url,
  };
}

/**
 * Search for existing issues to avoid duplicates
 * 
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @param {string} query - Search query
 * @param {string} token - GitHub token (optional)
 * @returns {Promise<Array>} Matching issues
 */
export async function searchIssues(owner, repo, query, token = null) {
  const searchQuery = `repo:${owner}/${repo} is:issue ${query}`;
  const url = `https://api.github.com/search/issues?q=${encodeURIComponent(searchQuery)}`;
  
  const headers = {
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent': 'QAAI-Runner',
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  console.log(`[GitHub] Searching issues: ${searchQuery}`);
  
  const response = await fetch(url, { headers });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`GitHub API error: ${response.status} ${error}`);
  }
  
  const data = await response.json();
  return data.items || [];
}