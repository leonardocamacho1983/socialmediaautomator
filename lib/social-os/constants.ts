export const SOCIAL_OS_TABLES = [
  "business_profiles",
  "brand_dna",
  "brand_writing_profiles",
  "brand_visual_systems",
  "audience_segments",
  "content_strategies",
  "campaigns",
  "creative_concepts",
  "creative_pieces",
  "creative_variants",
  "copy_evaluations",
  "creative_evaluations",
  "rendering_jobs",
  "rendered_assets",
  "publication_jobs",
  "engagement_policies",
  "contacts",
  "conversations",
  "social_interactions",
  "engagement_actions",
  "content_performance",
  "learning_insights",
  "decision_traces",
] as const;

export const LEGACY_TABLES = [
  "brand_profiles",
  "personas",
  "content_pillars",
  "content_calendar_items",
  "content_ideas",
  "post_drafts",
  "media_assets",
  "brand_assets",
  "brand_references",
  "brand_knowledge",
  "generation_runs",
  "zernio_events",
] as const;

export const SOCIAL_OS_PHASES = [
  {
    id: "foundation",
    label: "Fundacao estrategica",
    status: "in_progress",
    route: "/estrategia",
  },
  {
    id: "campaigns",
    label: "Campanhas",
    status: "prepared",
    route: "/campanhas",
  },
  {
    id: "creative",
    label: "Conceitos criativos",
    status: "prepared",
    route: "/conceitos",
  },
  {
    id: "production",
    label: "Producao visual",
    status: "prepared",
    route: "/producao",
  },
  {
    id: "engagement",
    label: "Engajamento",
    status: "prepared",
    route: "/engajamento",
  },
  {
    id: "learning",
    label: "Aprendizado",
    status: "prepared",
    route: "/aprendizado",
  },
] as const;

export const DEFAULT_TIMEZONE = "America/Sao_Paulo";
export const DEFAULT_LOCALE = "pt-BR";
