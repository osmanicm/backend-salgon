-- Próximo contacto para seguimiento en el Embudo de Ventas.
-- Nullable, sin default. Las políticas RLS por fila de leads ya cubren esta columna.
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS next_contact_at date;
