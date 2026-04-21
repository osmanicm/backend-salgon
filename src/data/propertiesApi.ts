import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

export type PropertyRow = Tables<"properties"> & {
  agent?: { id: string; full_name: string | null; email: string | null } | null;
};
export type PropertyStatus = PropertyRow["status"];
export type PropertyInsert = TablesInsert<"properties">;
export type PropertyUpdate = TablesUpdate<"properties">;

const KEY = ["properties"] as const;

async function fetchProperties(): Promise<PropertyRow[]> {
  const { data, error } = await supabase
    .from("properties")
    .select("*, agent:profiles!properties_agent_id_fkey(id, full_name, email)")
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as PropertyRow[];
}

export function useProperties() {
  return useQuery({ queryKey: KEY, queryFn: fetchProperties });
}

const TRASH_KEY = ["properties", "trash"] as const;

export function useDeletedProperties() {
  return useQuery({
    queryKey: TRASH_KEY,
    queryFn: async (): Promise<PropertyRow[]> => {
      const { data, error } = await supabase
        .from("properties")
        .select("*, agent:profiles!properties_agent_id_fkey(id, full_name, email)")
        .not("deleted_at", "is", null)
        .order("deleted_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as PropertyRow[];
    },
  });
}

export function useRestoreProperty() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("properties")
        .update({ deleted_at: null })
        .eq("id", id);
      if (error) throw error;
      return id;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
      qc.invalidateQueries({ queryKey: TRASH_KEY });
    },
  });
}

export function useHardDeleteProperty() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("properties").delete().eq("id", id);
      if (error) throw error;
      return id;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
      qc.invalidateQueries({ queryKey: TRASH_KEY });
    },
  });
}

export type PropertyMediaRow = Tables<"property_media">;
export type PropertyFileRow = Tables<"property_files">;

export function useProperty(id: string | undefined) {
  return useQuery({
    enabled: !!id,
    queryKey: ["property", id],
    queryFn: async (): Promise<PropertyRow | null> => {
      const { data, error } = await supabase
        .from("properties")
        .select("*, agent:profiles!properties_agent_id_fkey(id, full_name, email)")
        .eq("id", id!)
        .maybeSingle();
      if (error) throw error;
      return (data as PropertyRow | null) ?? null;
    },
  });
}

export function usePropertyMedia(propertyId: string | undefined) {
  return useQuery({
    enabled: !!propertyId,
    queryKey: ["property-media", propertyId],
    queryFn: async (): Promise<PropertyMediaRow[]> => {
      const { data, error } = await supabase
        .from("property_media")
        .select("*")
        .eq("property_id", propertyId!)
        .order("kind", { ascending: true })
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function usePropertyFiles(propertyId: string | undefined) {
  return useQuery({
    enabled: !!propertyId,
    queryKey: ["property-files", propertyId],
    queryFn: async (): Promise<PropertyFileRow[]> => {
      const { data, error } = await supabase
        .from("property_files")
        .select("*")
        .eq("property_id", propertyId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useCreateProperty() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: PropertyInsert) => {
      const { data, error } = await supabase.from("properties").insert(input).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useUpdateProperty() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: PropertyUpdate }) => {
      const { data, error } = await supabase.from("properties").update(patch).eq("id", id).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useSoftDeleteProperty() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("properties")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
      return id;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useAgentsList() {
  return useQuery({
    queryKey: ["profiles-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .order("full_name", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function nextPropertyCode(existing: PropertyRow[]) {
  const nums = existing
    .map((p) => p.code.match(/^P-(\d+)$/)?.[1])
    .filter(Boolean)
    .map((n) => Number(n));
  const max = nums.length ? Math.max(...nums) : 1023;
  return `P-${max + 1}`;
}
