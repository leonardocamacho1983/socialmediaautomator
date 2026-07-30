alter table public.post_drafts
  add column if not exists source_idea_id uuid references public.content_ideas(id) on delete set null;

create index if not exists post_drafts_source_idea_id_idx
  on public.post_drafts(source_idea_id);
