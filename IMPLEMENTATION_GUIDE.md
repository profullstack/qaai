# QAAI Implementation Guide

This guide provides detailed step-by-step instructions for implementing the QAAI platform across all 6 phases.

## Prerequisites

Before starting implementation, ensure you have:

- Node.js 20+ installed
- pnpm installed globally (`npm install -g pnpm`)
- Git configured
- Supabase account (free tier is sufficient for development)
- Railway account (for deployment)
- GitHub account (for GitHub App integration)
- OpenAI/Anthropic API key OR Ollama installed locally

## Phase 1: Foundation (Skeleton)

### 1.1 Project Structure Setup

Create the monorepo structure:

```bash
mkdir qaai && cd qaai
pnpm init

# Create workspace configuration
cat > pnpm-workspace.yaml << EOF
packages:
  - 'apps/*'
  - 'services/*'
  - 'packages/*'
EOF

# Create directory structure
mkdir -p apps/web
mkdir -p services/runner
mkdir -p packages/playwright-tests
mkdir -p infra/{supabase,railway,github/workflows}
mkdir -p docs
```

### 1.2 Root Package Configuration

Create `package.json`:

```json
{
  "name": "qaai",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev:web": "pnpm --filter apps/web dev",
    "dev:runner": "pnpm --filter services/runner dev",
    "build:web": "pnpm --filter apps/web build",
    "build:runner": "pnpm --filter services/runner build",
    "db:migrate": "node scripts/migrate.js",
    "test": "pnpm -r test"
  },
  "devDependencies": {
    "prettier": "^3.1.0",
    "eslint": "^8.55.0"
  }
}
```

### 1.3 Initialize Next.js Application

```bash
cd apps/web
pnpm create next-app@latest . --typescript=false --tailwind --app --src-dir=false --import-alias="@/*"
```

Update `apps/web/package.json`:

```json
{
  "name": "web",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint"
  },
  "dependencies": {
    "next": "^15.0.0",
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "@supabase/supabase-js": "^2.39.0",
    "@supabase/ssr": "^0.1.0"
  },
  "devDependencies": {
    "autoprefixer": "^10.4.16",
    "postcss": "^8.4.32",
    "tailwindcss": "^3.4.0"
  }
}
```

### 1.4 Supabase Project Setup

1. Go to https://supabase.com/dashboard
2. Create new project
3. Note down:
   - Project URL
   - Anon/Public key
   - Service role key (keep secret!)

Create `.env.local` in `apps/web/`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### 1.5 Database Schema

Create `infra/supabase/schema.sql`:

```sql
-- Enable extensions
create extension if not exists pgcrypto;
create extension if not exists pg_trgm;

-- Organizations
create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz default now()
);

-- Organization members
create table org_members (
  org_id uuid references organizations(id) on delete cascade,
  user_id uuid not null,
  role text check (role in ('owner','admin','member')) default 'member',
  primary key (org_id, user_id)
);

-- Projects
create table projects (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) on delete cascade,
  name text not null,
  repo_url text,
  app_base_url text,
  env_json jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

-- Test suites
create table suites (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  name text not null,
  tags text[] default '{}',
  created_at timestamptz default now()
);

-- Test cases
create table test_cases (
  id uuid primary key default gen_random_uuid(),
  suite_id uuid references suites(id) on delete cascade,
  title text not null,
  priority int default 2,
  steps jsonb not null,
  source text check (source in ('ai','manual')) default 'ai',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- AI test plans
create table plans (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  pr_url text,
  spec_md text,
  plan_json jsonb not null,
  status text default 'draft',
  created_by uuid,
  created_at timestamptz default now()
);

-- Test runs
create table runs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  plan_id uuid references plans(id),
  suite_ids uuid[] default '{}',
  trigger text check (trigger in ('manual','pr','schedule','api')) default 'manual',
  status text check (status in ('queued','running','passed','failed','error')) default 'queued',
  started_at timestamptz,
  finished_at timestamptz,
  meta jsonb default '{}'::jsonb
);

-- Individual test results
create table run_tests (
  id uuid primary key default gen_random_uuid(),
  run_id uuid references runs(id) on delete cascade,
  test_case_id uuid,
  status text check (status in ('queued','running','passed','failed','flaky','skipped','error')) default 'queued',
  attempt int default 0,
  duration_ms int,
  junit_path text,
  trace_path text,
  video_path text,
  screenshot_path text,
  logs text,
  error_text text,
  created_at timestamptz default now()
);

-- Job queue
create table jobs_queue (
  id bigserial primary key,
  kind text check (kind in ('plan','generate','run')) not null,
  payload jsonb not null,
  status text check (status in ('queued','running','done','error')) default 'queued',
  attempts int default 0,
  last_error text,
  scheduled_at timestamptz default now(),
  locked_by text,
  locked_at timestamptz
);

-- Indexes for performance
create index idx_org_members_user on org_members(user_id);
create index idx_projects_org on projects(org_id);
create index idx_suites_project on suites(project_id);
create index idx_test_cases_suite on test_cases(suite_id);
create index idx_plans_project on plans(project_id);
create index idx_runs_project on runs(project_id);
create index idx_run_tests_run on run_tests(run_id);
create index idx_jobs_status on jobs_queue(status, scheduled_at);
```

