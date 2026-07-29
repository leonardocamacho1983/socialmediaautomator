create table if not exists public.brand_assets (
  id uuid primary key default gen_random_uuid(),
  brand_profile_id uuid references public.brand_profiles(id) on delete set null,
  type text not null check (type in ('logo', 'photo', 'product', 'screenshot', 'template', 'background', 'reference', 'other')),
  title text not null,
  description text not null default '',
  storage_bucket text not null default 'brand-assets',
  storage_path text not null,
  content_type text,
  size_bytes bigint,
  tags text[] not null default '{}'::text[],
  usage_notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists brand_assets_type_idx on public.brand_assets(type);
create index if not exists brand_assets_created_at_idx on public.brand_assets(created_at desc);

alter table public.brand_assets enable row level security;

drop trigger if exists brand_assets_set_updated_at on public.brand_assets;
create trigger brand_assets_set_updated_at before update on public.brand_assets for each row execute function public.set_updated_at();
