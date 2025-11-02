/**
 * Execute Run API Route
 * 
 * POST /api/runs/[id]/execute - Execute a test run
 */

import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import { enqueueRunJob } from '@/lib/jobs';

/**
 * POST /api/runs/[id]/execute
 * Execute a test run
 */
export async function POST(request, { params }) {
  try {
    const supabase = createServerClient();
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    const { id } = params;
    
    // Fetch run
    const { data: run, error: runError } = await supabase
      .from('runs')
      .select('*, projects(id, organization_id)')
      .eq('id', id)
      .single();
    
    if (runError || !run) {
      return NextResponse.json(
        { error: 'Run not found' },
        { status: 404 }
      );
    }
    
    // Check organization membership
    const { data: membership } = await supabase
      .from('org_members')
      .select('role')
      .eq('organization_id', run.projects.organization_id)
      .eq('user_id', user.id)
      .single();
    
    if (!membership) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }
    
    // Check run status
    if (run.status === 'running') {
      return NextResponse.json(
        { error: 'Run is already executing' },
        { status: 400 }
      );
    }
    
    // Enqueue run job
    const job = await enqueueRunJob(id, run.projects.id);
    
    return NextResponse.json({
      success: true,
      job_id: job.id,
      message: 'Run job enqueued successfully',
    });
    
  } catch (error) {
    console.error('Error executing run:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}