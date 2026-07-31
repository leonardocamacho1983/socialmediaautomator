export const dynamic = "force-dynamic";

export function GET() {
  return Response.json({
    status: "ok",
    service: "socialmediaautomator",
    milestone: "marco-0-reset",
    productFeaturesEnabled: false,
    timestamp: new Date().toISOString(),
  });
}
