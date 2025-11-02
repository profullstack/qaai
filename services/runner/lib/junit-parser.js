/**
 * JUnit XML Parser
 * 
 * Parses JUnit XML test results from Playwright into structured data.
 */

import { parseStringPromise } from 'xml2js';

/**
 * Parse JUnit XML string into structured test results
 * 
 * @param {string} xmlContent - JUnit XML content
 * @returns {Promise<object>} Parsed test results
 */
export async function parseJUnitXML(xmlContent) {
  try {
    const result = await parseStringPromise(xmlContent, {
      explicitArray: false,
      mergeAttrs: true,
    });
    
    if (!result.testsuites) {
      throw new Error('Invalid JUnit XML: missing testsuites element');
    }
    
    const testsuites = result.testsuites;
    const suites = Array.isArray(testsuites.testsuite) 
      ? testsuites.testsuite 
      : [testsuites.testsuite];
    
    // Parse summary statistics
    const summary = {
      total: parseInt(testsuites.tests || '0', 10),
      passed: 0,
      failed: parseInt(testsuites.failures || '0', 10),
      skipped: parseInt(testsuites.skipped || '0', 10),
      errors: parseInt(testsuites.errors || '0', 10),
      duration: parseFloat(testsuites.time || '0'),
    };
    
    summary.passed = summary.total - summary.failed - summary.skipped - summary.errors;
    
    // Parse individual test cases
    const tests = [];
    
    for (const suite of suites) {
      if (!suite.testcase) continue;
      
      const testcases = Array.isArray(suite.testcase) 
        ? suite.testcase 
        : [suite.testcase];
      
      for (const testcase of testcases) {
        const test = {
          name: testcase.name,
          classname: testcase.classname,
          file: testcase.file || testcase.classname,
          duration: parseFloat(testcase.time || '0'),
          status: 'passed',
          error: null,
          failure: null,
          stdout: null,
          stderr: null,
        };
        
        // Check for failure
        if (testcase.failure) {
          test.status = 'failed';
          test.failure = {
            message: testcase.failure.message || 'Test failed',
            type: testcase.failure.type || 'AssertionError',
            details: typeof testcase.failure === 'string' 
              ? testcase.failure 
              : testcase.failure._ || '',
          };
        }
        
        // Check for error
        if (testcase.error) {
          test.status = 'error';
          test.error = {
            message: testcase.error.message || 'Test error',
            type: testcase.error.type || 'Error',
            details: typeof testcase.error === 'string' 
              ? testcase.error 
              : testcase.error._ || '',
          };
        }
        
        // Check for skipped
        if (testcase.skipped) {
          test.status = 'skipped';
        }
        
        // Capture stdout/stderr if present
        if (testcase['system-out']) {
          test.stdout = testcase['system-out'];
        }
        
        if (testcase['system-err']) {
          test.stderr = testcase['system-err'];
        }
        
        tests.push(test);
      }
    }
    
    return {
      summary,
      tests,
    };
    
  } catch (error) {
    throw new Error(`Failed to parse JUnit XML: ${error.message}`);
  }
}

/**
 * Extract error information from test result
 * 
 * @param {object} test - Test result object
 * @returns {object|null} Error information or null
 */
export function extractError(test) {
  if (test.status === 'passed' || test.status === 'skipped') {
    return null;
  }
  
  const errorInfo = test.failure || test.error;
  if (!errorInfo) {
    return null;
  }
  
  return {
    message: errorInfo.message,
    type: errorInfo.type,
    stack: errorInfo.details,
  };
}

/**
 * Group tests by file
 * 
 * @param {Array} tests - Array of test results
 * @returns {object} Tests grouped by file
 */
export function groupTestsByFile(tests) {
  const grouped = {};
  
  for (const test of tests) {
    const file = test.file || test.classname || 'unknown';
    
    if (!grouped[file]) {
      grouped[file] = {
        file,
        tests: [],
        summary: {
          total: 0,
          passed: 0,
          failed: 0,
          skipped: 0,
          errors: 0,
          duration: 0,
        },
      };
    }
    
    grouped[file].tests.push(test);
    grouped[file].summary.total++;
    grouped[file].summary.duration += test.duration;
    
    switch (test.status) {
      case 'passed':
        grouped[file].summary.passed++;
        break;
      case 'failed':
        grouped[file].summary.failed++;
        break;
      case 'skipped':
        grouped[file].summary.skipped++;
        break;
      case 'error':
        grouped[file].summary.errors++;
        break;
    }
  }
  
  return grouped;
}

/**
 * Calculate test statistics
 * 
 * @param {Array} tests - Array of test results
 * @returns {object} Test statistics
 */
export function calculateStats(tests) {
  const stats = {
    total: tests.length,
    passed: 0,
    failed: 0,
    skipped: 0,
    errors: 0,
    duration: 0,
    passRate: 0,
    avgDuration: 0,
  };
  
  for (const test of tests) {
    stats.duration += test.duration;
    
    switch (test.status) {
      case 'passed':
        stats.passed++;
        break;
      case 'failed':
        stats.failed++;
        break;
      case 'skipped':
        stats.skipped++;
        break;
      case 'error':
        stats.errors++;
        break;
    }
  }
  
  if (stats.total > 0) {
    stats.passRate = (stats.passed / stats.total) * 100;
    stats.avgDuration = stats.duration / stats.total;
  }
  
  return stats;
}

/**
 * Format duration in human-readable format
 * 
 * @param {number} seconds - Duration in seconds
 * @returns {string} Formatted duration
 */
export function formatDuration(seconds) {
  if (seconds < 1) {
    return `${Math.round(seconds * 1000)}ms`;
  }
  
  if (seconds < 60) {
    return `${seconds.toFixed(2)}s`;
  }
  
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.round(seconds % 60);
  return `${minutes}m ${remainingSeconds}s`;
}

/**
 * Get failed tests from results
 * 
 * @param {Array} tests - Array of test results
 * @returns {Array} Failed tests
 */
export function getFailedTests(tests) {
  return tests.filter(test => test.status === 'failed' || test.status === 'error');
}

/**
 * Get flaky test candidates (tests that sometimes pass, sometimes fail)
 * This requires historical data, so it returns a structure for tracking
 * 
 * @param {Array} tests - Array of test results
 * @returns {Array} Test identifiers for flake tracking
 */
export function getFlakyTestCandidates(tests) {
  return tests.map(test => ({
    name: test.name,
    file: test.file,
    status: test.status,
    duration: test.duration,
  }));
}