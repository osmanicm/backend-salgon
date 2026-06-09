-- ============================================
-- WHATSAPP TEMPLATES (global, admin-managed)
-- ============================================
create table public.whatsapp_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  body text not null,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.whatsapp_templates enable row level security;

create trigger whatsapp_templates_set_updated_at
  before update on public.whatsapp_templates
  for each row execute function public.set_updated_at();

-- RLS: every authenticated user can read active templates; only admins manage them.
create policy "WhatsApp templates: authenticated read non-deleted"
  on public.whatsapp_templates for select to authenticated
  using (deleted_at is null or public.has_role(auth.uid(), 'admin'));

create policy "WhatsApp templates: admins insert"
  on public.whatsapp_templates for insert to authenticated
  with check (public.has_role(auth.uid(), 'admin'));

create policy "WhatsApp templates: admins update"
  on public.whatsapp_templates for update to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

create policy "WhatsApp templates: admins delete"
  on public.whatsapp_templates for delete to authenticated
  using (public.has_role(auth.uid(), 'admin'));

-- Seed with the templates previously hardcoded in the app.
insert into public.whatsapp_templates (name, body) values
  ('Bienvenida', 'Hola {{name}}, gracias por contactar a Salgon Bienes Raíces. ¿En qué podemos ayudarte hoy?'),
  ('Propiedad Sugerida', 'Hola {{name}}, encontramos una propiedad que coincide con tu interés: {{property}}. ¿Te gustaría agendar una visita?'),
  ('Confirmación de Visita', 'Hola {{name}}, confirmamos tu visita a {{property}} el {{date}}. ¡Te esperamos!'),
  ('Seguimiento', 'Hola {{name}}, queríamos dar seguimiento a nuestra última conversación. ¿Tienes alguna duda?'),
  ('Oferta Enviada', 'Estimado(a) {{name}}, adjuntamos nuestra oferta oficial para {{property}}. Quedamos atentos a tus comentarios.');
