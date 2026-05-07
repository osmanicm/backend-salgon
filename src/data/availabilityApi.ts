import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

export type AvailabilityUnit = Tables<"availability_units">;
export type AvailabilityStatus = AvailabilityUnit["status"];
export type AvailabilityInsert = TablesInsert<"availability_units">;
export type AvailabilityUpdate = TablesUpdate<"availability_units">;

const KEY = ["availability_units"] as const;

async function fetchAvailability(): Promise<AvailabilityUnit[]> {
  const { data, error } = await supabase
    .from("availability_units")
    .select("*")
    .order("model", { ascending: true })
    .order("lot", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export function useAvailabilityUnits(model?: string | null) {
  const qc = useQueryClient();
  const query = useQuery({ queryKey: KEY, queryFn: fetchAvailability });

  useEffect(() => {
    const channel = supabase
      .channel("availability_units_realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "availability_units" },
        () => {
          qc.invalidateQueries({ queryKey: KEY });
          qc.invalidateQueries({ queryKey: ["properties"] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);

  const data = model
    ? (query.data ?? []).filter((r) => r.model === model)
    : (query.data ?? []);

  return { ...query, data };
}

export function useUpdateAvailabilityUnit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: AvailabilityUpdate }) => {
      const { data, error } = await supabase
        .from("availability_units")
        .update(patch)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
      qc.invalidateQueries({ queryKey: ["properties"] });
    },
  });
}

export function useBulkUpdateAvailabilityStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ ids, status }: { ids: string[]; status: AvailabilityStatus }) => {
      const { data, error } = await supabase
        .from("availability_units")
        .update({ status })
        .in("id", ids)
        .select();
      if (error) throw error;
      return data ?? [];
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
      qc.invalidateQueries({ queryKey: ["properties"] });
    },
  });
}

export function useCreateAvailabilityUnit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: AvailabilityInsert) => {
      const { data, error } = await supabase
        .from("availability_units")
        .insert(input)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
      qc.invalidateQueries({ queryKey: ["properties"] });
    },
  });
}

export function useDeleteAvailabilityUnit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("availability_units").delete().eq("id", id);
      if (error) throw error;
      return id;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
      qc.invalidateQueries({ queryKey: ["properties"] });
    },
  });
}

export type AvailabilityHistoryEntry = Tables<"availability_history">;

export function useAvailabilityHistory(unitId: string | undefined) {
  return useQuery({
    enabled: !!unitId,
    queryKey: ["availability_history", unitId],
    queryFn: async (): Promise<AvailabilityHistoryEntry[]> => {
      const { data, error } = await supabase
        .from("availability_history")
        .select("*")
        .eq("unit_id", unitId!)
        .order("changed_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return data ?? [];
    },
  });
}
