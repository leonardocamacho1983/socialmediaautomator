import type { BrandProfile } from "../brand/profile";
import type { CreativeBriefing, CreativeConcept } from "./concepts";
import type { TypographicPiece } from "./typographic-piece";

export const DEFAULT_VISUAL_ASSET_MODEL = "recraft/recraft-v4.1";
export const DEFAULT_VISUAL_ASSET_FALLBACK_MODEL = "openai/gpt-image-1-mini";

export type VisualAssetProvider = "recraft" | "openai" | "google" | "unknown";

export type GeneratedVisualAsset = {
  id: string;
  model: string;
  provider: VisualAssetProvider;
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
    "The image is only the visual layer. Do not include text, letters, numbers, captions, UI labels, logos, notification badges, counters, clocks, price tags, dashboard labels, watermarks, or readable symbols.",
    "This must not look like a literal app screenshot or UI mockup. If messaging apps are referenced, represent them as generic abstract conversation shapes, not as branded interface screens.",
    "Place the main subject in the upper half of the frame. Keep the lower 42% calm and uncluttered so a dark translucent text panel can be placed there.",
    "Leave clean negative space for headline and caption overlay. Avoid busy details behind the future text area.",
    "Use a polished marketing/editorial look, not stock-photo blandness.",
    `Brand: ${input.brandProfile.brandName || "Social Studio"}.`,
    brandColors ? `Use these brand colors as influence: ${brandColors}.` : "",
    `Post objective: ${input.briefing.objective}.`,
    `Concept title: ${input.selectedConcept.title}.`,
    `Concept hook: ${input.selectedConcept.hook}.`,
    `Visual direction: ${direction}.`,
    "Avoid direct trademark logos. If WhatsApp, Instagram, LinkedIn, chat, or messaging are referenced, translate that into generic chat shapes and abstract conversation cues.",
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
    provider: providerFromModel(input.model),
    prompt: input.prompt,
    mediaType: input.mediaType,
    dataUrl: input.dataUrl,
    generatedAt: new Date().toISOString(),
  };
}

function providerFromModel(model: string): VisualAssetProvider {
  if (model.startsWith("recraft/")) {
    return "recraft";
  }

  if (model.startsWith("openai/")) {
    return "openai";
  }

  if (model.startsWith("google/")) {
    return "google";
  }

  return "unknown";
}

function compactLines(values: string[]) {
  return values
    .map((value) => value.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n");
}
