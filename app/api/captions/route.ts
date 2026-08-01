import {
  APICallError,
  generateText,
  gateway,
  NoObjectGeneratedError,
  TypeValidationError,
} from "ai";
import { z } from "zod";
import { stripEmbeddedBrandAssets } from "../../../lib/brand/profile";
import {
  buildCaptionPackage,
  DEFAULT_CAPTION_FALLBACK_MODEL,
  DEFAULT_CAPTION_MODEL,
} from "../../../lib/creative/captions";
import {
  compactBrandProfileForGeneration,
  compactBriefingForGeneration,
} from "../../../lib/creative/context";
import { buildCaptionPrompt } from "../../../lib/creative/prompts";

export const dynamic = "force-dynamic";

const MAX_REQUEST_BODY_CHARS = 240_000;
const textField = z.string().min(1).catch("");
const textList = z.array(z.string().min(1)).catch([]);
const instagramScoreSchema = z.enum(["baixo", "medio", "alto"]);

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
    const parsedOutput = captionOutputSchema.safeParse(parsedJson);

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

const captionVariantSchema = z.object({
  id: z.enum(["short-dry", "conversation", "strategic-context"]),
  label: textField,
  strategicRole: textField,
  caption: textField,
  firstComment: z.string().catch(""),
  hashtags: textList,
  review: z.object({
    sharePotential: instagramScoreSchema,
    commentPotential: instagramScoreSchema,
    savePotential: instagramScoreSchema,
    openingClarity: instagramScoreSchema,
    brandFit: instagramScoreSchema,
    aiRisk: instagramScoreSchema,
    promiseRisk: instagramScoreSchema,
    rationale: textField,
    improvementNotes: textList,
  }),
});

const captionOutputSchema = z.object({
  variants: z.array(captionVariantSchema).min(3).max(5),
});

const requestSchema = z.object({
  brandProfile: brandProfileSchema,
  briefing: briefingSchema,
  selectedConcept: conceptSchema,
  typographicPiece: typographicPieceSchema,
});

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
  };
  const prompt = buildCaptionPrompt(generationInput);

  for (const activeModel of models) {
    try {
      const result = await generateText({
        model: gateway(activeModel),
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

      const parsedOutput = parseModelOutput(result.text);

      if (!parsedOutput.success) {
        console.error("Caption JSON parse failed", {
          model: activeModel,
          reason: parsedOutput.error,
          promptChars: prompt.length,
          textChars: result.text.length,
        });
        continue;
      }

      return Response.json(
        buildCaptionPackage(
          generationInput,
          parsedOutput.data.variants.slice(0, 3),
          activeModel,
        ),
      );
    } catch (error) {
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
        NoObjectGeneratedError.isInstance(error) ||
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
