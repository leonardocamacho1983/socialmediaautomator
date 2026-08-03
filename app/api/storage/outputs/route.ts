import { z } from "zod";
import {
  isStudioStorageConfigured,
  listStudioOutputs,
  uploadStudioOutputFile,
} from "../../../../lib/storage/studio-output-store";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_UPLOAD_BODY_CHARS = 8_000_000;

const uploadSchema = z.object({
  approvedPostId: z.string().min(3).max(180),
  projectId: z.string().max(180).nullable().optional(),
  kind: z.enum([
    "generated_asset",
    "selected_asset",
    "final_post_png",
    "final_post_svg",
    "carousel_slide_png",
    "carousel_slide_svg",
    "carousel_zip",
    "final_package_zip",
  ]),
  label: z.string().min(1).max(180),
  fileName: z.string().min(1).max(180),
  contentType: z.string().min(3).max(120),
  dataBase64: z.string().min(8),
  metadata: z.record(z.string(), z.unknown()).optional().catch({}),
});

export async function GET(request: Request) {
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

  const url = new URL(request.url);
  const approvedPostId = url.searchParams.get("approvedPostId") || "";

  if (!approvedPostId.trim()) {
    return Response.json(
      {
        ok: false,
        error: "Post aprovado nao informado.",
        code: "APPROVED_POST_ID_REQUIRED",
      },
      { status: 400 },
    );
  }

  try {
    const outputs = await listStudioOutputs(approvedPostId);

    return Response.json({
      ok: true,
      outputs,
    });
  } catch (error) {
    return Response.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Nao foi possivel carregar os arquivos.",
        code: "OUTPUT_LIST_FAILED",
      },
      { status: 500 },
    );
  }
}

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

  const contentLength = Number(request.headers.get("content-length") || "0");

  if (contentLength > MAX_UPLOAD_BODY_CHARS) {
    return Response.json(
      {
        ok: false,
        error:
          "Arquivo grande demais para este upload. Salve os arquivos em partes menores.",
        code: "UPLOAD_TOO_LARGE",
      },
      { status: 413 },
    );
  }

  let body: unknown;
  try {
    const rawBody = await request.text();

    if (rawBody.length > MAX_UPLOAD_BODY_CHARS) {
      return Response.json(
        {
          ok: false,
          error:
            "Arquivo grande demais para este upload. Salve os arquivos em partes menores.",
          code: "UPLOAD_TOO_LARGE",
        },
        { status: 413 },
      );
    }

    body = JSON.parse(rawBody);
  } catch {
    return Response.json(
      {
        ok: false,
        error: "Nao foi possivel ler o arquivo enviado.",
        code: "INVALID_JSON",
      },
      { status: 400 },
    );
  }

  const parsedUpload = uploadSchema.safeParse(body);

  if (!parsedUpload.success) {
    return Response.json(
      {
        ok: false,
        error: "Arquivo ou metadados invalidos.",
        code: "INVALID_UPLOAD",
      },
      { status: 400 },
    );
  }

  try {
    const output = await uploadStudioOutputFile({
      approvedPostId: parsedUpload.data.approvedPostId,
      projectId: parsedUpload.data.projectId || null,
      kind: parsedUpload.data.kind,
      label: parsedUpload.data.label,
      fileName: parsedUpload.data.fileName,
      contentType: parsedUpload.data.contentType,
      body: Buffer.from(parsedUpload.data.dataBase64, "base64"),
      metadata: parsedUpload.data.metadata || {},
    });

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
            : "Nao foi possivel salvar o arquivo.",
        code: "OUTPUT_SAVE_FAILED",
      },
      { status: 500 },
    );
  }
}
