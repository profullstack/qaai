/**
 * Generator Worker
 * 
 * Converts test plans into executable Playwright test code.
 */

import { promises as fs } from 'fs';
import path from 'path';
import { getSupabaseClient } from '../lib/supabase.js';
import { generateCompletion } from '../lib/llm-client.js';
import { enqueueJob } from '../lib/jobs.js';

/**
 * System prompt for test code generation
 */
const GENERATOR_SYSTEM_PROMPT = `You are an expert Playwright test engineer.

Your task is to convert test scenarios into executable Playwright test code.

Requirements:
1. Use modern Playwright syntax with async/await
2. Include proper page object patterns where appropriate
3. Add clear comments explaining each step
4. Use descriptive test names and assertions
5. Handle common edge cases (loading states, errors, etc.)
6. Include proper waits and selectors
7. Follow Playwright best practices

Generate clean, production-ready test code that:
- Is maintainable and readable
- Has proper error handling
- Uses stable selectors (data-testid preferred)
- Includes meaningful assertions
- Can run independently

Return ONLY the test code, no explanations or markdown formatting.`;

/**
 * Generate Playwright test code for a scenario
 */
async function generateTestCode(scenario, projectContext) {
  const userPrompt = `Generate a Playwright test for this scenario:

Test Name: ${scenario.name}
Description: ${scenario.description}
Priority: ${scenario.priority}
Complexity: ${scenario.complexity}

Test Steps:
${scenario.steps.map((step, i) => `${i + 1}. ${step}`).join('\n')}

Expected Outcome: ${scenario.expectedOutcome}

${projectContext ? `Project Context:\n${projectContext}\n` : ''}

Generate a complete Playwright test using this structure:

import { test, expect } from '@playwright/test';

test('${scenario.name}', async ({ page }) => {
  // Your test code here
});

Focus on:
- Clear, descriptive variable names
- Proper waits for elements and network requests
- Meaningful assertions
- Error handling
- Comments explaining complex logic`;

  console.log(`[Generator] Generating code for: ${scenario.name}`);
  
  const result = await generateCompletion([
    { role: 'system', content: GENERATOR_SYSTEM_PROMPT },
    { role: 'user', content: userPrompt },
  ], {
    temperature: 0.3, // Lower temperature for more consistent code
    maxTokens: 2000,
  });
  
  // Clean up the generated code
  let code = result.content.trim();
  
  // Remove markdown code blocks if present
  code = code.replace(/```(?:javascript|typescript|js|ts)?\n/g, '');
  code = code.replace(/```\n?$/g, '');
  
  return code;
}

/**
 * Validate generated test code
 */
