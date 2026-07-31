create extension if not exists pgcrypto;

create table if not exists public.business_profiles (
  id uuid primary key default gen_random_uuid(),
  legacy_brand_profile_id uuid references public.brand_profiles(id) on delete set null,
  name text not null default 'Meu negocio',
  business_summary text not null default '',
  product_scope text not null default '',
  value_proposition text not null default '',
  market text not null default '',
  primary_offer text not null default '',
  operating_constraints jsonb not null default '{}'::jsonb,
  default_locale text not null default 'pt-BR',
  default_timezone text not null default 'America/Sao_Paulo',
  status text not null default 'active' check (status in ('active', 'paused', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.business_profiles (
  legacy_brand_profile_id,
  name,
  business_summary,
  product_scope,
  value_proposition,
  operating_constraints,
  default_timezone
)
select
  bp.id,
  bp.name,
  bp.business_idea,
  bp.product_scope,
  bp.value_proposition,
  jsonb_build_object(
    'target_audience', bp.target_audience,
    'tone_of_voice', bp.tone_of_voice,
    'design_system_notes', bp.design_system_notes,
    'constraints', bp.constraints
  ),
  'America/Sao_Paulo'
from public.brand_profiles bp
where not exists (
  select 1
  from public.business_profiles existing
  where existing.legacy_brand_profile_id = bp.id
);

create table if not exists public.decision_traces (
  id uuid primary key default gen_random_uuid(),
  business_profile_id uuid references public.business_profiles(id) on delete set null,
  subject_table text not null,
  subject_id uuid,
  engine text not null,
  decision_key text not null,
  selected_value text not null default '',
  alternatives jsonb not null default '[]'::jsonb,
  context jsonb not null default '{}'::jsonb,
  rule_ids text[] not null default '{}'::text[],
  confidence_score numeric(5,2) check (confidence_score is null or (confidence_score >= 0 and confidence_score <= 100)),
  risk_level text not null default 'low' check (risk_level in ('low', 'medium', 'high', 'blocked')),
  requires_human_review boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.brand_dna (
  id uuid primary key default gen_random_uuid(),
  business_profile_id uuid not null references public.business_profiles(id) on delete cascade,
  source_brand_knowledge_id uuid references public.brand_knowledge(id) on delete set null,
  decision_trace_id uuid references public.decision_traces(id) on delete set null,
  personality jsonb not null default '{}'::jsonb,
  mission text not null default '',
  enemy text not null default '',
  transformation text not null default '',
  verbal_codes jsonb not null default '{}'::jsonb,
  visual_codes jsonb not null default '{}'::jsonb,
  forbidden_patterns jsonb not null default '{}'::jsonb,
  confidence_score numeric(5,2) check (confidence_score is null or (confidence_score >= 0 and confidence_score <= 100)),
  status text not null default 'draft' check (status in ('draft', 'active', 'archived')),
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.brand_writing_profiles (
  id uuid primary key default gen_random_uuid(),
  brand_dna_id uuid not null references public.brand_dna(id) on delete cascade,
  language text not null default 'pt-BR',
  rhythm jsonb not null default '{}'::jsonb,
  vocabulary jsonb not null default '{}'::jsonb,
  punctuation_policy jsonb not null default '{}'::jsonb,
  ai_pattern_bans jsonb not null default '{}'::jsonb,
  copy_style_defaults jsonb not null default '{}'::jsonb,
  human_imperfections jsonb not null default '{}'::jsonb,
  status text not null default 'draft' check (status in ('draft', 'active', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.brand_visual_systems (
  id uuid primary key default gen_random_uuid(),
  brand_dna_id uuid not null references public.brand_dna(id) on delete cascade,
  colors jsonb not null default '{}'::jsonb,
  typography jsonb not null default '{}'::jsonb,
  composition_rules jsonb not null default '{}'::jsonb,
  logo_rules jsonb not null default '{}'::jsonb,
  asset_rules jsonb not null default '{}'::jsonb,
  visual_grammars jsonb not null default '[]'::jsonb,
  status text not null default 'draft' check (status in ('draft', 'active', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.audience_segments (
  id uuid primary key default gen_random_uuid(),
  business_profile_id uuid not null references public.business_profiles(id) on delete cascade,
  name text not null,
  maturity_stage text not null default 'mixed' check (maturity_stage in ('unaware', 'problem_aware', 'solution_aware', 'decision', 'retention', 'mixed')),
  description text not null default '',
  pains jsonb not null default '[]'::jsonb,
  desired_outcomes jsonb not null default '[]'::jsonb,
  objections jsonb not null default '[]'::jsonb,
  language_patterns jsonb not null default '{}'::jsonb,
  channels jsonb not null default '["instagram"]'::jsonb,
  priority integer not null default 1 check (priority >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.content_strategies (
  id uuid primary key default gen_random_uuid(),
  business_profile_id uuid not null references public.business_profiles(id) on delete cascade,
  title text not null,
  objective text not null default 'awareness',
  period_start date,
  period_end date,
  narrative_thesis text not null default '',
  success_metrics jsonb not null default '[]'::jsonb,
  constraints jsonb not null default '{}'::jsonb,
  status text not null default 'draft' check (status in ('draft', 'active', 'completed', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.campaigns (
  id uuid primary key default gen_random_uuid(),
  content_strategy_id uuid not null references public.content_strategies(id) on delete cascade,
  audience_segment_id uuid references public.audience_segments(id) on delete set null,
  decision_trace_id uuid references public.decision_traces(id) on delete set null,
  name text not null,
  narrative text not null default '',
  core_tension text not null default '',
  funnel_stage text not null default 'awareness',
  objective text not null default 'conversation',
  hypotheses jsonb not null default '[]'::jsonb,
  decision_policy jsonb not null default '{}'::jsonb,
  priority integer not null default 1 check (priority >= 0),
  starts_on date,
  ends_on date,
  status text not null default 'planned' check (status in ('planned', 'active', 'paused', 'completed', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.creative_concepts (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  decision_trace_id uuid references public.decision_traces(id) on delete set null,
  title text not null,
  core_idea text not null default '',
  psychological_trigger text not null default '',
  emotion text not null default '',
  story text not null default '',
  visual_metaphor text not null default '',
  visual_style text not null default '',
  composition text not null default '',
  recommended_format text not null default 'carousel',
  expected_engagement jsonb not null default '{}'::jsonb,
  brand_rules jsonb not null default '{}'::jsonb,
  status text not null default 'proposed' check (status in ('proposed', 'approved', 'rejected', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.creative_pieces (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  creative_concept_id uuid references public.creative_concepts(id) on delete set null,
  decision_trace_id uuid references public.decision_traces(id) on delete set null,
  title text not null,
  platform text not null default 'instagram' check (platform in ('instagram', 'linkedin', 'both')),
  content_objective text not null default 'conversation',
  format_family text not null default 'carousel',
  hypothesis jsonb not null default '{}'::jsonb,
  status text not null default 'planned' check (status in ('planned', 'in_production', 'review', 'approved', 'rendered', 'scheduled', 'published', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.creative_variants (
  id uuid primary key default gen_random_uuid(),
  creative_piece_id uuid not null references public.creative_pieces(id) on delete cascade,
  decision_trace_id uuid references public.decision_traces(id) on delete set null,
  variant_label text not null default 'A',
  platform text not null default 'instagram' check (platform in ('instagram', 'linkedin', 'both')),
  format text not null default 'carousel',
  aspect_ratio text not null default '4:5',
  copy_payload jsonb not null default '{}'::jsonb,
  layout_spec jsonb not null default '{}'::jsonb,
  asset_plan jsonb not null default '{}'::jsonb,
  engagement_plan jsonb not null default '{}'::jsonb,
  quality_scores jsonb not null default '{}'::jsonb,
  approval_status text not null default 'draft' check (approval_status in ('draft', 'needs_revision', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.copy_evaluations (
  id uuid primary key default gen_random_uuid(),
  creative_variant_id uuid references public.creative_variants(id) on delete cascade,
  evaluator text not null default 'human_writing_engine',
  artificiality_score numeric(5,2) check (artificiality_score is null or (artificiality_score >= 0 and artificiality_score <= 100)),
  flagged_patterns jsonb not null default '[]'::jsonb,
  rewrite_notes text not null default '',
  passed boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.creative_evaluations (
  id uuid primary key default gen_random_uuid(),
  creative_variant_id uuid references public.creative_variants(id) on delete cascade,
  evaluator text not null default 'creative_direction_engine',
  brand_fit_score numeric(5,2) check (brand_fit_score is null or (brand_fit_score >= 0 and brand_fit_score <= 100)),
  hierarchy_score numeric(5,2) check (hierarchy_score is null or (hierarchy_score >= 0 and hierarchy_score <= 100)),
  originality_score numeric(5,2) check (originality_score is null or (originality_score >= 0 and originality_score <= 100)),
  risk_level text not null default 'low' check (risk_level in ('low', 'medium', 'high', 'blocked')),
  notes text not null default '',
  passed boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.rendering_jobs (
  id uuid primary key default gen_random_uuid(),
  creative_variant_id uuid references public.creative_variants(id) on delete cascade,
  renderer text not null default 'html_svg',
  status text not null default 'queued' check (status in ('queued', 'running', 'rendered', 'failed', 'cancelled')),
  input_payload jsonb not null default '{}'::jsonb,
  output_payload jsonb not null default '{}'::jsonb,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.rendered_assets (
  id uuid primary key default gen_random_uuid(),
  rendering_job_id uuid references public.rendering_jobs(id) on delete set null,
  creative_variant_id uuid references public.creative_variants(id) on delete cascade,
  storage_bucket text not null default 'rendered-assets',
  storage_path text not null default '',
  media_type text not null default 'image' check (media_type in ('image', 'video', 'document')),
  public_url text,
  width integer check (width is null or width > 0),
  height integer check (height is null or height > 0),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.publication_jobs (
  id uuid primary key default gen_random_uuid(),
  creative_variant_id uuid references public.creative_variants(id) on delete set null,
  rendered_asset_id uuid references public.rendered_assets(id) on delete set null,
  zernio_post_id text,
  target_platform text not null default 'instagram',
  target_account_id text,
  scheduled_for timestamptz,
  timezone text not null default 'America/Sao_Paulo',
  zernio_payload jsonb not null default '{}'::jsonb,
  status text not null default 'draft' check (status in ('draft', 'queued', 'scheduled', 'publishing', 'published', 'failed', 'cancelled')),
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.engagement_policies (
  id uuid primary key default gen_random_uuid(),
  business_profile_id uuid references public.business_profiles(id) on delete cascade,
  campaign_id uuid references public.campaigns(id) on delete set null,
  creative_piece_id uuid references public.creative_pieces(id) on delete set null,
  name text not null,
  autonomy_level text not null default 'assisted' check (autonomy_level in ('autonomous', 'assisted', 'human_review')),
  scope text not null default 'account' check (scope in ('account', 'campaign', 'piece', 'variant')),
  keyword_rules jsonb not null default '[]'::jsonb,
  intent_rules jsonb not null default '[]'::jsonb,
  escalation_rules jsonb not null default '[]'::jsonb,
  material_delivery_rules jsonb not null default '[]'::jsonb,
  status text not null default 'active' check (status in ('active', 'paused', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  platform text not null default 'instagram',
  platform_contact_id text not null,
  display_name text,
  username text,
  tags text[] not null default '{}'::text[],
  custom_fields jsonb not null default '{}'::jsonb,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  status text not null default 'active' check (status in ('active', 'muted', 'blocked', 'archived')),
  unique(platform, platform_contact_id)
);

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid references public.contacts(id) on delete set null,
  platform text not null default 'instagram',
  zernio_conversation_id text,
  status text not null default 'open' check (status in ('open', 'waiting', 'closed', 'archived')),
  last_message_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.social_interactions (
  id uuid primary key default gen_random_uuid(),
  zernio_event_id uuid references public.zernio_events(id) on delete set null,
  contact_id uuid references public.contacts(id) on delete set null,
  conversation_id uuid references public.conversations(id) on delete set null,
  source text not null default 'zernio' check (source in ('zernio', 'instagram', 'manual')),
  platform text not null default 'instagram',
  zernio_interaction_id text,
  account_id text,
  interaction_type text not null default 'unknown' check (interaction_type in ('comment', 'dm', 'story_reply', 'review', 'mention', 'unknown')),
  direction text not null default 'inbound' check (direction in ('inbound', 'outbound')),
  author_external_id text,
  author_username text,
  body text not null default '',
  classification jsonb not null default '{}'::jsonb,
  risk_level text not null default 'low' check (risk_level in ('low', 'medium', 'high', 'blocked')),
  status text not null default 'received' check (status in ('received', 'classified', 'actioned', 'ignored', 'escalated')),
  received_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.engagement_actions (
  id uuid primary key default gen_random_uuid(),
  engagement_policy_id uuid references public.engagement_policies(id) on delete set null,
  interaction_id uuid references public.social_interactions(id) on delete set null,
  contact_id uuid references public.contacts(id) on delete set null,
  conversation_id uuid references public.conversations(id) on delete set null,
  decision_trace_id uuid references public.decision_traces(id) on delete set null,
  action_type text not null check (action_type in ('public_reply', 'private_reply', 'comment_to_dm', 'material_delivery', 'tag_contact', 'start_sequence', 'human_review', 'noop')),
  autonomy_level text not null default 'assisted' check (autonomy_level in ('autonomous', 'assisted', 'human_review')),
  status text not null default 'proposed' check (status in ('proposed', 'approved', 'executed', 'failed', 'skipped')),
  request_payload jsonb not null default '{}'::jsonb,
  response_payload jsonb not null default '{}'::jsonb,
  error text,
  scheduled_for timestamptz,
  executed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.content_performance (
  id uuid primary key default gen_random_uuid(),
  creative_variant_id uuid references public.creative_variants(id) on delete set null,
  publication_job_id uuid references public.publication_jobs(id) on delete set null,
  zernio_post_id text,
  platform text not null default 'instagram',
  metric_window_start timestamptz,
  metric_window_end timestamptz,
  metrics jsonb not null default '{}'::jsonb,
  normalized_metrics jsonb not null default '{}'::jsonb,
  source text not null default 'zernio',
  collected_at timestamptz not null default now()
);

create table if not exists public.learning_insights (
  id uuid primary key default gen_random_uuid(),
  business_profile_id uuid references public.business_profiles(id) on delete cascade,
  campaign_id uuid references public.campaigns(id) on delete set null,
  decision_trace_id uuid references public.decision_traces(id) on delete set null,
  title text not null,
  insight_type text not null default 'performance',
  evidence jsonb not null default '{}'::jsonb,
  recommendation text not null default '',
  confidence_score numeric(5,2) check (confidence_score is null or (confidence_score >= 0 and confidence_score <= 100)),
  status text not null default 'proposed' check (status in ('proposed', 'applied', 'rejected', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists public.brand_assets
  add column if not exists business_profile_id uuid references public.business_profiles(id) on delete set null;

alter table if exists public.brand_references
  add column if not exists business_profile_id uuid references public.business_profiles(id) on delete set null;

alter table if exists public.brand_knowledge
  add column if not exists business_profile_id uuid references public.business_profiles(id) on delete set null;

create index if not exists business_profiles_status_idx on public.business_profiles(status);
create index if not exists decision_traces_business_profile_id_idx on public.decision_traces(business_profile_id);
create index if not exists decision_traces_engine_idx on public.decision_traces(engine);
create index if not exists decision_traces_subject_idx on public.decision_traces(subject_table, subject_id);
create index if not exists brand_dna_business_profile_id_idx on public.brand_dna(business_profile_id);
create index if not exists audience_segments_business_profile_id_idx on public.audience_segments(business_profile_id);
create index if not exists content_strategies_business_profile_id_idx on public.content_strategies(business_profile_id);
create index if not exists campaigns_content_strategy_id_idx on public.campaigns(content_strategy_id);
create index if not exists campaigns_status_idx on public.campaigns(status);
create index if not exists creative_concepts_campaign_id_idx on public.creative_concepts(campaign_id);
create index if not exists creative_pieces_campaign_id_idx on public.creative_pieces(campaign_id);
create index if not exists creative_pieces_status_idx on public.creative_pieces(status);
create index if not exists creative_variants_piece_id_idx on public.creative_variants(creative_piece_id);
create index if not exists creative_variants_approval_status_idx on public.creative_variants(approval_status);
create index if not exists rendering_jobs_status_idx on public.rendering_jobs(status);
create index if not exists rendered_assets_variant_id_idx on public.rendered_assets(creative_variant_id);
create index if not exists publication_jobs_status_idx on public.publication_jobs(status);
create index if not exists publication_jobs_zernio_post_id_idx on public.publication_jobs(zernio_post_id);
create index if not exists engagement_policies_business_profile_id_idx on public.engagement_policies(business_profile_id);
create index if not exists contacts_platform_contact_id_idx on public.contacts(platform, platform_contact_id);
create index if not exists conversations_contact_id_idx on public.conversations(contact_id);
create index if not exists social_interactions_received_at_idx on public.social_interactions(received_at desc);
create index if not exists social_interactions_type_idx on public.social_interactions(interaction_type);
create index if not exists engagement_actions_status_idx on public.engagement_actions(status);
create index if not exists content_performance_variant_id_idx on public.content_performance(creative_variant_id);
create index if not exists learning_insights_business_profile_id_idx on public.learning_insights(business_profile_id);

drop trigger if exists business_profiles_set_updated_at on public.business_profiles;
create trigger business_profiles_set_updated_at before update on public.business_profiles for each row execute function public.set_updated_at();

drop trigger if exists brand_dna_set_updated_at on public.brand_dna;
create trigger brand_dna_set_updated_at before update on public.brand_dna for each row execute function public.set_updated_at();

drop trigger if exists brand_writing_profiles_set_updated_at on public.brand_writing_profiles;
create trigger brand_writing_profiles_set_updated_at before update on public.brand_writing_profiles for each row execute function public.set_updated_at();

drop trigger if exists brand_visual_systems_set_updated_at on public.brand_visual_systems;
create trigger brand_visual_systems_set_updated_at before update on public.brand_visual_systems for each row execute function public.set_updated_at();

drop trigger if exists audience_segments_set_updated_at on public.audience_segments;
create trigger audience_segments_set_updated_at before update on public.audience_segments for each row execute function public.set_updated_at();

drop trigger if exists content_strategies_set_updated_at on public.content_strategies;
create trigger content_strategies_set_updated_at before update on public.content_strategies for each row execute function public.set_updated_at();

drop trigger if exists campaigns_set_updated_at on public.campaigns;
create trigger campaigns_set_updated_at before update on public.campaigns for each row execute function public.set_updated_at();

drop trigger if exists creative_concepts_set_updated_at on public.creative_concepts;
create trigger creative_concepts_set_updated_at before update on public.creative_concepts for each row execute function public.set_updated_at();

drop trigger if exists creative_pieces_set_updated_at on public.creative_pieces;
create trigger creative_pieces_set_updated_at before update on public.creative_pieces for each row execute function public.set_updated_at();

drop trigger if exists creative_variants_set_updated_at on public.creative_variants;
create trigger creative_variants_set_updated_at before update on public.creative_variants for each row execute function public.set_updated_at();

drop trigger if exists rendering_jobs_set_updated_at on public.rendering_jobs;
create trigger rendering_jobs_set_updated_at before update on public.rendering_jobs for each row execute function public.set_updated_at();

drop trigger if exists publication_jobs_set_updated_at on public.publication_jobs;
create trigger publication_jobs_set_updated_at before update on public.publication_jobs for each row execute function public.set_updated_at();

drop trigger if exists engagement_policies_set_updated_at on public.engagement_policies;
create trigger engagement_policies_set_updated_at before update on public.engagement_policies for each row execute function public.set_updated_at();

drop trigger if exists conversations_set_updated_at on public.conversations;
create trigger conversations_set_updated_at before update on public.conversations for each row execute function public.set_updated_at();

drop trigger if exists engagement_actions_set_updated_at on public.engagement_actions;
create trigger engagement_actions_set_updated_at before update on public.engagement_actions for each row execute function public.set_updated_at();

drop trigger if exists learning_insights_set_updated_at on public.learning_insights;
create trigger learning_insights_set_updated_at before update on public.learning_insights for each row execute function public.set_updated_at();

alter table public.business_profiles enable row level security;
alter table public.decision_traces enable row level security;
alter table public.brand_dna enable row level security;
alter table public.brand_writing_profiles enable row level security;
alter table public.brand_visual_systems enable row level security;
alter table public.audience_segments enable row level security;
alter table public.content_strategies enable row level security;
alter table public.campaigns enable row level security;
alter table public.creative_concepts enable row level security;
alter table public.creative_pieces enable row level security;
alter table public.creative_variants enable row level security;
alter table public.copy_evaluations enable row level security;
alter table public.creative_evaluations enable row level security;
alter table public.rendering_jobs enable row level security;
alter table public.rendered_assets enable row level security;
alter table public.publication_jobs enable row level security;
alter table public.engagement_policies enable row level security;
alter table public.contacts enable row level security;
alter table public.conversations enable row level security;
alter table public.social_interactions enable row level security;
alter table public.engagement_actions enable row level security;
alter table public.content_performance enable row level security;
alter table public.learning_insights enable row level security;
