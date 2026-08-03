create table if not exists public.studio_projects (
  id text primary key,
  title text not null,
  brand_name text not null,
  source text not null check (source in ('creative_project', 'approved_post')),
  status text not null check (
    status in (
      'draft',
      'concept_selected',
      'typographic_ready',
      'caption_ready',
      'approved',
      'package_ready',
      'exported',
      'ready_to_publish'
    )
  ),
  visual_status text,
  final_package_status text,
  carousel_status text,
  project_data jsonb not null,
  approved_post_data jsonb,
  summary jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

alter table public.studio_projects enable row level security;

revoke all on table public.studio_projects from anon;
revoke all on table public.studio_projects from authenticated;
grant select, insert, update, delete on table public.studio_projects to service_role;

create index if not exists studio_projects_updated_at_idx
  on public.studio_projects (updated_at desc)
  where deleted_at is null;

create index if not exists studio_projects_brand_name_idx
  on public.studio_projects (brand_name)
  where deleted_at is null;

create index if not exists studio_projects_status_idx
  on public.studio_projects (status)
  where deleted_at is null;

create index if not exists studio_projects_summary_gin_idx
  on public.studio_projects using gin (summary);