Create `infra/supabase/policies.sql`:

```sql
-- Enable RLS on all tables
alter table organizations enable row level security;
alter table org_members enable row level security;
alter table projects enable row level security;
alter table suites enable row level security;
alter table test_cases enable row level security;
alter table plans enable row level security;
alter table runs enable row level security;
alter table run_tests enable row level security;

-- Helper view for user's organizations
create or replace view my_orgs as
select o.* from organizations o
join org_members m on m.org_id = o.id
where m.user_id = auth.uid();

-- Organizations: users can see orgs they're members of
create policy "org_select" on organizations for select
using (exists (
  select 1 from org_members m 
  where m.org_id = id and m.user_id = auth.uid()
));

-- Org members: users can see members of their orgs
create policy "org_members_select" on org_members for select
using (exists (
  select 1 from org_members m 
  where m.org_id = org_id and m.user_id = auth.uid()
));

-- Projects: scoped to user's orgs
create policy "projects_all" on projects for all
using (exists (
  select 1 from org_members m 
  where m.org_id = projects.org_id and m.user_id = auth.uid()
));

-- Suites: scoped via project
create policy "suites_all" on suites for all
using (exists (
  select 1 from projects p
  join org_members m on m.org_id = p.org_id
  where p.id = suites.project_id and m.user_id = auth.uid()
));

-- Test cases: scoped via suite
create policy "test_cases_all" on test_cases for all
using (exists (
  select 1 from suites s
  join projects p on p.id = s.project_id
  join org_members m on m.org_id = p.org_id
  where s.id = test_cases.suite_id and m.user_id = auth.uid()
));

-- Plans: scoped via project
create policy "plans_all" on plans for all
using (exists (
  select 1 from projects p
  join org_members m on m.org_id = p.org_id
  where p.id = plans.project_id and m.user_id = auth.uid()
));

-- Runs: scoped via project
create policy "runs_all" on runs for all
using (exists (
  select 1 from projects p
  join org_members m on m.org_id = p.org_id
  where p.id = runs.project_id and m.user_id = auth.uid()
));

-- Run tests: scoped via run
create policy "run_tests_all" on run_tests for all
using (exists (
  select 1 from runs r
  join projects p on p.id = r.project_id
  join org_members m on m.org_id = p.org_id
  where r.id = run_tests.run_id and m.user_id = auth.uid()
));
```

Run migrations in Supabase SQL Editor:
1. Copy contents of `schema.sql` and execute
2. Copy contents of `policies.sql` and execute

### 1.6 Storage Buckets

In Supabase Dashboard → Storage:

1. Create bucket `artifacts`
2. Set to Private
3. Add policy for authenticated reads:

```sql
create policy "Authenticated users can read artifacts"
on storage.objects for select
using (bucket_id = 'artifacts' and auth.role() = 'authenticated');

create policy "Service role can manage artifacts"
on storage.objects for all
using (bucket_id = 'artifacts' and auth.role() = 'service_role');
```

### 1.7 Supabase Client Setup

Create `apps/web/lib/supabase-client.js`:

```javascript
import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}
```

Create `apps/web/lib/supabase-server.js`:

```javascript
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export function createClient() {
  const cookieStore = cookies();
  
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        get(name) {
          return cookieStore.get(name)?.value;
        },
      },
    }
  );
}

export function createServiceClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        persistSession: false,
      },
    }
  );
}
```

### 1.8 Authentication Middleware

Create `apps/web/middleware.js`:

