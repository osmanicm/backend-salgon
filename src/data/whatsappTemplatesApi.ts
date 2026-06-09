import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

export type WhatsappTemplateRow = Tables<"whatsapp_templates">;
export type WhatsappTemplateInsert = TablesInsert<"whatsapp_templates">;
export type WhatsappTemplateUpdate = TablesUpdate<"whatsapp_templates">;

const KEY = ["whatsapp_templates"] as const;

export function useWhatsappTemplates() {
  return useQuery({
    queryKey: KEY,
    queryFn: async (): Promise<WhatsappTemplateRow[]> => {
      const { data, error } = await supabase
        .from("whatsapp_templates")
        .select("*")
        .is("deleted_at", null)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useCreateWhatsappTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string; body: string }) => {
      const { data, error } = await supabase
        .from("whatsapp_templates")
        .insert(input)
        .select("*")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useUpdateWhatsappTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: WhatsappTemplateUpdate }) => {
      const { data, error } = await supabase
        .from("whatsapp_templates")
        .update(patch)
        .eq("id", id)
        .select("*")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useDeleteWhatsappTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      // Soft delete (convención del proyecto: deleted_at, no borrado físico).
      const { error } = await supabase
        .from("whatsapp_templates")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
