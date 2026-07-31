export const dynamic = "force-dynamic";

export function GET() {
  return Response.json({
    status: "ok",
    service: "socialmediaautomator",
    milestone: "marco-2-creative-concepts",
    productFeaturesEnabled: true,
    aiGatewayConfigured: Boolean(process.env.AI_GATEWAY_API_KEY),
    creativeConceptModel:
      process.env.CREATIVE_CONCEPT_MODEL || "anthropic/claude-sonnet-5",
    timestamp: new Date().toISOString(),
  });
}
