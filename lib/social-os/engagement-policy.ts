import type {
  AutomationAutonomy,
  EngagementIntent,
  EngagementPolicyDecision,
  RiskLevel,
} from "@/lib/social-os/types";

const KEYWORD_REQUESTS = ["guia", "checklist", "template", "diagnostico", "material"];
const HIGH_RISK_TERMS = ["processo", "advogado", "golpe", "fraude", "reembolso"];
const COMMERCIAL_TERMS = ["preco", "valor", "contratar", "comprar", "demo", "reuniao"];

export function buildDefaultEngagementPolicy() {
  return {
    autonomy_level: "assisted",
    keyword_rules: [
      {
        keywords: KEYWORD_REQUESTS,
        match_mode: "normalized_contains",
        action: "comment_to_dm",
        public_reply: "Te mandei no privado.",
        requires_human_review: false,
      },
    ],
    intent_rules: [
      { intent: "compliment", action: "public_reply", autonomy_level: "autonomous" },
      { intent: "question", action: "reply_assist", autonomy_level: "assisted" },
      { intent: "purchase_interest", action: "human_review", autonomy_level: "human_review" },
      { intent: "criticism", action: "human_review", autonomy_level: "human_review" },
    ],
    escalation_rules: [
      "legal_or_regulatory_claim",
      "pricing_negotiation",
      "personal_sensitive_information",
      "reputational_risk",
    ],
  };
}

export function classifyEngagement(input: { text: string }): EngagementPolicyDecision {
  const text = removeAccents(input.text.toLowerCase());
  const intent = inferIntent(text);
  const riskLevel = inferRisk(text, intent);
  const commercialSignal = inferCommercialSignal(text, intent);
  const materialDelivery = intent === "keyword_request";
  const privateMessage = materialDelivery || intent === "purchase_interest";
  const publicReply = riskLevel === "low" && intent !== "spam";
  const autonomyLevel: AutomationAutonomy =
    riskLevel === "high" || riskLevel === "blocked" || commercialSignal > 0.7
      ? "human_review"
      : materialDelivery || intent === "compliment"
        ? "autonomous"
        : "assisted";

  return {
    intent,
    sentiment: riskLevel === "high" ? "negative" : intent === "compliment" ? "positive" : "neutral",
    commercialSignal,
    publicReply,
    privateMessage,
    materialDelivery,
    autonomyLevel,
    riskLevel,
    escalationReason:
      autonomyLevel === "human_review" ? "Risco ou sinal comercial exige revisao." : undefined,
  };
}

function inferIntent(text: string): EngagementIntent {
  if (!text.trim()) return "unclear";
  if (KEYWORD_REQUESTS.some((term) => text.includes(term))) return "keyword_request";
  if (COMMERCIAL_TERMS.some((term) => text.includes(term))) return "purchase_interest";
  if (HIGH_RISK_TERMS.some((term) => text.includes(term))) return "criticism";
  if (/[?]/.test(text) || /\b(como|qual|quando|onde|porque|por que)\b/.test(text)) {
    return "question";
  }
  if (/\b(obrigado|boa|bom|excelente|curti|gostei|perfeito)\b/.test(text)) {
    return "compliment";
  }

  return "unclear";
}

function inferRisk(text: string, intent: EngagementIntent): RiskLevel {
  if (HIGH_RISK_TERMS.some((term) => text.includes(term))) return "high";
  if (intent === "criticism" || intent === "purchase_interest") return "medium";
  if (intent === "spam") return "blocked";

  return "low";
}

function inferCommercialSignal(text: string, intent: EngagementIntent) {
  if (intent === "purchase_interest") return 0.86;

  const matches = COMMERCIAL_TERMS.filter((term) => text.includes(term)).length;
  return Math.min(1, matches * 0.24);
}

function removeAccents(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}
