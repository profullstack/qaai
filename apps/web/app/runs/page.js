'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

const STATUS_COLORS = {
  queued: 'bg-gray-100 text-gray-800',
  running: 'bg-blue-100 text-blue-800',
  passed: 'bg-green-100 text-green-800',
  failed: 'bg-red-100 text-red-800',
  error: 'bg-red-100 text-red-800',
};

const STATUS_ICONS = {
  queued: '⏳',
  running: '▶️',
  passed: '✅',
  failed: '❌',
  error: '⚠️',
};

export default function RunsPage() {
  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchRuns();
  }, []);

  const fetchRuns = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/runs');
      
      if (!res.ok) {
        throw new Error('Failed to fetch runs');
      }

      const data = await res.json();
      setRuns(data.runs || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const formatDuration = (startedAt, finishedAt) => {
    if (!startedAt || !finishedAt) return '-';
    
    const duration = new Date(finishedAt) - new Date(startedAt);
    const seconds = Math.floor(duration / 1000);
    const minutes = Math.floor(seconds / 60);
    
    if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    }
    return `${seconds}s`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading runs...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-red-50 border border-red-200 text-red-700 px-6 py-4 rounded-lg">
          <p className="font-semibold">Error loading runs</p>
          <p className="text-sm mt-1">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Test Runs</h1>
          <p className="mt-2 text-gray-600">
            View all test execution runs across your projects
          </p>
        </div>

        {/* Runs List */}
        {runs.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No test runs yet
            </h3>
            <p className="text-gray-600 mb-6">
              Create a project and run your first test
            </p>
            <Link
              href="/projects"
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700"
            >
              Go to Projects
            </Link>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Project
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Trigger
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Duration
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Started
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {runs.map((run) => (
                  <tr key={run.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[run.status]}`}>
                        {STATUS_ICONS[run.status]} {run.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {run.projects?.name}
                      </div>
                      <div className="text-sm text-gray-500">
                        {run.projects?.organizations?.name}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {run.trigger}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDuration(run.started_at, run.finished_at)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {run.started_at 
                        ? new Date(run.started_at).toLocaleString()
                        : 'Not started'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <Link
                        href={`/runs/${run.id}`}
                        className="text-blue-600 hover:text-blue-900"
                      >
                        View Details
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}