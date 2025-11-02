/**
 * Flake Detection Algorithm
 * 
 * Analyzes test execution history to identify flaky tests using statistical methods.
 * A flaky test is one that exhibits non-deterministic behavior - sometimes passing,
 * sometimes failing without code changes.
 */

import { getSupabaseClient } from './supabase.js';

/**
 * Flake detection thresholds and configuration
 */
const DEFAULT_CONFIG = {
  // Minimum number of runs to consider for flake detection
  minRuns: 5,
  
  // Time window for analysis (days)
  timeWindowDays: 30,
  
  // Flake rate threshold (percentage)
  flakeRateThreshold: 10, // 10% failure rate
  
  // Minimum failures to consider
  minFailures: 2,
  
  // Confidence level for statistical significance
  confidenceLevel: 0.95,
};

/**
 * Calculate flake rate for a test
 * 
 * @param {number} passed - Number of passed runs
 * @param {number} failed - Number of failed runs
 * @param {number} flaky - Number of flaky runs
 * @returns {number} Flake rate as percentage
 */
export function calculateFlakeRate(passed, failed, flaky) {
  const total = passed + failed + flaky;
  if (total === 0) return 0;
  
  const unstable = failed + flaky;
  return (unstable / total) * 100;
}

/**
 * Calculate confidence interval for flake rate
 * Uses Wilson score interval for binomial proportion
 * 
 * @param {number} successes - Number of successes
 * @param {number} total - Total number of trials
 * @param {number} confidence - Confidence level (default 0.95)
 * @returns {object} Lower and upper bounds of confidence interval
 */
export function calculateConfidenceInterval(successes, total, confidence = 0.95) {
  if (total === 0) return { lower: 0, upper: 0 };
  
  const p = successes / total;
  const z = confidence === 0.95 ? 1.96 : 2.576; // 95% or 99%
  
  const denominator = 1 + (z * z) / total;
  const center = p + (z * z) / (2 * total);
  const margin = z * Math.sqrt((p * (1 - p) + (z * z) / (4 * total)) / total);
  
  return {
    lower: Math.max(0, (center - margin) / denominator),
    upper: Math.min(1, (center + margin) / denominator),
  };
}

/**
 * Detect if a test is statistically flaky
 * 
 * @param {object} stats - Test statistics
 * @param {object} config - Detection configuration
 * @returns {boolean} True if test is flaky
 */
export function isFlaky(stats, config = DEFAULT_CONFIG) {
  const { passed, failed, flaky, total } = stats;
  
  // Must have minimum number of runs
  if (total < config.minRuns) return false;
  
  // Must have both passes and failures
  if (passed === 0 || (failed + flaky) < config.minFailures) return false;
  
  // Calculate flake rate
  const flakeRate = calculateFlakeRate(passed, failed, flaky);
  
  // Check if flake rate exceeds threshold
  if (flakeRate < config.flakeRateThreshold) return false;
  
  // Calculate confidence interval for failure rate
  const failures = failed + flaky;
  const ci = calculateConfidenceInterval(failures, total, config.confidenceLevel);
  
  // Test is flaky if lower bound of CI is above 0 (statistically significant failures)
  // and upper bound is below 1 (not always failing)
  return ci.lower > 0 && ci.upper < 1;
}

/**
 * Analyze test history for flakiness
 * 
 * @param {string} testCaseId - Test case ID
 * @param {object} options - Analysis options
 * @returns {Promise<object>} Flake analysis result
 */
export async function analyzeTestFlakiness(testCaseId, options = {}) {
  const config = { ...DEFAULT_CONFIG, ...options };
  const supabase = getSupabaseClient();
  
  // Calculate time window
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - config.timeWindowDays);
  
  // Fetch test execution history
  const { data: runs, error } = await supabase
    .from('run_tests')
    .select('status, duration_ms, created_at, run_id')
    .eq('test_case_id', testCaseId)
    .gte('created_at', startDate.toISOString())
    .order('created_at', { ascending: false });
  
  if (error) {
    throw new Error(`Failed to fetch test history: ${error.message}`);
  }
  
  if (!runs || runs.length === 0) {
    return {
      testCaseId,
      isFlaky: false,
      reason: 'insufficient_data',
      stats: { total: 0, passed: 0, failed: 0, flaky: 0 },
    };
  }
  
  // Calculate statistics
  const stats = {
    total: runs.length,
    passed: runs.filter(r => r.status === 'passed').length,
    failed: runs.filter(r => r.status === 'failed').length,
    flaky: runs.filter(r => r.status === 'flaky').length,
    skipped: runs.filter(r => r.status === 'skipped').length,
    avgDuration: runs.reduce((sum, r) => sum + (r.duration_ms || 0), 0) / runs.length,
  };
  
  // Detect flakiness
  const flaky = isFlaky(stats, config);
  const flakeRate = calculateFlakeRate(stats.passed, stats.failed, stats.flaky);
  
  // Calculate confidence interval
  const failures = stats.failed + stats.flaky;
  const ci = calculateConfidenceInterval(failures, stats.total, config.confidenceLevel);
  
  // Analyze patterns
  const patterns = analyzeFailurePatterns(runs);
  
  return {
    testCaseId,
    isFlaky: flaky,
    flakeRate: Math.round(flakeRate * 100) / 100,
    stats,
    confidence: {
      level: config.confidenceLevel,
      interval: {
        lower: Math.round(ci.lower * 10000) / 100,
        upper: Math.round(ci.upper * 10000) / 100,
      },
    },
    patterns,
    recommendation: generateRecommendation(flaky, flakeRate, patterns),
  };
}

