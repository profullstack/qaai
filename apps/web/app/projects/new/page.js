'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function NewProjectPage() {
  const [organizations, setOrganizations] = useState([]);
  const [formData, setFormData] = useState({
    org_id: '',
    name: '',
    repo_url: '',
    app_base_url: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const router = useRouter();

  useEffect(() => {
    fetchOrganizations();
  }, []);

  const fetchOrganizations = async () => {
    try {
      const res = await fetch('/api/organizations');
      if (!res.ok) throw new Error('Failed to fetch organizations');
      
      const data = await res.json();
      setOrganizations(data.organizations || []);
      
      // Auto-select first org if available
      if (data.organizations?.length > 0) {
        setFormData(prev => ({ ...prev, org_id: data.organizations[0].id }));
      }
    } catch (err) {
      setError(err.message);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create project');
      }

      const { project } = await res.json();
      router.push(`/projects/${project.id}`);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  if (organizations.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow p-8 max-w-md text-center">
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            No Organizations Found
          </h2>
          <p className="text-gray-600 mb-6">
            You need to create an organization before creating a project.
          </p>
          <Link
            href="/organizations/new"
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700"
          >
            Create Organization
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <Link href="/projects" className="text-blue-600 hover:text-blue-700 text-sm">
            ← Back to Projects
          </Link>
          <h1 className="text-3xl font-bold text-gray-900 mt-4">Create New Project</h1>
          <p className="mt-2 text-gray-600">
            Set up a new QA testing project
          </p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          {error && (
            <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="org_id" className="block text-sm font-medium text-gray-700">
                Organization *
              </label>
              <select
                id="org_id"
                name="org_id"
                required
                value={formData.org_id}
                onChange={handleChange}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Select an organization</option>
                {organizations.map(org => (
                  <option key={org.id} value={org.id}>
                    {org.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                Project Name *
              </label>
              <input
                type="text"
                id="name"
                name="name"
                required
                value={formData.name}
                onChange={handleChange}
                placeholder="My Awesome App"
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label htmlFor="repo_url" className="block text-sm font-medium text-gray-700">
                Repository URL
              </label>
              <input
                type="url"
                id="repo_url"
                name="repo_url"
                value={formData.repo_url}
                onChange={handleChange}
                placeholder="https://github.com/username/repo"
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
              <p className="mt-1 text-sm text-gray-500">
                GitHub repository for PR integration
              </p>
            </div>

            <div>
              <label htmlFor="app_base_url" className="block text-sm font-medium text-gray-700">
                Application Base URL
              </label>
              <input
                type="url"
                id="app_base_url"
                name="app_base_url"
                value={formData.app_base_url}
                onChange={handleChange}
                placeholder="https://app.example.com"
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
              <p className="mt-1 text-sm text-gray-500">
                Base URL for E2E testing (e.g., staging or production URL)
              </p>
            </div>

            <div className="flex justify-end space-x-3 pt-4">
              <Link
                href="/projects"
                className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
              >
                Cancel
              </Link>
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Creating...' : 'Create Project'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}