import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Returns whether at least one user with role 'admin' exists.
 * Used by /auth to inform the visitor that the first signup becomes the
 * global superadmin. Returns only a boolean — no PII is exposed.
 */
export const checkAdminExists = createServerFn({ method: "GET" }).handler(
  async () => {
    try {
      const { count, error } = await supabaseAdmin
        .from("user_roles")
        .select("id", { count: "exact", head: true })
        .eq("role", "admin");
      if (error) {
        console.error("checkAdminExists error:", error);
        return { hasAdmin: true, error: error.message };
      }
      return { hasAdmin: (count ?? 0) > 0, error: null };
    } catch (err) {
      console.error("checkAdminExists threw:", err);
      // Fail closed: assume admin exists so we don't mislead users.
      return { hasAdmin: true, error: "lookup_failed" };
    }
  },
);
