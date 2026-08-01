import {
  APICallError,
  generateText,
  gateway,
  NoObjectGeneratedError,
  NoOutputGeneratedError,
  Output,
  TypeValidationError,
} from "ai";
import { z } from "zod";
import { stripEmbeddedBrandAssets } from "../../../lib/brand/profile";
import {
  buildCaptionPackage,
  DEFAULT_CAPTION_FALLBACK_MODEL,
  DEFAULT_CAPTION_MODEL,
  reviewCaptionForInstagram,
  type CaptionGenerationInput,
  type CaptionVariant,
  type CaptionVariantId,
  type InstagramScore,
} from "../../../lib/creative/captions";
import {
  compactBrandProfileForGeneration,
  compactBriefingForGeneration,
} from "../../../lib/creative/context";
import { buildCaptionPrompt } from "../../../lib/creative/prompts";

export const dynamic = "force-dynamic";

const MAX_REQUEST_BODY_CHARS = 240_000;
const textField = z.string().min(1).catch("");
const captionVariantOrder: CaptionVariantId[] = [
  "short-dry",
  "conversation",
  "strategic-context",
];

function extractJsonObject(text: string) {
  const trimmedText = text.trim();
  const fencedJson = trimmedText.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fencedJson?.[1] || trimmedText;
  const firstBrace = candidate.indexOf("{");
  const lastBrace = candidate.lastIndexOf("}");

  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    return null;
  }

  return candidate.slice(firstBrace, lastBrace + 1);
}

function parseModelOutput(text: string) {
  const jsonText = extractJsonObject(text);

  if (!jsonText) {
    return {
      success: false as const,
      error: "NO_JSON_OBJECT",
    };
  }

  try {
    const parsedJson: unknown = JSON.parse(jsonText);
    const parsedOutput = captionOutputSchema.safeParse(
      Array.isArray(parsedJson) ? { variants: parsedJson } : parsedJson,
    );

    if (!parsedOutput.success) {
      return {
        success: false as const,
        error: "SCHEMA_VALIDATION_FAILED",
      };
    }

    return {
      success: true as const,
      data: parsedOutput.data,
    };
  } catch {
    return {
      success: false as const,
      error: "JSON_PARSE_FAILED",
    };
  }
}

const brandProfileSchema = z.object({
  brandName: z.string(),
  businessDescription: z.string(),
  productOrService: z.string(),
  valueProposition: z.string(),
  audience: z.string(),
  toneOfVoice: z.string(),
  preferredWords: z.array(z.string()),
  forbiddenWords: z.array(z.string()),
  primaryColor: z.string(),
  secondaryColor: z.string(),
  backgroundColor: z.string(),
  headingFont: z.string(),
  bodyFont: z.string(),
  logoDataUrl: z.string(),
  logoFileName: z.string(),
  visualReferences: z.array(z.string()),
  goodExamples: z.string(),
  badExamples: z.string(),
  updatedAt: z.string().nullable(),
});

const briefingSchema = z.object({
  topic: z.string().min(3),
  mainMessage: z.string().min(8),
  objective: z.enum([
    "awareness",
    "trust",
    "conversation",
    "lead_capture",
    "conversion",
  ]),
  context: z.string(),
  reference: z.string(),
  relatedLink: z.string(),
  constraints: z.string(),
});

const conceptSchema = z.object({
  id: textField,
  title: textField,
  centralIdea: textField,
  hook: textField,
  recommendedFormat: textField,
  estimatedSlides: z.coerce.number().int().min(1).max(10).catch(1),
  narrativeStructure: z.array(z.string().min(1)).min(1).max(8).catch([]),
  visualDirection: z
    .object({
      visualFamily: textField,
      composition: textField,
      typography: textField,
      colorUsage: textField,
      assetStrategy: textField,
    })
    .catch({
      visualFamily: "",
      composition: "",
      typography: "",
      colorUsage: "",
      assetStrategy: "",
    }),
  copyDirection: z
    .object({
      style: textField,
      openingMove: textField,
      voiceNotes: textField,
    })
    .catch({
      style: "",
      openingMove: "",
      voiceNotes: "",
    }),
  whyItFitsBrand: textField,
  differentiationFromOthers: textField,
  riskNotes: z.string().catch("Sem risco especifico apontado."),
});

