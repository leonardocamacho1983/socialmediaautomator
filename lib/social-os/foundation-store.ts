import "server-only";

import { DEFAULT_LOCALE, DEFAULT_TIMEZONE, LEGACY_TABLES, SOCIAL_OS_TABLES } from "@/lib/social-os/constants";
import { buildDefaultEngagementPolicy } from "@/lib/social-os/engagement-policy";
import { DEFAULT_WRITING_PROFILE } from "@/lib/social-os/human-writing";
import { selectDecisionPolicy } from "@/lib/social-os/decision-policy";
import type { FunnelStage, SocialOsStatus } from "@/lib/social-os/types";
import { getSupabaseAdminClient, isSupabaseConfigured } from "@/lib/supabase";

export type BootstrapFoundationInput = {
  businessName: string;
  businessSummary: string;
  valueProposition: string;
  targetAudience: string;
  strategicObjective: FunnelStage;
};

export type BootstrapFoundationResult = {
  created: boolean;
  businessProfileId: string;
  message: string;
};

type SupabaseAdmin = ReturnType<typeof getSupabaseAdminClient>;

export async function getSocialOsStatus(): Promise<SocialOsStatus> {
  if (!isSupabaseConfigured()) {
    return {
      configured: false,
      migrationReady: false,
      errors: ["Supabase nao esta configurado."],
      counts: emptyCounts(SOCIAL_OS_TABLES),
      legacyCounts: emptyCounts(LEGACY_TABLES),
      recentDecisionTraces: [],
    };
  }

  const supabase = getSupabaseAdminClient();
  const [countsResult, legacyCountsResult] = await Promise.all([
    countTables(supabase, SOCIAL_OS_TABLES),
    countTables(supabase, LEGACY_TABLES),
  ]);
  const migrationReady = countsResult.errors.length === 0;
  const recentDecisionTraces = migrationReady
    ? await getRecentDecisionTraces(supabase, countsResult.errors)
    : [];

  return {
    configured: true,
    migrationReady,
    errors: [...countsResult.errors, ...legacyCountsResult.errors],
    counts: countsResult.counts,
    legacyCounts: legacyCountsResult.counts,
    recentDecisionTraces,
  };
}

export async function bootstrapSocialOsFoundation(
  input: BootstrapFoundationInput,
): Promise<BootstrapFoundationResult> {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase nao esta configurado.");
  }

  const supabase = getSupabaseAdminClient();
  const decisionPolicy = selectDecisionPolicy({
    objective: input.strategicObjective,
    audienceMaturity: "mixed",
    hasBrandAssets: false,
    hasLeadMagnet: input.strategicObjective === "lead_capture",
  });
  const { data: existing, error: existingError } = await supabase
    .from("business_profiles")
    .select("id,name,business_summary,value_proposition,operating_constraints")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingError) {
    throw new Error(
      `A migration de fase 1 ainda nao parece aplicada: ${existingError.message}`,
    );
  }

  const businessProfile = existing?.id
    ? await updateExistingBusinessProfile(supabase, existing, input)
    : await createBusinessProfile(supabase, input);

  const createdParts: string[] = existing?.id ? [] : ["Business Profile"];
  const trace = await ensureDecisionTrace(
    supabase,
    businessProfile.id,
    decisionPolicy,
    createdParts,
  );
  const brandDna = await ensureBrandDna(
    supabase,
    businessProfile.id,
    trace.id,
    decisionPolicy,
    createdParts,
  );

  await Promise.all([
    ensureWritingProfile(supabase, brandDna.id, createdParts),
    ensureVisualSystem(supabase, brandDna.id, decisionPolicy.visualStyle, createdParts),
  ]);

  const [audience, strategy] = await Promise.all([
    ensureAudienceSegment(supabase, businessProfile.id, input, createdParts),
    ensureContentStrategy(supabase, businessProfile.id, input, decisionPolicy.approvalRequired, createdParts),
  ]);

  const campaign = await ensureCampaign(
    supabase,
    strategy.id,
    audience.id,
    trace.id,
    input,
    decisionPolicy,
    createdParts,
  );

  await ensureEngagementPolicy(
    supabase,
    businessProfile.id,
    campaign.id,
    createdParts,
  );

  return {
    created: createdParts.length > 0,
    businessProfileId: businessProfile.id,
    message: createdParts.length
      ? `Fundacao Social Creative OS completada: ${createdParts.join(", ")}.`
      : `Fundacao ja esta completa para ${businessProfile.name}.`,
  };
}

