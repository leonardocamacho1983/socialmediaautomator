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
  DEFAULT_CREATIVE_CONCEPT_FALLBACK_MODEL,
  DEFAULT_CREATIVE_CONCEPT_MODEL,
  type CreativeConceptBatch,
} from "../../../lib/creative/concepts";
import {
  compactBrandProfileForGeneration,
  compactBriefingForGeneration,
} from "../../../lib/creative/context";
import { buildCreativeConceptPrompt } from "../../../lib/creative/prompts";

export const dynamic = "force-dynamic";

const MAX_REQUEST_BODY_CHARS = 240_000;
const textField = z.string().min(1).catch("");
const textList = z.array(z.string().min(1)).catch([]);

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
    const parsedOutput = conceptOutputSchema.safeParse(parsedJson);

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

const conceptOutputSchema = z.object({
  concepts: z
    .array(
      z.object({
        title: textField,
        centralIdea: textField,
        hook: textField,
        recommendedFormat: textField,
        estimatedSlides: z.coerce.number().int().min(1).max(10).catch(1),
        narrativeStructure: z.array(z.string().min(1)).min(1).max(8).catch([]),
        visualDirection: z.object({
          visualFamily: textField,
          composition: textField,
          typography: textField,
          colorUsage: textField,
          assetStrategy: textField,
        }).catch({
          visualFamily: "",
          composition: "",
          typography: "",
          colorUsage: "",
          assetStrategy: "",
        }),
        copyDirection: z.object({
          style: textField,
          openingMove: textField,
          voiceNotes: textField,
        }).catch({
          style: "",
          openingMove: "",
          voiceNotes: "",
        }),
        whyItFitsBrand: textField,
        differentiationFromOthers: textField,
        riskNotes: z.string().catch("Sem risco especifico apontado."),
      }),
    )
    .min(3)
    .max(5),
  decisionTrace: z.object({
    brandSignals: textList,
    briefingSignals: textList,
    differentiationStrategy: textField,
  }).catch({
    brandSignals: [],
    briefingSignals: [],
    differentiationStrategy: "",
  }),
});

const requestSchema = z.object({
  brandProfile: brandProfileSchema,
  briefing: briefingSchema,
});

export async function POST(request: Request) {
  const contentLength = Number(request.headers.get("content-length") || "0");

  if (contentLength > MAX_REQUEST_BODY_CHARS) {
    return Response.json(
      {
        code: "REQUEST_TOO_LARGE",
        error:
          "O perfil enviado esta grande demais para gerar conceitos. Recarregue a pagina e tente novamente.",
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
            "O perfil enviado esta grande demais para gerar conceitos. Recarregue a pagina e tente novamente.",
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
        error: "Briefing ou perfil de marca invalido.",
        details: parsedRequest.error.flatten(),
      },
      { status: 400 },
    );
  }

  const model =
    process.env.CREATIVE_CONCEPT_MODEL || DEFAULT_CREATIVE_CONCEPT_MODEL;
  const fallbackModel =
    process.env.CREATIVE_CONCEPT_FALLBACK_MODEL ||
    DEFAULT_CREATIVE_CONCEPT_FALLBACK_MODEL;
  const models = Array.from(new Set([model, fallbackModel].filter(Boolean)));
  const generationBrandProfile = compactBrandProfileForGeneration(
    stripEmbeddedBrandAssets(parsedRequest.data.brandProfile),
  );
  const generationBriefing = compactBriefingForGeneration(
    parsedRequest.data.briefing,
  );
  const prompt = buildCreativeConceptPrompt(
    generationBrandProfile,
    generationBriefing,
  );

  for (const activeModel of models) {
    try {
      const result = await generateText({
        model: gateway(activeModel),
        maxOutputTokens: 4200,
        providerOptions: {
          gateway: {
            tags: [
              "feature:creative-concepts",
              "milestone:marco-2",
              `model:${activeModel}`,
            ],
          },
        },
        system:
          "Voce e um diretor criativo senior, estrategista de social media e editor. Responda em portugues do Brasil. Responda somente com JSON valido, sem markdown e sem comentario fora do JSON.",
        prompt,
      });

      const parsedOutput = parseModelOutput(result.text);

      if (!parsedOutput.success) {
        console.error("Creative concept JSON parse failed", {
          model: activeModel,
          reason: parsedOutput.error,
          promptChars: prompt.length,
          textChars: result.text.length,
        });
        continue;
      }

      const batch: CreativeConceptBatch = {
        concepts: parsedOutput.data.concepts
          .slice(0, 3)
          .map((concept, index) => ({
            ...concept,
            id: `concept-${index + 1}`,
          })),
        decisionTrace: parsedOutput.data.decisionTrace,
        model: activeModel,
        generatedAt: new Date().toISOString(),
      };

      return Response.json(batch);
    } catch (error) {
      console.error("Creative concept generation failed", {
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
        "Os modelos tentados nao devolveram JSON valido. Tente gerar novamente.",
    },
    { status: 502 },
  );
}
