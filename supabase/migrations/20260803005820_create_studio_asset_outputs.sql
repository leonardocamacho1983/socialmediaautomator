insert into storage.buckets (id, name, public)
values ('studio-assets', 'studio-assets', false)
on conflict (id) do update set public = false;

create table if not exists public.studio_asset_outputs (
  id text primary key,
  approved_post_id text not null,
  project_id text,
  kind text not null check (
    kind in (
      'generated_asset',
      'selected_asset',
      'final_post_png',
      'final_post_svg',
      'carousel_slide_png',
      'carousel_slide_svg',
      'carousel_zip',
      'final_package_zip'
    )
  ),
  label text not null,
  file_name text not null,
  bucket_id text not null default 'studio-assets',
  object_path text not null unique,
  content_type text not null,
  size_bytes integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

alter table public.studio_asset_outputs enable row level security;

revoke all on table public.studio_asset_outputs from anon;
revoke all on table public.studio_asset_outputs from authenticated;
grant select, insert, update, delete on table public.studio_asset_outputs to service_role;

create index if not exists studio_asset_outputs_post_idx
  on public.studio_asset_outputs (approved_post_id, created_at desc)
  where deleted_at is null;

create index if not exists studio_asset_outputs_kind_idx
  on public.studio_asset_outputs (kind)
  where deleted_at is null;