async function createBusinessProfile(
  supabase: SupabaseAdmin,
  input: BootstrapFoundationInput,
) {
  const { data, error } = await supabase
    .from("business_profiles")
    .insert({
      name: clean(input.businessName) || "Meu negocio",
      business_summary: clean(input.businessSummary),
      value_proposition: clean(input.valueProposition),
      product_scope: "",
      market: "",
      primary_offer: "",
      operating_constraints: buildOperatingConstraints(input),
      default_locale: DEFAULT_LOCALE,
      default_timezone: DEFAULT_TIMEZONE,
      status: "active",
    })
    .select("id,name")
    .single();

  if (error) {
    throw new Error(`Erro ao criar Business Profile: ${error.message}`);
  }

  return data;
}

async function updateExistingBusinessProfile(
  supabase: SupabaseAdmin,
  existing: {
    id: string;
    name: string;
    business_summary?: string | null;
    value_proposition?: string | null;
    operating_constraints?: Record<string, unknown> | null;
  },
  input: BootstrapFoundationInput,
) {
  const currentConstraints = isRecord(existing.operating_constraints)
    ? existing.operating_constraints
    : {};
  const nextName = clean(input.businessName) || existing.name;
  const nextSummary =
    clean(input.businessSummary) || existing.business_summary || "";
  const nextValueProposition =
    clean(input.valueProposition) || existing.value_proposition || "";

  const { data, error } = await supabase
    .from("business_profiles")
    .update({
      name: nextName,
      business_summary: nextSummary,
      value_proposition: nextValueProposition,
      operating_constraints: {
        ...currentConstraints,
        ...buildOperatingConstraints(input),
      },
      updated_at: new Date().toISOString(),
    })
    .eq("id", existing.id)
    .select("id,name")
    .single();

  if (error) {
    throw new Error(`Erro ao atualizar Business Profile: ${error.message}`);
  }

  return data;
}

async function ensureDecisionTrace(
  supabase: SupabaseAdmin,
  businessProfileId: string,
  decisionPolicy: ReturnType<typeof selectDecisionPolicy>,
  createdParts: string[],
) {
  const { data: existing, error: existingError } = await supabase
    .from("decision_traces")
    .select("id")
    .eq("business_profile_id", businessProfileId)
    .eq("engine", decisionPolicy.trace.engine)
    .eq("decision_key", decisionPolicy.trace.decisionKey)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingError) {
    throw new Error(`Erro ao consultar Decision Trace: ${existingError.message}`);
  }

  if (existing?.id) {
    return existing;
  }

  const { data, error } = await supabase
    .from("decision_traces")
    .insert({
      business_profile_id: businessProfileId,
      subject_table: decisionPolicy.trace.subjectTable,
      engine: decisionPolicy.trace.engine,
      decision_key: decisionPolicy.trace.decisionKey,
      selected_value: decisionPolicy.trace.selectedValue,
      alternatives: decisionPolicy.trace.alternatives,
      context: decisionPolicy.trace.context,
      rule_ids: decisionPolicy.trace.ruleIds,
      confidence_score: decisionPolicy.trace.confidenceScore,
      risk_level: decisionPolicy.trace.riskLevel,
      requires_human_review: decisionPolicy.trace.requiresHumanReview,
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(`Erro ao criar Decision Trace: ${error.message}`);
  }

  createdParts.push("Decision Trace");
  return data;
}

