export const dynamic = "force-dynamic";

export function GET() {
  return Response.json({
    status: "ok",
    service: "socialmediaautomator",
    milestone: "marco-1-brand-foundation",
    productFeaturesEnabled: true,
    timestamp: new Date().toISOString(),
  });
}
