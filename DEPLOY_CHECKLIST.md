# QAAI Railway Deployment Checklist

Follow these steps to deploy both qaai.dev (web app) and the runner service to Railway.

## 🚀 Quick Deployment (5 Minutes)

### Step 1: Push to GitHub

```bash
cd /home/ettinger/src/profullstack.com/qaai
git add .
git commit -m "Initial QAAI platform implementation"
git push origin main
```

### Step 2: Deploy Web App (qaai.dev)

1. **Go to Railway Dashboard**
   - Visit https://railway.app/dashboard
   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Choose your QAAI repository

2. **Railway Auto-Configuration**
   - Railway will detect `railway.json` in root
   - It will use RAILPACK builder
   - Build command: `pnpm install && pnpm build:web`
   - Start command: `pnpm start:web`

3. **Set Environment Variables**
   - Click on the service → "Variables" tab
   - Add these variables:

   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   NODE_ENV=production
   ARTIFACTS_BUCKET=artifacts
   ```

4. **Deploy**
   - Click "Deploy" or it will auto-deploy
   - Wait for build to complete (~2-3 minutes)
   - Get your URL: `https://qaai-web-production.up.railway.app`

5. **Add Custom Domain (Optional)**
   - Go to "Settings" → "Domains"
   - Click "Custom Domain"
   - Enter `qaai.dev`
   - Add CNAME record to your DNS provider

### Step 3: Deploy Runner Service

1. **Add New Service**
   - In your Railway project, click "+ New"
   - Select "Empty Service"
   - Name it "qaai-runner"

2. **Connect to GitHub**
   - Click "Settings" → "Source"
   - Connect to your GitHub repo
   - Select the same repository

3. **Configure Build**
   - Railway will detect `services/runner/railway.json`
   - Builder: DOCKERFILE
   - Dockerfile path: `services/runner/Dockerfile`

4. **Set Environment Variables**
   - Click "Variables" tab
   - Add these variables:

   ```env
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   RUNNER_CONCURRENCY=3
   RUNNER_POLL_INTERVAL_MS=3000
   PLAYWRIGHT_HEADLESS=true
   NODE_ENV=production
   APP_BASE_URL_DEFAULT=https://qaai-web-production.up.railway.app
   
   # Choose your LLM provider
   LLM_PROVIDER=openai
   OPENAI_API_KEY=your-openai-key
   OPENAI_MODEL=gpt-4o-mini
   
   # GitHub
   GITHUB_APP_ID=your-app-id
   GITHUB_APP_PRIVATE_KEY_B64=your-base64-key
   
   ARTIFACTS_BUCKET=artifacts
   ```

5. **Deploy**
   - Click "Deploy"
   - Wait for Docker build (~5-7 minutes first time)
   - Check logs to verify runner is polling

## ✅ Verification

### Web App

1. Visit your Railway URL
2. You should see the QAAI login page
3. Sign up with email/password
4. Create an organization
5. Create a project

### Runner Service

1. Check Railway logs:
   ```
   QAAI Runner Service
   ============================================================
   Node Version: v20.x.x
   Environment: production
   Poll Interval: 3000ms
   ============================================================
   Testing database connection...
   Database connection successful!
   Starting job polling...
   ```

2. Create a test run in the UI
3. Watch the runner logs pick up the job

## 🔧 Troubleshooting

### Web App Issues

**Build fails:**
```bash
# Check Railway build logs
# Common issues:
# - Missing environment variables
# - Supabase connection errors
```

**App won't start:**
```bash
# Verify in Railway Variables:
NEXT_PUBLIC_SUPABASE_URL=https://...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

### Runner Service Issues

**Docker build fails:**
```bash
# Check Dockerfile path in railway.json
# Should be: services/runner/Dockerfile
```

**Runner won't connect to database:**
```bash
# Verify environment variables:
SUPABASE_URL=https://...
SUPABASE_SERVICE_ROLE_KEY=...
```

**No jobs being processed:**
```bash
# Check runner logs for errors
# Verify job queue has jobs:
# SELECT * FROM jobs_queue WHERE status = 'queued';
```

## 📊 Post-Deployment

### 1. Configure Supabase Storage

In Supabase Dashboard:
1. Go to Storage
2. Create bucket named `artifacts`
3. Set to Private
4. Policies are already in `infra/supabase/policies.sql`

### 2. Set Up GitHub App (Optional)

1. Create GitHub App at https://github.com/settings/apps/new
2. Set webhook URL to: `https://qaai.dev/api/webhooks/github`
3. Copy App ID, Private Key, Webhook Secret
4. Add to Railway environment variables
5. Install app on your repositories

### 3. Test End-to-End

1. Create a project in QAAI
2. Add a PR URL or spec
3. Let AI generate test plan
4. Generate tests
5. Run tests
6. View results and artifacts

## 🎉 Success!

Both services should now be running:
- **Web App**: https://qaai.dev (or your Railway URL)
- **Runner**: Background service (check logs)

The QAAI platform is live and ready to use! 🚀

## 📞 Support

- Check [`RAILWAY_DEPLOYMENT.md`](RAILWAY_DEPLOYMENT.md:1) for detailed instructions
- See [`QUICKSTART.md`](QUICKSTART.md:1) for local development
- Review [`USER_GUIDE.md`](USER_GUIDE.md:1) for platform usage

---

**Deployment Time:** ~10-15 minutes total
**Cost:** Railway Hobby plan ($5/month) or Pro ($20/month)