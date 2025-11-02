/**
 * Test Data Seeder
 * 
 * Utilities for seeding and managing test data for E2E tests.
 * Supports multiple data generation strategies and cleanup.
 */

import { getSupabaseClient } from './supabase.js';
import { randomBytes } from 'crypto';

/**
 * Generate random string
 * 
 * @param {number} length - Length of string
 * @returns {string} Random string
 */
function generateRandomString(length = 10) {
  return randomBytes(length).toString('hex').slice(0, length);
}

/**
 * Generate random email
 * 
 * @param {string} domain - Email domain
 * @returns {string} Random email
 */
function generateRandomEmail(domain = 'test.example.com') {
  return `test-${generateRandomString(8)}@${domain}`;
}

/**
 * Generate random phone number
 * 
 * @returns {string} Random phone number
 */
function generateRandomPhone() {
  const areaCode = Math.floor(Math.random() * 900) + 100;
  const prefix = Math.floor(Math.random() * 900) + 100;
  const lineNumber = Math.floor(Math.random() * 9000) + 1000;
  return `+1${areaCode}${prefix}${lineNumber}`;
}

/**
 * Test user templates
 */
const USER_TEMPLATES = {
  admin: {
    role: 'admin',
    metadata: { permissions: ['read', 'write', 'delete', 'admin'] },
  },
  user: {
    role: 'user',
    metadata: { permissions: ['read', 'write'] },
  },
  viewer: {
    role: 'viewer',
    metadata: { permissions: ['read'] },
  },
  premium: {
    role: 'user',
    metadata: { subscription: 'premium', permissions: ['read', 'write'] },
  },
};

/**
 * Seed test users for a project
 * 
 * @param {string} projectId - Project ID
 * @param {object} options - Seeding options
 * @returns {Promise<Array>} Created test users
 */
export async function seedTestUsers(projectId, options = {}) {
  const {
    count = 5,
    templates = ['admin', 'user', 'viewer'],
    customUsers = [],
    password = 'Test123!@#',
  } = options;
  
  const supabase = getSupabaseClient();
  const users = [];
  
  // Create users from templates
  for (let i = 0; i < count; i++) {
    const template = templates[i % templates.length];
    const templateData = USER_TEMPLATES[template] || USER_TEMPLATES.user;
    
    const user = {
      project_id: projectId,
      name: `Test ${template} ${i + 1}`,
      email: generateRandomEmail(),
      phone: generateRandomPhone(),
      password_encrypted: Buffer.from(password).toString('base64'),
      role: templateData.role,
      metadata: {
        ...templateData.metadata,
        seeded: true,
        seededAt: new Date().toISOString(),
      },
    };
    
    users.push(user);
  }
  
  // Add custom users
  for (const customUser of customUsers) {
    users.push({
      project_id: projectId,
      ...customUser,
      password_encrypted: customUser.password 
        ? Buffer.from(customUser.password).toString('base64')
        : Buffer.from(password).toString('base64'),
      metadata: {
        ...customUser.metadata,
        seeded: true,
        seededAt: new Date().toISOString(),
      },
    });
  }
  
  // Insert users
  const { data, error } = await supabase
    .from('test_users')
    .insert(users)
    .select();
  
  if (error) {
    throw new Error(`Failed to seed test users: ${error.message}`);
  }
  
  return data;
}

/**
 * Seed test headers for a project
 * 
 * @param {string} projectId - Project ID
 * @param {Array} headerSets - Array of header set definitions
 * @returns {Promise<Array>} Created test headers
 */
export async function seedTestHeaders(projectId, headerSets = []) {
  const supabase = getSupabaseClient();
  
  const defaultHeaderSets = [
    {
      name: 'Basic Auth',
      description: 'Basic authentication headers',
      headers: {
        'Authorization': 'Basic dGVzdDp0ZXN0',
      },
    },
    {
      name: 'Bearer Token',
      description: 'Bearer token authentication',
      headers: {
        'Authorization': 'Bearer test-token-12345',
      },
    },
    {
      name: 'API Key',
      description: 'API key authentication',
      headers: {
        'X-API-Key': 'test-api-key-12345',
      },
    },
  ];
  
  const headers = [...defaultHeaderSets, ...headerSets].map(set => ({
    project_id: projectId,
    ...set,
  }));
  
  const { data, error } = await supabase
    .from('test_headers')
    .insert(headers)
    .select();
  
  if (error) {
    throw new Error(`Failed to seed test headers: ${error.message}`);
  }
  
  return data;
}

/**
 * Seed test suites for a project
 * 
 * @param {string} projectId - Project ID
 * @param {Array} suites - Array of suite definitions
 * @returns {Promise<Array>} Created test suites
 */
export async function seedTestSuites(projectId, suites = []) {
  const supabase = getSupabaseClient();
  
  const defaultSuites = [
    {
      name: 'Smoke Tests',
      tags: ['smoke', 'critical'],
    },
    {
      name: 'Authentication Tests',
      tags: ['auth', 'security'],
    },
    {
      name: 'API Tests',
      tags: ['api', 'integration'],
    },
    {
      name: 'UI Tests',
      tags: ['ui', 'e2e'],
    },
  ];
  
  const suitesToCreate = [...defaultSuites, ...suites].map(suite => ({
    project_id: projectId,
    ...suite,
  }));
  
  const { data, error } = await supabase
    .from('suites')
    .insert(suitesToCreate)
    .select();
  
  if (error) {
    throw new Error(`Failed to seed test suites: ${error.message}`);
  }
  
  return data;
}

