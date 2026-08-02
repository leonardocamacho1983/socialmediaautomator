import {
  APICallError,
  generateImage,
  gateway,
  NoImageGeneratedError,
} from "ai";
import { z } from "zod";
import { stripEmbeddedBrandAssets } from "../../../lib/brand/profile";
import {
  buildVisualAssetPrompt,
  createGeneratedVisualAsset,
  DEFAULT_VISUAL_ASSET_MODEL,
} from "../../../lib/creative/assets";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_REQUEST_BODY_CHARS = 240_000;
const textField = z.string().min(1).catch("");

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

const requestSchema = z.object({
  brandProfile: brandProfileSchema,
  briefing: briefingSchema,
  selectedConcept: conceptSchema,
  typographicPiece: typographicPieceSchema,
  userPrompt: z.string().max(1600).optional().catch(""),
  count: z.coerce.number().int().min(1).max(2).optional().catch(1),
});

export async function POST(request: Request) {
  const contentLength = Number(request.headers.get("content-length") || "0");

  if (contentLength > MAX_REQUEST_BODY_CHARS) {
    return Response.json(
      {
        code: "REQUEST_TOO_LARGE",
        error:
          "O projeto enviado esta grande demais para gerar asset visual. Recarregue a pagina e tente novamente.",
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
            "O projeto enviado esta grande demais para gerar asset visual. Recarregue a pagina e tente novamente.",
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

  const model = process.env.VISUAL_ASSET_MODEL || DEFAULT_VISUAL_ASSET_MODEL;
  const generationInput = {
    brandProfile: stripEmbeddedBrandAssets(parsedRequest.data.brandProfile),
    briefing: parsedRequest.data.briefing,
    selectedConcept: parsedRequest.data.selectedConcept,
    typographicPiece: parsedRequest.data.typographicPiece,
    userPrompt: compactRouteText(parsedRequest.data.userPrompt || "", 1600),
  };
  const prompt = buildVisualAssetPrompt(generationInput);

  try {
    const result = await generateImage({
      model: gateway.image(model),
      prompt,
      aspectRatio: "4:5",
      n: parsedRequest.data.count,
      maxImagesPerCall: 1,
      providerOptions: {
        gateway: {
          tags: [
            "feature:visual-asset-generation",
            "milestone:marco-4",
            `model:${model}`,
          ],
        },
      },
    });

    return Response.json({
      assets: result.images.map((image, index) =>
        createGeneratedVisualAsset({
          dataUrl: `data:${image.mediaType || "image/png"};base64,${image.base64}`,
          mediaType: image.mediaType || "image/png",
          model,
          prompt,
          index,
        }),
      ),
      model,
      prompt,
      generatedAt: new Date().toISOString(),
      warnings: result.warnings,
    });
  } catch (error) {
    console.error("Visual asset generation failed", {
      model,
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

    if (APICallError.isInstance(error) && error.statusCode === 402) {
      return Response.json(
        {
          code: "AI_GATEWAY_BUDGET_EXCEEDED",
          error:
            "O limite de creditos do AI Gateway foi atingido. Ajuste o budget na Vercel antes de gerar novos assets.",
        },
        { status: 402 },
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

    if (NoImageGeneratedError.isInstance(error)) {
      return Response.json(
        {
          code: "NO_IMAGE_GENERATED",
          error:
            "O modelo nao devolveu uma imagem. Ajuste a direcao visual e tente novamente.",
        },
        { status: 502 },
      );
    }

    return Response.json(
      {
        code: "VISUAL_ASSET_GENERATION_FAILED",
        error:
          "Nao foi possivel gerar o asset visual. Tente uma direcao mais concreta.",
      },
      { status: 502 },
    );
  }
}

function compactRouteText(value: string, maxLength: number) {
  const normalized = value.replace(/\s+/g, " ").trim();

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, Math.max(0, maxLength - 3)).trim()}...`;
}
