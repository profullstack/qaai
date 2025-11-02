/**
 * Supabase Server Clients
 * 
 * These clients are used in server components, API routes, and server actions.
 * They handle cookie-based authentication for user sessions.
 */

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * Create a Supabase client for server components
 * This client respects RLS policies based on the authenticated user
 * 
 * @returns {import('@supabase/supabase-js').SupabaseClient}
 */
export function createClient() {
  const cookieStore = cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        get(name) {
          return cookieStore.get(name)?.value;
        },
        set(name, value, options) {
          try {
            cookieStore.set({ name, value, ...options });
          } catch (error) {
            // Handle cookie setting errors in middleware
          }
        },
        remove(name, options) {
          try {
            cookieStore.set({ name, value: '', ...options });
          } catch (error) {
            // Handle cookie removal errors in middleware
          }
        },
      },
    }
  );
}

/**
 * Create a Supabase client with service role privileges
 * This client bypasses RLS policies - use with caution!
 * Only use this for background jobs, admin operations, or when RLS doesn't apply
 * 
 * @returns {import('@supabase/supabase-js').SupabaseClient}
 */
export function createServiceClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  );
}

/**
 * Get the current authenticated user from server context
 * @returns {Promise<{user: object | null, error: object | null}>}
 */
export async function getUser() {
  const supabase = createClient();
  const { data, error } = await supabase.auth.getUser();
  
  if (error) {
    return { user: null, error };
  }
  
  return { user: data.user, error: null };
}

/**
 * Check if user is authenticated
 * @returns {Promise<boolean>}
 */
export async function isAuthenticated() {
  const { user } = await getUser();
  return user !== null;
}