import {
  DEFAULT_CREATIVE_CONCEPT_FALLBACK_MODEL,
  DEFAULT_CREATIVE_CONCEPT_MODEL,
} from "../../../lib/creative/concepts";
import {
  DEFAULT_CAPTION_FALLBACK_MODEL,
  DEFAULT_CAPTION_MODEL,
} from "../../../lib/creative/captions";
import { isStudioPersistenceConfigured } from "../../../lib/persistence/studio-project-store";
import { isStudioStorageConfigured } from "../../../lib/storage/studio-output-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function GET() {
  const staticGatewayKeyPresent = Boolean(process.env.AI_GATEWAY_API_KEY);
  const vercelRuntimePresent = Boolean(process.env.VERCEL);
  const persistenceConfigured = isStudioPersistenceConfigured();
  const storageConfigured = isStudioStorageConfigured();

  return Response.json({
    status: "ok",
    service: "socialmediaautomator",
    milestone: "marco-9-delivery-library",
    productFeaturesEnabled: true,
    persistenceConfigured,
    storageConfigured,
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
