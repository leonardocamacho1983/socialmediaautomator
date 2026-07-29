create table if not exists public.brand_references (
  id uuid primary key default gen_random_uuid(),
  brand_profile_id uuid references public.brand_profiles(id) on delete set null,
  type text not null check (type in ('design_system', 'brand_book', 'figma', 'canva', 'landing_page', 'site', 'reference', 'other')),
  title text not null,
  url text not null,
  description text not null default '',
  tags text[] not null default '{}'::text[],
  usage_notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists brand_references_type_idx on public.brand_references(type);
create index if not exists brand_references_created_at_idx on public.brand_references(created_at desc);

alter table public.brand_references enable row level security;

drop trigger if exists brand_references_set_updated_at on public.brand_references;
create trigger brand_references_set_updated_at before update on public.brand_references for each row execute function public.set_updated_at();
