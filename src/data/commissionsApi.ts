import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";

export type CommissionRow = Tables<"commissions">;
export type CommissionInsert = TablesInsert<"commissions">;

function key(propertyId?: string) {
  return propertyId ? ["commissions", propertyId] : ["commissions"];
}

export function useCommissions(propertyId?: string) {
  return useQuery({
    queryKey: key(propertyId),
    queryFn: async (): Promise<CommissionRow[]> => {
      let q = supabase
        .from("commissions")
        .select("*")
        .order("created_at", { ascending: false });
      if (propertyId) q = q.eq("property_id", propertyId);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useCreateCommission() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CommissionInsert) => {
      const { data, error } = await supabase
        .from("commissions")
        .insert(input)
        .select("*")
        .single();
      if (error) throw error;
      return data as CommissionRow;
    },
    onSuccess: (row) => {
      qc.invalidateQueries({ queryKey: key(row.property_id ?? undefined) });
      qc.invalidateQueries({ queryKey: ["commissions"] });
    },
  });
}

export function useDeleteCommission() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("commissions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["commissions"] });
    },
  });
}