const typographicPieceSchema = z.object({
  id: textField,
  conceptId: textField,
  generatedAt: textField,
  dimensions: z.object({
    width: z.literal(1080),
    height: z.literal(1350),
  }),
  copy: z.object({
    headline: textField,
    support: textField,
    cta: z.string().catch(""),
  }),
  variants: z
    .array(
      z.object({
        id: z.enum([
          "editorial-tension",
          "conversation-clean",
          "manifesto-mark",
        ]),
        name: textField,
        layoutFamily: textField,
        rationale: textField,
      }),
    )
    .min(1),
  selectedVariantId: z.enum([
    "editorial-tension",
    "conversation-clean",
    "manifesto-mark",
  ]),
});

const generatedScoreSchema = z
  .string()
  .describe("Use exactly one value: baixo, medio, or alto.");

const generatedCaptionVariantSchema = z.object({
  id: z
    .string()
    .describe("One of: short-dry, conversation, strategic-context."),
  label: z.string().describe("Short user-facing label."),
  strategicRole: z
    .string()
    .describe("The strategic reason for this caption variant."),
  caption: z.string().describe("Instagram caption text."),
  firstComment: z.string().describe("Suggested first comment."),
  hashtags: z.array(z.string()).max(8).describe("Specific hashtags."),
  review: z.object({
    sharePotential: generatedScoreSchema,
    commentPotential: generatedScoreSchema,
    savePotential: generatedScoreSchema,
    openingClarity: generatedScoreSchema,
    brandFit: generatedScoreSchema,
    aiRisk: generatedScoreSchema,
    promiseRisk: generatedScoreSchema,
    rationale: z.string().describe("Short strategic assessment."),
    improvementNotes: z.array(z.string()).max(5),
  }),
});

const captionOutputSchema = z.object({
  variants: z.array(generatedCaptionVariantSchema).min(3).max(5),
});

type GeneratedCaptionOutput = z.infer<typeof captionOutputSchema>;

const requestSchema = z.object({
  brandProfile: brandProfileSchema,
  briefing: briefingSchema,
  selectedConcept: conceptSchema,
  typographicPiece: typographicPieceSchema,
  regenerationInstruction: z.string().max(1200).optional().catch(""),
});

function coerceCaptionVariants(
  output: GeneratedCaptionOutput,
  input: CaptionGenerationInput,
): CaptionVariant[] {
  const usedIds = new Set<CaptionVariantId>();

  return output.variants.slice(0, 3).map((variant, index) => {
    const id = uniqueCaptionVariantId(
      normalizeCaptionVariantId(variant.id, index),
      usedIds,
      index,
    );
    const caption = compactRouteCaption(variant.caption, 2200);
    const fallbackReview = reviewCaptionForInstagram(
      caption,
      input.typographicPiece.copy,
      input.brandProfile,
    );
    const review = variant.review || {
      rationale: "",
      improvementNotes: [],
    };

    return {
      id,
      label: compactRouteText(variant.label || captionLabelForId(id), 80),
      strategicRole: compactRouteText(variant.strategicRole, 280),
      caption,
      firstComment: compactRouteCaption(variant.firstComment || "", 280),
      hashtags: normalizeHashtagList(variant.hashtags),
      review: {
        sharePotential: normalizeScore(
          review.sharePotential,
          fallbackReview.sharePotential,
        ),
        commentPotential: normalizeScore(
          review.commentPotential,
          fallbackReview.commentPotential,
        ),
        savePotential: normalizeScore(
          review.savePotential,
          fallbackReview.savePotential,
        ),
        openingClarity: normalizeScore(
          review.openingClarity,
          fallbackReview.openingClarity,
        ),
        brandFit: normalizeScore(review.brandFit, fallbackReview.brandFit),
        aiRisk: normalizeScore(review.aiRisk, fallbackReview.aiRisk),
        promiseRisk: normalizeScore(
          review.promiseRisk,
          fallbackReview.promiseRisk,
        ),
        rationale:
          compactRouteText(review.rationale || "", 420) ||
          fallbackReview.rationale,
        improvementNotes: normalizeImprovementNotes(
          review.improvementNotes,
          fallbackReview.improvementNotes,
        ),
      },
    };
  });
}

