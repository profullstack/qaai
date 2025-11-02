/**
 * Analytics Dashboard Page
 * 
 * Displays flake detection heatmap and test analytics for a project.
 */

'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';

export default function AnalyticsPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id;
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [timeWindow, setTimeWindow] = useState(30);
  const [analyzing, setAnalyzing] = useState(false);

  useEffect(() => {
    loadAnalytics();
  }, [projectId, timeWindow]);

  async function loadAnalytics() {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(
        `/api/analytics/flakes?project_id=${projectId}&time_window=${timeWindow}`
      );
      
      if (!response.ok) {
        throw new Error('Failed to load analytics');
      }
      
      const data = await response.json();
      setAnalytics(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function runAnalysis() {
    try {
      setAnalyzing(true);
      setError(null);
      
      const response = await fetch('/api/analytics/flakes/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          project_id: projectId,
          options: { timeWindowDays: timeWindow }
        }),
      });
      
      if (!response.ok) {
        throw new Error('Analysis failed');
      }
      
      await loadAnalytics();
    } catch (err) {
      setError(err.message);
    } finally {
      setAnalyzing(false);
    }
  }

  function getRiskColor(flakeRate) {
    if (flakeRate > 30) return 'bg-red-500';
    if (flakeRate > 15) return 'bg-orange-500';
    if (flakeRate > 5) return 'bg-yellow-500';
    return 'bg-green-500';
  }

  function getRiskLabel(flakeRate) {
    if (flakeRate > 30) return 'High Risk';
    if (flakeRate > 15) return 'Medium Risk';
    if (flakeRate > 5) return 'Low Risk';
    return 'Stable';
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/4 mb-8"></div>
            <div className="grid grid-cols-4 gap-4 mb-8">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="h-24 bg-gray-200 rounded"></div>
              ))}
            </div>
            <div className="h-96 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <h3 className="text-red-800 font-semibold mb-2">Error</h3>
            <p className="text-red-600">{error}</p>
            <button
              onClick={loadAnalytics}
              className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  const { summary, flakyTests } = analytics || {};

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Test Analytics</h1>
            <p className="text-gray-600 mt-1">Flake detection and test stability analysis</p>
          </div>
          <div className="flex gap-4">
            <select
              value={timeWindow}
              onChange={(e) => setTimeWindow(parseInt(e.target.value))}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="7">Last 7 days</option>
              <option value="14">Last 14 days</option>
              <option value="30">Last 30 days</option>
              <option value="60">Last 60 days</option>
              <option value="90">Last 90 days</option>
            </select>
            <button
              onClick={runAnalysis}
              disabled={analyzing}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {analyzing ? 'Analyzing...' : 'Run Analysis'}
            </button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm font-medium text-gray-600 mb-2">Total Flaky Tests</div>
            <div className="text-3xl font-bold text-gray-900">{summary?.totalFlaky || 0}</div>
          </div>
          
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm font-medium text-gray-600 mb-2">Avg Flake Rate</div>
            <div className="text-3xl font-bold text-gray-900">
              {summary?.avgFlakeRate ? `${summary.avgFlakeRate.toFixed(1)}%` : '0%'}
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm font-medium text-gray-600 mb-2">High Risk</div>
            <div className="text-3xl font-bold text-red-600">{summary?.highRisk || 0}</div>
          </div>
          
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm font-medium text-gray-600 mb-2">Medium Risk</div>
            <div className="text-3xl font-bold text-orange-600">{summary?.mediumRisk || 0}</div>
          </div>
        </div>

        {/* Flake Heatmap */}
        <div className="bg-white rounded-lg shadow mb-8">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">Flake Heatmap</h2>
            <p className="text-sm text-gray-600 mt-1">
              Visual representation of test flakiness over time
            </p>
          </div>
          
          <div className="p-6">
            {!flakyTests || flakyTests.length === 0 ? (
              <div className="text-center py-12">
                <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <h3 className="mt-2 text-sm font-medium text-gray-900">No flaky tests detected</h3>
                <p className="mt-1 text-sm text-gray-500">
                  All tests appear stable. Great job!
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {flakyTests.map((test, index) => (
                  <div key={index} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <h3 className="font-medium text-gray-900">{test.title}</h3>
                          <span className={`px-2 py-1 text-xs font-medium text-white rounded ${getRiskColor(test.flakeRate)}`}>
                            {getRiskLabel(test.flakeRate)}
                          </span>
                        </div>
                        
                        <div className="mt-2 grid grid-cols-4 gap-4 text-sm">
                          <div>
                            <span className="text-gray-600">Flake Rate:</span>
                            <span className="ml-2 font-medium text-gray-900">{test.flakeRate.toFixed(1)}%</span>
                          </div>
                          <div>
                            <span className="text-gray-600">Total Runs:</span>
                            <span className="ml-2 font-medium text-gray-900">{test.stats.total}</span>
                          </div>
                          <div>
                            <span className="text-gray-600">Passed:</span>
                            <span className="ml-2 font-medium text-green-600">{test.stats.passed}</span>
                          </div>
                          <div>
                            <span className="text-gray-600">Failed:</span>
                            <span className="ml-2 font-medium text-red-600">{test.stats.failed}</span>
                          </div>
                        </div>
                        
                        {test.recommendation && (
                          <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded text-sm text-blue-800">
                            <strong>Recommendation:</strong> {test.recommendation}
                          </div>
                        )}
                        
                        {test.patterns?.hasPattern && (
                          <div className="mt-2 flex gap-2 text-xs">
                            {test.patterns.maxConsecutiveFailures > 2 && (
                              <span className="px-2 py-1 bg-orange-100 text-orange-800 rounded">
                                {test.patterns.maxConsecutiveFailures} consecutive failures
                              </span>
                            )}
                            {test.patterns.alternationRate > 0.5 && (
                              <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded">
                                Alternating pattern
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                      
                      {/* Visual heatmap bar */}
                      <div className="ml-4 w-32">
                        <div className="h-8 bg-gray-200 rounded overflow-hidden">
                          <div 
                            className={`h-full ${getRiskColor(test.flakeRate)}`}
                            style={{ width: `${Math.min(test.flakeRate, 100)}%` }}
                          ></div>
                        </div>
                        <div className="text-xs text-center text-gray-600 mt-1">
                          {test.flakeRate.toFixed(1)}%
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Legend */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Risk Levels</h3>
          <div className="grid grid-cols-4 gap-4">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-green-500 rounded"></div>
              <span className="text-sm text-gray-700">Stable (&lt;5%)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-yellow-500 rounded"></div>
              <span className="text-sm text-gray-700">Low Risk (5-15%)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-orange-500 rounded"></div>
              <span className="text-sm text-gray-700">Medium Risk (15-30%)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-red-500 rounded"></div>
              <span className="text-sm text-gray-700">High Risk (&gt;30%)</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}