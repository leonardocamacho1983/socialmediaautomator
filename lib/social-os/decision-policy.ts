import type { DecisionTrace, FunnelStage, JsonRecord, RiskLevel } from "@/lib/social-os/types";

export type DecisionPolicyInput = {
  objective: FunnelStage;
  audienceMaturity?: string;
  hasBrandAssets?: boolean;
  hasLeadMagnet?: boolean;
  riskLevel?: RiskLevel;
};

export type DecisionPolicyOutput = {
  contentObjective: FunnelStage;
  recommendedFormat: "carousel" | "reel" | "image" | "text";
  copyStyle:
    | "founder_pov"
    | "contrarian_observation"
    | "diagnostic"
    | "case_breakdown"
    | "mechanism_proof"
    | "lead_magnet";
  visualStyle:
    | "editorial_typographic"
    | "stat_card"
    | "proof_sequence"
    | "product_context"
    | "manifesto";
  ctaType: "comment_question" | "keyword_comment" | "profile_visit" | "soft_offer";
  engagementAutomation: "none" | "keyword_to_dm" | "reply_assist";
  approvalRequired: boolean;
  trace: DecisionTrace;
};

const FORMAT_BY_OBJECTIVE: Record<FunnelStage, DecisionPolicyOutput["recommendedFormat"]> = {
  awareness: "carousel",
  consideration: "carousel",
  trust: "carousel",
  conversation: "image",
  lead_capture: "carousel",
  conversion: "carousel",
  retention: "text",
  advocacy: "image",
};

const COPY_STYLE_BY_OBJECTIVE: Record<FunnelStage, DecisionPolicyOutput["copyStyle"]> = {
  awareness: "contrarian_observation",
  consideration: "diagnostic",
  trust: "founder_pov",
  conversation: "founder_pov",
  lead_capture: "lead_magnet",
  conversion: "mechanism_proof",
  retention: "case_breakdown",
  advocacy: "case_breakdown",
};

export function selectDecisionPolicy(input: DecisionPolicyInput): DecisionPolicyOutput {
  const contentObjective = input.objective;
  const recommendedFormat = FORMAT_BY_OBJECTIVE[contentObjective] ?? "carousel";
  const copyStyle = COPY_STYLE_BY_OBJECTIVE[contentObjective] ?? "founder_pov";
  const engagementAutomation =
    input.hasLeadMagnet || contentObjective === "lead_capture"
      ? "keyword_to_dm"
      : contentObjective === "conversation"
        ? "reply_assist"
        : "none";
  const visualStyle = selectVisualStyle(contentObjective, Boolean(input.hasBrandAssets));
  const ctaType =
    engagementAutomation === "keyword_to_dm"
      ? "keyword_comment"
      : contentObjective === "conversion"
        ? "soft_offer"
        : contentObjective === "awareness"
          ? "profile_visit"
          : "comment_question";
  const riskLevel = input.riskLevel ?? "low";
  const approvalRequired = riskLevel !== "low" || contentObjective === "conversion";

  return {
    contentObjective,
    recommendedFormat,
    copyStyle,
    visualStyle,
    ctaType,
    engagementAutomation,
    approvalRequired,
    trace: {
      subjectTable: "content_strategies",
      engine: "decision_policy_engine",
      decisionKey: "phase_1_default_content_policy",
      selectedValue: `${recommendedFormat}:${copyStyle}:${visualStyle}:${ctaType}`,
      alternatives: [
        "carousel:diagnostic:editorial_typographic:comment_question",
        "image:founder_pov:manifesto:profile_visit",
        "carousel:lead_magnet:stat_card:keyword_comment",
      ],
      context: normalizeContext(input),
      ruleIds: [
        "objective_controls_format",
        "lead_capture_controls_keyword_dm",
        "conversion_requires_approval",
      ],
      confidenceScore: 72,
      riskLevel,
      requiresHumanReview: approvalRequired,
    },
  };
}

function selectVisualStyle(
  objective: FunnelStage,
  hasBrandAssets: boolean,
): DecisionPolicyOutput["visualStyle"] {
  if (objective === "lead_capture") return "stat_card";
  if (objective === "conversion") return "proof_sequence";
  if (objective === "trust") return hasBrandAssets ? "product_context" : "manifesto";
  if (objective === "conversation") return "manifesto";

  return "editorial_typographic";
}

function normalizeContext(input: DecisionPolicyInput): JsonRecord {
  return {
    objective: input.objective,
    audience_maturity: input.audienceMaturity ?? "mixed",
    has_brand_assets: Boolean(input.hasBrandAssets),
    has_lead_magnet: Boolean(input.hasLeadMagnet),
    risk_level: input.riskLevel ?? "low",
  };
}
