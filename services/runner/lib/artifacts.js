/**
 * Artifact Management
 * 
 * Functions for uploading and managing test artifacts (traces, videos, screenshots, HAR files)
 */

import { promises as fs } from 'fs';
import path from 'path';
import { getSupabaseClient } from './supabase.js';

/**
 * Upload a file to Supabase Storage
 * 
 * @param {string} bucket - Storage bucket name
 * @param {string} filePath - Local file path
 * @param {string} storagePath - Path in storage bucket
 * @returns {Promise<object>} Upload result with path and URL
 */
async function uploadFile(bucket, filePath, storagePath) {
  const supabase = getSupabaseClient();
  
  // Read file
  const fileBuffer = await fs.readFile(filePath);
  
  // Determine content type
  const ext = path.extname(filePath).toLowerCase();
  const contentTypeMap = {
    '.zip': 'application/zip',
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.har': 'application/json',
    '.json': 'application/json',
    '.xml': 'application/xml',
  };
  
  const contentType = contentTypeMap[ext] || 'application/octet-stream';
  
  // Upload to storage
  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(storagePath, fileBuffer, {
      contentType,
      upsert: false,
    });
  
  if (error) {
    throw new Error(`Failed to upload ${filePath}: ${error.message}`);
  }
  
  console.log(`[Artifacts] Uploaded: ${storagePath}`);
  
  return {
    path: data.path,
    bucket,
  };
}

/**
 * Upload test artifacts to storage
 * 
 * @param {string} runId - Run ID
 * @param {string} testName - Test name
 * @param {object} artifacts - Artifact file paths
 * @param {string} artifacts.trace - Trace file path
 * @param {string} artifacts.video - Video file path
 * @param {string} artifacts.screenshot - Screenshot file path
 * @param {string} artifacts.har - HAR file path
 * @returns {Promise<object>} Uploaded artifact paths
 */
export async function uploadTestArtifacts(runId, testName, artifacts) {
  console.log(`[Artifacts] Uploading artifacts for test: ${testName}`);
  
  const uploaded = {};
  const bucket = 'test-artifacts';
  
  // Create storage path prefix
  const sanitizedTestName = testName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  
  const pathPrefix = `runs/${runId}/${sanitizedTestName}`;
  
  // Upload trace
  if (artifacts.trace) {
    try {
      const result = await uploadFile(
        bucket,
        artifacts.trace,
        `${pathPrefix}/trace.zip`
      );
      uploaded.trace = result.path;
    } catch (error) {
      console.error(`[Artifacts] Failed to upload trace:`, error);
    }
  }
  
  // Upload video
  if (artifacts.video) {
    try {
      const ext = path.extname(artifacts.video);
      const result = await uploadFile(
        bucket,
        artifacts.video,
        `${pathPrefix}/video${ext}`
      );
      uploaded.video = result.path;
    } catch (error) {
      console.error(`[Artifacts] Failed to upload video:`, error);
    }
  }
  
  // Upload screenshot
  if (artifacts.screenshot) {
    try {
      const ext = path.extname(artifacts.screenshot);
      const result = await uploadFile(
        bucket,
        artifacts.screenshot,
        `${pathPrefix}/screenshot${ext}`
      );
      uploaded.screenshot = result.path;
    } catch (error) {
      console.error(`[Artifacts] Failed to upload screenshot:`, error);
    }
  }
  
  // Upload HAR
  if (artifacts.har) {
    try {
      const result = await uploadFile(
        bucket,
        artifacts.har,
        `${pathPrefix}/network.har`
      );
      uploaded.har = result.path;
    } catch (error) {
      console.error(`[Artifacts] Failed to upload HAR:`, error);
    }
  }
  
  console.log(`[Artifacts] Uploaded ${Object.keys(uploaded).length} artifacts`);
  
  return uploaded;
}

/**
 * Upload JUnit XML results
 * 
 * @param {string} runId - Run ID
 * @param {string} xmlPath - Path to JUnit XML file
 * @returns {Promise<string>} Storage path
 */
export async function uploadJUnitXML(runId, xmlPath) {
  console.log(`[Artifacts] Uploading JUnit XML for run: ${runId}`);
  
  const bucket = 'test-artifacts';
  const storagePath = `runs/${runId}/results.xml`;
  
  const result = await uploadFile(bucket, xmlPath, storagePath);
  
  return result.path;
}

/**
 * Get signed URL for an artifact
 * 
 * @param {string} bucket - Storage bucket name
 * @param {string} path - File path in storage
 * @param {number} expiresIn - URL expiry in seconds (default: 3600)
 * @returns {Promise<string>} Signed URL
 */
