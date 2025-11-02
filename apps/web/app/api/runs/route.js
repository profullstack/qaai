import { NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase-server';

/**
 * GET /api/runs
 * List all runs for projects in user's organizations
 */
export async function GET(request) {
  try {
    const supabase = createClient();
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('project_id');
    
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Build query
    let query = supabase
      .from('runs')
      .select(`
        *,
        projects (
          id,
          name,
          organizations (
            id,
            name
          )
        )
      `)
      .order('created_at', { ascending: false })
      .limit(50);

    // Filter by project if specified
    if (projectId) {
      query = query.eq('project_id', projectId);
    }

    const { data: runs, error } = await query;

    if (error) {
      console.error('Error fetching runs:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ runs });
  } catch (error) {
    console.error('Exception in GET /api/runs:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/runs
 * Create and queue a new test run
 */
export async function POST(request) {
  try {
    const supabase = createClient();
    const serviceClient = createServiceClient();
    
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse request body
    const body = await request.json();
    const { project_id, plan_id, suite_ids = [], trigger = 'manual' } = body;

    // Validate required fields
    if (!project_id) {
      return NextResponse.json(
        { error: 'project_id is required' },
        { status: 400 }
      );
    }

    // Verify user has access to project (RLS will handle this)
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id')
      .eq('id', project_id)
      .single();

    if (projectError || !project) {
      return NextResponse.json({ error: 'Project not found or access denied' }, { status: 404 });
    }

    // Create run
    const { data: run, error: runError } = await supabase
      .from('runs')
      .insert({
        project_id,
        plan_id,
        suite_ids,
        trigger,
        status: 'queued',
      })
      .select()
      .single();

    if (runError) {
      console.error('Error creating run:', runError);
      return NextResponse.json({ error: runError.message }, { status: 500 });
    }

    // Create job in queue using service client (bypasses RLS)
    const { error: jobError } = await serviceClient
      .from('jobs_queue')
      .insert({
        kind: 'run',
        payload: { run_id: run.id },
        status: 'queued',
      });

    if (jobError) {
      console.error('Error creating job:', jobError);
      // Try to clean up the run
      await supabase.from('runs').delete().eq('id', run.id);
      return NextResponse.json({ error: 'Failed to queue run' }, { status: 500 });
    }

    return NextResponse.json({ run }, { status: 201 });
  } catch (error) {
    console.error('Exception in POST /api/runs:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}