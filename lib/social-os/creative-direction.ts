import type {
  AudienceSegment,
  BrandDna,
  Campaign,
  CreativeConcept,
  DecisionTrace,
} from "@/lib/social-os/types";

export type CreativeConceptInput = {
  campaign: Pick<Campaign, "name" | "narrative" | "coreTension" | "objective">;
  brandDna?: Partial<BrandDna>;
  audience?: Partial<AudienceSegment>;
};

export function buildCreativeConceptSeed(
  input: CreativeConceptInput,
): { concept: CreativeConcept; trace: DecisionTrace } {
  const title = input.campaign.coreTension
    ? `O custo invisivel: ${input.campaign.coreTension}`
    : `Tensao central: ${input.campaign.name}`;
  const recommendedFormat =
    input.campaign.objective === "lead_capture" ? "carousel" : "image";

  return {
    concept: {
      title,
      coreIdea:
        input.campaign.narrative ||
        "Transformar a tese da campanha em uma peca com tensao clara e leitura rapida.",
      psychologicalTrigger: "specificity_and_recognition",
      emotion: "urgency_without_hype",
      story:
        "Comecar com uma situacao reconhecivel, nomear o custo ignorado e fechar com uma acao simples.",
      visualMetaphor: "sinal operacional perdido antes de virar venda perdida",
      visualStyle: "editorial_typographic",
      composition:
        "Headline dominante, uma evidencia curta, respiro generoso e CTA discreto.",
      recommendedFormat,
      expectedEngagement: {
        primary_metric: "shares_per_reach",
        secondary_metrics: ["saves_per_reach", "comments_per_reach"],
      },
      brandRules: {
        use_logo: "subtle",
        stock_photo: "only_if_scene_specific",
        avoid: ["generic_people_smiling", "corporate_gradient_background"],
      },
      status: "proposed",
    },
    trace: {
      subjectTable: "creative_concepts",
      engine: "creative_direction_engine",
      decisionKey: "phase_1_seed_concept",
      selectedValue: recommendedFormat,
      alternatives: ["carousel", "image", "reel"],
      context: {
        campaign_name: input.campaign.name,
        objective: input.campaign.objective,
        has_brand_dna: Boolean(input.brandDna),
        audience: input.audience?.name ?? "not_defined",
      },
      ruleIds: [
        "concept_before_asset",
        "format_selected_by_objective",
        "stock_is_supplier_not_default",
      ],
      confidenceScore: 68,
      riskLevel: "low",
      requiresHumanReview: true,
    },
  };
}

export function buildCreativeDirectionPrompt(input: CreativeConceptInput) {
  return [
    "Voce e um diretor criativo. Gere apenas JSON valido para Creative Concept.",
    "Nao escreva legenda final. Nao escolha foto de banco como default.",
    "Saida obrigatoria: title, core_idea, psychological_trigger, emotion, story, visual_metaphor, visual_style, composition, recommended_format, expected_engagement, brand_rules.",
    `Campanha: ${JSON.stringify(input.campaign)}`,
    `Brand DNA: ${JSON.stringify(input.brandDna ?? {})}`,
    `Audiencia: ${JSON.stringify(input.audience ?? {})}`,
  ].join("\n\n");
}
