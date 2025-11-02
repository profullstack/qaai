/**
 * Individual Plan API Routes
 * 
 * GET /api/plans/[id] - Get plan details
 * DELETE /api/plans/[id] - Delete a plan
 */

import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';

/**
 * GET /api/plans/[id]
 * Get plan details
 */
export async function GET(request, { params }) {
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
    
    // Fetch plan
    const { data: plan, error } = await supabase
      .from('plans')
      .select('*, projects(name, organization_id)')
      .eq('id', id)
      .single();
    
    if (error || !plan) {
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
    
    return NextResponse.json({ plan });
    
  } catch (error) {
    console.error('Error fetching plan:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/plans/[id]
 * Delete a plan
 */
export async function DELETE(request, { params }) {
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
    
    // Fetch plan to check permissions
    const { data: plan, error: fetchError } = await supabase
      .from('plans')
      .select('project_id, projects(organization_id)')
      .eq('id', id)
      .single();
    
    if (fetchError || !plan) {
      return NextResponse.json(
        { error: 'Plan not found' },
        { status: 404 }
      );
    }
    
    // Check organization membership (admin or owner only)
    const { data: membership } = await supabase
      .from('org_members')
      .select('role')
      .eq('organization_id', plan.projects.organization_id)
      .eq('user_id', user.id)
      .single();
    
    if (!membership || (membership.role !== 'admin' && membership.role !== 'owner')) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }
    
    // Delete plan
    const { error: deleteError } = await supabase
      .from('plans')
      .delete()
      .eq('id', id);
    
    if (deleteError) {
      throw deleteError;
    }
    
    return NextResponse.json({
      success: true,
      message: 'Plan deleted successfully',
    });
    
  } catch (error) {
    console.error('Error deleting plan:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}