function uniqueCaptionVariantId(
  id: CaptionVariantId,
  usedIds: Set<CaptionVariantId>,
  index: number,
) {
  if (!usedIds.has(id)) {
    usedIds.add(id);
    return id;
  }

  const fallbackId =
    captionVariantOrder.find((candidate) => !usedIds.has(candidate)) ||
    captionVariantOrder[index] ||
    "short-dry";
  usedIds.add(fallbackId);
  return fallbackId;
}

function normalizeCaptionVariantId(value: string, index: number): CaptionVariantId {
  const normalized = normalizeLooseToken(value);

  if (normalized.includes("short") || normalized.includes("curta")) {
    return "short-dry";
  }

  if (
    normalized.includes("conversation") ||
    normalized.includes("conversa") ||
    normalized.includes("comment")
  ) {
    return "conversation";
  }

  if (
    normalized.includes("strategic") ||
    normalized.includes("context") ||
    normalized.includes("estrateg")
  ) {
    return "strategic-context";
  }

  return captionVariantOrder[index] || "short-dry";
}

function captionLabelForId(id: CaptionVariantId) {
  if (id === "conversation") {
    return "Conversa";
  }

  if (id === "strategic-context") {
    return "Contexto estrategico";
  }

  return "Curta e seca";
}

function normalizeScore(value: string | undefined, fallback: InstagramScore) {
  const normalized = normalizeLooseToken(value || "");

  if (!normalized || normalized.includes("|")) {
    return fallback;
  }

  if (
    normalized.includes("alto") ||
    normalized.includes("alta") ||
    normalized.includes("high")
  ) {
    return "alto";
  }

  if (
    normalized.includes("baixo") ||
    normalized.includes("baixa") ||
    normalized.includes("low")
  ) {
    return "baixo";
  }

  if (
    normalized.includes("medio") ||
    normalized.includes("media") ||
    normalized.includes("medium")
  ) {
    return "medio";
  }

  return fallback;
}

