/**
 * Planner Worker
 * 
 * Analyzes PR diffs or specifications and generates test plans using AI.
 */

import { getSupabaseClient } from '../lib/supabase.js';
import { generateJSON } from '../lib/llm-client.js';
import { fetchPRDiff, fetchPRMetadata } from '../lib/github.js';
import { enqueueJob } from '../lib/jobs.js';

/**
 * System prompt for test planning
 */
const PLANNER_SYSTEM_PROMPT = `You are an expert QA engineer specializing in E2E testing with Playwright.

Your task is to analyze code changes or specifications and create a comprehensive test plan.

For each test scenario, provide:
1. A clear, descriptive name
2. The user flow or feature being tested
3. Specific test steps
4. Expected outcomes
5. Priority (high, medium, low)
6. Estimated complexity (simple, moderate, complex)

Focus on:
- Critical user paths
- Edge cases and error handling
- Integration points
- UI interactions
- Data validation
- Security considerations

Return your response as a JSON object with this structure:
{
  "summary": "Brief overview of what's being tested",
  "scenarios": [
    {
      "name": "Test scenario name",
      "description": "What this test validates",
      "priority": "high|medium|low",
      "complexity": "simple|moderate|complex",
      "steps": [
        "Step 1: Action to take",
        "Step 2: Next action",
        "Step 3: Verification"
      ],
      "expectedOutcome": "What should happen when test passes"
    }
  ],
  "coverage": {
    "routes": ["List of routes/pages covered"],
    "features": ["List of features tested"],
    "riskAreas": ["Areas that need extra attention"]
  }
}`;

/**
 * Generate test plan from PR diff
 */
async function planFromPRDiff(prUrl, projectId, githubToken) {
  console.log(`[Planner] Analyzing PR: ${prUrl}`);
  
  // Fetch PR metadata and diff
  const [metadata, diff] = await Promise.all([
    fetchPRMetadata(prUrl, githubToken),
    fetchPRDiff(prUrl, githubToken),
  ]);
  
  console.log(`[Planner] PR: "${metadata.title}" by ${metadata.author}`);
  console.log(`[Planner] Changes: +${metadata.additions} -${metadata.deletions} across ${metadata.changedFiles} files`);
  
  // Build user prompt with PR context
  const userPrompt = `Analyze this Pull Request and create a test plan.

PR Title: ${metadata.title}
PR Description:
${metadata.body || 'No description provided'}

Code Changes (unified diff):
\`\`\`diff
${diff}
\`\`\`

Create a comprehensive test plan that covers:
1. New features or changes introduced
2. Potential regression areas
3. Edge cases based on the code changes
4. Integration points affected

Focus on E2E testing scenarios that can be automated with Playwright.`;

  // Generate plan using LLM
  console.log(`[Planner] Generating test plan with AI...`);
  const plan = await generateJSON(PLANNER_SYSTEM_PROMPT, userPrompt, {
    temperature: 0.7,
    maxTokens: 4000,
  });
  
  return {
    ...plan,
    source: 'pr',
    prUrl,
    prTitle: metadata.title,
    prAuthor: metadata.author,
    prChanges: {
      files: metadata.changedFiles,
      additions: metadata.additions,
      deletions: metadata.deletions,
    },
  };
}

/**
 * Generate test plan from specification
 */
async function planFromSpec(specMarkdown, projectId) {
  console.log(`[Planner] Analyzing specification (${specMarkdown.length} chars)`);
  
  // Build user prompt with spec
  const userPrompt = `Analyze this specification and create a test plan.

Specification:
${specMarkdown}

Create a comprehensive test plan that covers:
1. All features described in the spec
2. User workflows and interactions
3. Edge cases and error scenarios
4. Data validation requirements
5. Integration points

Focus on E2E testing scenarios that can be automated with Playwright.`;

  // Generate plan using LLM
  console.log(`[Planner] Generating test plan with AI...`);
  const plan = await generateJSON(PLANNER_SYSTEM_PROMPT, userPrompt, {
    temperature: 0.7,
    maxTokens: 4000,
  });
  
  return {
    ...plan,
    source: 'spec',
  };
}

/**
 * Save plan to database
 */
async function savePlan(projectId, suiteId, planData) {
  const supabase = getSupabaseClient();
  
  console.log(`[Planner] Saving plan to database...`);
  
  const { data: plan, error } = await supabase
    .from('plans')
    .insert({
      project_id: projectId,
      suite_id: suiteId,
      summary: planData.summary,
      scenarios: planData.scenarios,
      coverage: planData.coverage,
      source: planData.source,
      pr_url: planData.prUrl,
      pr_title: planData.prTitle,
      pr_author: planData.prAuthor,
      pr_changes: planData.prChanges,
      status: 'completed',
    })
    .select()
    .single();
  
  if (error) {
    throw new Error(`Failed to save plan: ${error.message}`);
  }
  
  console.log(`[Planner] Plan saved with ID: ${plan.id}`);
  console.log(`[Planner] Scenarios: ${planData.scenarios.length}`);
  
  return plan;
}

/**
 * Run the planner worker
 * 
 * @param {object} job - The job object from the queue
 * @param {number} job.id - Job ID
 * @param {string} job.kind - Job kind ('plan')
 * @param {object} job.payload - Job payload
 * @param {string} job.payload.project_id - Project ID
 * @param {string} job.payload.suite_id - Suite ID (optional)
 * @param {string} job.payload.pr_url - PR URL (optional)
 * @param {string} job.payload.spec_md - Spec markdown (optional)
 * @param {boolean} job.payload.auto_generate - Auto-generate tests after planning
 */
export async function runPlanner(job) {
  console.log(`[Planner] Starting planner for job ${job.id}`);
  console.log(`[Planner] Project ID: ${job.payload.project_id}`);
  
  const { project_id, suite_id, pr_url, spec_md, auto_generate } = job.payload;
  
  // Validate input
  if (!pr_url && !spec_md) {
    throw new Error('Either pr_url or spec_md must be provided');
  }
  
  try {
    // Fetch project details for GitHub token
    const supabase = getSupabaseClient();
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('github_token')
      .eq('id', project_id)
      .single();
    
    if (projectError) {
      throw new Error(`Failed to fetch project: ${projectError.message}`);
    }
    
    // Generate plan based on source
    let planData;
    if (pr_url) {
      planData = await planFromPRDiff(pr_url, project_id, project.github_token);
    } else {
      planData = await planFromSpec(spec_md, project_id);
    }
    
    // Save plan to database
    const plan = await savePlan(project_id, suite_id, planData);
    
    // Optionally enqueue generation job
    if (auto_generate) {
      console.log(`[Planner] Auto-generate enabled, enqueueing generator job...`);
      await enqueueJob('generate', {
        plan_id: plan.id,
        project_id: project_id,
      });
    }
    
    console.log(`[Planner] Job ${job.id} completed successfully`);
    console.log(`[Planner] Plan ID: ${plan.id}`);
    console.log(`[Planner] Scenarios: ${planData.scenarios.length}`);
    
  } catch (error) {
    console.error(`[Planner] Error in planner worker:`, error);
    throw error;
  }
}