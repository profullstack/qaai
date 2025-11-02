/**
 * Test Data Seeding API
 * 
 * Endpoints for seeding and managing test data.
 */

import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import {
  seedTestEnvironment,
  cleanupTestData,
  getTestUserByRole,
  getTestHeadersByName,
  generateFixtures
} from '../../../../../services/runner/lib/test-data-seeder.js';

/**
 * POST /api/test-data/seed
 * 
 * Seed test data for a project
 * 
 * Body:
 * - project_id: Project ID (required)
 * - users: User seeding options (optional)
 * - headers: Header sets to create (optional)
 * - suites: Test suites to create (optional)
 * - cleanup: Whether to cleanup existing data (optional)
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
    const { project_id, users, headers, suites, cleanup } = body;
    
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
    
    // Check org membership (must be admin or owner)
    const { data: membership } = await supabase
      .from('org_members')
      .select('role')
      .eq('org_id', project.org_id)
      .eq('user_id', user.id)
      .single();
    
    if (!membership || membership.role === 'member') {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }
    
    // Seed test environment
    const result = await seedTestEnvironment(project_id, {
      users,
      headers,
      suites,
      cleanup,
    });
    
    return NextResponse.json({
      success: true,
      ...result,
    });
    
  } catch (error) {
    console.error('[Test Data Seed API] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/test-data/seed
 * 
 * Clean up test data for a project
 * 
 * Query parameters:
 * - project_id: Project ID (required)
 * - clean_users: Clean test users (optional, default true)
 * - clean_headers: Clean test headers (optional, default true)
 * - clean_suites: Clean test suites (optional, default false)
 */
export async function DELETE(request) {
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
    const cleanUsers = searchParams.get('clean_users') !== 'false';
    const cleanHeaders = searchParams.get('clean_headers') !== 'false';
    const cleanSuites = searchParams.get('clean_suites') === 'true';
    
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
    
    // Check org membership (must be admin or owner)
    const { data: membership } = await supabase
      .from('org_members')
      .select('role')
      .eq('org_id', project.org_id)
      .eq('user_id', user.id)
      .single();
    
    if (!membership || membership.role === 'member') {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }
    
    // Clean up test data
    const summary = await cleanupTestData(projectId, {
      cleanUsers,
      cleanHeaders,
      cleanSuites,
    });
    
    return NextResponse.json({
      success: true,
      ...summary,
    });
    
  } catch (error) {
    console.error('[Test Data Cleanup API] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/test-data/seed
 * 
 * Get test data for a project
 * 
 * Query parameters:
 * - project_id: Project ID (required)
 * - type: Data type (users, headers, fixtures) (optional)
 * - role: User role filter (optional, for users type)
 * - name: Header name filter (optional, for headers type)
 * - fixture_type: Fixture type (optional, for fixtures type)
 * - fixture_count: Number of fixtures (optional, default 10)
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
    const type = searchParams.get('type') || 'users';
    const role = searchParams.get('role');
    const name = searchParams.get('name');
    const fixtureType = searchParams.get('fixture_type');
    const fixtureCount = parseInt(searchParams.get('fixture_count') || '10', 10);
    
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
    
    let result;
    
    switch (type) {
      case 'users':
        if (role) {
          result = await getTestUserByRole(projectId, role);
        } else {
          const { data } = await supabase
            .from('test_users')
            .select('*')
            .eq('project_id', projectId);
          result = data;
        }
        break;
        
      case 'headers':
        if (name) {
          result = await getTestHeadersByName(projectId, name);
        } else {
          const { data } = await supabase
            .from('test_headers')
            .select('*')
            .eq('project_id', projectId);
          result = data;
        }
        break;
        
      case 'fixtures':
        if (!fixtureType) {
          return NextResponse.json(
            { error: 'fixture_type is required for fixtures' },
            { status: 400 }
          );
        }
        result = generateFixtures(fixtureType, fixtureCount);
        break;
        
      default:
        return NextResponse.json(
          { error: 'Invalid type. Must be users, headers, or fixtures' },
          { status: 400 }
        );
    }
    
    return NextResponse.json(result);
    
  } catch (error) {
    console.error('[Test Data Get API] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}