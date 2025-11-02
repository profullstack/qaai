import { createHmac } from 'crypto';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';

/**
 * GitHub App Webhook Handler
 * 
 * Handles webhook events from GitHub App:
 * - pull_request (opened, synchronize, reopened)
 * - check_suite (requested, rerequested)
 * - check_run (rerequested)
 */

/**
 * Verify GitHub webhook signature
 * 
 * @param {string} payload - Raw request body
 * @param {string} signature - X-Hub-Signature-256 header
 * @param {string} secret - Webhook secret
 * @returns {boolean} True if signature is valid
 */
function verifySignature(payload, signature, secret) {
  if (!signature || !secret) {
    return false;
  }

  const hmac = createHmac('sha256', secret);
  hmac.update(payload);
  const expectedSignature = `sha256=${hmac.digest('hex')}`;

  return signature === expectedSignature;
}

/**
 * Handle pull_request events
 * 
 * @param {object} payload - GitHub webhook payload
 * @param {object} supabase - Supabase client
 */
async function handlePullRequest(payload, supabase) {
  const { action, pull_request, repository, installation } = payload;

  // Only handle opened, synchronize, and reopened events
  if (!['opened', 'synchronize', 'reopened'].includes(action)) {
    console.log(`[Webhook] Ignoring PR action: ${action}`);
    return { message: 'Event ignored' };
  }

  console.log(`[Webhook] Processing PR #${pull_request.number} (${action})`);

  const prUrl = pull_request.html_url;
  const headSha = pull_request.head.sha;

  // Find project by repository
  const repoFullName = repository.full_name;
  const { data: projects, error: projectError } = await supabase
    .from('projects')
    .select('id, name, github_token')
    .eq('github_repo', repoFullName)
    .eq('status', 'active');

  if (projectError) {
    console.error('[Webhook] Error finding project:', projectError);
    throw new Error('Failed to find project');
  }

  if (!projects || projects.length === 0) {
    console.log(`[Webhook] No active project found for repo: ${repoFullName}`);
    return { message: 'No project configured for this repository' };
  }

  const project = projects[0];

  // Create a new test run for this PR
  const { data: run, error: runError } = await supabase
    .from('runs')
    .insert({
      project_id: project.id,
      pr_url: prUrl,
      head_sha: headSha,
      status: 'pending',
      trigger: 'webhook',
      metadata: {
        pr_number: pull_request.number,
        pr_title: pull_request.title,
        pr_author: pull_request.user.login,
        action,
        installation_id: installation?.id,
      },
    })
    .select()
    .single();

  if (runError) {
    console.error('[Webhook] Error creating run:', runError);
    throw new Error('Failed to create test run');
  }

  console.log(`[Webhook] Created run ${run.id} for PR #${pull_request.number}`);

  // Queue the run for execution
  const { error: queueError } = await supabase
    .from('job_queue')
    .insert({
      job_type: 'run_tests',
      payload: {
        run_id: run.id,
        project_id: project.id,
        pr_url: prUrl,
        head_sha: headSha,
      },
      status: 'pending',
      priority: 10, // High priority for webhook-triggered runs
    });

  if (queueError) {
    console.error('[Webhook] Error queueing job:', queueError);
    throw new Error('Failed to queue test run');
  }

  return {
    message: 'Test run created',
    run_id: run.id,
    pr_number: pull_request.number,
  };
}

/**
 * Handle check_suite events
 * 
 * @param {object} payload - GitHub webhook payload
 * @param {object} supabase - Supabase client
 */
async function handleCheckSuite(payload, supabase) {
  const { action, check_suite, repository } = payload;

  // Only handle requested and rerequested events
  if (!['requested', 'rerequested'].includes(action)) {
    console.log(`[Webhook] Ignoring check_suite action: ${action}`);
    return { message: 'Event ignored' };
  }

  console.log(`[Webhook] Processing check_suite (${action})`);

  // Get the associated pull requests
  const pullRequests = check_suite.pull_requests || [];

  if (pullRequests.length === 0) {
    console.log('[Webhook] No pull requests associated with check suite');
    return { message: 'No pull requests to test' };
  }

  // Process the first PR (GitHub typically sends one PR per check suite)
  const pr = pullRequests[0];
  const prUrl = pr.url.replace('api.github.com/repos', 'github.com').replace('/pulls/', '/pull/');

  // Create a synthetic pull_request event
  const syntheticPayload = {
    action: 'synchronize',
    pull_request: {
      html_url: prUrl,
      number: pr.number,
      title: pr.title || `PR #${pr.number}`,
      head: {
        sha: check_suite.head_sha,
      },
      user: {
        login: check_suite.head_commit?.author?.name || 'unknown',
      },
    },
    repository,
    installation: payload.installation,
  };

  return await handlePullRequest(syntheticPayload, supabase);
}

/**
 * Handle check_run rerequested events
 * 
 * @param {object} payload - GitHub webhook payload
 * @param {object} supabase - Supabase client
 */
async function handleCheckRun(payload, supabase) {
  const { action, check_run, repository } = payload;

  if (action !== 'rerequested') {
    console.log(`[Webhook] Ignoring check_run action: ${action}`);
    return { message: 'Event ignored' };
  }

  console.log(`[Webhook] Processing check_run rerun`);

  // Get the associated pull requests
  const pullRequests = check_run.pull_requests || [];

  if (pullRequests.length === 0) {
    console.log('[Webhook] No pull requests associated with check run');
    return { message: 'No pull requests to test' };
  }

  const pr = pullRequests[0];
  const prUrl = pr.url.replace('api.github.com/repos', 'github.com').replace('/pulls/', '/pull/');

  // Create a synthetic pull_request event
  const syntheticPayload = {
    action: 'synchronize',
    pull_request: {
      html_url: prUrl,
      number: pr.number,
      title: pr.title || `PR #${pr.number}`,
      head: {
        sha: check_run.head_sha,
      },
      user: {
        login: check_run.check_suite?.head_commit?.author?.name || 'unknown',
      },
    },
    repository,
    installation: payload.installation,
  };

  return await handlePullRequest(syntheticPayload, supabase);
}

/**
 * POST /api/webhooks/github
 * 
 * GitHub webhook endpoint
 */
export async function POST(request) {
  try {
    // Get raw body for signature verification
    const rawBody = await request.text();
    const signature = request.headers.get('x-hub-signature-256');
    const event = request.headers.get('x-github-event');
    const deliveryId = request.headers.get('x-github-delivery');

    console.log(`[Webhook] Received ${event} event (${deliveryId})`);

    // Verify webhook signature
    const webhookSecret = process.env.GITHUB_WEBHOOK_SECRET;
    if (!verifySignature(rawBody, signature, webhookSecret)) {
      console.error('[Webhook] Invalid signature');
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 401 }
      );
    }

    // Parse payload
    const payload = JSON.parse(rawBody);

    // Create Supabase client
    const supabase = createClient();

    // Route to appropriate handler
    let result;
    switch (event) {
      case 'pull_request':
        result = await handlePullRequest(payload, supabase);
        break;

      case 'check_suite':
        result = await handleCheckSuite(payload, supabase);
        break;

      case 'check_run':
        result = await handleCheckRun(payload, supabase);
        break;

      case 'ping':
        console.log('[Webhook] Ping received');
        result = { message: 'pong' };
        break;

      default:
        console.log(`[Webhook] Unhandled event: ${event}`);
        result = { message: 'Event not handled' };
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('[Webhook] Error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

/**
 * GET /api/webhooks/github
 * 
 * Health check endpoint
 */
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    service: 'github-webhook',
    timestamp: new Date().toISOString(),
  });
}