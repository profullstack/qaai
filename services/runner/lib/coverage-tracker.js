/**
 * Coverage Tracker
 * 
 * Tracks route and API endpoint coverage from test executions.
 * Analyzes which endpoints are tested and provides coverage metrics.
 */

import { getSupabaseClient } from './supabase.js';

/**
 * Extract routes from test execution logs
 * 
 * @param {Array} testResults - Test results with logs
 * @returns {Array} Array of route objects
 */
export function extractRoutesFromLogs(testResults) {
  const routes = new Set();
  const routePattern = /(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s+(\/[^\s]*)/gi;
  
  for (const test of testResults) {
    const logs = test.logs || test.stdout || '';
    if (!logs) continue;
    
    const matches = logs.matchAll(routePattern);
    for (const match of matches) {
      const method = match[1].toUpperCase();
      const path = match[2];
      routes.add(JSON.stringify({ method, path }));
    }
  }
  
  return Array.from(routes).map(r => JSON.parse(r));
}

/**
 * Extract routes from Playwright network logs
 * 
 * @param {object} harData - HAR (HTTP Archive) data from Playwright
 * @returns {Array} Array of route objects
 */
export function extractRoutesFromHAR(harData) {
  if (!harData?.log?.entries) return [];
  
  const routes = new Map();
  
  for (const entry of harData.log.entries) {
    const { request } = entry;
    const url = new URL(request.url);
    
    // Skip external URLs and assets
    if (!url.pathname.startsWith('/api') && !url.pathname.startsWith('/')) continue;
    if (url.pathname.match(/\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf)$/)) continue;
    
    const method = request.method;
    const path = url.pathname;
    const key = `${method}:${path}`;
    
    if (!routes.has(key)) {
      routes.set(key, {
        method,
        path,
        statusCode: entry.response.status,
        responseTime: entry.time,
        timestamp: entry.startedDateTime,
      });
    }
  }
  
  return Array.from(routes.values());
}

/**
 * Normalize route path for comparison
 * Converts dynamic segments to patterns
 * 
 * @param {string} path - Route path
 * @returns {string} Normalized path
 */
export function normalizeRoutePath(path) {
  // Replace UUIDs with :id
  let normalized = path.replace(
    /\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
    '/:id'
  );
  
  // Replace numeric IDs with :id
  normalized = normalized.replace(/\/\d+/g, '/:id');
  
  // Remove query strings
  normalized = normalized.split('?')[0];
  
  // Remove trailing slashes
  normalized = normalized.replace(/\/$/, '') || '/';
  
  return normalized;
}

/**
 * Calculate coverage for a project
 * 
 * @param {string} projectId - Project ID
 * @param {Array} definedRoutes - Array of defined routes in the application
 * @returns {Promise<object>} Coverage statistics
 */
export async function calculateRouteCoverage(projectId, definedRoutes = []) {
  const supabase = getSupabaseClient();
  
  // Fetch recent test runs
  const { data: runs, error: runsError } = await supabase
    .from('runs')
    .select('id')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
    .limit(10);
  
  if (runsError) {
    throw new Error(`Failed to fetch runs: ${runsError.message}`);
  }
  
  if (!runs || runs.length === 0) {
    return {
      totalRoutes: definedRoutes.length,
      testedRoutes: 0,
      untestedRoutes: definedRoutes.length,
      coveragePercentage: 0,
      routes: [],
    };
  }
  
  // Fetch test results with logs
  const runIds = runs.map(r => r.id);
  const { data: testResults, error: testsError } = await supabase
    .from('run_tests')
    .select('logs, har_path')
    .in('run_id', runIds);
  
  if (testsError) {
    throw new Error(`Failed to fetch test results: ${testsError.message}`);
  }
  
  // Extract tested routes
  const testedRoutes = new Map();
  
  for (const test of testResults || []) {
    const routes = extractRoutesFromLogs([test]);
    
    for (const route of routes) {
      const normalized = normalizeRoutePath(route.path);
      const key = `${route.method}:${normalized}`;
      
      if (!testedRoutes.has(key)) {
        testedRoutes.set(key, {
          method: route.method,
          path: normalized,
          originalPath: route.path,
          testCount: 0,
          lastTested: null,
        });
      }
      
      const existing = testedRoutes.get(key);
      existing.testCount++;
    }
  }
  
  // Match with defined routes
  const routeCoverage = [];
  const testedSet = new Set(testedRoutes.keys());
  
  for (const route of definedRoutes) {
    const key = `${route.method}:${route.path}`;
    const tested = testedSet.has(key);
    
    routeCoverage.push({
      method: route.method,
      path: route.path,
      tested,
      testCount: tested ? testedRoutes.get(key).testCount : 0,
      category: route.category || 'uncategorized',
    });
  }
  
  // Add tested routes not in defined routes (discovered routes)
  for (const [key, route] of testedRoutes) {
    const exists = definedRoutes.some(
      r => `${r.method}:${r.path}` === key
    );
    
    if (!exists) {
      routeCoverage.push({
        method: route.method,
        path: route.path,
        tested: true,
        testCount: route.testCount,
        category: 'discovered',
      });
    }
  }
  
  const testedCount = routeCoverage.filter(r => r.tested).length;
  const totalCount = definedRoutes.length || routeCoverage.length;
  
  return {
    totalRoutes: totalCount,
    testedRoutes: testedCount,
    untestedRoutes: totalCount - testedCount,
    coveragePercentage: totalCount > 0 ? (testedCount / totalCount) * 100 : 0,
    routes: routeCoverage,
    discoveredRoutes: routeCoverage.filter(r => r.category === 'discovered'),
  };
}

