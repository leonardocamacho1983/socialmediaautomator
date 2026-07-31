import type { CreativeConcept, LayoutSpec } from "@/lib/social-os/types";

export type VisualGrammar = {
  id: string;
  label: string;
  fit: string[];
  maxTextBlocks: number;
  dominantElement: "headline" | "number" | "image" | "sequence";
  supportsMedia: boolean;
};

export const VISUAL_GRAMMARS: VisualGrammar[] = [
  {
    id: "editorial_typographic",
    label: "Editorial tipografico",
    fit: ["awareness", "conversation", "manifesto", "founder_pov"],
    maxTextBlocks: 3,
    dominantElement: "headline",
    supportsMedia: false,
  },
  {
    id: "stat_card",
    label: "Card de dado",
    fit: ["lead_capture", "diagnostic", "proof"],
    maxTextBlocks: 3,
    dominantElement: "number",
    supportsMedia: false,
  },
  {
    id: "proof_sequence",
    label: "Sequencia de prova",
    fit: ["conversion", "case", "mechanism"],
    maxTextBlocks: 4,
    dominantElement: "sequence",
    supportsMedia: true,
  },
  {
    id: "product_context",
    label: "Produto em contexto",
    fit: ["trust", "demo", "case"],
    maxTextBlocks: 2,
    dominantElement: "image",
    supportsMedia: true,
  },
];

export function selectVisualGrammar(input: {
  objective: string;
  concept?: Pick<CreativeConcept, "visualStyle" | "recommendedFormat">;
  requiresPhotography?: boolean;
}) {
  if (input.requiresPhotography) {
    return VISUAL_GRAMMARS.find((grammar) => grammar.id === "product_context")!;
  }

  const visualStyle = input.concept?.visualStyle;
  const byStyle = visualStyle
    ? VISUAL_GRAMMARS.find((grammar) => grammar.id === visualStyle)
    : undefined;

  if (byStyle) return byStyle;

  return (
    VISUAL_GRAMMARS.find((grammar) => grammar.fit.includes(input.objective)) ??
    VISUAL_GRAMMARS[0]
  );
}

export function buildLayoutSpec(input: {
  grammar: VisualGrammar;
  headline: string;
  supportingCopy?: string;
  cta?: string;
  aspectRatio?: LayoutSpec["aspectRatio"];
}): LayoutSpec {
  const aspectRatio = input.aspectRatio ?? "4:5";
  const dimensions = getDimensions(aspectRatio);

  return {
    grammarId: input.grammar.id,
    aspectRatio,
    ...dimensions,
    safeArea: {
      top: 96,
      right: 72,
      bottom: 96,
      left: 72,
    },
    tokens: {
      max_font_sizes: 3,
      logo_position: "bottom_left",
      whitespace_minimum: 24,
      render_pipeline: "html_svg_sharp",
    },
    blocks: [
      {
        id: "headline",
        role: "headline",
        content: input.headline,
        priority: 1,
        maxLines: 4,
      },
      ...(input.supportingCopy
        ? [
            {
              id: "supporting",
              role: "supporting" as const,
              content: input.supportingCopy,
              priority: 2,
              maxLines: 3,
            },
          ]
        : []),
      ...(input.cta
        ? [
            {
              id: "cta",
              role: "cta" as const,
              content: input.cta,
              priority: 3,
              maxLines: 1,
            },
          ]
        : []),
      {
        id: "logo",
        role: "logo",
        priority: 4,
      },
    ],
  };
}

function getDimensions(aspectRatio: LayoutSpec["aspectRatio"]) {
  if (aspectRatio === "1:1") {
    return { width: 1080, height: 1080 };
  }

  if (aspectRatio === "9:16") {
    return { width: 1080, height: 1920 };
  }

  return { width: 1080, height: 1350 };
}