async function ensureBrandDna(
  supabase: SupabaseAdmin,
  businessProfileId: string,
  decisionTraceId: string,
  decisionPolicy: ReturnType<typeof selectDecisionPolicy>,
  createdParts: string[],
) {
  const { data: existing, error: existingError } = await supabase
    .from("brand_dna")
    .select("id")
    .eq("business_profile_id", businessProfileId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingError) {
    throw new Error(`Erro ao consultar Brand DNA: ${existingError.message}`);
  }

  if (existing?.id) {
    return existing;
  }

  const { data, error } = await supabase
    .from("brand_dna")
    .insert({
      business_profile_id: businessProfileId,
      decision_trace_id: decisionTraceId,
      personality: {
        authority: "high",
        promotional: "low",
        specificity: "high",
      },
      mission: "",
      enemy: "conteudo generico com cara de IA",
      transformation: "de publicacao solta para narrativa consistente",
      verbal_codes: {
        directness: "high",
        concrete_examples: "required",
      },
      visual_codes: {
        default_style: decisionPolicy.visualStyle,
        logo_usage: "subtle",
      },
      forbidden_patterns: {
        copy: DEFAULT_WRITING_PROFILE.aiPatternBans,
        visual: ["generic_stock_photo", "decorative_gradient_only"],
      },
      confidence_score: 55,
      status: "draft",
      version: 1,
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(`Erro ao criar Brand DNA: ${error.message}`);
  }

  createdParts.push("Brand DNA");
  return data;
}

async function ensureWritingProfile(
  supabase: SupabaseAdmin,
  brandDnaId: string,
  createdParts: string[],
) {
  const { data: existing, error: existingError } = await supabase
    .from("brand_writing_profiles")
    .select("id")
    .eq("brand_dna_id", brandDnaId)
    .limit(1)
    .maybeSingle();

  if (existingError) {
    throw new Error(
      `Erro ao consultar perfil de escrita: ${existingError.message}`,
    );
  }

  if (existing?.id) {
    return existing;
  }

  const { data, error } = await supabase
    .from("brand_writing_profiles")
    .insert({
      brand_dna_id: brandDnaId,
      language: DEFAULT_WRITING_PROFILE.language,
      rhythm: DEFAULT_WRITING_PROFILE.rhythm,
      vocabulary: DEFAULT_WRITING_PROFILE.vocabulary,
      punctuation_policy: DEFAULT_WRITING_PROFILE.punctuationPolicy,
      ai_pattern_bans: DEFAULT_WRITING_PROFILE.aiPatternBans,
      copy_style_defaults: DEFAULT_WRITING_PROFILE.copyStyleDefaults,
      human_imperfections: DEFAULT_WRITING_PROFILE.humanImperfections,
      status: "draft",
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(`Erro ao criar perfil de escrita: ${error.message}`);
  }

  createdParts.push("perfil de escrita");
  return data;
}

async function ensureVisualSystem(
  supabase: SupabaseAdmin,
  brandDnaId: string,
  visualStyle: string,
  createdParts: string[],
) {
  const { data: existing, error: existingError } = await supabase
    .from("brand_visual_systems")
    .select("id")
    .eq("brand_dna_id", brandDnaId)
    .limit(1)
    .maybeSingle();

  if (existingError) {
    throw new Error(
      `Erro ao consultar sistema visual: ${existingError.message}`,
    );
  }

  if (existing?.id) {
    return existing;
  }

  const { data, error } = await supabase
    .from("brand_visual_systems")
    .insert({
      brand_dna_id: brandDnaId,
      colors: {},
      typography: {},
      composition_rules: {
        max_text_blocks: 3,
        dominant_element_required: true,
        safe_area_required: true,
      },
      logo_rules: { default_position: "bottom_left", usage: "subtle" },
      asset_rules: {
        pexels_role: "fallback_supplier",
        open_design_dependency: false,
      },
      visual_grammars: ["editorial_typographic", "stat_card", "proof_sequence"],
      status: "draft",
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(`Erro ao criar sistema visual: ${error.message}`);
  }

  createdParts.push(`sistema visual ${visualStyle}`);
  return data;
}

async function ensureAudienceSegment(
  supabase: SupabaseAdmin,
  businessProfileId: string,
  input: BootstrapFoundationInput,
  createdParts: string[],
) {
  const { data: existing, error: existingError } = await supabase
    .from("audience_segments")
    .select("id")
    .eq("business_profile_id", businessProfileId)
    .order("priority", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (existingError) {
    throw new Error(`Erro ao consultar audiencia: ${existingError.message}`);
  }

  if (existing?.id) {
    return existing;
  }

  const targetAudience = clean(input.targetAudience);
  const { data, error } = await supabase
    .from("audience_segments")
    .insert({
      business_profile_id: businessProfileId,
      name: targetAudience || "Audiencia principal",
      maturity_stage: "mixed",
      description: targetAudience,
      pains: [],
      desired_outcomes: [],
      objections: [],
      language_patterns: {},
      channels: ["instagram"],
      priority: 1,
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(`Erro ao criar audiencia: ${error.message}`);
  }

  createdParts.push("audiencia");
  return data;
}

async function ensureContentStrategy(
  supabase: SupabaseAdmin,
  businessProfileId: string,
  input: BootstrapFoundationInput,
  approvalRequired: boolean,
  createdParts: string[],
) {
  const { data: existing, error: existingError } = await supabase
    .from("content_strategies")
    .select("id")
    .eq("business_profile_id", businessProfileId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingError) {
    throw new Error(`Erro ao consultar estrategia: ${existingError.message}`);
  }

  if (existing?.id) {
    return existing;
  }

  const { data, error } = await supabase
    .from("content_strategies")
    .insert({
      business_profile_id: businessProfileId,
      title: "Estrategia inicial de 30 dias",
      objective: input.strategicObjective,
      narrative_thesis: "Construir narrativa antes de produzir posts.",
      success_metrics: [
        "shares_per_reach",
        "saves_per_reach",
        "comments_per_reach",
      ],
      constraints: {
        approval_required: approvalRequired,
        no_megaprompt: true,
      },
      status: "draft",
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(`Erro ao criar estrategia: ${error.message}`);
  }

  createdParts.push("estrategia");
  return data;
}

async function ensureCampaign(
  supabase: SupabaseAdmin,
  strategyId: string,
  audienceId: string,
  decisionTraceId: string,
  input: BootstrapFoundationInput,
  decisionPolicy: ReturnType<typeof selectDecisionPolicy>,
  createdParts: string[],
) {
  const { data: existing, error: existingError } = await supabase
    .from("campaigns")
    .select("id")
    .eq("content_strategy_id", strategyId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingError) {
    throw new Error(`Erro ao consultar campanha piloto: ${existingError.message}`);
  }

  if (existing?.id) {
    return existing;
  }

  const { data, error } = await supabase
    .from("campaigns")
    .insert({
      content_strategy_id: strategyId,
      audience_segment_id: audienceId,
      decision_trace_id: decisionTraceId,
      name: "Campanha piloto",
      narrative:
        "Primeira campanha usada para validar narrativa, copy humana e direcao visual.",
      core_tension:
        "A empresa precisa parecer dirigida por uma estrategia, nao por um gerador de posts.",
      funnel_stage: input.strategicObjective,
      objective: input.strategicObjective,
      hypotheses: [
        "Conteudo com tensao concreta gera mais salvamentos do que dicas genericas.",
        "CTA contextual gera mais comentarios do que CTA padrao.",
      ],
      decision_policy: {
        format: decisionPolicy.recommendedFormat,
        copy_style: decisionPolicy.copyStyle,
        visual_style: decisionPolicy.visualStyle,
        cta_type: decisionPolicy.ctaType,
        engagement_automation: decisionPolicy.engagementAutomation,
      },
      priority: 1,
      status: "planned",
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(`Erro ao criar campanha piloto: ${error.message}`);
  }

  createdParts.push("campanha piloto");
  return data;
}

async function ensureEngagementPolicy(
  supabase: SupabaseAdmin,
  businessProfileId: string,
  campaignId: string,
  createdParts: string[],
) {
  const { data: existing, error: existingError } = await supabase
    .from("engagement_policies")
    .select("id")
    .eq("business_profile_id", businessProfileId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingError) {
    throw new Error(
      `Erro ao consultar politica de engajamento: ${existingError.message}`,
    );
  }

  if (existing?.id) {
    return existing;
  }

  const defaultEngagementPolicy = buildDefaultEngagementPolicy();
  const { data, error } = await supabase
    .from("engagement_policies")
    .insert({
      ...defaultEngagementPolicy,
      business_profile_id: businessProfileId,
      campaign_id: campaignId,
      name: "Politica inicial de engajamento",
      scope: "account",
      status: "active",
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(
      `Erro ao criar politica de engajamento: ${error.message}`,
    );
  }

  createdParts.push("politica de engajamento");
  return data;
}

async function countTables(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  tables: readonly string[],
) {
  const counts: Record<string, number> = {};
  const errors: string[] = [];

  const results = await Promise.all(
    tables.map(async (table) => {
      const { count, error } = await supabase
        .from(table)
        .select("*", { count: "exact", head: true });

      return { table, count, error };
    }),
  );

  for (const { table, count, error } of results) {
    counts[table] = count ?? 0;

    if (error) {
      errors.push(`${table}: ${error.message}`);
    }
  }

  return { counts, errors };
}

async function getRecentDecisionTraces(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  errors: string[],
) {
  const { data, error } = await supabase
    .from("decision_traces")
    .select("id,engine,decision_key,selected_value,risk_level,requires_human_review,created_at")
    .order("created_at", { ascending: false })
    .limit(8);

  if (error) {
    errors.push(`decision_traces: ${error.message}`);
    return [];
  }

  return data ?? [];
}

function emptyCounts(tables: readonly string[]) {
  return Object.fromEntries(tables.map((table) => [table, 0]));
}

function buildOperatingConstraints(input: BootstrapFoundationInput) {
  const targetAudience = clean(input.targetAudience);
  const constraints: Record<string, string> = {
    strategic_objective: input.strategicObjective,
  };

  if (targetAudience) {
    constraints.target_audience = targetAudience;
  }

  return constraints;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function clean(value: string) {
  return value.trim().slice(0, 2000);
}