/**
 * Analyze failure patterns in test runs
 * 
 * @param {Array} runs - Test run history
 * @returns {object} Pattern analysis
 */
function analyzeFailurePatterns(runs) {
  if (runs.length < 2) {
    return { hasPattern: false };
  }
  
  // Check for consecutive failures
  let maxConsecutiveFailures = 0;
  let currentStreak = 0;
  
  for (const run of runs) {
    if (run.status === 'failed' || run.status === 'flaky') {
      currentStreak++;
      maxConsecutiveFailures = Math.max(maxConsecutiveFailures, currentStreak);
    } else {
      currentStreak = 0;
    }
  }
  
  // Check for alternating pattern
  let alternations = 0;
  for (let i = 1; i < runs.length; i++) {
    const prev = runs[i - 1].status;
    const curr = runs[i].status;
    if ((prev === 'passed' && curr === 'failed') || 
        (prev === 'failed' && curr === 'passed')) {
      alternations++;
    }
  }
  
  const alternationRate = alternations / (runs.length - 1);
  
  // Check for time-based patterns
  const failuresByHour = {};
  for (const run of runs) {
    if (run.status === 'failed' || run.status === 'flaky') {
      const hour = new Date(run.created_at).getHours();
      failuresByHour[hour] = (failuresByHour[hour] || 0) + 1;
    }
  }
  
  return {
    hasPattern: maxConsecutiveFailures > 2 || alternationRate > 0.5,
    maxConsecutiveFailures,
    alternationRate: Math.round(alternationRate * 100) / 100,
    timePattern: Object.keys(failuresByHour).length > 0 ? failuresByHour : null,
  };
}

/**
 * Generate recommendation based on flake analysis
 * 
 * @param {boolean} isFlaky - Whether test is flaky
 * @param {number} flakeRate - Flake rate percentage
 * @param {object} patterns - Failure patterns
 * @returns {string} Recommendation text
 */
function generateRecommendation(isFlaky, flakeRate, patterns) {
  if (!isFlaky) {
    return 'Test appears stable. Continue monitoring.';
  }
  
  const recommendations = [];
  
  if (flakeRate > 30) {
    recommendations.push('High flake rate detected. Investigate test logic and dependencies.');
  } else if (flakeRate > 15) {
    recommendations.push('Moderate flake rate. Review test for timing issues or race conditions.');
  } else {
    recommendations.push('Low flake rate. Monitor for patterns.');
  }
  
  if (patterns.maxConsecutiveFailures > 3) {
    recommendations.push('Consecutive failures detected. Check for environmental issues.');
  }
  
  if (patterns.alternationRate > 0.5) {
    recommendations.push('Alternating pass/fail pattern suggests timing or state issues.');
  }
  
  if (patterns.timePattern) {
    recommendations.push('Time-based failure pattern detected. Check for time-dependent logic.');
  }
  
  return recommendations.join(' ');
}

/**
 * Batch analyze multiple tests for flakiness
 * 
 * @param {string} projectId - Project ID
 * @param {object} options - Analysis options
 * @returns {Promise<Array>} Array of flake analysis results
 */
export async function analyzeProjectFlakiness(projectId, options = {}) {
  const supabase = getSupabaseClient();
  
  // Fetch all test cases for project
  const { data: testCases, error } = await supabase
    .from('test_cases')
    .select('id, title, suite_id')
    .eq('project_id', projectId);
  
  if (error) {
    throw new Error(`Failed to fetch test cases: ${error.message}`);
  }
  
  // Analyze each test case
  const results = [];
  for (const testCase of testCases) {
    try {
      const analysis = await analyzeTestFlakiness(testCase.id, options);
      if (analysis.isFlaky) {
        results.push({
          ...analysis,
          title: testCase.title,
          suiteId: testCase.suite_id,
        });
      }
    } catch (error) {
      console.error(`Failed to analyze test ${testCase.id}:`, error);
    }
  }
  
  // Sort by flake rate (highest first)
  results.sort((a, b) => b.flakeRate - a.flakeRate);
  
  return results;
}

/**
 * Get flake detection summary for a project
 * 
 * @param {string} projectId - Project ID
 * @returns {Promise<object>} Flake summary
 */
export async function getFlakeSummary(projectId) {
  const supabase = getSupabaseClient();
  
  // Use the flaky_tests view from database
  const { data: flakyTests, error } = await supabase
    .from('flaky_tests')
    .select('*')
    .eq('project_id', projectId);
  
  if (error) {
    throw new Error(`Failed to fetch flaky tests: ${error.message}`);
  }
  
  const summary = {
    totalFlaky: flakyTests?.length || 0,
    avgFlakeRate: 0,
    highRisk: 0,
    mediumRisk: 0,
    lowRisk: 0,
  };
  
  if (flakyTests && flakyTests.length > 0) {
    summary.avgFlakeRate = flakyTests.reduce((sum, t) => sum + parseFloat(t.flake_rate || 0), 0) / flakyTests.length;
    
    for (const test of flakyTests) {
      const rate = parseFloat(test.flake_rate || 0);
      if (rate > 30) summary.highRisk++;
      else if (rate > 15) summary.mediumRisk++;
      else summary.lowRisk++;
    }
  }
  
  return summary;
}