```javascript
import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';

export async function middleware(request) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        get(name) {
          return request.cookies.get(name)?.value;
        },
        set(name, value, options) {
          request.cookies.set({ name, value, ...options });
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          });
          response.cookies.set({ name, value, ...options });
        },
        remove(name, options) {
          request.cookies.set({ name, value: '', ...options });
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          });
          response.cookies.set({ name, value: '', ...options });
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  // Redirect to login if not authenticated
  if (!user && !request.nextUrl.pathname.startsWith('/login')) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Redirect to dashboard if authenticated and on login page
  if (user && request.nextUrl.pathname === '/login') {
    return NextResponse.redirect(new URL('/', request.url));
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
```

### 1.9 Base UI Components

Create `apps/web/components/Nav.js`:

```javascript
'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase-client';

export default function Nav() {
  const router = useRouter();
  const supabase = createClient();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  return (
    <nav className="bg-white shadow-sm border-b">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex">
            <Link href="/" className="flex items-center text-xl font-bold text-gray-900">
              QAAI
            </Link>
            <div className="ml-10 flex items-center space-x-4">
              <Link href="/" className="text-gray-700 hover:text-gray-900">
                Dashboard
              </Link>
              <Link href="/projects" className="text-gray-700 hover:text-gray-900">
                Projects
              </Link>
              <Link href="/runs" className="text-gray-700 hover:text-gray-900">
                Runs
              </Link>
            </div>
          </div>
          <div className="flex items-center">
            <button
              onClick={handleSignOut}
              className="text-gray-700 hover:text-gray-900"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
```

Create `apps/web/app/layout.js`:

```javascript
import './globals.css';
import Nav from '@/components/Nav';

export const metadata = {
  title: 'QAAI - AI-Driven QA Platform',
  description: 'Automated E2E testing with AI',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <Nav />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {children}
        </main>
      </body>
    </html>
  );
}
```

Create `apps/web/app/page.js`:

```javascript
import { createClient } from '@/lib/supabase-server';

export default async function Dashboard() {
  const supabase = createClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  
  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Dashboard</h1>
      <p className="text-gray-600">Welcome, {user?.email}</p>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-2">Recent Runs</h3>
          <p className="text-3xl font-bold text-blue-600">0</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-2">Pass Rate</h3>
          <p className="text-3xl font-bold text-green-600">0%</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-2">Flake Rate</h3>
          <p className="text-3xl font-bold text-yellow-600">0%</p>
        </div>
      </div>
    </div>
  );
}
```

Create `apps/web/app/login/page.js`:

```javascript
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase-client';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const router = useRouter();
  const supabase = createClient();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      router.push('/');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-lg shadow">
        <h2 className="text-3xl font-bold text-center">Sign in to QAAI</h2>
        
        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded">
            {error}
          </div>
        )}
        
        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              required
            />
          </div>
          
          <button
            type="submit"
            disabled={loading}
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
          >
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}
```

## Phase 2: Runner Infrastructure

### 2.1 Runner Service Setup

Create `services/runner/package.json`:

```json
{
  "name": "runner",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "node --watch index.js",
    "start": "node index.js"
  },
  "dependencies": {
    "@supabase/supabase-js": "^2.39.0",
    "@playwright/test": "^1.48.0",
    "dotenv": "^16.3.1"
  }
}
```

### 2.2 Job Polling System

Create `services/runner/lib/jobs.js`:

```javascript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const WORKER_ID = `worker-${process.pid}-${Date.now()}`;

export async function getJob() {
  const { data, error } = await supabase.rpc('acquire_job', {
    worker_id: WORKER_ID
  });
  
  if (error) {
    console.error('Error acquiring job:', error);
    return null;
  }
  
  return data;
}

export async function markRunning(jobId) {
  await supabase
    .from('jobs_queue')
    .update({ 
      status: 'running',
      locked_by: WORKER_ID,
      locked_at: new Date().toISOString()
    })
    .eq('id', jobId);
}

export async function markDone(jobId) {
  await supabase
    .from('jobs_queue')
    .update({ status: 'done' })
    .eq('id', jobId);
}

export async function markError(jobId, error) {
  await supabase
    .from('jobs_queue')
    .update({ 
      status: 'error',
      last_error: error,
      attempts: supabase.raw('attempts + 1')
    })
    .eq('id', jobId);
}
```

Add SQL function for job acquisition in Supabase:

