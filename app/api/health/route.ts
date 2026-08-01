import {
  DEFAULT_CREATIVE_CONCEPT_FALLBACK_MODEL,
  DEFAULT_CREATIVE_CONCEPT_MODEL,
} from "../../../lib/creative/concepts";

export const dynamic = "force-dynamic";

export function GET() {
  const staticGatewayKeyPresent = Boolean(process.env.AI_GATEWAY_API_KEY);
  const vercelRuntimePresent = Boolean(process.env.VERCEL);

  return Response.json({
    status: "ok",
    service: "socialmediaautomator",
    milestone: "marco-3-typographic-post",
    productFeaturesEnabled: true,
    aiGatewayConfigured: staticGatewayKeyPresent || vercelRuntimePresent,
    aiGatewayAuth: {
      staticApiKeyPresent: staticGatewayKeyPresent,
      vercelRuntimePresent,
    },
    creativeConceptModel:
      process.env.CREATIVE_CONCEPT_MODEL || DEFAULT_CREATIVE_CONCEPT_MODEL,
    creativeConceptFallbackModel:
      process.env.CREATIVE_CONCEPT_FALLBACK_MODEL ||
      DEFAULT_CREATIVE_CONCEPT_FALLBACK_MODEL,
    timestamp: new Date().toISOString(),
  });
}
