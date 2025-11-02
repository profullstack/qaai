/**
 * Project Settings Page
 * 
 * Configure test execution settings including retry, timeout, and environment variables.
 */

'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';

export default function SettingsPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id;
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  
  const [settings, setSettings] = useState({
    // Retry settings
    test_retries: 2,
    retry_on_failure_only: true,
    
    // Timeout settings
    test_timeout: 30000,
    action_timeout: 10000,
    navigation_timeout: 30000,
    
    // Execution settings
    parallel: false,
    workers: 1,
    
    // Browser settings
    browsers: ['chromium'],
    headless: true,
    
    // Artifact settings
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    
    // Viewport settings
    viewport_width: 1280,
    viewport_height: 720,
    
    // Other settings
    ignore_https_errors: false,
    base_url: '',
  });

  useEffect(() => {
    loadSettings();
  }, [projectId]);

  async function loadSettings() {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(`/api/projects/${projectId}`);
      
      if (!response.ok) {
        throw new Error('Failed to load project settings');
      }
      
      const project = await response.json();
      
      // Merge with existing settings
      if (project.test_config) {
        setSettings(prev => ({ ...prev, ...project.test_config }));
      }
      
      if (project.app_base_url) {
        setSettings(prev => ({ ...prev, base_url: project.app_base_url }));
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function saveSettings() {
    try {
      setSaving(true);
      setError(null);
      setSuccess(false);
      
      const response = await fetch(`/api/projects/${projectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          test_config: settings,
          app_base_url: settings.base_url,
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to save settings');
      }
      
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  function updateSetting(key, value) {
    setSettings(prev => ({ ...prev, [key]: value }));
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-4xl mx-auto">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/4 mb-8"></div>
            <div className="space-y-4">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="h-24 bg-gray-200 rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Test Configuration</h1>
          <p className="text-gray-600 mt-1">Configure test execution settings and behavior</p>
        </div>

        {/* Success Message */}
        {success && (
          <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center">
              <svg className="h-5 w-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span className="ml-2 text-green-800">Settings saved successfully!</span>
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center">
              <svg className="h-5 w-5 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <span className="ml-2 text-red-800">{error}</span>
            </div>
          </div>
        )}

        <div className="space-y-6">
          {/* Retry Settings */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Retry Configuration</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Number of Retries
                </label>
                <input
                  type="number"
                  min="0"
                  max="5"
                  value={settings.test_retries}
                  onChange={(e) => updateSetting('test_retries', parseInt(e.target.value))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
                <p className="mt-1 text-sm text-gray-500">
                  Number of times to retry failed tests (0-5)
                </p>
              </div>
              
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="retry_on_failure_only"
                  checked={settings.retry_on_failure_only}
                  onChange={(e) => updateSetting('retry_on_failure_only', e.target.checked)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="retry_on_failure_only" className="ml-2 text-sm text-gray-700">
                  Only retry on failure (not on timeout)
                </label>
              </div>
            </div>
          </div>

          {/* Timeout Settings */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Timeout Configuration</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Test Timeout (ms)
                </label>
                <input
                  type="number"
                  min="5000"
                  max="300000"
                  step="1000"
                  value={settings.test_timeout}
                  onChange={(e) => updateSetting('test_timeout', parseInt(e.target.value))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
                <p className="mt-1 text-sm text-gray-500">
                  Maximum time for a single test (5s - 300s)
                </p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Action Timeout (ms)
                </label>
                <input
                  type="number"
                  min="1000"
                  max="60000"
                  step="1000"
                  value={settings.action_timeout}
                  onChange={(e) => updateSetting('action_timeout', parseInt(e.target.value))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
                <p className="mt-1 text-sm text-gray-500">
                  Timeout for individual actions like click, fill (1s - 60s)
                </p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Navigation Timeout (ms)
                </label>
                <input
                  type="number"
                  min="5000"
                  max="120000"
                  step="1000"
                  value={settings.navigation_timeout}
                  onChange={(e) => updateSetting('navigation_timeout', parseInt(e.target.value))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
                <p className="mt-1 text-sm text-gray-500">
                  Timeout for page navigation (5s - 120s)
                </p>
              </div>
            </div>
          </div>

          {/* Execution Settings */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Execution Settings</h2>
            
            <div className="space-y-4">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="parallel"
                  checked={settings.parallel}
                  onChange={(e) => updateSetting('parallel', e.target.checked)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="parallel" className="ml-2 text-sm text-gray-700">
                  Run tests in parallel
                </label>
              </div>
              
              {settings.parallel && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Number of Workers
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={settings.workers}
                    onChange={(e) => updateSetting('workers', parseInt(e.target.value))}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="mt-1 text-sm text-gray-500">
                    Number of parallel workers (1-10)
                  </p>
                </div>
              )}
              
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="headless"
                  checked={settings.headless}
                  onChange={(e) => updateSetting('headless', e.target.checked)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="headless" className="ml-2 text-sm text-gray-700">
                  Run in headless mode
                </label>
              </div>
            </div>
          </div>

          {/* Artifact Settings */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Artifact Collection</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Trace Collection
                </label>
                <select
                  value={settings.trace}
                  onChange={(e) => updateSetting('trace', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="off">Off</option>
                  <option value="on">Always On</option>
                  <option value="on-first-retry">On First Retry</option>
                  <option value="retain-on-failure">Retain on Failure</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Screenshot Capture
                </label>
                <select
                  value={settings.screenshot}
                  onChange={(e) => updateSetting('screenshot', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="off">Off</option>
                  <option value="on">Always On</option>
                  <option value="only-on-failure">Only on Failure</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Video Recording
                </label>
                <select
                  value={settings.video}
                  onChange={(e) => updateSetting('video', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="off">Off</option>
                  <option value="on">Always On</option>
                  <option value="retain-on-failure">Retain on Failure</option>
                  <option value="on-first-retry">On First Retry</option>
                </select>
              </div>
            </div>
          </div>

          {/* Base URL */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Application Settings</h2>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Base URL
              </label>
              <input
                type="url"
                value={settings.base_url}
                onChange={(e) => updateSetting('base_url', e.target.value)}
                placeholder="https://example.com"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
              <p className="mt-1 text-sm text-gray-500">
                Base URL for your application under test
              </p>
            </div>
          </div>

          {/* Save Button */}
          <div className="flex justify-end gap-4">
            <button
              onClick={() => router.back()}
              className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={saveSettings}
              disabled={saving}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}