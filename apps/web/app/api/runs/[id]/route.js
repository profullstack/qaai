import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';

/**
 * GET /api/runs/[id]
 * Get a single run with its test results
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

    // Get run with project and test results
    const { data: run, error } = await supabase
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
        ),
        plans (
          id,
          pr_url,
          spec_md
        )
      `)
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Run not found' }, { status: 404 });
      }
      console.error('Error fetching run:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Get test results for this run
    const { data: tests, error: testsError } = await supabase
      .from('run_tests')
      .select('*')
      .eq('run_id', id)
      .order('created_at', { ascending: true });

    if (testsError) {
      console.error('Error fetching test results:', error);
      return NextResponse.json({ error: testsError.message }, { status: 500 });
    }

    return NextResponse.json({ run: { ...run, tests } });
  } catch (error) {
    console.error('Exception in GET /api/runs/[id]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}