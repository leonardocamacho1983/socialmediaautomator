create extension if not exists pgcrypto;

create table if not exists public.brand_profiles (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Meu negócio',
  business_idea text not null default '',
  value_proposition text not null default '',
  product_scope text not null default '',
  target_audience text not null default '',
  tone_of_voice text not null default '',
  design_system_notes text not null default '',
  constraints text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.personas (
  id uuid primary key default gen_random_uuid(),
  brand_profile_id uuid not null references public.brand_profiles(id) on delete cascade,
  name text not null,
  description text not null default '',
  pains text not null default '',
  desired_outcomes text not null default '',
  objections text not null default '',
  language_notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.content_pillars (
  id uuid primary key default gen_random_uuid(),
  brand_profile_id uuid not null references public.brand_profiles(id) on delete cascade,
  name text not null,
  description text not null default '',
  viral_angle text not null default '',
  weight integer not null default 1 check (weight >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.content_calendar_items (
  id uuid primary key default gen_random_uuid(),
  brand_profile_id uuid references public.brand_profiles(id) on delete set null,
  content_pillar_id uuid references public.content_pillars(id) on delete set null,
  scheduled_for timestamptz,
  platform text not null check (platform in ('instagram', 'linkedin', 'both')),
  format text not null default 'post',
  objective text not null default 'alcance',
  topic text not null,
  viral_hook text not null default '',
  angle text not null default '',
  status text not null default 'planned' check (status in ('planned', 'drafted', 'approved', 'scheduled', 'published', 'failed', 'archived')),
  score integer check (score is null or (score >= 0 and score <= 100)),
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.media_assets (
  id uuid primary key default gen_random_uuid(),
  source text not null check (source in ('pexels', 'manual', 'generated')),
  media_type text not null check (media_type in ('image', 'video', 'document')),
  url text not null,
  thumbnail_url text,
  author text,
  license text,
  search_query text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.generation_runs (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'manual',
  model text,
  task text not null,
  input jsonb not null default '{}'::jsonb,
  output jsonb not null default '{}'::jsonb,
  status text not null default 'completed' check (status in ('queued', 'running', 'completed', 'failed')),
  error text,
  duration_ms integer,
  created_at timestamptz not null default now()
);

create table if not exists public.post_drafts (
  id uuid primary key default gen_random_uuid(),
  calendar_item_id uuid references public.content_calendar_items(id) on delete set null,
  media_asset_id uuid references public.media_assets(id) on delete set null,
  zernio_post_id text,
  title text not null default '',
  content text not null default '',
  first_comment text not null default '',
  hashtags text[] not null default '{}'::text[],
  platform text not null check (platform in ('instagram', 'linkedin', 'both')),
  status text not null default 'draft' check (status in ('draft', 'approved', 'scheduled', 'publishing', 'published', 'failed', 'cancelled')),
  scheduled_for timestamptz,
  published_at timestamptz,
  generation_run_id uuid references public.generation_runs(id) on delete set null,
  zernio_payload jsonb not null default '{}'::jsonb,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.zernio_events (
  id uuid primary key default gen_random_uuid(),
  event_id text,
  event_type text not null,
  zernio_post_id text,
  post_draft_id uuid references public.post_drafts(id) on delete set null,
  payload jsonb not null default '{}'::jsonb,
  received_at timestamptz not null default now(),
  unique(event_id)
);

create index if not exists content_calendar_items_status_idx on public.content_calendar_items(status);
create index if not exists content_calendar_items_scheduled_for_idx on public.content_calendar_items(scheduled_for);
create index if not exists post_drafts_status_idx on public.post_drafts(status);
create index if not exists post_drafts_zernio_post_id_idx on public.post_drafts(zernio_post_id);
create index if not exists zernio_events_event_type_idx on public.zernio_events(event_type);
create index if not exists zernio_events_zernio_post_id_idx on public.zernio_events(zernio_post_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists brand_profiles_set_updated_at on public.brand_profiles;
create trigger brand_profiles_set_updated_at before update on public.brand_profiles for each row execute function public.set_updated_at();

drop trigger if exists personas_set_updated_at on public.personas;
create trigger personas_set_updated_at before update on public.personas for each row execute function public.set_updated_at();

drop trigger if exists content_pillars_set_updated_at on public.content_pillars;
create trigger content_pillars_set_updated_at before update on public.content_pillars for each row execute function public.set_updated_at();

drop trigger if exists content_calendar_items_set_updated_at on public.content_calendar_items;
create trigger content_calendar_items_set_updated_at before update on public.content_calendar_items for each row execute function public.set_updated_at();

drop trigger if exists post_drafts_set_updated_at on public.post_drafts;
create trigger post_drafts_set_updated_at before update on public.post_drafts for each row execute function public.set_updated_at();

alter table public.brand_profiles enable row level security;
alter table public.personas enable row level security;
alter table public.content_pillars enable row level security;
alter table public.content_calendar_items enable row level security;
alter table public.media_assets enable row level security;
alter table public.post_drafts enable row level security;
alter table public.generation_runs enable row level security;
alter table public.zernio_events enable row level security;
