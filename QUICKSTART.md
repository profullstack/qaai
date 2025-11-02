# QAAI Platform - Quick Start Guide

Get the QAAI platform running locally in under 10 minutes.

## Prerequisites

- Node.js 20+ installed
- pnpm installed (`npm install -g pnpm`)
- Supabase account (free tier works)
- OpenAI API key (or Claude/Ollama)

## Step 1: Clone and Install

```bash
# Install all dependencies
pnpm install

# This installs:
# - apps/web (Next.js frontend)
# - services/runner (Background worker)
# - packages/playwright-tests (Test execution)
```

## Step 2: Supabase Setup

### 2.1 Create Supabase Project

1. Go to [supabase.com](https://supabase.com)
2. Create a new project
3. Wait for database to initialize

### 2.2 Run Database Migrations

```bash
# Copy the SQL from infra/supabase/schema.sql
# Paste into Supabase SQL Editor and run
```

### 2.3 Create Storage Bucket

```bash
# In Supabase Dashboard:
# Storage → New Bucket → Name: "test-artifacts" → Private
```

### 2.4 Apply RLS Policies

```bash
# Copy the SQL from infra/supabase/policies.sql
# Paste into Supabase SQL Editor and run
```

## Step 3: Environment Configuration

### 3.1 Web App Environment

Create `apps/web/.env.local`:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 3.2 Runner Service Environment

Create `services/runner/.env`:

```bash
# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# LLM Provider (choose one)
LLM_PROVIDER=openai  # or claude, ollama
LLM_MODEL=gpt-4o-mini  # optional, uses provider default

# OpenAI (if using)
OPENAI_API_KEY=sk-...

# Anthropic Claude (if using)
ANTHROPIC_API_KEY=sk-ant-...

# Ollama (if using)
OLLAMA_BASE_URL=http://localhost:11434

# Runner Config
RUNNER_POLL_INTERVAL_MS=3000
RUNNER_CONCURRENCY=3
NODE_ENV=development
```

## Step 4: Start Services

### Terminal 1: Web App

```bash
cd apps/web
pnpm dev
```

Web app runs at: http://localhost:3000

### Terminal 2: Runner Service

```bash
cd services/runner
pnpm dev
```

Runner polls for jobs every 3 seconds.

## Step 5: First Test Run

### 5.1 Sign Up

1. Go to http://localhost:3000
2. Click "Sign Up"
3. Enter email and password
4. Check email for confirmation link

### 5.2 Create Organization

1. After login, click "Create Organization"
2. Enter name (e.g., "My Company")
3. Click "Create"

### 5.3 Create Project

1. Click "New Project"
2. Fill in details:
   - Name: "Demo App"
   - Base URL: "https://example.com"
   - Description: "Test project"
3. Click "Create"

### 5.4 Create Test Plan

**Option A: From Specification**

```bash
curl -X POST http://localhost:3000/api/plans \
  -H "Content-Type: application/json" \
  -d '{
    "project_id": "your-project-id",
    "spec_md": "# Login Feature\n\nTest that users can:\n1. Navigate to login page\n2. Enter credentials\n3. Submit form\n4. See dashboard after login",
    "auto_generate": true
  }'
```

**Option B: From GitHub PR**

```bash
curl -X POST http://localhost:3000/api/plans \
  -H "Content-Type: application/json" \
  -d '{
    "project_id": "your-project-id",
    "pr_url": "https://github.com/owner/repo/pull/123",
    "auto_generate": true
  }'
```

### 5.5 Monitor Progress

Watch the runner terminal for:
```
[Planner] Starting planner for job 1
[Planner] Generating test plan with AI...
[Planner] Plan saved with ID: abc-123
[Generator] Starting generator for job 2
[Generator] Generating code for: User can login successfully
[Generator] Test file saved: tests/project-id/user-can-login.spec.js
[Runner] Starting runner for job 3
[Runner] Executing Playwright tests...
[Runner] Results: 3/3 passed
```

### 5.6 View Results

1. Go to http://localhost:3000/runs
2. Click on the latest run
3. View test results, artifacts, and traces

## Step 6: Verify Installation

### Check Database

```sql
-- In Supabase SQL Editor
SELECT * FROM organizations;
SELECT * FROM projects;
SELECT * FROM plans;
SELECT * FROM runs;
SELECT * FROM jobs_queue;
```

### Check Storage

```bash
# In Supabase Dashboard
# Storage → test-artifacts → Should see uploaded files
```

### Check Logs

```bash
# Runner logs should show:
✓ Database connection successful
✓ LLM connection test successful
✓ Job polling started
```

## Common Issues

### Issue: "Failed to connect to database"

**Solution:** Check `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in `.env`

### Issue: "LLM API error"

**Solution:** Verify API key is correct and has credits

### Issue: "No jobs being processed"

**Solution:** Check runner is running and polling interval is set

### Issue: "Artifact upload failed"

**Solution:** Verify storage bucket exists and is named "test-artifacts"

### Issue: "Tests not executing"

**Solution:** Ensure Playwright is installed in `packages/playwright-tests`

```bash
cd packages/playwright-tests
npx playwright install
```

## Architecture Overview

```
┌─────────────────┐
│   Web App       │  Next.js 15 (Port 3000)
│   (apps/web)    │  - UI for users
└────────┬────────┘  - API routes
         │
         ↓
┌─────────────────┐
│   Supabase      │  PostgreSQL + Storage
│                 │  - Database with RLS
└────────┬────────┘  - File storage
         │
         ↓
┌─────────────────┐
│  Runner Service │  Node.js Background Worker
│ (services/runner)│ - Polls job queue
└─────────────────┘  - Executes AI workflows
         │
         ↓
┌─────────────────┐
│   LLM Provider  │  OpenAI / Claude / Ollama
│                 │  - Test planning
└─────────────────┘  - Code generation
```

## Next Steps

1. **Explore the UI** - Create projects, view runs, check artifacts
2. **Test with Real PRs** - Connect to your GitHub repositories
3. **Customize Prompts** - Edit worker files to tune AI behavior
4. **Add GitHub Integration** - Set up webhooks for automatic testing
5. **Deploy to Production** - Use Railway for hosting

## Development Tips

### Hot Reload

Both services support hot reload:
- Web app: Changes auto-reload
- Runner: Uses `--watch` flag for auto-restart

### Debug Mode

```bash
# Enable verbose logging
NODE_ENV=development DEBUG=* pnpm dev
```

### Test Individual Workers

```bash
# Test planner only
node -e "import('./workers/planner.js').then(m => m.runPlanner({id:1, payload:{project_id:'test'}}))"
```

### Reset Database

```bash
# In Supabase SQL Editor
TRUNCATE organizations, projects, plans, runs, jobs_queue CASCADE;
```

## Support

- **Documentation**: See `ARCHITECTURE.md` and `IMPLEMENTATION_GUIDE.md`
- **Issues**: Check `STATUS.md` for known issues
- **Updates**: Follow `FINAL_PLAN.md` for roadmap

---

**You're ready to build AI-powered E2E tests!** 🚀