import { supabase } from "@/integrations/supabase/client";

/**
 * Returns headers required to call a server function protected by
 * `requireSupabaseAuth`. The Supabase JS client doesn't auto-forward its
 * session to TanStack server function fetches, so we attach the access token
 * manually.
 */
export async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}
