import {
  APICallError,
  generateText,
  gateway,
  NoObjectGeneratedError,
  Output,
  TypeValidationError,
} from "ai";
import { z } from "zod";
import { stripEmbeddedBrandAssets } from "../../../lib/brand/profile";
import {
  DEFAULT_CREATIVE_CONCEPT_MODEL,
  type CreativeConceptBatch,
} from "../../../lib/creative/concepts";
import { buildCreativeConceptPrompt } from "../../../lib/creative/prompts";

export const dynamic = "force-dynamic";

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
        title: z.string().min(3),
        centralIdea: z.string().min(10),
        hook: z.string().min(6),
        recommendedFormat: z.string().min(3),
        estimatedSlides: z.number().int().min(1).max(10),
        narrativeStructure: z.array(z.string().min(3)).min(3).max(7),
        visualDirection: z.object({
          visualFamily: z.string().min(3),
          composition: z.string().min(6),
          typography: z.string().min(6),
          colorUsage: z.string().min(6),
          assetStrategy: z.string().min(6),
        }),
        copyDirection: z.object({
          style: z.string().min(3),
          openingMove: z.string().min(6),
          voiceNotes: z.string().min(6),
        }),
        whyItFitsBrand: z.string().min(10),
        differentiationFromOthers: z.string().min(10),
        riskNotes: z.string().min(3),
      }),
    )
    .length(3),
  decisionTrace: z.object({
    brandSignals: z.array(z.string().min(3)).min(2).max(6),
    briefingSignals: z.array(z.string().min(3)).min(2).max(6),
    differentiationStrategy: z.string().min(12),
  }),
});

const requestSchema = z.object({
  brandProfile: brandProfileSchema,
  briefing: briefingSchema,
});

export async function POST(request: Request) {
  const parsedRequest = requestSchema.safeParse(await request.json());
  if (!parsedRequest.success) {
    return Response.json(
      {
        error: "Briefing ou perfil de marca invalido.",
        details: parsedRequest.error.flatten(),
      },
      { status: 400 },
    );
  }

  const model =
    process.env.CREATIVE_CONCEPT_MODEL || DEFAULT_CREATIVE_CONCEPT_MODEL;
  const generationBrandProfile = stripEmbeddedBrandAssets(
    parsedRequest.data.brandProfile,
  );

  try {
    const result = await generateText({
      model: gateway(model),
      maxOutputTokens: 4200,
      output: Output.object({
        schema: conceptOutputSchema,
      }),
      providerOptions: {
        gateway: {
          tags: ["feature:creative-concepts", "milestone:marco-2"],
        },
      },
      system:
        "Voce e um diretor criativo senior, estrategista de social media e editor. Responda em portugues do Brasil. Seu trabalho aqui e criar direcoes criativas distintas, nao posts finais.",
      prompt: buildCreativeConceptPrompt(
        generationBrandProfile,
        parsedRequest.data.briefing,
      ),
    });

    const batch: CreativeConceptBatch = {
      concepts: result.output.concepts.map((concept, index) => ({
        ...concept,
        id: `concept-${index + 1}`,
      })),
      decisionTrace: result.output.decisionTrace,
      model,
      generatedAt: new Date().toISOString(),
    };

    return Response.json(batch);
  } catch (error) {
    console.error("Creative concept generation failed", {
      name: error instanceof Error ? error.name : "UnknownError",
      statusCode: APICallError.isInstance(error) ? error.statusCode : null,
    });

    if (APICallError.isInstance(error)) {
      return Response.json(
        {
          error: "Falha ao chamar o AI Gateway.",
          statusCode: error.statusCode,
        },
        { status: error.statusCode || 502 },
      );
    }

    if (
      error instanceof Error &&
      error.name === "GatewayAuthenticationError"
    ) {
      return Response.json(
        {
          error:
            "AI Gateway recusou a autenticacao. Verifique AI_GATEWAY_API_KEY no projeto Vercel.",
        },
        { status: 503 },
      );
    }

    if (
      NoObjectGeneratedError.isInstance(error) ||
      TypeValidationError.isInstance(error)
    ) {
      return Response.json(
        {
          error:
            "O modelo respondeu fora do contrato esperado. Tente gerar novamente.",
        },
        { status: 502 },
      );
    }

    return Response.json(
      {
        error: "Nao foi possivel gerar conceitos criativos.",
      },
      { status: 500 },
    );
  }
}
