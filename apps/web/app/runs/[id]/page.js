'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

const STATUS_COLORS = {
  queued: 'bg-gray-100 text-gray-800',
  running: 'bg-blue-100 text-blue-800',
  passed: 'bg-green-100 text-green-800',
  failed: 'bg-red-100 text-red-800',
  flaky: 'bg-yellow-100 text-yellow-800',
  skipped: 'bg-gray-100 text-gray-600',
  error: 'bg-red-100 text-red-800',
};

export default function RunDetailsPage() {
  const params = useParams();
  const [run, setRun] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchRun();
  }, [params.id]);

  const fetchRun = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/runs/${params.id}`);
      
      if (!res.ok) {
        if (res.status === 404) {
          throw new Error('Run not found');
        }
        throw new Error('Failed to fetch run');
      }

      const data = await res.json();
      setRun(data.run);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading run details...</p>
        </div>
      </div>
    );
  }

  if (error || !run) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-red-50 border border-red-200 text-red-700 px-6 py-4 rounded-lg max-w-md">
          <p className="font-semibold">Error</p>
          <p className="text-sm mt-1">{error || 'Run not found'}</p>
          <Link href="/runs" className="text-sm text-blue-600 hover:text-blue-700 mt-2 inline-block">
            ← Back to Runs
          </Link>
        </div>
      </div>
    );
  }

  const tests = run.tests || [];
  const passedCount = tests.filter(t => t.status === 'passed').length;
  const failedCount = tests.filter(t => t.status === 'failed').length;
  const flakyCount = tests.filter(t => t.status === 'flaky').length;
  const totalCount = tests.length;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <Link href="/runs" className="text-blue-600 hover:text-blue-700 text-sm">
            ← Back to Runs
          </Link>
          <div className="mt-4 flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Run #{run.id.slice(0, 8)}
              </h1>
              <p className="mt-2 text-gray-600">
                Project: <Link href={`/projects/${run.project_id}`} className="text-blue-600 hover:text-blue-700">
                  {run.projects?.name}
                </Link>
              </p>
            </div>
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${STATUS_COLORS[run.status]}`}>
              {run.status}
            </span>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-sm font-medium text-gray-500 mb-2">Total Tests</h3>
            <p className="text-3xl font-bold text-gray-900">{totalCount}</p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-sm font-medium text-gray-500 mb-2">Passed</h3>
            <p className="text-3xl font-bold text-green-600">{passedCount}</p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-sm font-medium text-gray-500 mb-2">Failed</h3>
            <p className="text-3xl font-bold text-red-600">{failedCount}</p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-sm font-medium text-gray-500 mb-2">Flaky</h3>
            <p className="text-3xl font-bold text-yellow-600">{flakyCount}</p>
          </div>
        </div>

        {/* Test Results */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Test Results</h2>
          </div>
          
          {tests.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              <p>No test results yet</p>
              <p className="text-sm mt-2">Tests will appear here once the run starts</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {tests.map((test) => (
                <div key={test.id} className="p-6 hover:bg-gray-50">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[test.status]}`}>
                          {test.status}
                        </span>
                        <h3 className="text-sm font-medium text-gray-900">
                          Test #{test.id.slice(0, 8)}
                        </h3>
                        {test.attempt > 0 && (
                          <span className="text-xs text-gray-500">
                            (Attempt {test.attempt + 1})
                          </span>
                        )}
                      </div>
                      
                      {test.duration_ms && (
                        <p className="text-sm text-gray-600 mt-1">
                          Duration: {(test.duration_ms / 1000).toFixed(2)}s
                        </p>
                      )}
                      
                      {test.error_text && (
                        <div className="mt-3 p-3 bg-red-50 rounded-md">
                          <p className="text-sm font-medium text-red-800">Error:</p>
                          <pre className="text-xs text-red-700 mt-1 whitespace-pre-wrap">
                            {test.error_text}
                          </pre>
                        </div>
                      )}
                    </div>
                    
                    <div className="ml-4 flex space-x-2">
                      {test.trace_path && (
                        <button className="text-sm text-blue-600 hover:text-blue-700">
                          View Trace
                        </button>
                      )}
                      {test.video_path && (
                        <button className="text-sm text-blue-600 hover:text-blue-700">
                          View Video
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Run Metadata */}
        {run.meta && Object.keys(run.meta).length > 0 && (
          <div className="mt-8 bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Run Metadata</h2>
            <pre className="text-sm text-gray-700 bg-gray-50 p-4 rounded-md overflow-auto">
              {JSON.stringify(run.meta, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}