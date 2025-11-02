-- QAAI Database Schema
-- Run this in your Supabase SQL Editor

-- Enable extensions
create extension if not exists pgcrypto;
create extension if not exists pg_trgm;

-- ============================================================================
-- CORE TABLES
-- ============================================================================

-- Organizations (multi-tenant)
create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz default now()
);

-- Organization members with roles
create table org_members (
  org_id uuid references organizations(id) on delete cascade,
  user_id uuid not null,
  role text check (role in ('owner','admin','member')) default 'member',
  primary key (org_id, user_id)
);

-- Projects linked to repositories
create table projects (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) on delete cascade,
  name text not null,
  repo_url text,
  app_base_url text,
  env_json jsonb default '{}'::jsonb,
  -- GitHub integration fields
  github_installation_id bigint,
  github_repo_owner text,
  github_repo_name text,
  auto_create_issues boolean default false,
  issue_labels text[] default array['qa-automated', 'bug'],
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

-- AI test plans from PRs/specs
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

-- Individual test results within runs
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

-- Background job queue
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

-- GitHub issues tracking
create table github_issues (
  id uuid primary key default gen_random_uuid(),
  run_test_id uuid references run_tests(id) on delete cascade,
  project_id uuid references projects(id) on delete cascade,
  issue_number int not null,
  issue_url text not null,
  issue_title text not null,
  created_by uuid,
  created_at timestamptz default now()
);

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

create index idx_org_members_user on org_members(user_id);
create index idx_projects_org on projects(org_id);
create index idx_suites_project on suites(project_id);
create index idx_test_cases_suite on test_cases(suite_id);
create index idx_plans_project on plans(project_id);
create index idx_runs_project on runs(project_id);
create index idx_runs_status on runs(status);
create index idx_run_tests_run on run_tests(run_id);
create index idx_run_tests_status on run_tests(status);
create index idx_jobs_status on jobs_queue(status, scheduled_at);
create index idx_github_issues_run_test on github_issues(run_test_id);
create index idx_github_issues_project on github_issues(project_id);

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to acquire a job atomically
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
  where jobs_queue.id = (
    select jobs_queue.id from jobs_queue
    where jobs_queue.status = 'queued'
    and jobs_queue.attempts < 3
    order by jobs_queue.scheduled_at
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

-- Function to update test_cases updated_at on modification
create or replace function update_test_case_timestamp()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger test_cases_updated_at
  before update on test_cases
  for each row
  execute function update_test_case_timestamp();

-- ============================================================================
-- VIEWS
-- ============================================================================

-- Helper view for user's organizations
create or replace view my_orgs as
select o.* from organizations o
join org_members m on m.org_id = o.id
where m.user_id = auth.uid();

-- View for run statistics
create or replace view run_stats as
select 
  r.id as run_id,
  r.project_id,
  count(rt.id) as total_tests,
  count(rt.id) filter (where rt.status = 'passed') as passed_tests,
  count(rt.id) filter (where rt.status = 'failed') as failed_tests,
  count(rt.id) filter (where rt.status = 'flaky') as flaky_tests,
  count(rt.id) filter (where rt.status = 'skipped') as skipped_tests,
  avg(rt.duration_ms) as avg_duration_ms
from runs r
left join run_tests rt on rt.run_id = r.id
group by r.id, r.project_id;

-- View for flake detection
create or replace view flaky_tests as
select 
  tc.id as test_case_id,
  tc.title,
  tc.suite_id,
  s.project_id,
  count(rt.id) as total_runs,
  count(rt.id) filter (where rt.status = 'passed') as passed_count,
  count(rt.id) filter (where rt.status = 'failed') as failed_count,
  count(rt.id) filter (where rt.status = 'flaky') as flaky_count,
  round(
    (count(rt.id) filter (where rt.status = 'failed' or rt.status = 'flaky'))::numeric / 
    nullif(count(rt.id), 0) * 100, 
    2
  ) as flake_rate
from test_cases tc
join suites s on s.id = tc.suite_id
left join run_tests rt on rt.test_case_id = tc.id
where rt.created_at > now() - interval '30 days'
group by tc.id, tc.title, tc.suite_id, s.project_id
having count(rt.id) > 5
  and count(rt.id) filter (where rt.status = 'passed') > 0
  and count(rt.id) filter (where rt.status = 'failed') > 0;

-- ============================================================================
-- COMMENTS
-- ============================================================================

comment on table organizations is 'Multi-tenant organizations';
comment on table org_members is 'Organization membership with roles';
comment on table projects is 'Test projects linked to GitHub repositories';
comment on table suites is 'Test suite groupings';
comment on table test_cases is 'Individual test definitions';
comment on table plans is 'AI-generated test plans from PRs or specs';
comment on table runs is 'Test execution runs';
comment on table run_tests is 'Individual test results within runs';
comment on table jobs_queue is 'Background job queue for workers';
comment on table github_issues is 'GitHub issues created for test failures';