import { createClient } from '@supabase/supabase-js';
import { getRuntimeConfig } from '@/services/runtimeConfig';

// Fork note (decommercialize): upstream fell back to base64 project URL/key
// values that only exist in the vendor's release environment, so a fork build
// threw out of `atob()` during module init. Nothing here points at a vendor
// backend any more: with no Supabase instance configured the client is built
// against an unreachable placeholder. Account auth and Readest Cloud sync are
// gated off in this fork (see `isReadestCloudEnabled`), so nothing requests it —
// the placeholder only exists so importing this module cannot throw.
const UNCONFIGURED_URL = 'http://127.0.0.1:1';
const UNCONFIGURED_KEY = 'unconfigured';

const supabaseUrl =
  getRuntimeConfig()?.supabaseUrl ||
  process.env['SUPABASE_URL'] ||
  process.env['NEXT_PUBLIC_SUPABASE_URL'] ||
  UNCONFIGURED_URL;
const supabaseAnonKey =
  getRuntimeConfig()?.supabaseAnonKey ||
  process.env['SUPABASE_ANON_KEY'] ||
  process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY'] ||
  UNCONFIGURED_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export const createSupabaseClient = (accessToken?: string) => {
  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: accessToken
        ? {
            Authorization: `Bearer ${accessToken}`,
          }
        : {},
    },
  });
};

export const createSupabaseAdminClient = () => {
  const supabaseAdminKey = process.env['SUPABASE_ADMIN_KEY'] || '';
  return createClient(supabaseUrl, supabaseAdminKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
};
