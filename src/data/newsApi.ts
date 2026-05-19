import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

export type NewsRow = Tables<"news"> & {
  property?: { id: string; title: string; code: string } | null;
};
export type NewsCategory = NewsRow["category"];
export type NewsStatus = NewsRow["status"];
export type NewsInsert = TablesInsert<"news">;
export type NewsUpdate = TablesUpdate<"news">;

export const NEWS_CATEGORIES: NewsCategory[] = [
  "Nuevos Lanzamientos",
  "Promociones",
  "Bonos",
  "Avisos Internos",
];

const KEY = ["news"] as const;

const SELECT = "*, property:properties!news_related_property_id_fkey(id, title, code)";

export function useNews(opts?: { onlyPublished?: boolean }) {
  return useQuery({
    queryKey: [...KEY, opts?.onlyPublished ? "published" : "all"],
    queryFn: async (): Promise<NewsRow[]> => {
      let q = supabase.from("news").select(SELECT).order("created_at", { ascending: false });
      if (opts?.onlyPublished) q = q.eq("status", "Published");
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as NewsRow[];
    },
  });
}

export function useNewsItem(id: string | undefined) {
  return useQuery({
    enabled: !!id,
    queryKey: ["news", id],
    queryFn: async (): Promise<NewsRow | null> => {
      const { data, error } = await supabase.from("news").select(SELECT).eq("id", id!).maybeSingle();
      if (error) throw error;
      return (data as NewsRow | null) ?? null;
    },
  });
}

export function useCreateNews() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: NewsInsert) => {
      const { data, error } = await supabase.from("news").insert(input).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useUpdateNews() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: NewsUpdate }) => {
      const { data, error } = await supabase.from("news").update(patch).eq("id", id).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useDeleteNews() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("news").delete().eq("id", id);
      if (error) throw error;
      return id;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
