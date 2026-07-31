export const dynamic = "force-dynamic";

export function GET() {
  const staticGatewayKeyPresent = Boolean(process.env.AI_GATEWAY_API_KEY);
  const vercelRuntimePresent = Boolean(process.env.VERCEL);

  return Response.json({
    status: "ok",
    service: "socialmediaautomator",
    milestone: "marco-2-creative-concepts",
    productFeaturesEnabled: true,
    aiGatewayConfigured: staticGatewayKeyPresent || vercelRuntimePresent,
    aiGatewayAuth: {
      staticApiKeyPresent: staticGatewayKeyPresent,
      vercelRuntimePresent,
    },
    creativeConceptModel:
      process.env.CREATIVE_CONCEPT_MODEL || "anthropic/claude-sonnet-5",
    timestamp: new Date().toISOString(),
  });
}