/**
 * Get route coverage summary by category
 * 
 * @param {Array} routes - Route coverage data
 * @returns {object} Summary by category
 */
export function getCoverageSummaryByCategory(routes) {
  const summary = {};
  
  for (const route of routes) {
    const category = route.category || 'uncategorized';
    
    if (!summary[category]) {
      summary[category] = {
        total: 0,
        tested: 0,
        untested: 0,
        coverage: 0,
      };
    }
    
    summary[category].total++;
    if (route.tested) {
      summary[category].tested++;
    } else {
      summary[category].untested++;
    }
  }
  
  // Calculate coverage percentages
  for (const category in summary) {
    const { tested, total } = summary[category];
    summary[category].coverage = total > 0 ? (tested / total) * 100 : 0;
  }
  
  return summary;
}

/**
 * Get route coverage trends over time
 * 
 * @param {string} projectId - Project ID
 * @param {number} days - Number of days to analyze
 * @returns {Promise<Array>} Coverage trend data
 */
export async function getRouteCoverageTrends(projectId, days = 30) {
  const supabase = getSupabaseClient();
  
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  // Fetch runs in time window
  const { data: runs, error } = await supabase
    .from('runs')
    .select('id, created_at')
    .eq('project_id', projectId)
    .gte('created_at', startDate.toISOString())
    .order('created_at', { ascending: true });
  
  if (error) {
    throw new Error(`Failed to fetch runs: ${error.message}`);
  }
  
  const trends = [];
  const routesSeen = new Set();
  
  for (const run of runs || []) {
    // Fetch test results for this run
    const { data: testResults } = await supabase
      .from('run_tests')
      .select('logs')
      .eq('run_id', run.id);
    
    // Extract routes
    const routes = extractRoutesFromLogs(testResults || []);
    
    for (const route of routes) {
      const key = `${route.method}:${normalizeRoutePath(route.path)}`;
      routesSeen.add(key);
    }
    
    trends.push({
      date: run.created_at,
      routesCovered: routesSeen.size,
    });
  }
  
  return trends;
}

/**
 * Identify untested critical routes
 * 
 * @param {Array} routes - Route coverage data
 * @param {Array} criticalPaths - Array of critical route patterns
 * @returns {Array} Untested critical routes
 */
export function getUntestedCriticalRoutes(routes, criticalPaths = []) {
  const criticalPatterns = criticalPaths.map(p => new RegExp(p));
  
  return routes.filter(route => {
    if (route.tested) return false;
    
    const fullPath = `${route.method} ${route.path}`;
    return criticalPatterns.some(pattern => pattern.test(fullPath));
  });
}

/**
 * Generate coverage report
 * 
 * @param {string} projectId - Project ID
 * @param {object} options - Report options
 * @returns {Promise<object>} Coverage report
 */
export async function generateCoverageReport(projectId, options = {}) {
  const {
    definedRoutes = [],
    criticalPaths = ['/api/auth', '/api/payment', '/api/users'],
    includeTrends = true,
    trendDays = 30,
  } = options;
  
  // Calculate current coverage
  const coverage = await calculateRouteCoverage(projectId, definedRoutes);
  
  // Get summary by category
  const summaryByCategory = getCoverageSummaryByCategory(coverage.routes);
  
  // Get untested critical routes
  const untestedCritical = getUntestedCriticalRoutes(
    coverage.routes,
    criticalPaths
  );
  
  // Get trends if requested
  let trends = null;
  if (includeTrends) {
    trends = await getRouteCoverageTrends(projectId, trendDays);
  }
  
  return {
    summary: {
      totalRoutes: coverage.totalRoutes,
      testedRoutes: coverage.testedRoutes,
      untestedRoutes: coverage.untestedRoutes,
      coveragePercentage: Math.round(coverage.coveragePercentage * 100) / 100,
      discoveredRoutes: coverage.discoveredRoutes.length,
      untestedCritical: untestedCritical.length,
    },
    byCategory: summaryByCategory,
    routes: coverage.routes,
    untestedCritical,
    discoveredRoutes: coverage.discoveredRoutes,
    trends,
    generatedAt: new Date().toISOString(),
  };
}