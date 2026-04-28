import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Verifies the caller is an admin. Returns the caller's user id.
 * Throws a 403 Response when not authorized.
 */
async function assertCallerIsAdmin(callerId: string): Promise<void> {
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", callerId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) {
    console.error("assertCallerIsAdmin lookup failed:", error);
    throw new Response("Authorization lookup failed", { status: 500 });
  }
  if (!data) {
    throw new Response("Forbidden: admin role required", { status: 403 });
  }
}

export interface ManagedUser {
  id: string;
  email: string | null;
  full_name: string | null;
  avatar_url: string | null;
  phone: string | null;
  roles: Array<"admin" | "agent">;
  last_sign_in_at: string | null;
  email_confirmed_at: string | null;
  created_at: string | null;
  must_change_password: boolean;
}

/**
 * Admin-only: list all managed users with their profile, roles and basic
 * auth metadata. Uses the service-role client to read auth.users for
 * last_sign_in / email_confirmed timestamps.
 */
export const listManagedUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ users: ManagedUser[]; error: string | null }> => {
    try {
      await assertCallerIsAdmin(context.userId);

      const [profilesRes, rolesRes, authRes] = await Promise.all([
        supabaseAdmin
          .from("profiles")
          .select("id, full_name, email, avatar_url, phone, created_at"),
        supabaseAdmin.from("user_roles").select("user_id, role"),
        supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
      ]);

      if (profilesRes.error) {
        console.error("listManagedUsers profiles error:", profilesRes.error);
        return { users: [], error: profilesRes.error.message };
      }
      if (rolesRes.error) {
        console.error("listManagedUsers roles error:", rolesRes.error);
        return { users: [], error: rolesRes.error.message };
      }
      if (authRes.error) {
        console.error("listManagedUsers auth error:", authRes.error);
        return { users: [], error: authRes.error.message };
      }

      const rolesByUser = new Map<string, Array<"admin" | "agent">>();
      for (const r of rolesRes.data ?? []) {
        const existing = rolesByUser.get(r.user_id) ?? [];
        existing.push(r.role as "admin" | "agent");
        rolesByUser.set(r.user_id, existing);
      }

      const authByUser = new Map(
        (authRes.data?.users ?? []).map((u) => [u.id, u] as const),
      );

      const users: ManagedUser[] = (profilesRes.data ?? []).map((p) => {
        const auth = authByUser.get(p.id);
        const meta = (auth?.user_metadata ?? {}) as { must_change_password?: boolean };
        return {
          id: p.id,
          email: p.email,
          full_name: p.full_name,
          avatar_url: p.avatar_url,
          phone: p.phone,
          roles: rolesByUser.get(p.id) ?? [],
          last_sign_in_at: auth?.last_sign_in_at ?? null,
          email_confirmed_at: auth?.email_confirmed_at ?? null,
          created_at: p.created_at,
          must_change_password: Boolean(meta.must_change_password),
        };
      });

      // Stable sort: admins first, then by full_name/email.
      users.sort((a, b) => {
        const aAdmin = a.roles.includes("admin") ? 0 : 1;
        const bAdmin = b.roles.includes("admin") ? 0 : 1;
        if (aAdmin !== bAdmin) return aAdmin - bAdmin;
        const an = (a.full_name || a.email || "").toLowerCase();
        const bn = (b.full_name || b.email || "").toLowerCase();
        return an.localeCompare(bn);
      });

      return { users, error: null };
    } catch (err) {
      if (err instanceof Response) throw err;
      console.error("listManagedUsers threw:", err);
      return { users: [], error: "lookup_failed" };
    }
  });

const resetSchema = z.object({
  user_id: z.string().uuid(),
  new_password: z
    .string()
    .min(8, "La contraseña temporal debe tener al menos 8 caracteres")
    .max(72, "Máximo 72 caracteres"),
  force_change_on_next_login: z.boolean().default(true),
});

/**
 * Admin-only: assigns a new password to the target user and (optionally)
 * marks user_metadata.must_change_password = true so the next login will
 * force the user to set their own password.
 */
export const adminResetUserPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => resetSchema.parse(input))
  .handler(
    async ({
      data,
      context,
    }): Promise<{ ok: boolean; error: string | null; email: string | null }> => {
      try {
        await assertCallerIsAdmin(context.userId);

        // Fetch the target user to read existing metadata and email.
        const { data: targetRes, error: getErr } =
          await supabaseAdmin.auth.admin.getUserById(data.user_id);
        if (getErr || !targetRes?.user) {
          console.error("adminResetUserPassword getUserById error:", getErr);
          return { ok: false, error: "Usuario no encontrado", email: null };
        }
        const target = targetRes.user;

        const newMeta = {
          ...(target.user_metadata ?? {}),
          must_change_password: data.force_change_on_next_login,
          password_reset_at: new Date().toISOString(),
          password_reset_by: context.userId,
        };

        const { error: updErr } = await supabaseAdmin.auth.admin.updateUserById(
          data.user_id,
          {
            password: data.new_password,
            user_metadata: newMeta,
          },
        );
        if (updErr) {
          console.error("adminResetUserPassword updateUserById error:", updErr);
          return { ok: false, error: updErr.message, email: target.email ?? null };
        }

        return { ok: true, error: null, email: target.email ?? null };
      } catch (err) {
        if (err instanceof Response) throw err;
        console.error("adminResetUserPassword threw:", err);
        return { ok: false, error: "reset_failed", email: null };
      }
    },
  );

const clearFlagSchema = z.object({ user_id: z.string().uuid() });

/**
 * Called by the user themselves after they finish the forced password
 * change flow. Clears must_change_password from their own metadata.
 * Allowed for the user on themselves, OR for an admin on anyone.
 */
export const clearMustChangePassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => clearFlagSchema.parse(input))
  .handler(async ({ data, context }) => {
    try {
      if (data.user_id !== context.userId) {
        await assertCallerIsAdmin(context.userId);
      }
      const { data: targetRes, error: getErr } =
        await supabaseAdmin.auth.admin.getUserById(data.user_id);
      if (getErr || !targetRes?.user) {
        return { ok: false, error: "Usuario no encontrado" };
      }
      const meta = { ...(targetRes.user.user_metadata ?? {}) } as Record<string, unknown>;
      delete meta.must_change_password;
      const { error: updErr } = await supabaseAdmin.auth.admin.updateUserById(
        data.user_id,
        { user_metadata: meta },
      );
      if (updErr) return { ok: false, error: updErr.message };
      return { ok: true, error: null };
    } catch (err) {
      if (err instanceof Response) throw err;
      console.error("clearMustChangePassword threw:", err);
      return { ok: false, error: "clear_failed" };
    }
  });
