/**
 * Generate Tests from Plan API Route
 * 
 * POST /api/plans/[id]/generate - Generate tests from a plan
 */

import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import { enqueueGenerateJob } from '@/lib/jobs';

/**
 * POST /api/plans/[id]/generate
 * Generate tests from a plan
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
    
    // Parse request body
    const body = await request.json();
    const { auto_run } = body;
    
    // Fetch plan
    const { data: plan, error: planError } = await supabase
      .from('plans')
      .select('*, projects(id, organization_id)')
      .eq('id', id)
      .single();
    
    if (planError || !plan) {
      return NextResponse.json(
        { error: 'Plan not found' },
        { status: 404 }
      );
    }
    
    // Check organization membership
    const { data: membership } = await supabase
      .from('org_members')
      .select('role')
      .eq('organization_id', plan.projects.organization_id)
      .eq('user_id', user.id)
      .single();
    
    if (!membership) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }
    
    // Check plan status
    if (plan.status === 'generating') {
      return NextResponse.json(
        { error: 'Plan is already being generated' },
        { status: 400 }
      );
    }
    
    if (plan.status === 'generated') {
      return NextResponse.json(
        { error: 'Plan has already been generated' },
        { status: 400 }
      );
    }
    
    // Enqueue generate job
    const job = await enqueueGenerateJob(
      id,
      plan.projects.id,
      auto_run ?? true
    );
    
    return NextResponse.json({
      success: true,
      job_id: job.id,
      message: 'Generate job enqueued successfully',
    });
    
  } catch (error) {
    console.error('Error generating tests:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}