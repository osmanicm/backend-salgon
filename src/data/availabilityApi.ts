import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type AvailabilityUnit = Tables<"availability_units">;

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

/**
 * Reactive availability list synced with Supabase in realtime.
 * Any insert/update/delete in `availability_units` (or change in
 * `properties`) refreshes consumers automatically.
 */
export function useAvailabilityUnits(model?: string | null) {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: KEY,
    queryFn: fetchAvailability,
  });

  useEffect(() => {
    const channel = supabase
      .channel("availability_units_realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "availability_units" },
        () => qc.invalidateQueries({ queryKey: KEY }),
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
