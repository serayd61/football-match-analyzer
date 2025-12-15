import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

// Server-side safe singleton instances
let _supabase: SupabaseClient | null = null;
let _supabaseAdmin: SupabaseClient | null = null;

function getSupabaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) throw new Error('NEXT_PUBLIC_SUPABASE_URL is not set');
  return url;
}

function getSupabaseAnonKey(): string {
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!key) throw new Error('NEXT_PUBLIC_SUPABASE_ANON_KEY is not set');
  return key;
}

function getSupabaseServiceKey(): string {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set');
  return key;
}

// ✅ Browser-only client with SSR check
export function getSupabase(): SupabaseClient {
  // Prevent server-side execution
  if (typeof window === 'undefined') {
    throw new Error('getSupabase() can only be called in the browser');
  }

  if (!_supabase) {
    _supabase = createBrowserClient(
      getSupabaseUrl(), 
      getSupabaseAnonKey()
    );
  }
  return _supabase;
}

// ✅ Admin client (server-safe fallback)
export function getSupabaseAdmin(): SupabaseClient {
  if (!_supabaseAdmin) {
    // Use standard createClient for admin (no browser APIs needed)
    const { createClient } = require('@supabase/supabase-js');
    _supabaseAdmin = createClient(
      getSupabaseUrl(), 
      getSupabaseServiceKey(),
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );
  }
  return _supabaseAdmin;
}

// ✅ Safe lazy initialization for backward compatibility
export const supabase = new Proxy({} as SupabaseClient, {
  get(_, prop) {
    if (typeof window === 'undefined') {
      throw new Error('Cannot access supabase on server. Use getSupabase() in useEffect or client components.');
    }
    return (getSupabase() as any)[prop];
  }
});

export const supabaseAdmin = new Proxy({} as SupabaseClient, {
  get(_, prop) {
    return (getSupabaseAdmin() as any)[prop];
  }
});

// ✅ React hook for safe usage
export function useSupabase() {
  if (typeof window === 'undefined') {
    return null;
  }
  return getSupabase();
}

// Type definitions (unchanged)
export interface User {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  created_at: string;
  updated_at: string;
}

export interface Subscription {
  id: string;
  user_id: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  status: 'trialing' | 'active' | 'canceled' | 'past_due' | 'unpaid' | 'incomplete';
  plan: 'free' | 'pro' | 'premium';
  trial_start: string | null;
  trial_end: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  created_at: string;
  updated_at: string;
}
