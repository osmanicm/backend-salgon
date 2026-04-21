-- 1) Add columns to properties
ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS model text,
  ADD COLUMN IF NOT EXISTS lot text,
  ADD COLUMN IF NOT EXISTS delivery_date date,
  ADD COLUMN IF NOT EXISTS notes text;

-- 2) property_media (photos, renders, videos)
CREATE TYPE public.media_kind AS ENUM ('photo', 'render', 'video');

CREATE TABLE public.property_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  kind public.media_kind NOT NULL,
  url text NOT NULL,
  title text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_property_media_property ON public.property_media(property_id);

ALTER TABLE public.property_media ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Media: authenticated read non-deleted"
ON public.property_media FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.properties p
    WHERE p.id = property_id
      AND (p.deleted_at IS NULL OR public.has_role(auth.uid(), 'admin'::public.app_role))
  )
);

CREATE POLICY "Media: agent or admin insert"
ON public.property_media FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.properties p
    WHERE p.id = property_id
      AND (p.agent_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.app_role))
  )
);

CREATE POLICY "Media: agent or admin update"
ON public.property_media FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.properties p
    WHERE p.id = property_id
      AND (p.agent_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.app_role))
  )
);

CREATE POLICY "Media: agent or admin delete"
ON public.property_media FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.properties p
    WHERE p.id = property_id
      AND (p.agent_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.app_role))
  )
);

CREATE TRIGGER set_property_media_updated_at
BEFORE UPDATE ON public.property_media
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3) property_files (downloadable files: PDFs, etc.)
CREATE TABLE public.property_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  label text NOT NULL,
  url text NOT NULL,
  mime_type text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_property_files_property ON public.property_files(property_id);

ALTER TABLE public.property_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Files: authenticated read non-deleted"
ON public.property_files FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.properties p
    WHERE p.id = property_id
      AND (p.deleted_at IS NULL OR public.has_role(auth.uid(), 'admin'::public.app_role))
  )
);

CREATE POLICY "Files: agent or admin insert"
ON public.property_files FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.properties p
    WHERE p.id = property_id
      AND (p.agent_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.app_role))
  )
);

CREATE POLICY "Files: agent or admin update"
ON public.property_files FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.properties p
    WHERE p.id = property_id
      AND (p.agent_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.app_role))
  )
);

CREATE POLICY "Files: agent or admin delete"
ON public.property_files FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.properties p
    WHERE p.id = property_id
      AND (p.agent_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.app_role))
  )
);

CREATE TRIGGER set_property_files_updated_at
BEFORE UPDATE ON public.property_files
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 4) Enable realtime on properties for status sync
ALTER TABLE public.properties REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.properties;