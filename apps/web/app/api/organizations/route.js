import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';

/**
 * GET /api/organizations
 * List all organizations for the authenticated user
 */
export async function GET(request) {
  try {
    const supabase = createClient();
    
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's organizations through org_members
    const { data: memberships, error } = await supabase
      .from('org_members')
      .select(`
        role,
        organizations (
          id,
          name,
          created_at
        )
      `)
      .eq('user_id', user.id);

    if (error) {
      console.error('Error fetching organizations:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Transform to include role with org data
    const organizations = memberships.map(m => ({
      ...m.organizations,
      role: m.role,
    }));

    return NextResponse.json({ organizations });
  } catch (error) {
    console.error('Exception in GET /api/organizations:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/organizations
 * Create a new organization and add current user as owner
 */
export async function POST(request) {
  try {
    const supabase = createClient();
    
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse request body
    const body = await request.json();
    const { name } = body;

    // Validate required fields
    if (!name) {
      return NextResponse.json(
        { error: 'name is required' },
        { status: 400 }
      );
    }

    // Create organization
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .insert({ name })
      .select()
      .single();

    if (orgError) {
      console.error('Error creating organization:', orgError);
      return NextResponse.json({ error: orgError.message }, { status: 500 });
    }

    // Add current user as owner
    const { error: memberError } = await supabase
      .from('org_members')
      .insert({
        org_id: org.id,
        user_id: user.id,
        role: 'owner',
      });

    if (memberError) {
      console.error('Error adding org member:', memberError);
      // Try to clean up the org
      await supabase.from('organizations').delete().eq('id', org.id);
      return NextResponse.json({ error: memberError.message }, { status: 500 });
    }

    return NextResponse.json({ organization: { ...org, role: 'owner' } }, { status: 201 });
  } catch (error) {
    console.error('Exception in POST /api/organizations:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}