export async function getSignedUrl(bucket, path, expiresIn = 3600) {
  const supabase = getSupabaseClient();
  
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, expiresIn);
  
  if (error) {
    throw new Error(`Failed to create signed URL: ${error.message}`);
  }
  
  return data.signedUrl;
}

/**
 * Get signed URLs for all artifacts
 * 
 * @param {object} artifacts - Artifact paths
 * @param {string} artifacts.trace - Trace path
 * @param {string} artifacts.video - Video path
 * @param {string} artifacts.screenshot - Screenshot path
 * @param {string} artifacts.har - HAR path
 * @returns {Promise<object>} Signed URLs
 */
export async function getArtifactUrls(artifacts) {
  const urls = {};
  const bucket = 'test-artifacts';
  
  if (artifacts.trace) {
    urls.trace = await getSignedUrl(bucket, artifacts.trace);
  }
  
  if (artifacts.video) {
    urls.video = await getSignedUrl(bucket, artifacts.video);
  }
  
  if (artifacts.screenshot) {
    urls.screenshot = await getSignedUrl(bucket, artifacts.screenshot);
  }
  
  if (artifacts.har) {
    urls.har = await getSignedUrl(bucket, artifacts.har);
  }
  
  return urls;
}

/**
 * Delete artifacts for a run
 * 
 * @param {string} runId - Run ID
 * @returns {Promise<void>}
 */
export async function deleteRunArtifacts(runId) {
  const supabase = getSupabaseClient();
  const bucket = 'test-artifacts';
  const prefix = `runs/${runId}/`;
  
  console.log(`[Artifacts] Deleting artifacts for run: ${runId}`);
  
  // List all files with prefix
  const { data: files, error: listError } = await supabase.storage
    .from(bucket)
    .list(`runs/${runId}`);
  
  if (listError) {
    throw new Error(`Failed to list artifacts: ${listError.message}`);
  }
  
  if (!files || files.length === 0) {
    console.log(`[Artifacts] No artifacts found for run: ${runId}`);
    return;
  }
  
  // Delete all files
  const filePaths = files.map(file => `${prefix}${file.name}`);
  
  const { error: deleteError } = await supabase.storage
    .from(bucket)
    .remove(filePaths);
  
  if (deleteError) {
    throw new Error(`Failed to delete artifacts: ${deleteError.message}`);
  }
  
  console.log(`[Artifacts] Deleted ${files.length} artifacts`);
}

/**
 * Find artifact files in a directory
 * 
 * @param {string} dir - Directory to search
 * @param {string} testName - Test name to match
 * @returns {Promise<object>} Found artifact paths
 */
export async function findArtifacts(dir, testName) {
  const artifacts = {};
  
  try {
    const files = await fs.readdir(dir);
    
    // Playwright typically names artifacts with test name
    const sanitizedName = testName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-');
    
    for (const file of files) {
      const filePath = path.join(dir, file);
      const stat = await fs.stat(filePath);
      
      if (!stat.isFile()) continue;
      
      const lowerFile = file.toLowerCase();
      
      // Match trace files
      if (lowerFile.includes('trace') && lowerFile.endsWith('.zip')) {
        artifacts.trace = filePath;
      }
      
      // Match video files
      if (lowerFile.includes('video') && (lowerFile.endsWith('.webm') || lowerFile.endsWith('.mp4'))) {
        artifacts.video = filePath;
      }
      
      // Match screenshot files
      if (lowerFile.includes('screenshot') && (lowerFile.endsWith('.png') || lowerFile.endsWith('.jpg'))) {
        artifacts.screenshot = filePath;
      }
      
      // Match HAR files
      if (lowerFile.endsWith('.har')) {
        artifacts.har = filePath;
      }
    }
  } catch (error) {
    console.error(`[Artifacts] Error finding artifacts in ${dir}:`, error);
  }
  
  return artifacts;
}

/**
 * Get artifact statistics
 * 
 * @param {string} runId - Run ID
 * @returns {Promise<object>} Artifact statistics
 */
export async function getArtifactStats(runId) {
  const supabase = getSupabaseClient();
  const bucket = 'test-artifacts';
  
  const { data: files, error } = await supabase.storage
    .from(bucket)
    .list(`runs/${runId}`);
  
  if (error) {
    throw new Error(`Failed to get artifact stats: ${error.message}`);
  }
  
  const stats = {
    count: files?.length || 0,
    totalSize: 0,
    types: {},
  };
  
  if (files) {
    for (const file of files) {
      stats.totalSize += file.metadata?.size || 0;
      
      const ext = path.extname(file.name);
      stats.types[ext] = (stats.types[ext] || 0) + 1;
    }
  }
  
  return stats;
}