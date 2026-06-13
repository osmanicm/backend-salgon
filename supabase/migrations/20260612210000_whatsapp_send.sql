-- WhatsApp Cloud API: vincular plantillas a Meta + log de envíos

-- 1) Extender whatsapp_templates con metadatos de Meta
alter table public.whatsapp_templates
  add column if not exists meta_template_name text,
  add column if not exists meta_language text not null default 'es_MX',
  add column if not exists header_format text not null default 'NONE'
    check (header_format in ('NONE','TEXT','IMAGE','DOCUMENT')),
  add column if not exists variable_mapping jsonb not null default '[]'::jsonb;

-- 2) Log de envíos (auditoría)
create table public.whatsapp_messages (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references public.leads(id) on delete set null,
  template_id uuid references public.whatsapp_templates(id) on delete set null,
  to_phone text not null,
  meta_message_id text,
  status text not null,
  error text,
  sent_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index whatsapp_messages_created_idx on public.whatsapp_messages(created_at desc);

alter table public.whatsapp_messages enable row level security;

create policy "WhatsApp messages: authenticated read"
  on public.whatsapp_messages for select to authenticated
  using (true);
