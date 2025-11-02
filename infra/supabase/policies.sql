-- QAAI Row Level Security Policies
-- Run this AFTER schema.sql in your Supabase SQL Editor

-- ============================================================================
-- ENABLE RLS ON ALL TABLES
-- ============================================================================

alter table organizations enable row level security;
alter table org_members enable row level security;
alter table projects enable row level security;
alter table suites enable row level security;
alter table test_cases enable row level security;
alter table plans enable row level security;
alter table runs enable row level security;
alter table run_tests enable row level security;
alter table github_issues enable row level security;

-- Note: jobs_queue does not need RLS as it's only accessed by service role

-- ============================================================================
-- ORGANIZATIONS POLICIES
-- ============================================================================

-- Users can see organizations they're members of
create policy "org_select" 
  on organizations for select
  using (
    exists (
      select 1 from org_members m 
      where m.org_id = id and m.user_id = auth.uid()
    )
  );

-- Owners and admins can update organizations
create policy "org_update" 
  on organizations for update
  using (
    exists (
      select 1 from org_members m 
      where m.org_id = id 
        and m.user_id = auth.uid()
        and m.role in ('owner', 'admin')
    )
  );

-- Authenticated users can create organizations
create policy "org_insert" 
  on organizations for insert
  with check (auth.role() = 'authenticated');

-- Only owners can delete organizations
create policy "org_delete" 
  on organizations for delete
  using (
    exists (
      select 1 from org_members m 
      where m.org_id = id 
        and m.user_id = auth.uid()
        and m.role = 'owner'
    )
  );

-- ============================================================================
-- ORG_MEMBERS POLICIES
-- ============================================================================

-- Users can see members of their organizations
create policy "org_members_select" 
  on org_members for select
  using (
    exists (
      select 1 from org_members m 
      where m.org_id = org_id and m.user_id = auth.uid()
    )
  );

-- Owners and admins can add members
create policy "org_members_insert" 
  on org_members for insert
  with check (
    exists (
      select 1 from org_members m 
      where m.org_id = org_id 
        and m.user_id = auth.uid()
        and m.role in ('owner', 'admin')
    )
  );

-- Owners and admins can update member roles
create policy "org_members_update" 
  on org_members for update
  using (
    exists (
      select 1 from org_members m 
      where m.org_id = org_id 
        and m.user_id = auth.uid()
        and m.role in ('owner', 'admin')
    )
  );

-- Owners and admins can remove members
create policy "org_members_delete" 
  on org_members for delete
  using (
    exists (
      select 1 from org_members m 
      where m.org_id = org_id 
        and m.user_id = auth.uid()
        and m.role in ('owner', 'admin')
    )
  );

-- ============================================================================
-- PROJECTS POLICIES
-- ============================================================================

-- Users can see projects in their organizations
create policy "projects_select" 
  on projects for select
  using (
    exists (
      select 1 from org_members m 
      where m.org_id = projects.org_id and m.user_id = auth.uid()
    )
  );

-- Members can create projects in their organizations
create policy "projects_insert" 
  on projects for insert
  with check (
    exists (
      select 1 from org_members m 
      where m.org_id = projects.org_id and m.user_id = auth.uid()
    )
  );

-- Members can update projects in their organizations
create policy "projects_update" 
  on projects for update
  using (
    exists (
      select 1 from org_members m 
      where m.org_id = projects.org_id and m.user_id = auth.uid()
    )
  );

-- Admins and owners can delete projects
create policy "projects_delete" 
  on projects for delete
  using (
    exists (
      select 1 from org_members m 
      where m.org_id = projects.org_id 
        and m.user_id = auth.uid()
        and m.role in ('owner', 'admin')
    )
  );

-- ============================================================================
-- SUITES POLICIES
-- ============================================================================

-- Users can see suites in their organization's projects
create policy "suites_select" 
  on suites for select
  using (
    exists (
      select 1 from projects p
      join org_members m on m.org_id = p.org_id
      where p.id = suites.project_id and m.user_id = auth.uid()
    )
  );

-- Members can create suites
create policy "suites_insert" 
  on suites for insert
  with check (
    exists (
      select 1 from projects p
      join org_members m on m.org_id = p.org_id
      where p.id = suites.project_id and m.user_id = auth.uid()
    )
  );

-- Members can update suites
create policy "suites_update" 
  on suites for update
  using (
    exists (
      select 1 from projects p
      join org_members m on m.org_id = p.org_id
      where p.id = suites.project_id and m.user_id = auth.uid()
    )
  );

-- Members can delete suites
create policy "suites_delete" 
  on suites for delete
  using (
    exists (
      select 1 from projects p
      join org_members m on m.org_id = p.org_id
      where p.id = suites.project_id and m.user_id = auth.uid()
    )
  );

-- ============================================================================
-- TEST_CASES POLICIES
-- ============================================================================

-- Users can see test cases in their organization's suites
create policy "test_cases_select" 
  on test_cases for select
  using (
    exists (
      select 1 from suites s
      join projects p on p.id = s.project_id
      join org_members m on m.org_id = p.org_id
      where s.id = test_cases.suite_id and m.user_id = auth.uid()
    )
  );

-- Members can create test cases
create policy "test_cases_insert" 
  on test_cases for insert
  with check (
    exists (
      select 1 from suites s
      join projects p on p.id = s.project_id
      join org_members m on m.org_id = p.org_id
      where s.id = test_cases.suite_id and m.user_id = auth.uid()
    )
  );

-- Members can update test cases
create policy "test_cases_update" 
  on test_cases for update
  using (
    exists (
      select 1 from suites s
      join projects p on p.id = s.project_id
      join org_members m on m.org_id = p.org_id
      where s.id = test_cases.suite_id and m.user_id = auth.uid()
    )
  );

