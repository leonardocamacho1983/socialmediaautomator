import type { BrandProfile } from "../brand/profile";
import type { CreativeBriefing, CreativeConcept } from "./concepts";
import type { TypographicPiece } from "./typographic-piece";

export const DEFAULT_VISUAL_ASSET_MODEL = "recraft/recraft-v4.1";

export type GeneratedVisualAsset = {
  id: string;
  model: string;
  provider: "recraft";
  prompt: string;
  mediaType: string;
  dataUrl: string;
  generatedAt: string;
};

export type VisualAssetGenerationInput = {
  brandProfile: Omit<BrandProfile, "logoDataUrl" | "logoFileName">;
  briefing: CreativeBriefing;
  selectedConcept: CreativeConcept;
  typographicPiece: TypographicPiece;
  userPrompt: string;
};

export function buildDefaultAssetInstruction(
  briefing: CreativeBriefing,
  concept: CreativeConcept,
  typographicPiece: TypographicPiece,
) {
  return compactLines([
    concept.visualDirection.assetStrategy,
    concept.visualDirection.composition,
    concept.visualDirection.visualFamily,
    concept.centralIdea,
    typographicPiece.copy.headline,
    briefing.context,
  ]);
}

export function buildVisualAssetPrompt(input: VisualAssetGenerationInput) {
  const brandColors = [
    input.brandProfile.primaryColor,
    input.brandProfile.secondaryColor,
    input.brandProfile.backgroundColor,
  ]
    .filter(Boolean)
    .join(", ");
  const direction =
    input.userPrompt.trim() ||
    buildDefaultAssetInstruction(
      input.briefing,
      input.selectedConcept,
      input.typographicPiece,
    );

  return compactLines([
    "Create a vertical 4:5 editorial visual asset for an Instagram post.",
    "The image is only the visual layer. Do not include text, letters, numbers, captions, UI labels, logos, or watermarks.",
    "Leave clean negative space for headline and caption overlay. Avoid busy details behind the future text area.",
    "Use a polished marketing/editorial look, not stock-photo blandness.",
    `Brand: ${input.brandProfile.brandName || "Social Studio"}.`,
    brandColors ? `Use these brand colors as influence: ${brandColors}.` : "",
    `Post objective: ${input.briefing.objective}.`,
    `Concept title: ${input.selectedConcept.title}.`,
    `Concept hook: ${input.selectedConcept.hook}.`,
    `Visual direction: ${direction}.`,
    "Avoid direct trademark logos. If messaging apps or chat are referenced, use generic chat shapes and abstract conversation cues.",
  ]);
}

export function createGeneratedVisualAsset(input: {
  dataUrl: string;
  mediaType: string;
  model: string;
  prompt: string;
  index: number;
}): GeneratedVisualAsset {
  return {
    id: `asset-${Date.now()}-${input.index + 1}`,
    model: input.model,
    provider: "recraft",
    prompt: input.prompt,
    mediaType: input.mediaType,
    dataUrl: input.dataUrl,
    generatedAt: new Date().toISOString(),
  };
}

function compactLines(values: string[]) {
  return values
    .map((value) => value.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n");
}
