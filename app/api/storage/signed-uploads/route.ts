import { z } from "zod";
import {
  completeStudioOutputSignedUpload,
  createStudioOutputSignedUploadTarget,
  isStudioStorageConfigured,
} from "../../../../lib/storage/studio-output-store";
import {
  normalizeStudioOutputRecord,
  type StudioOutputKind,
} from "../../../../lib/storage/studio-outputs";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";
export const maxDuration = 60;

const kindSchema = z.enum([
  "generated_asset",
  "selected_asset",
  "final_post_png",
  "final_post_svg",
  "carousel_slide_png",
  "carousel_slide_svg",
  "carousel_zip",
  "final_package_zip",
]);

const createUploadSchema = z.object({
  action: z.literal("create"),
  approvedPostId: z.string().min(3).max(180),
  projectId: z.string().max(180).nullable().optional(),
  kind: kindSchema,
  label: z.string().min(1).max(180),
  fileName: z.string().min(1).max(180),
  contentType: z.string().min(3).max(120),
  sizeBytes: z.number().int().positive().max(80_000_000),
  metadata: z.record(z.string(), z.unknown()).optional().catch({}),
});

const completeUploadSchema = z.object({
  action: z.literal("complete"),
  upload: z.object({
    id: z.string().min(3).max(180),
    approvedPostId: z.string().min(3).max(180),
    projectId: z.string().max(180).nullable().optional(),
    kind: kindSchema,
    label: z.string().min(1).max(180),
    fileName: z.string().min(1).max(180),
    bucketId: z.string().min(1).max(80),
    objectPath: z.string().min(3).max(500),
    contentType: z.string().min(3).max(120),
    sizeBytes: z.number().int().positive().max(80_000_000),
    metadata: z.record(z.string(), z.unknown()).optional().catch({}),
    createdAt: z.string().optional(),
    updatedAt: z.string().optional(),
    deletedAt: z.string().nullable().optional(),
  }),
});

const signedUploadSchema = z.discriminatedUnion("action", [
  createUploadSchema,
  completeUploadSchema,
]);

export async function POST(request: Request) {
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

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      {
        ok: false,
        error: "Nao foi possivel ler o pedido de upload.",
        code: "INVALID_JSON",
      },
      { status: 400 },
    );
  }

  const parsedUpload = signedUploadSchema.safeParse(body);

  if (!parsedUpload.success) {
    return Response.json(
      {
        ok: false,
        error: "Upload assinado invalido.",
        code: "INVALID_SIGNED_UPLOAD",
      },
      { status: 400 },
    );
  }

  try {
    if (parsedUpload.data.action === "create") {
      const upload = await createStudioOutputSignedUploadTarget({
        approvedPostId: parsedUpload.data.approvedPostId,
        projectId: parsedUpload.data.projectId || null,
        kind: parsedUpload.data.kind as StudioOutputKind,
        label: parsedUpload.data.label,
        fileName: parsedUpload.data.fileName,
        contentType: parsedUpload.data.contentType,
        sizeBytes: parsedUpload.data.sizeBytes,
        metadata: parsedUpload.data.metadata || {},
      });

      return Response.json({
        ok: true,
        upload,
      });
    }

    const upload = normalizeStudioOutputRecord(parsedUpload.data.upload);

    if (!upload) {
      return Response.json(
        {
          ok: false,
          error: "Upload concluido invalido.",
          code: "INVALID_COMPLETED_UPLOAD",
        },
        { status: 400 },
      );
    }

    const output = await completeStudioOutputSignedUpload(upload);

    return Response.json({
      ok: true,
      output,
    });
  } catch (error) {
    return Response.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Nao foi possivel salvar o upload.",
        code: "SIGNED_UPLOAD_FAILED",
      },
      { status: 500 },
    );
  }
}
