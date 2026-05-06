CREATE TABLE IF NOT EXISTS public.agent_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL,
  event_type public.agent_event_type NOT NULL,
  property_id uuid NULL,
  model text NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_events_agent ON public.agent_events(agent_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_events_type ON public.agent_events(event_type, created_at DESC);

ALTER TABLE public.agent_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Agent events insert own" ON public.agent_events;
DROP POLICY IF EXISTS "Agent events read own" ON public.agent_events;
DROP POLICY IF EXISTS "Agent events admins read all" ON public.agent_events;

CREATE POLICY "Agent events insert own" ON public.agent_events FOR INSERT TO authenticated WITH CHECK (agent_id = auth.uid());
CREATE POLICY "Agent events read own" ON public.agent_events FOR SELECT TO authenticated USING (agent_id = auth.uid());
CREATE POLICY "Agent events admins read all" ON public.agent_events FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));