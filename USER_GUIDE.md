# QAAI User Guide

Complete guide to using the QAAI (QA AI) platform for automated E2E testing.

## Table of Contents

1. [Getting Started](#getting-started)
2. [Creating Your First Project](#creating-your-first-project)
3. [Test Generation](#test-generation)
4. [Running Tests](#running-tests)
5. [Analytics & Insights](#analytics--insights)
6. [GitHub Integration](#github-integration)
7. [Test Configuration](#test-configuration)
8. [Test Data Management](#test-data-management)
9. [Best Practices](#best-practices)
10. [Troubleshooting](#troubleshooting)

---

## Getting Started

### Prerequisites

- GitHub account
- Access to QAAI platform
- Application to test (with URL)

### Initial Setup

1. **Sign in** to QAAI using your GitHub account
2. **Create an organization** or join an existing one
3. **Set up your first project**

---

## Creating Your First Project

### Step 1: Create Organization

```
1. Navigate to "Organizations" → "New Organization"
2. Enter organization name
3. Click "Create Organization"
```

### Step 2: Create Project

```
1. Go to "Projects" → "New Project"
2. Fill in project details:
   - Name: Your project name
   - Repository URL: GitHub repository URL
   - Base URL: Application URL to test
3. Click "Create Project"
```

### Step 3: Configure GitHub Integration

```
1. Go to Project Settings → GitHub
2. Install QAAI GitHub App
3. Configure webhook settings
4. Set up issue labels (optional)
```

---

## Test Generation

QAAI can generate tests from multiple sources:

### From GitHub PR

```
1. Open a Pull Request in your repository
2. QAAI automatically detects changes
3. AI generates relevant test cases
4. Review and approve generated tests
```

### From Specification

```
1. Navigate to Project → "Generate Tests"
2. Paste specification or requirements
3. Click "Generate"
4. Review generated test plan
5. Approve or modify tests
```

### Manual Test Creation

```
1. Go to Project → "Test Suites"
2. Click "New Test Suite"
3. Add test cases manually
4. Define test steps and assertions
```

---

## Running Tests

### Manual Run

```
1. Navigate to Project → "Runs"
2. Click "New Run"
3. Select test suite(s)
4. Configure run settings
5. Click "Start Run"
```

### Automated PR Testing

Tests run automatically when:
- Pull request is opened
- Pull request is updated
- Manual rerun requested

### Scheduled Runs

```
1. Go to Project Settings → "Schedules"
2. Click "New Schedule"
3. Configure cron expression
4. Select test suites
5. Save schedule
```

---

## Analytics & Insights

### Flake Detection

**Access**: Project → Analytics → Flakes

**Features**:
- Flake rate calculation
- Statistical confidence intervals
- Pattern detection
- Recommendations

**Interpreting Results**:
- **High Risk (>30%)**: Immediate attention required
- **Medium Risk (15-30%)**: Monitor and investigate
- **Low Risk (5-15%)**: Keep watching
- **Stable (<5%)**: Healthy test

### Coverage Matrix

**Access**: Project → Coverage

**Features**:
- Route coverage tracking
- API endpoint testing status
- Coverage by category
- Trend analysis

**Using Coverage Data**:
1. Identify untested routes
2. Prioritize critical paths
3. Track coverage improvements
4. Discover new endpoints

### Test Trends

**Metrics Available**:
- Pass/fail rates over time
- Average test duration
- Flake rate trends
- Coverage progression

---

## GitHub Integration

### Check Runs

QAAI posts test results as GitHub check runs:

```
✓ QAAI Tests - 45/50 passed
  - View detailed results
  - See failed test details
  - Access artifacts
```

### Automatic Issue Creation

**Configuration**:
```
Project Settings → GitHub → Auto-create Issues
- Enable/disable
- Set failure threshold
- Configure labels
```

**Issue Types**:
- Single test failure
- Multiple test failures
- Flaky test detection
- Manual issues

### Webhooks

**Supported Events**:
- `pull_request` - PR opened/updated
- `check_suite` - Check suite requested
- `check_run` - Check run rerequested

---

## Test Configuration

### Retry Settings

**Access**: Project → Settings → Retry Configuration

**Options**:
- Number of retries (0-5)
- Retry on failure only
- Retry delay

**Recommendations**:
- Start with 2 retries
- Enable "failure only" mode
- Adjust based on flake rate

### Timeout Configuration

**Access**: Project → Settings → Timeout Configuration

**Settings**:
- **Test Timeout**: Maximum time for entire test (default: 30s)
- **Action Timeout**: Time for individual actions (default: 10s)
- **Navigation Timeout**: Time for page loads (default: 30s)

**Guidelines**:
- Increase for slow applications
- Decrease for fast, responsive apps
- Monitor timeout failures

### Execution Settings

**Parallel Execution**:
```
✓ Enable parallel execution
  Workers: 4
```

**Browser Configuration**:
```
Browsers: [Chromium, Firefox, WebKit]
Headless: ✓ Enabled
```

### Artifact Collection

**Trace**: Detailed execution trace
- Off
- Always On
- On First Retry ✓
- Retain on Failure

**Screenshots**: Visual captures
- Off
- Always On
- Only on Failure ✓

**Videos**: Test recordings
- Off
- Always On
- Retain on Failure ✓
- On First Retry

---

## Test Data Management

### Seeding Test Users

**API Endpoint**: `POST /api/test-data/seed`

**Example**:
```bash
curl -X POST https://qaai.example.com/api/test-data/seed \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "project_id": "uuid",
    "users": {
      "count": 5,
      "templates": ["admin", "user", "viewer"]
    }
  }'
```

### Test Headers

**Creating Header Sets**:
```javascript
{
  "name": "Bearer Token",
  "headers": {
    "Authorization": "Bearer test-token"
  }
}
```

### Cleanup

**Manual Cleanup**:
```
Project → Test Data → Cleanup
- Select data types
- Set age threshold
- Confirm cleanup
```

**Automated Cleanup**:
```javascript
// Before each test run
cleanup: true
```

---

## Best Practices

### Test Organization

1. **Group by Feature**: Create suites per feature
2. **Use Tags**: Tag tests for easy filtering
3. **Prioritize**: Mark critical tests
4. **Keep Small**: Aim for focused, atomic tests

### Writing Stable Tests

1. **Use Explicit Waits**: Wait for elements
2. **Avoid Hard Delays**: Use `waitFor` instead of `sleep`
3. **Handle Async**: Properly await async operations
4. **Isolate Tests**: Each test should be independent

### Flake Management

1. **Monitor Regularly**: Check analytics weekly
2. **Fix High-Risk First**: Prioritize >30% flake rate
3. **Investigate Patterns**: Look for timing issues
4. **Add Retries Judiciously**: Don't mask problems

### Coverage Strategy

1. **Start with Critical Paths**: Auth, payment, core features
2. **Expand Gradually**: Add coverage incrementally
3. **Track Progress**: Monitor coverage trends
4. **Review Regularly**: Update route definitions

---

## Troubleshooting

### Tests Failing Locally but Passing in CI

**Possible Causes**:
- Environment differences
- Timing issues
- Data dependencies

**Solutions**:
1. Check environment variables
2. Increase timeouts
3. Verify test data setup
4. Review CI logs

### High Flake Rate

**Investigation Steps**:
1. Check flake heatmap
2. Review failure patterns
3. Analyze timing issues
4. Verify test isolation

**Common Fixes**:
- Add explicit waits
- Increase timeouts
- Fix race conditions
- Improve selectors

### GitHub Integration Not Working

**Checklist**:
- [ ] GitHub App installed
- [ ] Webhook configured
- [ ] Secrets set correctly
- [ ] Repository permissions granted

**Debug Steps**:
1. Check webhook deliveries
2. Verify signature validation
3. Review API logs
4. Test with manual trigger

### Slow Test Execution

**Optimization Tips**:
1. Enable parallel execution
2. Reduce unnecessary waits
3. Optimize selectors
4. Use headless mode
5. Minimize artifact collection

### Coverage Not Updating

**Possible Issues**:
- Routes not defined
- Logs not captured
- HAR files missing

**Solutions**:
1. Define routes in project settings
2. Enable trace collection
3. Verify log output
4. Check HAR file generation

---

## API Reference

### Authentication

All API requests require authentication:

```bash
Authorization: Bearer YOUR_TOKEN
```

### Endpoints

#### Get Flake Analysis
```
GET /api/analytics/flakes?project_id={id}
```

#### Get Coverage Report
```
GET /api/analytics/coverage?project_id={id}
```

#### Seed Test Data
```
POST /api/test-data/seed
Body: { project_id, users, headers, suites }
```

#### Create Test Run
```
POST /api/runs
Body: { project_id, suite_ids, trigger }
```

---

## Support

### Getting Help

- **Documentation**: https://docs.qaai.example.com
- **GitHub Issues**: https://github.com/qaai/qaai/issues
- **Community**: https://discord.gg/qaai
- **Email**: support@qaai.example.com

### Reporting Bugs

When reporting bugs, include:
1. Steps to reproduce
2. Expected vs actual behavior
3. Screenshots/videos
4. Test logs
5. Environment details

---

## Glossary

- **Flake**: Test that exhibits non-deterministic behavior
- **Coverage**: Percentage of routes/endpoints tested
- **Artifact**: Test output (trace, screenshot, video)
- **Suite**: Collection of related test cases
- **Run**: Execution of one or more test suites
- **Check Run**: GitHub status check for PR
- **Retry**: Re-execution of failed test

---

## Changelog

### Version 1.0.0 (Current)

**Features**:
- ✅ AI-powered test generation
- ✅ Automated PR testing
- ✅ Flake detection & analytics
- ✅ Route coverage tracking
- ✅ GitHub integration
- ✅ Test data seeding
- ✅ Configurable retry/timeout
- ✅ CI/CD pipeline

**Coming Soon**:
- 🔄 Multi-browser testing
- 🔄 Visual regression testing
- 🔄 Performance testing
- 🔄 API testing
- 🔄 Mobile testing

---

*Last Updated: 2025-11-02*