export const dynamic = "force-dynamic";

export function GET() {
  return Response.json({
    status: "ok",
    service: "socialmediaautomator",
    milestone: "marco-2-creative-concepts",
    productFeaturesEnabled: true,
    aiGatewayConfigured: Boolean(
      process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN,
    ),
    aiGatewayApiKeyConfigured: Boolean(process.env.AI_GATEWAY_API_KEY),
    vercelOidcTokenPresent: Boolean(process.env.VERCEL_OIDC_TOKEN),
    creativeConceptModel:
      process.env.CREATIVE_CONCEPT_MODEL || "anthropic/claude-sonnet-5",
    timestamp: new Date().toISOString(),
  });
}
