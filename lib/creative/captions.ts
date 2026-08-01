import type { BrandProfile } from "../brand/profile";
import type { CreativeBriefing, CreativeConcept } from "./concepts";
import type { TypographicCopy, TypographicPiece } from "./typographic-piece";

export const DEFAULT_CAPTION_MODEL = "openai/gpt-5.6-luna";
export const DEFAULT_CAPTION_FALLBACK_MODEL = "anthropic/claude-sonnet-5";

export type CaptionVariantId =
  | "short-dry"
  | "conversation"
  | "strategic-context";

export type InstagramScore = "baixo" | "medio" | "alto";

export type InstagramPerformanceReview = {
  sharePotential: InstagramScore;
  commentPotential: InstagramScore;
  savePotential: InstagramScore;
  openingClarity: InstagramScore;
  brandFit: InstagramScore;
  aiRisk: InstagramScore;
  promiseRisk: InstagramScore;
  rationale: string;
  improvementNotes: string[];
};

export type CaptionVariant = {
  id: CaptionVariantId;
  label: string;
  strategicRole: string;
  caption: string;
  firstComment: string;
  hashtags: string[];
  review: InstagramPerformanceReview;
};

export type CaptionPackage = {
  id: string;
  conceptId: string;
  typographicPieceId: string;
  generatedAt: string;
  model: string;
  selectedVariantId: CaptionVariantId;
  variants: CaptionVariant[];
};

export type CaptionGenerationInput = {
  brandProfile: BrandProfile;
  briefing: CreativeBriefing;
  selectedConcept: CreativeConcept;
  typographicPiece: TypographicPiece;
};

export function buildCaptionPackage(
  input: CaptionGenerationInput,
  variants: CaptionVariant[],
  model: string,
): CaptionPackage {
  const safeVariants = normalizeCaptionVariants(variants);

  return {
    id: `caption-${Date.now()}`,
    conceptId: input.selectedConcept.id,
    typographicPieceId: input.typographicPiece.id,
    generatedAt: new Date().toISOString(),
    model,
    selectedVariantId: safeVariants[0]?.id || "short-dry",
    variants: safeVariants,
  };
}

export function getSelectedCaptionVariant(captionPackage: CaptionPackage) {
  return (
    captionPackage.variants.find(
      (variant) => variant.id === captionPackage.selectedVariantId,
    ) || captionPackage.variants[0]
  );
}

export function reviewCaptionForInstagram(
  caption: string,
  typographicCopy: TypographicCopy,
  brandProfile: BrandProfile,
): InstagramPerformanceReview {
  const cleanCaption = compactCaptionText(caption, 5000);
  const opening = cleanCaption.split(/\n+/)[0] || "";
  const lowerCaption = cleanCaption.toLocaleLowerCase("pt-BR");
  const hasQuestion = /\?/.test(cleanCaption);
  const asksForRealReply =
    /\b(comenta|me conta|qual|quando|voce|você|ja aconteceu|já aconteceu)\b/i.test(
      cleanCaption,
    );
  const hasConcreteScene =
    /\b(cliente|pergunt|respost|esper|compr|venda|whatsapp|mensagem|hora)\b/i.test(
      cleanCaption,
    );
  const hasSaveCue =
    /\b(guarde|salve|checklist|passo|diagnostico|diagnóstico|roteiro)\b/i.test(
      lowerCaption,
    );
  const repeatsVisualCopy =
    similarity(cleanCaption, typographicCopy.headline) > 0.42 ||
    similarity(cleanCaption, typographicCopy.support) > 0.42;
  const aiCliches =
    /\b(potencialize|desvende|transforme sua|estrategia eficaz|jornada|solucao inovadora|resultado garantido)\b/i.test(
      cleanCaption,
    );
  const overPromise =
    /\b(garantid|nunca mais|automaticamente vender|100%|dobrar|triplicar)\b/i.test(
      cleanCaption,
    );
  const brandMentioned =
    brandProfile.brandName &&
    lowerCaption.includes(brandProfile.brandName.toLocaleLowerCase("pt-BR"));

  return {
    sharePotential:
      hasConcreteScene && !repeatsVisualCopy
        ? "alto"
        : hasConcreteScene
          ? "medio"
          : "baixo",
    commentPotential:
      hasQuestion && asksForRealReply ? "alto" : hasQuestion ? "medio" : "baixo",
    savePotential: hasSaveCue ? "alto" : cleanCaption.length > 420 ? "medio" : "baixo",
    openingClarity:
      opening.length > 0 && opening.length <= 120 && hasConcreteScene
        ? "alto"
        : opening.length <= 160
          ? "medio"
          : "baixo",
    brandFit:
      brandMentioned || lowerCaption.includes("whatsapp") ? "alto" : "medio",
    aiRisk: aiCliches || cleanCaption.length > 1200 ? "alto" : "baixo",
    promiseRisk: overPromise ? "alto" : "baixo",
    rationale:
      "Revisao baseada em clareza inicial, especificidade, potencial de comentario, potencial de compartilhamento, originalidade e risco de promessa exagerada.",
    improvementNotes: buildImprovementNotes({
      hasQuestion,
      hasConcreteScene,
      repeatsVisualCopy,
      aiCliches,
      overPromise,
      openingLength: opening.length,
    }),
  };
}

