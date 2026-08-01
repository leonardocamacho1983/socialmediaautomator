import type { BrandProfile } from "../brand/profile";

export const CREATIVE_PROJECT_STORAGE_KEY =
  "socialmediaautomator.creativeProject.v1";

export const DEFAULT_CREATIVE_CONCEPT_MODEL = "openai/gpt-5.4-mini";
export const DEFAULT_CREATIVE_CONCEPT_FALLBACK_MODEL =
  "anthropic/claude-haiku-4.5";

export type CreativeObjective =
  | "awareness"
  | "trust"
  | "conversation"
  | "lead_capture"
  | "conversion";

export type CreativeBriefing = {
  topic: string;
  mainMessage: string;
  objective: CreativeObjective;
  context: string;
  reference: string;
  relatedLink: string;
  constraints: string;
};

export type CreativeConcept = {
  id: string;
  title: string;
  centralIdea: string;
  hook: string;
  recommendedFormat: string;
  estimatedSlides: number;
  narrativeStructure: string[];
  visualDirection: {
    visualFamily: string;
    composition: string;
    typography: string;
    colorUsage: string;
    assetStrategy: string;
  };
  copyDirection: {
    style: string;
    openingMove: string;
    voiceNotes: string;
  };
  whyItFitsBrand: string;
  differentiationFromOthers: string;
  riskNotes: string;
};

export type CreativeConceptBatch = {
  concepts: CreativeConcept[];
  decisionTrace: {
    brandSignals: string[];
    briefingSignals: string[];
    differentiationStrategy: string;
  };
  model: string;
  generatedAt: string;
};

export type CreativeProject = {
  id: string;
  brandSnapshot: BrandProfile;
  briefing: CreativeBriefing;
  batch: CreativeConceptBatch;
  selectedConceptId: string | null;
  updatedAt: string;
};

export const emptyCreativeBriefing: CreativeBriefing = {
  topic: "",
  mainMessage: "",
  objective: "awareness",
  context: "",
  reference: "",
  relatedLink: "",
  constraints: "",
};

export const objectiveLabels: Record<CreativeObjective, string> = {
  awareness: "Alcance",
  trust: "Confianca",
  conversation: "Conversa",
  lead_capture: "Captura de lead",
  conversion: "Conversao",
};

export function isCreativeProject(value: unknown): value is CreativeProject {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.updatedAt === "string" &&
    typeof candidate.brandSnapshot === "object" &&
    typeof candidate.briefing === "object" &&
    typeof candidate.batch === "object"
  );
}
