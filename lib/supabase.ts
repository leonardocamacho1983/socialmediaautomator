import "server-only";

import { createClient } from "@supabase/supabase-js";

export function isSupabaseConfigured() {
  return Boolean(
    process.env.SUPABASE_URL && getSupabaseSecretKey(),
  );
}

export function getSupabaseConfigStatus() {
  return {
    hasUrl: Boolean(process.env.SUPABASE_URL),
    hasServiceRoleKey: Boolean(getSupabaseSecretKey()),
    ready: isSupabaseConfigured(),
  };
}

export function getSupabaseAdminClient() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = getSupabaseSecretKey();

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Supabase não está configurado. Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.",
    );
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function getSupabaseSecretKey() {
  return process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;
}