export function normalizeCaptionVariants(variants: CaptionVariant[]) {
  const desiredOrder: CaptionVariantId[] = [
    "short-dry",
    "conversation",
    "strategic-context",
  ];
  const fallbackLabels: Record<CaptionVariantId, string> = {
    "short-dry": "Curta e seca",
    conversation: "Conversa",
    "strategic-context": "Contexto estrategico",
  };

  return desiredOrder.map((id, index) => {
    const variant = variants.find((candidate) => candidate.id === id) ||
      variants[index] || {
        id,
        label: fallbackLabels[id],
        strategicRole: "",
        caption: "",
        firstComment: "",
        hashtags: [],
        review: emptyReview(),
      };

    return {
      ...variant,
      id,
      label: variant.label || fallbackLabels[id],
      strategicRole: compactText(variant.strategicRole, 280),
      caption: compactCaptionText(variant.caption, 2200),
      firstComment: compactText(variant.firstComment, 280),
      hashtags: variant.hashtags.slice(0, 8).map(normalizeHashtag).filter(Boolean),
      review: {
        ...emptyReview(),
        ...variant.review,
        improvementNotes: (
          variant.review?.improvementNotes || emptyReview().improvementNotes
        )
          .slice(0, 5)
          .map((note) => compactText(note, 180)),
      },
    };
  });
}

function buildImprovementNotes(input: {
  hasQuestion: boolean;
  hasConcreteScene: boolean;
  repeatsVisualCopy: boolean;
  aiCliches: boolean;
  overPromise: boolean;
  openingLength: number;
}) {
  const notes: string[] = [];

  if (input.openingLength > 140) {
    notes.push("Abrir com uma frase mais curta e concreta.");
  }

  if (!input.hasConcreteScene) {
    notes.push("Adicionar cena concreta antes de explicar a solucao.");
  }

  if (!input.hasQuestion) {
    notes.push("Fechar com pergunta real para comentario, sem engagement bait.");
  }

  if (input.repeatsVisualCopy) {
    notes.push("Evitar repetir literalmente o que a imagem ja diz.");
  }

  if (input.aiCliches) {
    notes.push("Remover formulações genericas ou promocionais.");
  }

  if (input.overPromise) {
    notes.push("Reduzir promessa absoluta ou dificil de sustentar.");
  }

  return notes.length ? notes : ["Sem ajuste critico encontrado."];
}

function emptyReview(): InstagramPerformanceReview {
  return {
    sharePotential: "medio",
    commentPotential: "medio",
    savePotential: "baixo",
    openingClarity: "medio",
    brandFit: "medio",
    aiRisk: "baixo",
    promiseRisk: "baixo",
    rationale: "",
    improvementNotes: [],
  };
}

function compactText(value: string, maxLength: number) {
  const normalized = value.replace(/\s+/g, " ").trim();

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, Math.max(0, maxLength - 3)).trim()}...`;
}

function compactCaptionText(value: string, maxLength: number) {
  const normalized = value
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, Math.max(0, maxLength - 3)).trim()}...`;
}

function normalizeHashtag(value: string) {
  const normalized = value
    .trim()
    .replace(/^#+/, "")
    .replace(/[^\p{L}\p{N}_]/gu, "");

  return normalized ? `#${normalized}` : "";
}

function similarity(text: string, fragment: string) {
  const normalizedText = text.toLocaleLowerCase("pt-BR");
  const normalizedFragment = fragment.toLocaleLowerCase("pt-BR");

  if (!normalizedFragment || normalizedFragment.length < 12) {
    return 0;
  }

  const overlap = normalizedFragment
    .split(/\s+/)
    .filter((word) => word.length > 3 && normalizedText.includes(word)).length;
  const total = normalizedFragment.split(/\s+/).filter((word) => word.length > 3)
    .length;

  return total ? overlap / total : 0;
}
