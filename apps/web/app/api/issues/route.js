import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';

/**
 * POST /api/issues
 * 
 * Create a GitHub issue manually
 */
export async function POST(request) {
  try {
    const supabase = createClient();

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { project_id, run_id, title, description, labels = [] } = body;

    // Validate required fields
    if (!project_id || !title || !description) {
      return NextResponse.json(
        { error: 'Missing required fields: project_id, title, description' },
        { status: 400 }
      );
    }

    // Fetch project details
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('github_repo, github_token')
      .eq('id', project_id)
      .single();

    if (projectError || !project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    if (!project.github_repo) {
      return NextResponse.json(
        { error: 'Project does not have a GitHub repository configured' },
        { status: 400 }
      );
    }

    // Parse repository owner and name
    const repoMatch = project.github_repo.match(/github\.com\/([^\/]+)\/([^\/]+)/);
    if (!repoMatch) {
      return NextResponse.json(
        { error: 'Invalid GitHub repository format' },
        { status: 400 }
      );
    }

    const [, owner, repo] = repoMatch;
    const token = project.github_token || process.env.GITHUB_TOKEN;

    if (!token) {
      return NextResponse.json(
        { error: 'No GitHub token available' },
        { status: 400 }
      );
    }

    // Get run details if provided
    let prUrl = null;
    if (run_id) {
      const { data: run } = await supabase
        .from('runs')
        .select('pr_url')
        .eq('id', run_id)
        .single();

      prUrl = run?.pr_url;
    }

    // Create issue on GitHub
    const issueData = {
      title,
      body: `${description}\n\n---\n\n*Manually created via QAAI*${
        run_id ? `\nRun ID: ${run_id}` : ''
      }${prUrl ? `\nPR: ${prUrl}` : ''}`,
      labels: ['manual', 'qaai', ...labels],
    };

    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/issues`,
      {
        method: 'POST',
        headers: {
          Accept: 'application/vnd.github.v3+json',
          Authorization: `Bearer ${token}`,
          'User-Agent': 'QAAI-Web',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(issueData),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error('[Issues API] GitHub error:', error);
      return NextResponse.json(
        { error: 'Failed to create GitHub issue' },
        { status: response.status }
      );
    }

    const issue = await response.json();

    // Store issue reference in database
    const { error: insertError } = await supabase.from('github_issues').insert({
      project_id,
      run_id,
      issue_number: issue.number,
      issue_url: issue.html_url,
      title: issue.title,
      created_by: user.id,
      metadata: {
        labels: issue.labels.map((l) => l.name),
        state: issue.state,
      },
    });

    if (insertError) {
      console.error('[Issues API] Failed to store issue reference:', insertError);
      // Don't fail the request - issue was created successfully
    }

    return NextResponse.json({
      success: true,
      issue: {
        number: issue.number,
        url: issue.html_url,
        title: issue.title,
      },
    });
  } catch (error) {
    console.error('[Issues API] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/issues?project_id=xxx
 * 
 * List GitHub issues for a project
 */
export async function GET(request) {
  try {
    const supabase = createClient();

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('project_id');
    const runId = searchParams.get('run_id');

    if (!projectId) {
      return NextResponse.json(
        { error: 'Missing required parameter: project_id' },
        { status: 400 }
      );
    }

    // Build query
    let query = supabase
      .from('github_issues')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });

    if (runId) {
      query = query.eq('run_id', runId);
    }

    const { data: issues, error } = await query;

    if (error) {
      console.error('[Issues API] Error fetching issues:', error);
      return NextResponse.json(
        { error: 'Failed to fetch issues' },
        { status: 500 }
      );
    }

    return NextResponse.json({ issues });
  } catch (error) {
    console.error('[Issues API] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}