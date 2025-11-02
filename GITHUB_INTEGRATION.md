# GitHub Integration Guide

This guide explains how to set up and use QAAI's GitHub integration for automated PR testing, check runs, and issue creation.

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Setup](#setup)
  - [1. Create a GitHub App](#1-create-a-github-app)
  - [2. Configure Environment Variables](#2-configure-environment-variables)
  - [3. Install the GitHub App](#3-install-the-github-app)
  - [4. Configure Your Project](#4-configure-your-project)
- [How It Works](#how-it-works)
- [API Endpoints](#api-endpoints)
- [Issue Templates](#issue-templates)
- [Troubleshooting](#troubleshooting)

## Overview

QAAI integrates with GitHub to provide:

- **Automated PR Testing**: Automatically run tests when PRs are opened or updated
- **GitHub Checks**: Post test results as check runs on PRs
- **Issue Creation**: Automatically create issues for test failures
- **Manual Issue Creation**: Create issues manually from the UI or API

## Features

### 1. Webhook Handler

The webhook handler (`/api/webhooks/github`) processes GitHub events:

- `pull_request` (opened, synchronize, reopened)
- `check_suite` (requested, rerequested)
- `check_run` (rerequested)

When a PR event is received, QAAI:
1. Verifies the webhook signature
2. Creates a new test run
3. Queues the run for execution
4. Returns immediately (async processing)

### 2. GitHub Checks Reporter

After tests complete, QAAI posts results as GitHub check runs:

- ✅ **Success**: All tests passed
- ❌ **Failure**: One or more tests failed
- 📊 **Detailed Summary**: Test counts, duration, and failure details
- 🔗 **Annotations**: Failed tests with error messages and stack traces

### 3. Automatic Issue Creation

QAAI can automatically create GitHub issues for:

- **Single Test Failures**: Individual issues for each failed test
- **Multiple Test Failures**: Single issue summarizing all failures
- **Flaky Tests**: Issues for tests that fail intermittently

### 4. Manual Issue Creation

Create issues manually via:
- Web UI (coming soon)
- REST API (`POST /api/issues`)

## Setup

### 1. Create a GitHub App

1. Go to GitHub Settings → Developer settings → GitHub Apps → New GitHub App

2. **Basic Information**:
   - **Name**: `QAAI Test Runner` (or your preferred name)
   - **Homepage URL**: Your QAAI instance URL (e.g., `https://qaai.example.com`)
   - **Webhook URL**: `https://qaai.example.com/api/webhooks/github`
   - **Webhook Secret**: Generate a secure random string (save this!)

3. **Permissions**:
   - **Repository permissions**:
     - Checks: Read & Write
     - Contents: Read-only
     - Issues: Read & Write
     - Pull requests: Read-only
   - **Subscribe to events**:
     - Check run
     - Check suite
     - Pull request

4. **Where can this GitHub App be installed?**:
   - Choose "Any account" or "Only on this account"

5. Click **Create GitHub App**

6. **Generate a private key**:
   - Scroll down to "Private keys"
   - Click "Generate a private key"
   - Save the downloaded `.pem` file securely

7. **Note your App ID**:
   - Found at the top of the app settings page

### 2. Configure Environment Variables

Add these to your `.env` file:

```bash
# GitHub App Configuration
GITHUB_APP_ID=123456
GITHUB_APP_PRIVATE_KEY_B64=<base64-encoded-private-key>
GITHUB_WEBHOOK_SECRET=<your-webhook-secret>
GITHUB_TOKEN=<optional-personal-access-token>
```

**To encode your private key**:

```bash
# Linux/Mac
cat your-app.private-key.pem | base64 -w 0

# Or use Node.js
node -e "console.log(require('fs').readFileSync('your-app.private-key.pem', 'utf8').toString('base64'))"
```

### 3. Install the GitHub App

1. Go to your GitHub App settings
2. Click "Install App" in the left sidebar
3. Choose the account/organization
4. Select repositories:
   - All repositories, or
   - Only select repositories
5. Click "Install"

6. **Note your Installation ID**:
   - After installation, check the URL: `https://github.com/settings/installations/12345678`
   - The number at the end is your installation ID

7. Add to `.env`:
   ```bash
   GITHUB_INSTALLATION_ID=12345678
   ```

### 4. Configure Your Project

In the QAAI web interface:

1. Go to your project settings
2. Add GitHub repository information:
   - **Repository**: `owner/repo` (e.g., `acme/my-app`)
   - **GitHub Token**: Optional, for private repos
3. Enable automatic issue creation (optional):
   - Toggle "Auto-create issues for failures"
   - Configure issue labels

Or via API:

```bash
curl -X PATCH https://qaai.example.com/api/projects/PROJECT_ID \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "github_repo": "owner/repo",
    "auto_create_issues": true,
    "issue_labels": ["qa-automated", "bug"]
  }'
```

## How It Works

### Workflow

```
1. Developer opens/updates PR
   ↓
2. GitHub sends webhook to QAAI
   ↓
3. QAAI creates test run and queues job
   ↓
4. QAAI creates "pending" check on PR
   ↓
5. Runner executes tests
   ↓
6. Runner posts results as check run
   ↓
7. If failures, create GitHub issues (optional)
```

### Check Run Lifecycle

1. **Queued**: Test run created, waiting to start
2. **In Progress**: Tests are running
3. **Completed**: Tests finished
   - **Success**: All tests passed ✅
   - **Failure**: One or more tests failed ❌

### Issue Creation Logic

**Single Failure Mode** (≤2 failures):
- Creates individual issues for each failed test
- Checks for duplicates before creating
- Includes error message, stack trace, and PR link

**Multiple Failures Mode** (≥3 failures):
- Creates single issue summarizing all failures
- Lists all failed tests with errors
- Includes run statistics and PR link

**Flaky Test Detection**:
- Tracks test failure rates over time
- Creates "flaky test" issues when threshold exceeded
- Suggests remediation steps

## API Endpoints

### Webhook Endpoint

```
POST /api/webhooks/github
```

Receives GitHub webhook events. Automatically called by GitHub.

**Headers**:
- `X-GitHub-Event`: Event type (e.g., `pull_request`)
- `X-GitHub-Delivery`: Unique delivery ID
- `X-Hub-Signature-256`: HMAC signature for verification

### Create Issue

```
POST /api/issues
```

Manually create a GitHub issue.

**Request Body**:
```json
{
  "project_id": "uuid",
  "run_id": "uuid",
  "title": "Test failure in login flow",
  "description": "The login test is failing consistently...",
  "labels": ["bug", "high-priority"]
}
```

**Response**:
```json
{
  "success": true,
  "issue": {
    "number": 123,
    "url": "https://github.com/owner/repo/issues/123",
    "title": "Test failure in login flow"
  }
}
```

### List Issues

```
GET /api/issues?project_id=uuid&run_id=uuid
```

List GitHub issues created by QAAI.

**Response**:
```json
{
  "issues": [
    {
      "id": "uuid",
      "issue_number": 123,
      "issue_url": "https://github.com/owner/repo/issues/123",
      "title": "Test Failure: Login with valid credentials",
      "issue_type": "test_failure",
      "created_at": "2024-01-15T10:30:00Z"
    }
  ]
}
```

## Issue Templates

QAAI uses different templates for different failure types:

### Test Failure Template

```markdown
## Test Failure Report

**Test:** Login with valid credentials
**Status:** Failed
**PR:** https://github.com/owner/repo/pull/123
**Run ID:** abc-123

### Error Message
```
Expected element to be visible
```

### Stack Trace
...

### Suggested Actions
- Review the error message and stack trace
- Check recent changes in the PR
- Verify test environment configuration
```

### Flaky Test Template

```markdown
## Flaky Test Report

**Test:** Login with valid credentials
**Failure Rate:** 25% (5/20 runs)
**First Failure:** 2024-01-10
**Last Failure:** 2024-01-15

### Recent Failures
1. Run abc-123 - 2024-01-15
2. Run def-456 - 2024-01-13
...

### Recommended Actions
- [ ] Review test for race conditions
- [ ] Check for timing dependencies
- [ ] Verify test isolation
```

### Multiple Failures Template

```markdown
## Multiple Test Failures (5 tests)

**PR:** https://github.com/owner/repo/pull/123
**Run ID:** abc-123

### Failed Tests
1. **Login with valid credentials**
   - Error: Expected element to be visible
2. **Logout flow**
   - Error: Navigation timeout
...

### Summary
- Total Tests: 20
- Passed: 15
- Failed: 5
```

## Troubleshooting

### Webhook Not Receiving Events

1. **Check webhook URL**: Ensure it's publicly accessible
2. **Verify webhook secret**: Must match in GitHub and `.env`
3. **Check GitHub App permissions**: Ensure all required permissions are granted
4. **View webhook deliveries**: GitHub App settings → Advanced → Recent Deliveries

### Check Runs Not Appearing

1. **Verify GitHub token**: Must have `checks:write` permission
2. **Check installation ID**: Must be correct in `.env`
3. **Review logs**: Check runner logs for errors
4. **Test manually**: Use GitHub API to create a test check run

### Issues Not Being Created

1. **Check auto-create setting**: Must be enabled in project settings
2. **Verify GitHub token**: Must have `issues:write` permission
3. **Check repository**: Must match project configuration
4. **Review logs**: Check for API errors in runner logs

### Signature Verification Failing

1. **Check webhook secret**: Must match exactly
2. **Verify payload**: Ensure raw body is used for verification
3. **Check encoding**: Secret should be UTF-8 encoded
4. **Test locally**: Use GitHub's webhook testing tool

### Common Error Messages

**"Invalid signature"**
- Webhook secret mismatch
- Body not raw/buffered correctly

**"No project configured for this repository"**
- Project not linked to GitHub repo
- Repository name format incorrect

**"GitHub API error: 401"**
- Invalid or expired GitHub token
- Insufficient permissions

**"Failed to create check run"**
- Missing `checks:write` permission
- Invalid commit SHA
- Repository not accessible

## Best Practices

1. **Use a dedicated GitHub App**: Don't share with other services
2. **Rotate secrets regularly**: Update webhook secret periodically
3. **Monitor webhook deliveries**: Check for failed deliveries
4. **Set up alerts**: Monitor for repeated failures
5. **Test in staging first**: Verify setup before production
6. **Use installation tokens**: More secure than personal access tokens
7. **Limit repository access**: Only install on necessary repos
8. **Review permissions**: Grant minimum required permissions

## Security Considerations

1. **Webhook Signature Verification**: Always verify signatures
2. **Secret Storage**: Store secrets securely (environment variables, secrets manager)
3. **HTTPS Only**: Always use HTTPS for webhook URLs
4. **Rate Limiting**: Implement rate limiting on webhook endpoint
5. **Input Validation**: Validate all webhook payloads
6. **Audit Logging**: Log all webhook events and API calls
7. **Token Rotation**: Rotate GitHub tokens regularly
8. **Least Privilege**: Grant minimum required permissions

## Support

For issues or questions:
- Check the [troubleshooting section](#troubleshooting)
- Review GitHub App logs in GitHub settings
- Check QAAI runner logs
- Open an issue in the QAAI repository

## Related Documentation

- [GitHub Apps Documentation](https://docs.github.com/en/developers/apps)
- [GitHub Webhooks](https://docs.github.com/en/developers/webhooks-and-events/webhooks)
- [GitHub Checks API](https://docs.github.com/en/rest/checks)
- [GitHub Issues API](https://docs.github.com/en/rest/issues)