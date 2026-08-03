import {
  isStudioStorageConfigured,
  listStudioOutputPackages,
} from "../../../../lib/storage/studio-output-store";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET() {
  if (!isStudioStorageConfigured()) {
    return Response.json(
      {
        ok: false,
        error: "Storage duravel nao configurado.",
        code: "STORAGE_NOT_CONFIGURED",
      },
      { status: 503 },
    );
  }

  try {
    const packages = await listStudioOutputPackages();

    return Response.json({
      ok: true,
      packages,
    });
  } catch (error) {
    return Response.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Nao foi possivel carregar as entregas.",
        code: "OUTPUT_PACKAGE_LIST_FAILED",
      },
      { status: 500 },
    );
  }
}
