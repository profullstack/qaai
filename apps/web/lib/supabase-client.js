/**
 * Supabase Client for Browser
 *
 * This client is ONLY used for authentication in client components.
 * All data operations must go through API routes to maintain security.
 *
 * IMPORTANT: Do NOT use this client for database queries or storage operations.
 * Use fetch() to call API routes instead.
 */

import { createBrowserClient } from '@supabase/ssr';

let client = null;

/**
 * Get or create a Supabase browser client (AUTH ONLY)
 * @returns {import('@supabase/supabase-js').SupabaseClient}
 */
export function createClient() {
  if (client) {
    return client;
  }

  client = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  return client;
}

/**
 * Get the current user session (AUTH ONLY)
 * @returns {Promise<{user: object | null, session: object | null}>}
 */
export async function getSession() {
  const supabase = createClient();
  const { data, error } = await supabase.auth.getSession();
  
  if (error) {
    console.error('Error getting session:', error);
    return { user: null, session: null };
  }
  
  return { user: data.session?.user ?? null, session: data.session };
}

/**
 * Sign in with email and password
 * @param {string} email
 * @param {string} password
 * @returns {Promise<{user: object | null, error: object | null}>}
 */
export async function signIn(email, password) {
  const supabase = createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  
  if (error) {
    return { user: null, error };
  }
  
  return { user: data.user, error: null };
}

/**
 * Sign up with email and password
 * @param {string} email
 * @param {string} password
 * @returns {Promise<{user: object | null, error: object | null}>}
 */
export async function signUp(email, password) {
  const supabase = createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  });
  
  if (error) {
    return { user: null, error };
  }
  
  return { user: data.user, error: null };
}

/**
 * Sign out the current user
 * @returns {Promise<{error: object | null}>}
 */
export async function signOut() {
  const supabase = createClient();
  return await supabase.auth.signOut();
}

/**
 * Listen to auth state changes
 * @param {Function} callback - Called when auth state changes
 * @returns {Function} Unsubscribe function
 */
export function onAuthStateChange(callback) {
  const supabase = createClient();
  const { data: { subscription } } = supabase.auth.onAuthStateChange(callback);
  return () => subscription.unsubscribe();
}