```sql
create or replace function acquire_job(worker_id text)
returns table (
  id bigint,
  kind text,
  payload jsonb,
  attempts int
) as $$
begin
  return query
  update jobs_queue
  set 
    status = 'running',
    locked_by = worker_id,
    locked_at = now()
  where id = (
    select id from jobs_queue
    where status = 'queued'
    and attempts < 3
    order by scheduled_at
    limit 1
    for update skip locked
  )
  returning 
    jobs_queue.id,
    jobs_queue.kind,
    jobs_queue.payload,
    jobs_queue.attempts;
end;
$$ language plpgsql;
```

### 2.3 Playwright Configuration

Create `services/runner/playwright.config.js`:

```javascript
import { defineConfig } from '@playwright/test';

export default defineConfig({
  timeout: 60_000,
  retries: 1,
  use: {
    headless: process.env.PLAYWRIGHT_HEADLESS !== 'false',
    trace: 'on-first-retry',
    video: 'retain-on-failure',
    screenshot: 'only-on-failure',
    baseURL: process.env.APP_BASE_URL || 'http://localhost:3000',
  },
  reporter: [
    ['list'],
    ['junit', { outputFile: 'results/junit.xml' }]
  ],
});
```

### 2.4 Main Runner Loop

Create `services/runner/index.js`:

```javascript
import 'dotenv/config';
import { getJob, markRunning, markDone, markError } from './lib/jobs.js';
import { runPlanner } from './workers/planner.js';
import { runGenerator } from './workers/generator.js';
import { runRunner } from './workers/runner.js';

const POLL_INTERVAL = Number(process.env.RUNNER_POLL_INTERVAL_MS || 3000);

async function processJob() {
  try {
    const job = await getJob();
    
    if (!job) {
      return;
    }
    
    console.log(`Processing job ${job.id} of type ${job.kind}`);
    
    await markRunning(job.id);
    
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
    
    await markDone(job.id);
    console.log(`Job ${job.id} completed successfully`);
    
  } catch (error) {
    console.error('Error processing job:', error);
    if (job?.id) {
      await markError(job.id, error.stack?.slice(0, 5000));
    }
  }
}

async function loop() {
  while (true) {
    await processJob();
    await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL));
  }
}

console.log('Runner service starting...');
loop().catch(console.error);
```

Create placeholder workers:

`services/runner/workers/planner.js`:
```javascript
export async function runPlanner(job) {
  console.log('Planner worker - to be implemented in Phase 3');
  // TODO: Implement in Phase 3
}
```

`services/runner/workers/generator.js`:
```javascript
export async function runGenerator(job) {
  console.log('Generator worker - to be implemented in Phase 3');
  // TODO: Implement in Phase 3
}
```

`services/runner/workers/runner.js`:
```javascript
export async function runRunner(job) {
  console.log('Runner worker - to be implemented in Phase 2');
  // TODO: Implement basic Playwright execution
}
```

### 2.5 Dockerfile for Runner

Create `services/runner/Dockerfile`:

```dockerfile
FROM mcr.microsoft.com/playwright:v1.48.0-jammy

WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy package files
COPY package.json pnpm-lock.yaml ./
COPY services/runner/package.json ./services/runner/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY services/runner ./services/runner
COPY packages ./packages

# Set environment
ENV NODE_ENV=production

# Run the service
CMD ["node", "services/runner/index.js"]
```

## Phase 3: AI Planning & Generation

[Content continues with detailed implementation steps for Phases 3-6...]

## Testing the Implementation

After each phase, test the implementation:

### Phase 1 Testing
```bash
cd apps/web
pnpm dev
# Visit http://localhost:3000
# Test login/signup flow
# Verify dashboard loads
```

### Phase 2 Testing
```bash
cd services/runner
pnpm dev
# Verify job polling starts
# Create a test job in Supabase
# Verify job is picked up and processed
```

## Troubleshooting

### Common Issues

**Supabase Connection Errors**
- Verify environment variables are set correctly
- Check Supabase project is not paused
- Ensure RLS policies are applied

**Playwright Installation Issues**
- Run `npx playwright install --with-deps`
- Ensure Docker has enough resources

**Job Queue Not Processing**
- Check `acquire_job` function exists in Supabase
- Verify service role key has correct permissions
- Check worker logs for errors

## Next Steps

After completing Phase 1-2:
1. Test the basic infrastructure
2. Proceed to Phase 3 for AI integration
3. Continue through remaining phases
4. Deploy to Railway
5. Set up GitHub integration

For detailed implementation of Phases 3-6, refer to the phase-specific documentation files.