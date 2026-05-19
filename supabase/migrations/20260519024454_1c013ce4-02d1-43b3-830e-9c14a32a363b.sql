-- News categories enum
CREATE TYPE public.news_category AS ENUM (
  'Open House',
  'Nuevos Lanzamientos',
  'Promociones',
  'Bonos',
  'Avisos Internos'
);

CREATE TYPE public.news_status AS ENUM ('Published', 'Draft');

CREATE TABLE public.news (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  image_url text,
  description text NOT NULL DEFAULT '',
  category public.news_category NOT NULL DEFAULT 'Avisos Internos',
  status public.news_status NOT NULL DEFAULT 'Draft',
  event_date date,
  highlighted boolean NOT NULL DEFAULT false,
  related_property_id uuid REFERENCES public.properties(id) ON DELETE SET NULL,
  author_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_news_status_created ON public.news (status, created_at DESC);
CREATE INDEX idx_news_category ON public.news (category);

ALTER TABLE public.news ENABLE ROW LEVEL SECURITY;

-- Admins: full access
CREATE POLICY "News: admins all"
  ON public.news FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- All authenticated users can read published
CREATE POLICY "News: authenticated read published"
  ON public.news FOR SELECT
  TO authenticated
  USING (status = 'Published'::public.news_status OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER news_set_updated_at
  BEFORE UPDATE ON public.news
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();