function validateTestCode(code) {
  // Basic validation checks
  const checks = [
    { pattern: /import.*@playwright\/test/, message: 'Missing Playwright import' },
    { pattern: /test\(/, message: 'Missing test declaration' },
    { pattern: /async.*\({.*page.*}\)/, message: 'Missing async page parameter' },
    { pattern: /expect\(/, message: 'Missing assertions' },
  ];
  
  const errors = [];
  for (const check of checks) {
    if (!check.pattern.test(code)) {
      errors.push(check.message);
    }
  }
  
  if (errors.length > 0) {
    console.warn(`[Generator] Validation warnings: ${errors.join(', ')}`);
  }
  
  return errors.length === 0;
}

/**
 * Save test code to file system
 */
async function saveTestFile(projectId, testCase, code) {
  const testsDir = path.join(process.cwd(), '..', 'playwright-tests', 'tests', projectId);
  
  // Ensure directory exists
  await fs.mkdir(testsDir, { recursive: true });
  
  // Generate filename from test name
  const filename = testCase.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  
  const filepath = path.join(testsDir, `${filename}.spec.js`);
  
  // Write test file
  await fs.writeFile(filepath, code, 'utf-8');
  
  console.log(`[Generator] Test file saved: ${filepath}`);
  
  return {
    filepath: filepath,
    filename: `${filename}.spec.js`,
    relativePath: `tests/${projectId}/${filename}.spec.js`,
  };
}

/**
 * Save test case to database
 */
async function saveTestCase(planId, suiteId, scenario, fileInfo) {
  const supabase = getSupabaseClient();
  
  const { data: testCase, error } = await supabase
    .from('test_cases')
    .insert({
      plan_id: planId,
      suite_id: suiteId,
      name: scenario.name,
      description: scenario.description,
      file_path: fileInfo.relativePath,
      priority: scenario.priority,
      complexity: scenario.complexity,
      steps: scenario.steps,
      expected_outcome: scenario.expectedOutcome,
      status: 'active',
    })
    .select()
    .single();
  
  if (error) {
    throw new Error(`Failed to save test case: ${error.message}`);
  }
  
  console.log(`[Generator] Test case saved: ${testCase.id}`);
  
  return testCase;
}

/**
 * Update plan status
 */
async function updatePlanStatus(planId, status) {
  const supabase = getSupabaseClient();
  
  const { error } = await supabase
    .from('plans')
    .update({ status })
    .eq('id', planId);
  
  if (error) {
    throw new Error(`Failed to update plan status: ${error.message}`);
  }
}

/**
 * Run the generator worker
 * 
 * @param {object} job - The job object from the queue
 * @param {number} job.id - Job ID
 * @param {string} job.kind - Job kind ('generate')
 * @param {object} job.payload - Job payload
 * @param {string} job.payload.plan_id - Plan ID to generate tests from
 * @param {string} job.payload.project_id - Project ID
 * @param {boolean} job.payload.auto_run - Auto-run tests after generation
 */
export async function runGenerator(job) {
  console.log(`[Generator] Starting generator for job ${job.id}`);
  console.log(`[Generator] Plan ID: ${job.payload.plan_id}`);
  
  const { plan_id, project_id, auto_run } = job.payload;
  
  try {
    // Fetch plan from database
    const supabase = getSupabaseClient();
    const { data: plan, error: planError } = await supabase
      .from('plans')
      .select('*')
      .eq('id', plan_id)
      .single();
    
    if (planError) {
      throw new Error(`Failed to fetch plan: ${planError.message}`);
    }
    
    console.log(`[Generator] Plan: ${plan.summary}`);
    console.log(`[Generator] Scenarios: ${plan.scenarios.length}`);
    
    // Update plan status
    await updatePlanStatus(plan_id, 'generating');
    
    // Fetch project context (optional)
    const { data: project } = await supabase
      .from('projects')
      .select('name, description, base_url')
      .eq('id', project_id)
      .single();
    
    const projectContext = project ? `
Project: ${project.name}
Base URL: ${project.base_url}
${project.description ? `Description: ${project.description}` : ''}
`.trim() : null;
    
    // Generate test code for each scenario
    const generatedTests = [];
    
    for (const scenario of plan.scenarios) {
      try {
        // Generate test code
        const code = await generateTestCode(scenario, projectContext);
        
        // Validate code
        const isValid = validateTestCode(code);
        if (!isValid) {
          console.warn(`[Generator] Generated code may have issues for: ${scenario.name}`);
        }
        
        // Save to file system
        const fileInfo = await saveTestFile(project_id, scenario, code);
        
        // Save to database
        const testCase = await saveTestCase(plan_id, plan.suite_id, scenario, fileInfo);
        
        generatedTests.push({
          scenario: scenario.name,
          testCaseId: testCase.id,
          filepath: fileInfo.filepath,
        });
        
        console.log(`[Generator] ✓ Generated: ${scenario.name}`);
        
      } catch (error) {
        console.error(`[Generator] ✗ Failed to generate ${scenario.name}:`, error);
        // Continue with other scenarios
      }
    }
    
    // Update plan status
    await updatePlanStatus(plan_id, 'generated');
    
    console.log(`[Generator] Job ${job.id} completed successfully`);
    console.log(`[Generator] Generated ${generatedTests.length}/${plan.scenarios.length} tests`);
    
    // Optionally enqueue run job
    if (auto_run && generatedTests.length > 0) {
      console.log(`[Generator] Auto-run enabled, creating run...`);
      
      // Create run record
      const { data: run, error: runError } = await supabase
        .from('runs')
        .insert({
          project_id: project_id,
          suite_id: plan.suite_id,
          plan_id: plan_id,
          status: 'pending',
          trigger: 'auto',
        })
        .select()
        .single();
      
      if (runError) {
        throw new Error(`Failed to create run: ${runError.message}`);
      }
      
      // Enqueue run job
      await enqueueJob('run', {
        run_id: run.id,
        project_id: project_id,
      });
      
      console.log(`[Generator] Run created: ${run.id}`);
    }
    
  } catch (error) {
    console.error(`[Generator] Error in generator worker:`, error);
    
    // Update plan status to error
    if (plan_id) {
      await updatePlanStatus(plan_id, 'error').catch(console.error);
    }
    
    throw error;
  }
}