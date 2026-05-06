import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";

export type AppointmentRow = Tables<"appointments"> & {
  property?: { id: string; title: string; location: string } | null;
  lead?: { id: string; name: string } | null;
};
export type AppointmentInsert = TablesInsert<"appointments">;

const KEY = ["appointments"] as const;

export function useAppointments() {
  return useQuery({
    queryKey: KEY,
    queryFn: async (): Promise<AppointmentRow[]> => {
      const { data, error } = await supabase
        .from("appointments")
        .select(
          "*, property:properties!appointments_property_id_fkey(id, title, location), lead:leads!appointments_lead_id_fkey(id, name)"
        )
        .order("scheduled_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as AppointmentRow[];
    },
  });
}

export function useCreateAppointment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: AppointmentInsert) => {
      const { data, error } = await supabase.from("appointments").insert(input).select("*").single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
