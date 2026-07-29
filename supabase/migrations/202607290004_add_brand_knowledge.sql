create table if not exists public.brand_knowledge (
  id uuid primary key default gen_random_uuid(),
  brand_profile_id uuid references public.brand_profiles(id) on delete set null,
  source text not null default 'brand_assets',
  summary text not null default '',
  visual_identity jsonb not null default '{}'::jsonb,
  asset_inventory jsonb not null default '[]'::jsonb,
  reference_inventory jsonb not null default '[]'::jsonb,
  generated_by text not null default 'system',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists brand_knowledge_created_at_idx on public.brand_knowledge(created_at desc);

alter table public.brand_knowledge enable row level security;

drop trigger if exists brand_knowledge_set_updated_at on public.brand_knowledge;
create trigger brand_knowledge_set_updated_at before update on public.brand_knowledge for each row execute function public.set_updated_at();
