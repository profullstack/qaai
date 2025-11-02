'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

export default function ProjectDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetchProject();
  }, [params.id]);

  const fetchProject = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/projects/${params.id}`);
      
      if (!res.ok) {
        if (res.status === 404) {
          throw new Error('Project not found');
        }
        throw new Error('Failed to fetch project');
      }

      const data = await res.json();
      setProject(data.project);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this project? This action cannot be undone.')) {
      return;
    }

    setDeleting(true);
    try {
      const res = await fetch(`/api/projects/${params.id}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        throw new Error('Failed to delete project');
      }

      router.push('/projects');
    } catch (err) {
      alert(`Error: ${err.message}`);
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading project...</p>
        </div>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-red-50 border border-red-200 text-red-700 px-6 py-4 rounded-lg max-w-md">
          <p className="font-semibold">Error</p>
          <p className="text-sm mt-1">{error || 'Project not found'}</p>
          <Link href="/projects" className="text-sm text-blue-600 hover:text-blue-700 mt-2 inline-block">
            ← Back to Projects
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <Link href="/projects" className="text-blue-600 hover:text-blue-700 text-sm">
            ← Back to Projects
          </Link>
          <div className="mt-4 flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{project.name}</h1>
              <p className="mt-2 text-gray-600">
                Organization: {project.organizations?.name}
              </p>
            </div>
            <div className="flex space-x-3">
              <Link
                href={`/projects/${project.id}/settings`}
                className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
              >
                Settings
              </Link>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-4 py-2 border border-red-300 rounded-md shadow-sm text-sm font-medium text-red-700 bg-white hover:bg-red-50 disabled:opacity-50"
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>

        {/* Project Info */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-sm font-medium text-gray-500 mb-2">Repository</h3>
            {project.repo_url ? (
              <a
                href={project.repo_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-700 break-all"
              >
                {project.repo_url}
              </a>
            ) : (
              <p className="text-gray-400">Not configured</p>
            )}
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-sm font-medium text-gray-500 mb-2">App Base URL</h3>
            {project.app_base_url ? (
              <a
                href={project.app_base_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-700 break-all"
              >
                {project.app_base_url}
              </a>
            ) : (
              <p className="text-gray-400">Not configured</p>
            )}
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-sm font-medium text-gray-500 mb-2">Created</h3>
            <p className="text-gray-900">
              {new Date(project.created_at).toLocaleDateString()}
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-sm font-medium text-gray-500 mb-2">Test Suites</h3>
            <p className="text-3xl font-bold text-gray-900">0</p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-sm font-medium text-gray-500 mb-2">Total Runs</h3>
            <p className="text-3xl font-bold text-blue-600">0</p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-sm font-medium text-gray-500 mb-2">Pass Rate</h3>
            <p className="text-3xl font-bold text-green-600">0%</p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-sm font-medium text-gray-500 mb-2">Flake Rate</h3>
            <p className="text-3xl font-bold text-yellow-600">0%</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow">
          <div className="border-b border-gray-200">
            <nav className="flex -mb-px">
              <button className="px-6 py-4 text-sm font-medium text-blue-600 border-b-2 border-blue-600">
                Overview
              </button>
              <button className="px-6 py-4 text-sm font-medium text-gray-500 hover:text-gray-700">
                Test Suites
              </button>
              <button className="px-6 py-4 text-sm font-medium text-gray-500 hover:text-gray-700">
                Recent Runs
              </button>
              <button className="px-6 py-4 text-sm font-medium text-gray-500 hover:text-gray-700">
                Test Users
              </button>
            </nav>
          </div>

          <div className="p-6">
            {/* Getting Started */}
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <button className="p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors text-left">
                    <h4 className="font-medium text-gray-900">Create Test Suite</h4>
                    <p className="text-sm text-gray-600 mt-1">Organize your tests into suites</p>
                  </button>
                  
                  <button className="p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors text-left">
                    <h4 className="font-medium text-gray-900">Generate from PR</h4>
                    <p className="text-sm text-gray-600 mt-1">Let AI create tests from a pull request</p>
                  </button>
                  
                  <button className="p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors text-left">
                    <h4 className="font-medium text-gray-900">Add Test User</h4>
                    <p className="text-sm text-gray-600 mt-1">Configure test credentials for authentication</p>
                  </button>
                  
                  <button className="p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors text-left">
                    <h4 className="font-medium text-gray-900">Run Tests</h4>
                    <p className="text-sm text-gray-600 mt-1">Execute your test suites</p>
                  </button>
                </div>
              </div>

              {/* Recent Activity */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h3>
                <div className="text-center py-12 text-gray-500 border-2 border-dashed border-gray-200 rounded-lg">
                  <p>No activity yet</p>
                  <p className="text-sm mt-2">Test runs will appear here</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}