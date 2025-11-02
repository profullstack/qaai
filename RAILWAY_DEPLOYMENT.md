# Railway Deployment Guide for QAAI

This guide explains how to deploy both the web app (qaai.dev) and the runner service to Railway.

## Overview

QAAI consists of **two separate services** that need to be deployed:

1. **Web App** (`apps/web`) - Next.js application for the UI and API
2. **Runner Service** (`services/runner`) - Background worker for test execution

## Prerequisites

- Railway account (https://railway.app)
- GitHub repository with QAAI code
- Supabase project set up
- LLM API keys (OpenAI, Claude, or Ollama)

## Deployment Steps

### Step 1: Create Railway Project

1. Go to https://railway.app/dashboard
2. Click "New Project"
3. Select "Deploy from GitHub repo"
4. Choose your QAAI repository
5. Railway will create a project

### Step 2: Deploy Web App Service

#### 2.1 Configure Web Service

In Railway dashboard:

1. Click on the service that was created
2. Go to "Settings" tab
3. Rename service to "qaai-web"
4. Under "Build", ensure it's using the root `railway.json` config

#### 2.2 Set Environment Variables

Go to "Variables" tab and add:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# App
NODE_ENV=production
APP_URL=${{RAILWAY_PUBLIC_DOMAIN}}

# Storage
ARTIFACTS_BUCKET=artifacts

# GitHub (if using GitHub integration)
GITHUB_APP_ID=your-app-id
GITHUB_APP_PRIVATE_KEY_B64=your-base64-encoded-private-key
GITHUB_WEBHOOK_SECRET=your-webhook-secret
```

#### 2.3 Deploy

1. Click "Deploy" or push to your GitHub repo
2. Railway will automatically build and deploy
3. Once deployed, you'll get a URL like `https://qaai-web.up.railway.app`

### Step 3: Deploy Runner Service

#### 3.1 Add New Service

1. In your Railway project, click "+ New"
2. Select "Empty Service"
3. Name it "qaai-runner"

#### 3.2 Configure Runner Service

1. Go to "Settings" tab
2. Under "Source", connect to your GitHub repo
3. Under "Build":
   - Builder: **DOCKERFILE**
   - Dockerfile Path: `services/runner/Dockerfile`
   - Build Command: (leave empty, Dockerfile handles it)

4. Under "Deploy":
   - Start Command: (leave empty, Dockerfile handles it)
   - No health check needed (background service)

#### 3.3 Set Environment Variables

Go to "Variables" tab and add:

```env
# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Runner Configuration
RUNNER_CONCURRENCY=3
RUNNER_POLL_INTERVAL_MS=3000
PLAYWRIGHT_HEADLESS=true
NODE_ENV=production

# App URL (for testing)
APP_BASE_URL_DEFAULT=https://qaai-web.up.railway.app

# LLM Provider (choose one)
LLM_PROVIDER=openai

# OpenAI (if using)
OPENAI_API_KEY=your-openai-key
OPENAI_MODEL=gpt-4o-mini

# Anthropic Claude (if using)
ANTHROPIC_API_KEY=your-anthropic-key
ANTHROPIC_MODEL=claude-sonnet-4

# Ollama (if using local)
OLLAMA_BASE_URL=http://your-ollama-server:11434
OLLAMA_MODEL=llama3.1

# GitHub
GITHUB_APP_ID=your-app-id
GITHUB_APP_PRIVATE_KEY_B64=your-base64-encoded-private-key

# Storage
ARTIFACTS_BUCKET=artifacts
```

#### 3.4 Deploy

1. Click "Deploy"
2. Railway will build the Docker image and start the runner
3. Check logs to verify it's polling for jobs

## Alternative: Using Railway CLI

### Deploy Web App

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Link to project
railway link

# Deploy web service
railway up --service qaai-web

# Set environment variables
railway variables set NEXT_PUBLIC_SUPABASE_URL=https://...
railway variables set NEXT_PUBLIC_SUPABASE_ANON_KEY=...
# ... (add all variables)
```

### Deploy Runner Service

```bash
# Create new service
railway service create qaai-runner

# Deploy with Dockerfile
railway up --service qaai-runner --dockerfile services/runner/Dockerfile

# Set environment variables
railway variables set SUPABASE_URL=https://...
railway variables set SUPABASE_SERVICE_ROLE_KEY=...
# ... (add all variables)
```

## Verification

### Web App

1. Visit your Railway URL (e.g., `https://qaai-web.up.railway.app`)
2. You should see the login page
3. Sign up and create an organization
4. Create a project

### Runner Service

1. Check Railway logs for the runner service
2. You should see:
   ```
   QAAI Runner Service
   Database connection successful!
   Starting job polling...
   ```
3. Create a test run in the UI
4. Verify the runner picks up the job

## Troubleshooting

### Web App Won't Start

**Check:**
- Environment variables are set correctly
- Supabase URL and keys are valid
- Build logs for errors

**Fix:**
```bash
railway logs --service qaai-web
```

### Runner Service Won't Start

**Check:**
- Dockerfile path is correct: `services/runner/Dockerfile`
- Environment variables include SUPABASE_SERVICE_ROLE_KEY
- LLM provider credentials are set

**Fix:**
```bash
railway logs --service qaai-runner
```

### Database Connection Errors

**Check:**
- Supabase project is not paused
- Service role key has correct permissions
- Database schema has been applied

**Fix:**
- Run `infra/supabase/schema.sql` in Supabase SQL Editor
- Run `infra/supabase/policies.sql` in Supabase SQL Editor

## Custom Domain Setup

### For qaai.dev

1. In Railway dashboard, go to qaai-web service
2. Click "Settings" → "Domains"
3. Click "Custom Domain"
4. Enter `qaai.dev`
5. Add the CNAME record to your DNS:
   ```
   CNAME qaai.dev → your-railway-domain.up.railway.app
   ```
6. Wait for DNS propagation (5-30 minutes)

## Monitoring

### Web App Metrics

- Response times
- Error rates
- Active users
- API endpoint usage

### Runner Service Metrics

- Job queue depth
- Processing time per job
- Success/failure rates
- Resource usage

## Scaling

### Web App

Railway auto-scales based on traffic. For manual scaling:
1. Go to service settings
2. Adjust "Replicas" (horizontal scaling)
3. Adjust "Resources" (vertical scaling)

### Runner Service

To handle more concurrent jobs:
1. Increase `RUNNER_CONCURRENCY` environment variable
2. Or deploy multiple runner instances
3. Each will poll independently

## Cost Optimization

### Development

- Use Hobby plan ($5/month)
- Single web instance
- Single runner instance
- Supabase free tier

### Production

- Use Pro plan ($20/month)
- Multiple web instances for redundancy
- 2-3 runner instances for throughput
- Supabase Pro tier

## Next Steps

1. ✅ Deploy web app to Railway
2. ✅ Deploy runner service to Railway
3. ✅ Configure custom domain (qaai.dev)
4. ✅ Set up monitoring and alerts
5. ✅ Test end-to-end flow
6. ✅ Configure GitHub App webhook URL
7. ✅ Start using QAAI for your projects!

---

**Need help?** Check the logs, verify environment variables, and ensure Supabase is configured correctly.