-- Members can delete test cases
create policy "test_cases_delete" 
  on test_cases for delete
  using (
    exists (
      select 1 from suites s
      join projects p on p.id = s.project_id
      join org_members m on m.org_id = p.org_id
      where s.id = test_cases.suite_id and m.user_id = auth.uid()
    )
  );

-- ============================================================================
-- PLANS POLICIES
-- ============================================================================

-- Users can see plans in their organization's projects
create policy "plans_select" 
  on plans for select
  using (
    exists (
      select 1 from projects p
      join org_members m on m.org_id = p.org_id
      where p.id = plans.project_id and m.user_id = auth.uid()
    )
  );

-- Members can create plans
create policy "plans_insert" 
  on plans for insert
  with check (
    exists (
      select 1 from projects p
      join org_members m on m.org_id = p.org_id
      where p.id = plans.project_id and m.user_id = auth.uid()
    )
  );

-- Members can update plans
create policy "plans_update" 
  on plans for update
  using (
    exists (
      select 1 from projects p
      join org_members m on m.org_id = p.org_id
      where p.id = plans.project_id and m.user_id = auth.uid()
    )
  );

-- Members can delete plans
create policy "plans_delete" 
  on plans for delete
  using (
    exists (
      select 1 from projects p
      join org_members m on m.org_id = p.org_id
      where p.id = plans.project_id and m.user_id = auth.uid()
    )
  );

-- ============================================================================
-- RUNS POLICIES
-- ============================================================================

-- Users can see runs in their organization's projects
create policy "runs_select" 
  on runs for select
  using (
    exists (
      select 1 from projects p
      join org_members m on m.org_id = p.org_id
      where p.id = runs.project_id and m.user_id = auth.uid()
    )
  );

-- Members can create runs
create policy "runs_insert" 
  on runs for insert
  with check (
    exists (
      select 1 from projects p
      join org_members m on m.org_id = p.org_id
      where p.id = runs.project_id and m.user_id = auth.uid()
    )
  );

-- Members can update runs
create policy "runs_update" 
  on runs for update
  using (
    exists (
      select 1 from projects p
      join org_members m on m.org_id = p.org_id
      where p.id = runs.project_id and m.user_id = auth.uid()
    )
  );

-- Members can delete runs
create policy "runs_delete" 
  on runs for delete
  using (
    exists (
      select 1 from projects p
      join org_members m on m.org_id = p.org_id
      where p.id = runs.project_id and m.user_id = auth.uid()
    )
  );

-- ============================================================================
-- RUN_TESTS POLICIES
-- ============================================================================

-- Users can see run tests in their organization's runs
create policy "run_tests_select" 
  on run_tests for select
  using (
    exists (
      select 1 from runs r
      join projects p on p.id = r.project_id
      join org_members m on m.org_id = p.org_id
      where r.id = run_tests.run_id and m.user_id = auth.uid()
    )
  );

-- Members can create run tests
create policy "run_tests_insert" 
  on run_tests for insert
  with check (
    exists (
      select 1 from runs r
      join projects p on p.id = r.project_id
      join org_members m on m.org_id = p.org_id
      where r.id = run_tests.run_id and m.user_id = auth.uid()
    )
  );

-- Members can update run tests
create policy "run_tests_update" 
  on run_tests for update
  using (
    exists (
      select 1 from runs r
      join projects p on p.id = r.project_id
      join org_members m on m.org_id = p.org_id
      where r.id = run_tests.run_id and m.user_id = auth.uid()
    )
  );

-- Members can delete run tests
create policy "run_tests_delete" 
  on run_tests for delete
  using (
    exists (
      select 1 from runs r
      join projects p on p.id = r.project_id
      join org_members m on m.org_id = p.org_id
      where r.id = run_tests.run_id and m.user_id = auth.uid()
    )
  );

-- ============================================================================
-- GITHUB_ISSUES POLICIES
-- ============================================================================

-- Users can see GitHub issues in their organization's projects
create policy "github_issues_select" 
  on github_issues for select
  using (
    exists (
      select 1 from projects p
      join org_members m on m.org_id = p.org_id
      where p.id = github_issues.project_id and m.user_id = auth.uid()
    )
  );

-- Members can create GitHub issues
create policy "github_issues_insert" 
  on github_issues for insert
  with check (
    exists (
      select 1 from projects p
      join org_members m on m.org_id = p.org_id
      where p.id = github_issues.project_id and m.user_id = auth.uid()
    )
  );

-- Members can update GitHub issues
create policy "github_issues_update" 
  on github_issues for update
  using (
    exists (
      select 1 from projects p
      join org_members m on m.org_id = p.org_id
      where p.id = github_issues.project_id and m.user_id = auth.uid()
    )
  );

-- Members can delete GitHub issues
create policy "github_issues_delete" 
  on github_issues for delete
  using (
    exists (
      select 1 from projects p
      join org_members m on m.org_id = p.org_id
      where p.id = github_issues.project_id and m.user_id = auth.uid()
    )
  );

-- ============================================================================
-- STORAGE POLICIES
-- ============================================================================

-- Authenticated users can read artifacts from their organization's projects
create policy "artifacts_select"
  on storage.objects for select
  using (
    bucket_id = 'artifacts' 
    and auth.role() = 'authenticated'
  );

-- Service role can manage all artifacts
create policy "artifacts_insert"
  on storage.objects for insert
  with check (
    bucket_id = 'artifacts' 
    and auth.role() = 'service_role'
  );

create policy "artifacts_update"
  on storage.objects for update
  using (
    bucket_id = 'artifacts' 
    and auth.role() = 'service_role'
  );

create policy "artifacts_delete"
  on storage.objects for delete
  using (
    bucket_id = 'artifacts' 
    and auth.role() = 'service_role'
  );