/**
 * Clean up seeded test data
 * 
 * @param {string} projectId - Project ID
 * @param {object} options - Cleanup options
 * @returns {Promise<object>} Cleanup summary
 */
export async function cleanupTestData(projectId, options = {}) {
  const {
    cleanUsers = true,
    cleanHeaders = true,
    cleanSuites = false, // Don't clean suites by default
    olderThan = null, // Clean data older than this date
  } = options;
  
  const supabase = getSupabaseClient();
  const summary = {
    usersDeleted: 0,
    headersDeleted: 0,
    suitesDeleted: 0,
  };
  
  // Clean test users
  if (cleanUsers) {
    let query = supabase
      .from('test_users')
      .delete()
      .eq('project_id', projectId)
      .eq('metadata->>seeded', 'true');
    
    if (olderThan) {
      query = query.lt('created_at', olderThan);
    }
    
    const { data, error } = await query.select();
    if (!error && data) {
      summary.usersDeleted = data.length;
    }
  }
  
  // Clean test headers
  if (cleanHeaders) {
    let query = supabase
      .from('test_headers')
      .delete()
      .eq('project_id', projectId);
    
    if (olderThan) {
      query = query.lt('created_at', olderThan);
    }
    
    const { data, error } = await query.select();
    if (!error && data) {
      summary.headersDeleted = data.length;
    }
  }
  
  // Clean test suites (careful with this)
  if (cleanSuites) {
    let query = supabase
      .from('suites')
      .delete()
      .eq('project_id', projectId);
    
    if (olderThan) {
      query = query.lt('created_at', olderThan);
    }
    
    const { data, error } = await query.select();
    if (!error && data) {
      summary.suitesDeleted = data.length;
    }
  }
  
  return summary;
}

/**
 * Seed complete test environment
 * 
 * @param {string} projectId - Project ID
 * @param {object} options - Seeding options
 * @returns {Promise<object>} Seeding summary
 */
export async function seedTestEnvironment(projectId, options = {}) {
  const {
    users = { count: 5, templates: ['admin', 'user', 'viewer'] },
    headers = [],
    suites = [],
    cleanup = false,
  } = options;
  
  // Clean up existing data if requested
  if (cleanup) {
    await cleanupTestData(projectId, { cleanUsers: true, cleanHeaders: true });
  }
  
  // Seed data
  const [seededUsers, seededHeaders, seededSuites] = await Promise.all([
    seedTestUsers(projectId, users),
    seedTestHeaders(projectId, headers),
    seedTestSuites(projectId, suites),
  ]);
  
  return {
    users: seededUsers,
    headers: seededHeaders,
    suites: seededSuites,
    summary: {
      usersCreated: seededUsers.length,
      headersCreated: seededHeaders.length,
      suitesCreated: seededSuites.length,
    },
  };
}

/**
 * Get test user by role
 * 
 * @param {string} projectId - Project ID
 * @param {string} role - User role
 * @returns {Promise<object>} Test user
 */
export async function getTestUserByRole(projectId, role = 'user') {
  const supabase = getSupabaseClient();
  
  const { data, error } = await supabase
    .from('test_users')
    .select('*')
    .eq('project_id', projectId)
    .eq('role', role)
    .limit(1)
    .single();
  
  if (error) {
    throw new Error(`Failed to get test user: ${error.message}`);
  }
  
  // Decrypt password
  if (data && data.password_encrypted) {
    data.password = Buffer.from(data.password_encrypted, 'base64').toString('utf-8');
  }
  
  return data;
}

/**
 * Get test headers by name
 * 
 * @param {string} projectId - Project ID
 * @param {string} name - Header set name
 * @returns {Promise<object>} Test headers
 */
export async function getTestHeadersByName(projectId, name) {
  const supabase = getSupabaseClient();
  
  const { data, error } = await supabase
    .from('test_headers')
    .select('*')
    .eq('project_id', projectId)
    .eq('name', name)
    .single();
  
  if (error) {
    throw new Error(`Failed to get test headers: ${error.message}`);
  }
  
  return data;
}

/**
 * Generate test data fixtures
 * 
 * @param {string} type - Fixture type
 * @param {number} count - Number of fixtures to generate
 * @returns {Array} Generated fixtures
 */
export function generateFixtures(type, count = 10) {
  const fixtures = [];
  
  switch (type) {
    case 'users':
      for (let i = 0; i < count; i++) {
        fixtures.push({
          name: `User ${i + 1}`,
          email: generateRandomEmail(),
          phone: generateRandomPhone(),
          role: ['admin', 'user', 'viewer'][i % 3],
        });
      }
      break;
      
    case 'products':
      for (let i = 0; i < count; i++) {
        fixtures.push({
          name: `Product ${i + 1}`,
          sku: `SKU-${generateRandomString(8).toUpperCase()}`,
          price: Math.floor(Math.random() * 10000) / 100,
          stock: Math.floor(Math.random() * 100),
        });
      }
      break;
      
    case 'orders':
      for (let i = 0; i < count; i++) {
        fixtures.push({
          orderNumber: `ORD-${generateRandomString(8).toUpperCase()}`,
          total: Math.floor(Math.random() * 100000) / 100,
          status: ['pending', 'processing', 'shipped', 'delivered'][i % 4],
          items: Math.floor(Math.random() * 5) + 1,
        });
      }
      break;
      
    default:
      throw new Error(`Unknown fixture type: ${type}`);
  }
  
  return fixtures;
}