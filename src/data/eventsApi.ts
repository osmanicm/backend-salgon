import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

export type EventRow = Tables<"events"> & {
  property?: { id: string; title: string; code: string } | null;
  slots?: EventSlotRow[];
};
export type EventType = EventRow["type"];
export type EventStatus = EventRow["status"];
export type EventInsert = TablesInsert<"events">;
export type EventUpdate = TablesUpdate<"events">;
export type EventSlotRow = Tables<"event_slots">;
export type EventSlotInsert = TablesInsert<"event_slots">;
export type EventRegistration = Tables<"event_registrations">;
export type EventRegistrationWithUser = EventRegistration & {
  user?: { id: string; full_name: string | null; email: string | null } | null;
};

export const EVENT_TYPES: EventType[] = [
  "Open House",
  "PASS Anual",
  "Capacitación",
  "Reunión Comercial",
];

const KEY = ["events"] as const;
const SELECT = "*, property:properties!events_related_property_id_fkey(id, title, code), slots:event_slots(*)";

export function useEvents(opts?: { onlyPublished?: boolean }) {
  return useQuery({
    queryKey: [...KEY, opts?.onlyPublished ? "published" : "all"],
    queryFn: async (): Promise<EventRow[]> => {
      let q = supabase.from("events").select(SELECT).order("created_at", { ascending: false });
      if (opts?.onlyPublished) q = q.eq("status", "Published");
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as EventRow[];
    },
  });
}

export function useEventItem(id: string | undefined) {
  return useQuery({
    enabled: !!id,
    queryKey: ["events", id],
    queryFn: async (): Promise<EventRow | null> => {
      const { data, error } = await supabase.from("events").select(SELECT).eq("id", id!).maybeSingle();
      if (error) throw error;
      return (data as unknown as EventRow | null) ?? null;
    },
  });
}

export function useCreateEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: EventInsert) => {
      const { data, error } = await supabase.from("events").insert(input).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useUpdateEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: EventUpdate }) => {
      const { data, error } = await supabase.from("events").update(patch).eq("id", id).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useDeleteEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("events").delete().eq("id", id);
      if (error) throw error;
      return id;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

// ── Slots ──
export function useAddSlot() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: EventSlotInsert) => {
      const { data, error } = await supabase.from("event_slots").insert(input).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
export function useDeleteSlot() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("event_slots").delete().eq("id", id);
      if (error) throw error;
      return id;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

// ── Registrations ──
export function useEventRegistrations(eventId: string | undefined) {
  return useQuery({
    enabled: !!eventId,
    queryKey: ["event_registrations", eventId],
    queryFn: async (): Promise<EventRegistrationWithUser[]> => {
      const { data, error } = await supabase
        .from("event_registrations")
        .select("*")
        .eq("event_id", eventId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      const regs = (data ?? []) as EventRegistration[];
      if (regs.length === 0) return [];

      // user_id no tiene FK a profiles, así que enriquecemos en un query aparte.
      const userIds = [...new Set(regs.map((r) => r.user_id))];
      const { data: profiles, error: pErr } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", userIds);
      if (pErr) throw pErr;

      const byId = new Map((profiles ?? []).map((p) => [p.id, p]));
      return regs.map((r) => ({ ...r, user: byId.get(r.user_id) ?? null }));
    },
  });
}

export type EventRegistrationFull = EventRegistration & {
  user?: { id: string; full_name: string | null; email: string | null } | null;
  event?: { id: string; title: string; starts_at: string | null; type: EventType } | null;
};

/** Todos los registros (solo admin por RLS), con evento embebido y perfil del usuario. */
export function useAllEventRegistrations() {
  return useQuery({
    queryKey: ["event_registrations", "all"],
    queryFn: async (): Promise<EventRegistrationFull[]> => {
      const { data, error } = await supabase
        .from("event_registrations")
        .select(
          "*, event:events!event_registrations_event_id_fkey(id, title, starts_at, type)"
        )
        .order("created_at", { ascending: false });
      if (error) throw error;
      const regs = (data ?? []) as unknown as EventRegistrationFull[];
      if (regs.length === 0) return [];

      // user_id no tiene FK a profiles → enriquecemos en un query aparte.
      const userIds = [...new Set(regs.map((r) => r.user_id))];
      const { data: profiles, error: pErr } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", userIds);
      if (pErr) throw pErr;

      const byId = new Map((profiles ?? []).map((p) => [p.id, p]));
      return regs.map((r) => ({ ...r, user: byId.get(r.user_id) ?? null }));
    },
  });
}

export function useMyRegistration(eventId: string | undefined, userId: string | undefined) {
  return useQuery({
    enabled: !!eventId && !!userId,
    queryKey: ["event_registrations", eventId, "me", userId],
    queryFn: async (): Promise<EventRegistration | null> => {
      const { data, error } = await supabase
        .from("event_registrations")
        .select("*")
        .eq("event_id", eventId!)
        .eq("user_id", userId!)
        .neq("status", "Cancelled")
        .maybeSingle();
      if (error) throw error;
      return (data as EventRegistration | null) ?? null;
    },
  });
}

export function useRegister() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { event_id: string; slot_id?: string | null; user_id: string; notes?: string }) => {
      const { data, error } = await supabase
        .from("event_registrations")
        .insert({
          event_id: input.event_id,
          slot_id: input.slot_id ?? null,
          user_id: input.user_id,
          notes: input.notes ?? "",
          status: "Confirmed",
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["event_registrations", vars.event_id] });
    },
  });
}

export function useCancelRegistration() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("event_registrations").delete().eq("id", id);
      if (error) throw error;
      return id;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["event_registrations"] }),
  });
}
