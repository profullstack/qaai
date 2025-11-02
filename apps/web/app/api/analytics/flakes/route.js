/**
 * Flake Detection API
 * 
 * Endpoints for analyzing test flakiness and retrieving flake statistics.
 */

import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import { 
  analyzeTestFlakiness, 
  analyzeProjectFlakiness, 
  getFlakeSummary 
} from '../../../../../services/runner/lib/flake-detector.js';

/**
 * GET /api/analytics/flakes
 * 
 * Query parameters:
 * - project_id: Project ID (required)
 * - test_case_id: Specific test case ID (optional)
 * - time_window: Time window in days (optional, default 30)
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
    
    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('project_id');
    const testCaseId = searchParams.get('test_case_id');
    const timeWindow = parseInt(searchParams.get('time_window') || '30', 10);
    
    if (!projectId) {
      return NextResponse.json(
        { error: 'project_id is required' },
        { status: 400 }
      );
    }
    
    // Verify user has access to project
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id, org_id')
      .eq('id', projectId)
      .single();
    
    if (projectError || !project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }
    
    // Check org membership
    const { data: membership } = await supabase
      .from('org_members')
      .select('role')
      .eq('org_id', project.org_id)
      .eq('user_id', user.id)
      .single();
    
    if (!membership) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }
    
    // Analyze specific test or entire project
    let result;
    if (testCaseId) {
      result = await analyzeTestFlakiness(testCaseId, { timeWindowDays: timeWindow });
    } else {
      const [flakyTests, summary] = await Promise.all([
        analyzeProjectFlakiness(projectId, { timeWindowDays: timeWindow }),
        getFlakeSummary(projectId),
      ]);
      
      result = {
        summary,
        flakyTests,
        timeWindow,
      };
    }
    
    return NextResponse.json(result);
    
  } catch (error) {
    console.error('[Flakes API] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/analytics/flakes/analyze
 * 
 * Trigger flake analysis for a project
 * 
 * Body:
 * - project_id: Project ID (required)
 * - options: Analysis options (optional)
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
    const { project_id, options = {} } = body;
    
    if (!project_id) {
      return NextResponse.json(
        { error: 'project_id is required' },
        { status: 400 }
      );
    }
    
    // Verify user has access to project
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id, org_id')
      .eq('id', project_id)
      .single();
    
    if (projectError || !project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }
    
    // Check org membership
    const { data: membership } = await supabase
      .from('org_members')
      .select('role')
      .eq('org_id', project.org_id)
      .eq('user_id', user.id)
      .single();
    
    if (!membership) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }
    
    // Run analysis
    const flakyTests = await analyzeProjectFlakiness(project_id, options);
    const summary = await getFlakeSummary(project_id);
    
    return NextResponse.json({
      success: true,
      summary,
      flakyTests,
      analyzedAt: new Date().toISOString(),
    });
    
  } catch (error) {
    console.error('[Flakes API] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}