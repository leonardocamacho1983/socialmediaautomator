create table if not exists public.content_ideas (
  id uuid primary key default gen_random_uuid(),
  brand_knowledge_id uuid references public.brand_knowledge(id) on delete set null,
  topic text not null,
  hook text not null,
  pain text not null default '',
  promise text not null default '',
  platform text not null check (platform in ('instagram', 'linkedin', 'both')),
  format text not null default 'post',
  viral_hypothesis text not null default '',
  score integer check (score is null or (score >= 0 and score <= 100)),
  status text not null default 'generated' check (status in ('generated', 'approved', 'rejected', 'expanded', 'archived')),
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists content_ideas_status_idx on public.content_ideas(status);
create index if not exists content_ideas_score_idx on public.content_ideas(score desc);
create index if not exists content_ideas_created_at_idx on public.content_ideas(created_at desc);

alter table public.content_ideas enable row level security;

drop trigger if exists content_ideas_set_updated_at on public.content_ideas;
create trigger content_ideas_set_updated_at before update on public.content_ideas for each row execute function public.set_updated_at();
