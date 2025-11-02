/**
 * Planner Worker
 * 
 * Analyzes PR diffs or specifications and generates test plans using AI.
 * This is a placeholder that will be fully implemented in Phase 3.
 */

/**
 * Run the planner worker
 * 
 * @param {object} job - The job object from the queue
 * @param {number} job.id - Job ID
 * @param {string} job.kind - Job kind ('plan')
 * @param {object} job.payload - Job payload
 * @param {string} job.payload.project_id - Project ID
 * @param {string} job.payload.pr_url - PR URL (optional)
 * @param {string} job.payload.spec_md - Spec markdown (optional)
 */
export async function runPlanner(job) {
  console.log(`[Planner] Starting planner for job ${job.id}`);
  console.log(`[Planner] Project ID: ${job.payload.project_id}`);
  
  if (job.payload.pr_url) {
    console.log(`[Planner] PR URL: ${job.payload.pr_url}`);
  }
  
  if (job.payload.spec_md) {
    console.log(`[Planner] Spec provided (${job.payload.spec_md.length} chars)`);
  }
  
  // TODO: Phase 3 - Implement AI planning
  // 1. Fetch PR diff from GitHub if pr_url provided
  // 2. Analyze code changes or spec
  // 3. Call LLM to generate test plan
  // 4. Save plan to database
  // 5. Create generate job for next step
  
  console.log(`[Planner] Planner worker not yet implemented - Phase 3`);
  console.log(`[Planner] Job ${job.id} completed (placeholder)`);
}