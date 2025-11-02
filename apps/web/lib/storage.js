/**
 * Storage Helper Functions
 * 
 * Utilities for working with Supabase Storage, including
 * signed URL generation for private artifacts.
 */

import { createServiceClient } from './supabase-server.js';

const ARTIFACTS_BUCKET = process.env.ARTIFACTS_BUCKET || 'artifacts';

/**
 * Generate a signed URL for a private artifact
 * 
 * @param {string} path - The path to the file in storage
 * @param {number} expiresIn - Expiration time in seconds (default: 1 hour)
 * @returns {Promise<{url: string | null, error: object | null}>}
 */
export async function signArtifact(path, expiresIn = 3600) {
  try {
    const supabase = createServiceClient();
    
    const { data, error } = await supabase.storage
      .from(ARTIFACTS_BUCKET)
      .createSignedUrl(path, expiresIn);

    if (error) {
      console.error('Error creating signed URL:', error);
      return { url: null, error };
    }

    return { url: data.signedUrl, error: null };
  } catch (error) {
    console.error('Exception creating signed URL:', error);
    return { url: null, error };
  }
}

/**
 * Upload a file to storage
 * 
 * @param {string} path - The destination path in storage
 * @param {Buffer|Blob|File} file - The file to upload
 * @param {object} options - Upload options
 * @returns {Promise<{path: string | null, error: object | null}>}
 */
export async function uploadArtifact(path, file, options = {}) {
  try {
    const supabase = createServiceClient();
    
    const { data, error } = await supabase.storage
      .from(ARTIFACTS_BUCKET)
      .upload(path, file, {
        cacheControl: '3600',
        upsert: false,
        ...options,
      });

    if (error) {
      console.error('Error uploading file:', error);
      return { path: null, error };
    }

    return { path: data.path, error: null };
  } catch (error) {
    console.error('Exception uploading file:', error);
    return { path: null, error };
  }
}

/**
 * Delete a file from storage
 * 
 * @param {string} path - The path to the file in storage
 * @returns {Promise<{success: boolean, error: object | null}>}
 */
export async function deleteArtifact(path) {
  try {
    const supabase = createServiceClient();
    
    const { error } = await supabase.storage
      .from(ARTIFACTS_BUCKET)
      .remove([path]);

    if (error) {
      console.error('Error deleting file:', error);
      return { success: false, error };
    }

    return { success: true, error: null };
  } catch (error) {
    console.error('Exception deleting file:', error);
    return { success: false, error };
  }
}

/**
 * List files in a directory
 * 
 * @param {string} path - The directory path
 * @param {object} options - List options
 * @returns {Promise<{files: array, error: object | null}>}
 */
export async function listArtifacts(path, options = {}) {
  try {
    const supabase = createServiceClient();
    
    const { data, error } = await supabase.storage
      .from(ARTIFACTS_BUCKET)
      .list(path, {
        limit: 100,
        offset: 0,
        sortBy: { column: 'created_at', order: 'desc' },
        ...options,
      });

    if (error) {
      console.error('Error listing files:', error);
      return { files: [], error };
    }

    return { files: data, error: null };
  } catch (error) {
    console.error('Exception listing files:', error);
    return { files: [], error };
  }
}

/**
 * Generate artifact path for a test run
 * 
 * @param {string} orgId - Organization ID
 * @param {string} projectId - Project ID
 * @param {string} runId - Run ID
 * @param {string} testId - Test ID
 * @param {string} filename - Artifact filename
 * @returns {string} The full storage path
 */
export function getArtifactPath(orgId, projectId, runId, testId, filename) {
  return `org/${orgId}/project/${projectId}/run/${runId}/test/${testId}/${filename}`;
}

/**
 * Get public URL for an artifact (for public buckets only)
 * 
 * @param {string} path - The path to the file in storage
 * @returns {string} The public URL
 */
export function getPublicUrl(path) {
  const supabase = createServiceClient();
  const { data } = supabase.storage
    .from(ARTIFACTS_BUCKET)
    .getPublicUrl(path);
  
  return data.publicUrl;
}