function normalizeLooseToken(value: string) {
  return value
    .toLocaleLowerCase("pt-BR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeHashtagList(value: string[]) {
  return value
    .flatMap((item) => item.split(/[\s,]+/))
    .map((item) =>
      item
        .trim()
        .replace(/^#+/, "")
        .replace(/[^\p{L}\p{N}_]/gu, ""),
    )
    .filter(Boolean)
    .slice(0, 8)
    .map((item) => `#${item}`);
}

function normalizeImprovementNotes(value: string[], fallback: string[]) {
  const notes = value.map((note) => compactRouteText(note, 180)).filter(Boolean);

  return notes.length ? notes.slice(0, 5) : fallback.slice(0, 5);
}

function compactRouteText(value: string, maxLength: number) {
  const normalized = value.replace(/\s+/g, " ").trim();

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, Math.max(0, maxLength - 3)).trim()}...`;
}

function compactRouteCaption(value: string, maxLength: number) {
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

export async function POST(request: Request) {
  const contentLength = Number(request.headers.get("content-length") || "0");

  if (contentLength > MAX_REQUEST_BODY_CHARS) {
    return Response.json(
      {
        code: "REQUEST_TOO_LARGE",
        error:
          "O projeto enviado esta grande demais para gerar legenda. Recarregue a pagina e tente novamente.",
      },
      { status: 413 },
    );
  }

  let body: unknown;
  try {
    const rawBody = await request.text();

    if (rawBody.length > MAX_REQUEST_BODY_CHARS) {
      return Response.json(
        {
          code: "REQUEST_TOO_LARGE",
          error:
            "O projeto enviado esta grande demais para gerar legenda. Recarregue a pagina e tente novamente.",
        },
        { status: 413 },
      );
    }

    body = JSON.parse(rawBody);
  } catch {
    return Response.json(
      {
        code: "INVALID_JSON",
        error: "Nao foi possivel ler os dados enviados pelo formulario.",
      },
      { status: 400 },
    );
  }

  const parsedRequest = requestSchema.safeParse(body);
  if (!parsedRequest.success) {
    return Response.json(
      {
        code: "INVALID_REQUEST",
        error: "Projeto, conceito ou peca tipografica invalida.",
        details: parsedRequest.error.flatten(),
      },
      { status: 400 },
    );
  }

  const model = process.env.CAPTION_MODEL || DEFAULT_CAPTION_MODEL;
  const fallbackModel =
    process.env.CAPTION_FALLBACK_MODEL || DEFAULT_CAPTION_FALLBACK_MODEL;
  const models = Array.from(new Set([model, fallbackModel].filter(Boolean)));
  const generationInput = {
    brandProfile: compactBrandProfileForGeneration(
      stripEmbeddedBrandAssets(parsedRequest.data.brandProfile),
    ),
    briefing: compactBriefingForGeneration(parsedRequest.data.briefing),
    selectedConcept: parsedRequest.data.selectedConcept,
    typographicPiece: parsedRequest.data.typographicPiece,
    regenerationInstruction: compactRouteCaption(
      parsedRequest.data.regenerationInstruction || "",
      1200,
    ),
  };
  const prompt = buildCaptionPrompt(generationInput);

  for (const activeModel of models) {
    try {
      const result = await generateText({
        model: gateway(activeModel),
        output: Output.object({
          name: "InstagramCaptionPackage",
          description:
            "Three Instagram caption variants with first comment, hashtags, and review scores.",
          schema: captionOutputSchema,
        }),
        maxOutputTokens: 3600,
        providerOptions: {
          gateway: {
            tags: [
              "feature:caption-generation",
              "milestone:marco-3-1",
              `model:${activeModel}`,
            ],
          },
        },
        system:
          "Voce e um estrategista senior de Instagram e redator de marca. Responda em portugues do Brasil. Responda somente com JSON valido, sem markdown e sem comentario fora do JSON.",
        prompt,
      });

      const variants = coerceCaptionVariants(result.output, generationInput);

      return Response.json(
        buildCaptionPackage(
          generationInput,
          variants,
          activeModel,
        ),
      );
    } catch (error) {
      if (NoObjectGeneratedError.isInstance(error)) {
        const parsedOutput = parseModelOutput(error.text || "");

        if (parsedOutput.success) {
          return Response.json(
            buildCaptionPackage(
              generationInput,
              coerceCaptionVariants(parsedOutput.data, generationInput),
              activeModel,
            ),
          );
        }

        console.error("Caption structured output failed", {
          model: activeModel,
          reason: parsedOutput.error,
          cause:
            error.cause instanceof Error
              ? error.cause.message
              : String(error.cause || ""),
          promptChars: prompt.length,
          textChars: error.text?.length || 0,
        });
        continue;
      }

      console.error("Caption generation failed", {
        model: activeModel,
        name: error instanceof Error ? error.name : "UnknownError",
        statusCode: APICallError.isInstance(error) ? error.statusCode : null,
        promptChars: prompt.length,
      });

      if (APICallError.isInstance(error) && error.statusCode === 401) {
        return Response.json(
          {
            code: "AI_GATEWAY_AUTH_FAILED",
            error:
              "AI Gateway recusou a autenticacao. Verifique AI_GATEWAY_API_KEY no projeto Vercel.",
          },
          { status: 503 },
        );
      }

      if (
        error instanceof Error &&
        error.name === "GatewayAuthenticationError"
      ) {
        return Response.json(
          {
            code: "AI_GATEWAY_AUTH_FAILED",
            error:
              "AI Gateway recusou a autenticacao. Verifique AI_GATEWAY_API_KEY no projeto Vercel.",
          },
          { status: 503 },
        );
      }

      if (
        APICallError.isInstance(error) ||
        NoOutputGeneratedError.isInstance(error) ||
        TypeValidationError.isInstance(error)
      ) {
        continue;
      }
    }
  }

  return Response.json(
    {
      code: "MODEL_OUTPUT_INVALID",
      error:
        "Os modelos tentados nao devolveram JSON valido para legenda. Tente gerar novamente.",
    },
    { status: 502 },
  );
}
