/**
 * Job Queue Helpers for Web App
 * 
 * Functions to enqueue jobs from the web application
 */

import { createClient } from '@supabase/supabase-js';

/**
 * Get Supabase client with service role (for job queue access)
 */
function getServiceClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase configuration');
  }
  
  return createClient(supabaseUrl, supabaseServiceKey);
}

/**
 * Enqueue a job
 * 
 * @param {string} kind - Job kind (plan, generate, run)
 * @param {object} payload - Job payload
 * @returns {Promise<object>} Created job
 */
export async function enqueueJob(kind, payload) {
  const supabase = getServiceClient();
  
  const { data: job, error } = await supabase
    .from('jobs_queue')
    .insert({
      kind,
      payload,
      status: 'pending',
    })
    .select()
    .single();
  
  if (error) {
    throw new Error(`Failed to enqueue job: ${error.message}`);
  }
  
  console.log(`[Jobs] Enqueued ${kind} job: ${job.id}`);
  
  return job;
}

/**
 * Enqueue a plan job
 * 
 * @param {string} projectId - Project ID
 * @param {object} options - Plan options
 * @param {string} options.suiteId - Suite ID (optional)
 * @param {string} options.prUrl - PR URL (optional)
 * @param {string} options.specMd - Spec markdown (optional)
 * @param {boolean} options.autoGenerate - Auto-generate tests after planning
 * @returns {Promise<object>} Created job
 */
export async function enqueuePlanJob(projectId, options = {}) {
  return enqueueJob('plan', {
    project_id: projectId,
    suite_id: options.suiteId,
    pr_url: options.prUrl,
    spec_md: options.specMd,
    auto_generate: options.autoGenerate ?? true,
  });
}

/**
 * Enqueue a generate job
 * 
 * @param {string} planId - Plan ID
 * @param {string} projectId - Project ID
 * @param {boolean} autoRun - Auto-run tests after generation
 * @returns {Promise<object>} Created job
 */
export async function enqueueGenerateJob(planId, projectId, autoRun = true) {
  return enqueueJob('generate', {
    plan_id: planId,
    project_id: projectId,
    auto_run: autoRun,
  });
}

/**
 * Enqueue a run job
 * 
 * @param {string} runId - Run ID
 * @param {string} projectId - Project ID
 * @returns {Promise<object>} Created job
 */
export async function enqueueRunJob(runId, projectId) {
  return enqueueJob('run', {
    run_id: runId,
    project_id: projectId,
  });
}

/**
 * Get job status
 * 
 * @param {string} jobId - Job ID
 * @returns {Promise<object>} Job status
 */
export async function getJobStatus(jobId) {
  const supabase = getServiceClient();
  
  const { data: job, error } = await supabase
    .from('jobs_queue')
    .select('*')
    .eq('id', jobId)
    .single();
  
  if (error) {
    throw new Error(`Failed to get job status: ${error.message}`);
  }
  
  return job;
}