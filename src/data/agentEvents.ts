import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type AgentEventType =
  | "session_start"
  | "property_share"
  | "property_pdf"
  | "availability_pdf_general"
  | "availability_pdf_model"
  | "appointment_created";

export interface AgentEventInput {
  type: AgentEventType;
  propertyId?: string | null;
  model?: string | null;
  metadata?: Record<string, unknown>;
}

export interface AgentEventRow {
  id: string;
  agent_id: string;
  event_type: AgentEventType;
  property_id: string | null;
  model: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

/** Best-effort logger. Never throws — analytics must not break UX. */
export async function logAgentEvent(input: AgentEventInput): Promise<void> {
  try {
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth.user?.id;
    if (!uid) return;
    await supabase.from("agent_events" as never).insert({
      agent_id: uid,
      event_type: input.type,
      property_id: input.propertyId ?? null,
      model: input.model ?? null,
      metadata: input.metadata ?? {},
    } as never);
  } catch (e) {
    console.warn("[agent_events] log failed", e);
  }
}

/** Hook: fires session_start once per session per user. */
export function useSessionLogger(userId?: string | null) {
  useEffect(() => {
    if (!userId) return;
    const key = `agent_session_logged_${userId}`;
    if (typeof sessionStorage === "undefined") return;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
    void logAgentEvent({ type: "session_start" });
  }, [userId]);
}

/** Admin: fetch all agent events (RLS allows admins to read all). */
export function useAgentEvents() {
  return useQuery({
    queryKey: ["agent_events_all"],
    queryFn: async (): Promise<AgentEventRow[]> => {
      const { data, error } = await supabase
        .from("agent_events" as never)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(5000);
      if (error) throw error;
      return (data ?? []) as unknown as AgentEventRow[];
    },
  });
}
