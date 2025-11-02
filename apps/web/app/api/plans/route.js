/**
 * Plans API Routes
 * 
 * POST /api/plans - Create a new test plan
 * GET /api/plans - List plans
 */

import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import { enqueuePlanJob } from '@/lib/jobs';

/**
 * POST /api/plans
 * Create a new test plan from PR or spec
 */
export async function POST(request) {
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
    
    // Parse request body
    const body = await request.json();
    const { project_id, suite_id, pr_url, spec_md, auto_generate } = body;
    
    // Validate required fields
    if (!project_id) {
      return NextResponse.json(
        { error: 'project_id is required' },
        { status: 400 }
      );
    }
    
    if (!pr_url && !spec_md) {
      return NextResponse.json(
        { error: 'Either pr_url or spec_md is required' },
        { status: 400 }
      );
    }
    
    // Verify user has access to project
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id, organization_id')
      .eq('id', project_id)
      .single();
    
    if (projectError || !project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }
    
    // Check organization membership
    const { data: membership } = await supabase
      .from('org_members')
      .select('role')
      .eq('organization_id', project.organization_id)
      .eq('user_id', user.id)
      .single();
    
    if (!membership) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }
    
    // Enqueue plan job
    const job = await enqueuePlanJob(project_id, {
      suiteId: suite_id,
      prUrl: pr_url,
      specMd: spec_md,
      autoGenerate: auto_generate ?? true,
    });
    
    return NextResponse.json({
      success: true,
      job_id: job.id,
      message: 'Plan job enqueued successfully',
    });
    
  } catch (error) {
    console.error('Error creating plan:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/plans
 * List plans for a project
 */
export async function GET(request) {
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
    
    // Get query parameters
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('project_id');
    const suiteId = searchParams.get('suite_id');
    
    if (!projectId) {
      return NextResponse.json(
        { error: 'project_id is required' },
        { status: 400 }
      );
    }
    
    // Build query
    let query = supabase
      .from('plans')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });
    
    if (suiteId) {
      query = query.eq('suite_id', suiteId);
    }
    
    const { data: plans, error } = await query;
    
    if (error) {
      throw error;
    }
    
    return NextResponse.json({ plans });
    
  } catch (error) {
    console.error('Error fetching plans:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}