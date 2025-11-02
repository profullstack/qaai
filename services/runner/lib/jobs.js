/**
 * Job Queue Management
 * 
 * Handles acquiring, updating, and managing background jobs
 * from the jobs_queue table.
 */

import { getSupabase } from './supabase.js';

const WORKER_ID = `worker-${process.pid}-${Date.now()}`;
const MAX_ATTEMPTS = 3;

/**
 * Acquire the next available job from the queue
 * Uses PostgreSQL's FOR UPDATE SKIP LOCKED for atomic job acquisition
 * 
 * @returns {Promise<{id: number, kind: string, payload: object, attempts: number} | null>}
 */
export async function acquireJob() {
  try {
    const supabase = getSupabase();
    
    const { data, error } = await supabase.rpc('acquire_job', {
      worker_id: WORKER_ID
    });

    if (error) {
      console.error('Error acquiring job:', error);
      return null;
    }

    // The RPC returns an array, get the first item
    return data?.[0] || null;
  } catch (error) {
    console.error('Exception acquiring job:', error);
    return null;
  }
}

/**
 * Mark a job as running
 * 
 * @param {number} jobId 
 * @returns {Promise<boolean>}
 */
export async function markJobRunning(jobId) {
  try {
    const supabase = getSupabase();
    
    const { error } = await supabase
      .from('jobs_queue')
      .update({
        status: 'running',
        locked_by: WORKER_ID,
        locked_at: new Date().toISOString(),
      })
      .eq('id', jobId);

    if (error) {
      console.error('Error marking job as running:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Exception marking job as running:', error);
    return false;
  }
}

/**
 * Mark a job as completed
 * 
 * @param {number} jobId 
 * @returns {Promise<boolean>}
 */
export async function markJobDone(jobId) {
  try {
    const supabase = getSupabase();
    
    const { error } = await supabase
      .from('jobs_queue')
      .update({
        status: 'done',
      })
      .eq('id', jobId);

    if (error) {
      console.error('Error marking job as done:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Exception marking job as done:', error);
    return false;
  }
}

/**
 * Mark a job as failed with error details
 * 
 * @param {number} jobId 
 * @param {string} errorMessage 
 * @returns {Promise<boolean>}
 */
export async function markJobError(jobId, errorMessage) {
  try {
    const supabase = getSupabase();
    
    // Truncate error message to prevent database issues
    const truncatedError = errorMessage?.slice(0, 5000) || 'Unknown error';
    
    const { error } = await supabase
      .from('jobs_queue')
      .update({
        status: 'error',
        last_error: truncatedError,
        attempts: supabase.raw('attempts + 1'),
      })
      .eq('id', jobId);

    if (error) {
      console.error('Error marking job as failed:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Exception marking job as failed:', error);
    return false;
  }
}

/**
 * Create a new job in the queue
 * 
 * @param {string} kind - Job type: 'plan', 'generate', or 'run'
 * @param {object} payload - Job payload data
 * @returns {Promise<{id: number} | null>}
 */
export async function createJob(kind, payload) {
  try {
    const supabase = getSupabase();
    
    const { data, error } = await supabase
      .from('jobs_queue')
      .insert({
        kind,
        payload,
        status: 'queued',
      })
      .select('id')
      .single();

    if (error) {
      console.error('Error creating job:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Exception creating job:', error);
    return null;
  }
}

/**
 * Get job statistics
 * 
 * @returns {Promise<{queued: number, running: number, done: number, error: number}>}
 */
export async function getJobStats() {
  try {
    const supabase = getSupabase();
    
    const { data, error } = await supabase
      .from('jobs_queue')
      .select('status');

    if (error) {
      console.error('Error getting job stats:', error);
      return { queued: 0, running: 0, done: 0, error: 0 };
    }

    const stats = {
      queued: 0,
      running: 0,
      done: 0,
      error: 0,
    };

    data.forEach(job => {
      if (stats[job.status] !== undefined) {
        stats[job.status]++;
      }
    });

    return stats;
  } catch (error) {
    console.error('Exception getting job stats:', error);
    return { queued: 0, running: 0, done: 0, error: 0 };
  }
}

/**
 * Clean up old completed jobs
 * 
 * @param {number} daysOld - Delete jobs older than this many days
 * @returns {Promise<number>} Number of jobs deleted
 */
export async function cleanupOldJobs(daysOld = 30) {
  try {
    const supabase = getSupabase();
    
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);
    
    const { data, error } = await supabase
      .from('jobs_queue')
      .delete()
      .eq('status', 'done')
      .lt('scheduled_at', cutoffDate.toISOString())
      .select('id');

    if (error) {
      console.error('Error cleaning up old jobs:', error);
      return 0;
    }

    return data?.length || 0;
  } catch (error) {
    console.error('Exception cleaning up old jobs:', error);
    return 0;
  }
}

export { WORKER_ID, MAX_ATTEMPTS };