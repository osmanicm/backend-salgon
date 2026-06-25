import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PRIVACY_VERSION } from "@/content/privacy-notice";

const KEY = (userId: string) => ["privacy-acceptance", userId, PRIVACY_VERSION] as const;

/** ¿El usuario ya aceptó la versión vigente del aviso de privacidad? */
export function useHasAcceptedPrivacy(userId: string | undefined) {
  return useQuery({
    queryKey: KEY(userId ?? "anon"),
    enabled: !!userId,
    queryFn: async (): Promise<boolean> => {
      const { data, error } = await supabase
        .from("privacy_acceptances")
        .select("id")
        .eq("user_id", userId!)
        .eq("version", PRIVACY_VERSION)
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data != null;
    },
    staleTime: Infinity,
  });
}

/**
 * Registra la aceptación de la versión vigente para el usuario autenticado.
 * `accepted_at` lo asigna Postgres (default now()), por lo que la fecha/hora es
 * autoritativa del servidor. Idempotente: re-aceptar la misma versión no falla.
 */
export function useRecordPrivacyAcceptance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (userId: string) => {
      const userAgent = typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 500) : null;
      const { error } = await supabase
        .from("privacy_acceptances")
        .upsert(
          { user_id: userId, version: PRIVACY_VERSION, user_agent: userAgent },
          { onConflict: "user_id,version", ignoreDuplicates: true },
        );
      if (error) throw error;
      return userId;
    },
    onSuccess: (userId) => {
      qc.invalidateQueries({ queryKey: KEY(userId) });
    },
  });
}

/**
 * Registro directo (sin React Query) para usar fuera de componentes, p. ej. justo
 * después del signup. No lanza: si falla, el gate lo capturará en el próximo acceso.
 */
export async function recordPrivacyAcceptance(userId: string): Promise<void> {
  try {
    const userAgent = typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 500) : null;
    await supabase
      .from("privacy_acceptances")
      .upsert(
        { user_id: userId, version: PRIVACY_VERSION, user_agent: userAgent },
        { onConflict: "user_id,version", ignoreDuplicates: true },
      );
  } catch (e) {
    console.error("No se pudo registrar la aceptación del aviso de privacidad", e);
  }
}
