import {
  DEFAULT_CREATIVE_CONCEPT_FALLBACK_MODEL,
  DEFAULT_CREATIVE_CONCEPT_MODEL,
} from "../../../lib/creative/concepts";
import {
  DEFAULT_CAPTION_FALLBACK_MODEL,
  DEFAULT_CAPTION_MODEL,
} from "../../../lib/creative/captions";

export const dynamic = "force-dynamic";

export function GET() {
  const staticGatewayKeyPresent = Boolean(process.env.AI_GATEWAY_API_KEY);
  const vercelRuntimePresent = Boolean(process.env.VERCEL);

  return Response.json({
    status: "ok",
    service: "socialmediaautomator",
    milestone: "marco-5-visual-carousel",
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
    captionModel: process.env.CAPTION_MODEL || DEFAULT_CAPTION_MODEL,
    captionFallbackModel:
      process.env.CAPTION_FALLBACK_MODEL || DEFAULT_CAPTION_FALLBACK_MODEL,
    timestamp: new Date().toISOString(),
  });
}
