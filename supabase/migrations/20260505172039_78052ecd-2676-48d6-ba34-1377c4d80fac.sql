-- Enum for availability status
DO $$ BEGIN
  CREATE TYPE public.availability_status AS ENUM ('Available', 'Reserved', 'Sold');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Main availability table
CREATE TABLE IF NOT EXISTS public.availability_units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model TEXT NOT NULL,
  lot TEXT NOT NULL,
  cluster TEXT NOT NULL DEFAULT '',
  price NUMERIC NOT NULL DEFAULT 0,
  delivery DATE,
  status public.availability_status NOT NULL DEFAULT 'Available',
  notes TEXT NOT NULL DEFAULT '',
  property_id UUID REFERENCES public.properties(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_availability_units_model ON public.availability_units(model);
CREATE INDEX IF NOT EXISTS idx_availability_units_property_id ON public.availability_units(property_id);
CREATE INDEX IF NOT EXISTS idx_availability_units_status ON public.availability_units(status);

-- History table
CREATE TABLE IF NOT EXISTS public.availability_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id UUID NOT NULL REFERENCES public.availability_units(id) ON DELETE CASCADE,
  from_status public.availability_status NOT NULL,
  to_status public.availability_status NOT NULL,
  changed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_availability_history_unit_id ON public.availability_history(unit_id);

-- Enable RLS
ALTER TABLE public.availability_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.availability_history ENABLE ROW LEVEL SECURITY;

-- Policies: availability_units
CREATE POLICY "Availability: authenticated read"
  ON public.availability_units FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Availability: admins insert"
  ON public.availability_units FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Availability: admins update"
  ON public.availability_units FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Availability: admins delete"
  ON public.availability_units FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Policies: availability_history
CREATE POLICY "Availability history: authenticated read"
  ON public.availability_history FOR SELECT
  TO authenticated
  USING (true);

-- Updated_at trigger
DROP TRIGGER IF EXISTS trg_availability_units_updated_at ON public.availability_units;
CREATE TRIGGER trg_availability_units_updated_at
  BEFORE UPDATE ON public.availability_units
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- History trigger: log status changes automatically
CREATE OR REPLACE FUNCTION public.log_availability_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.availability_history (unit_id, from_status, to_status, changed_by)
    VALUES (NEW.id, OLD.status, NEW.status, auth.uid());
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_availability_units_status_history ON public.availability_units;
CREATE TRIGGER trg_availability_units_status_history
  AFTER UPDATE ON public.availability_units
  FOR EACH ROW EXECUTE FUNCTION public.log_availability_status_change();

-- Realtime
ALTER TABLE public.availability_units REPLICA IDENTITY FULL;
ALTER TABLE public.availability_history REPLICA IDENTITY FULL;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.availability_units;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.availability_history;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
