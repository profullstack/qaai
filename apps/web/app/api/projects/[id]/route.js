import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';

/**
 * GET /api/projects/[id]
 * Get a single project by ID
 */
export async function GET(request, { params }) {
  try {
    const supabase = createClient();
    const { id } = params;
    
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get project with organization details
    const { data: project, error } = await supabase
      .from('projects')
      .select(`
        *,
        organizations (
          id,
          name
        )
      `)
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Project not found' }, { status: 404 });
      }
      console.error('Error fetching project:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ project });
  } catch (error) {
    console.error('Exception in GET /api/projects/[id]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * PATCH /api/projects/[id]
 * Update a project
 */
export async function PATCH(request, { params }) {
  try {
    const supabase = createClient();
    const { id } = params;
    
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse request body
    const body = await request.json();
    const { name, repo_url, app_base_url, env_json, auto_create_issues, issue_labels } = body;

    // Build update object (only include provided fields)
    const updates = {};
    if (name !== undefined) updates.name = name;
    if (repo_url !== undefined) updates.repo_url = repo_url;
    if (app_base_url !== undefined) updates.app_base_url = app_base_url;
    if (env_json !== undefined) updates.env_json = env_json;
    if (auto_create_issues !== undefined) updates.auto_create_issues = auto_create_issues;
    if (issue_labels !== undefined) updates.issue_labels = issue_labels;

    // Update project
    const { data: project, error } = await supabase
      .from('projects')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Project not found' }, { status: 404 });
      }
      console.error('Error updating project:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ project });
  } catch (error) {
    console.error('Exception in PATCH /api/projects/[id]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/projects/[id]
 * Delete a project
 */
export async function DELETE(request, { params }) {
  try {
    const supabase = createClient();
    const { id } = params;
    
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Delete project (RLS will ensure user has permission)
    const { error } = await supabase
      .from('projects')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting project:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Exception in DELETE /api/projects/[id]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}