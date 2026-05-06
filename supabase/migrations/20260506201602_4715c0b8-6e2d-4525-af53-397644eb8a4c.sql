
-- Enums
CREATE TYPE public.lead_status AS ENUM ('New','Contacted','Visit','Negotiation','Closed');
CREATE TYPE public.lead_source AS ENUM ('Website','WhatsApp','Referral','Walk-in','Facebook');

-- LEADS
CREATE TABLE public.leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  name text NOT NULL,
  phone text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  interest text NOT NULL DEFAULT '',
  budget numeric NOT NULL DEFAULT 0,
  source public.lead_source NOT NULL DEFAULT 'Website',
  status public.lead_status NOT NULL DEFAULT 'New',
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX leads_agent_id_idx ON public.leads(agent_id);
CREATE INDEX leads_status_idx ON public.leads(status);

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Leads: owner or admin select" ON public.leads
  FOR SELECT TO authenticated
  USING (agent_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

CREATE POLICY "Leads: insert own or admin" ON public.leads
  FOR INSERT TO authenticated
  WITH CHECK (agent_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

CREATE POLICY "Leads: owner or admin update" ON public.leads
  FOR UPDATE TO authenticated
  USING (agent_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

CREATE POLICY "Leads: owner or admin delete" ON public.leads
  FOR DELETE TO authenticated
  USING (agent_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

CREATE TRIGGER leads_set_updated_at
  BEFORE UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- APPOINTMENTS
CREATE TABLE public.appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  property_id uuid REFERENCES public.properties(id) ON DELETE SET NULL,
  client_name text NOT NULL DEFAULT '',
  client_phone text NOT NULL DEFAULT '',
  scheduled_at timestamptz NOT NULL,
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX appointments_agent_id_idx ON public.appointments(agent_id);
CREATE INDEX appointments_scheduled_at_idx ON public.appointments(scheduled_at);

ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Appts: owner or admin select" ON public.appointments
  FOR SELECT TO authenticated
  USING (agent_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

CREATE POLICY "Appts: insert own or admin" ON public.appointments
  FOR INSERT TO authenticated
  WITH CHECK (agent_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

CREATE POLICY "Appts: owner or admin update" ON public.appointments
  FOR UPDATE TO authenticated
  USING (agent_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

CREATE POLICY "Appts: owner or admin delete" ON public.appointments
  FOR DELETE TO authenticated
  USING (agent_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

CREATE TRIGGER appointments_set_updated_at
  BEFORE UPDATE ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
