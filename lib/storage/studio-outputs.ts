export const STUDIO_OUTPUTS_API_PATH = "/api/storage/outputs";
export const STUDIO_ASSET_BUCKET = "studio-assets";

export type StudioOutputKind =
  | "generated_asset"
  | "selected_asset"
  | "final_post_png"
  | "final_post_svg"
  | "carousel_slide_png"
  | "carousel_slide_svg"
  | "carousel_zip"
  | "final_package_zip";

export type StudioOutputRecord = {
  id: string;
  approvedPostId: string;
  projectId: string | null;
  kind: StudioOutputKind;
  label: string;
  fileName: string;
  bucketId: string;
  objectPath: string;
  contentType: string;
  sizeBytes: number;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

export type StudioOutputLink = StudioOutputRecord & {
  signedUrl: string;
  signedUrlExpiresAt: string;
};

export type StudioOutputUploadInput = {
  approvedPostId: string;
  projectId?: string | null;
  kind: StudioOutputKind;
  label: string;
  fileName: string;
  contentType: string;
  dataBase64: string;
  metadata?: Record<string, unknown>;
};

export type StudioOutputUploadResponse =
  | {
      ok: true;
      output: StudioOutputLink;
    }
  | {
      ok: false;
      error: string;
      code?: string;
    };

export type StudioOutputListResponse =
  | {
      ok: true;
      outputs: StudioOutputLink[];
    }
  | {
      ok: false;
      error: string;
      code?: string;
    };

export async function uploadStudioOutput(input: StudioOutputUploadInput) {
  const response = await fetch(STUDIO_OUTPUTS_API_PATH, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });
  const payload: StudioOutputUploadResponse = await response
    .json()
    .catch(() => ({
      ok: false,
      error: "Resposta invalida ao salvar arquivo.",
    }));

  if (!response.ok || !payload.ok) {
    throw new Error(payload.ok ? "Falha ao salvar arquivo." : payload.error);
  }

  return payload.output;
}

export async function fetchStudioOutputs(approvedPostId: string) {
  const url = new URL(STUDIO_OUTPUTS_API_PATH, window.location.origin);
  url.searchParams.set("approvedPostId", approvedPostId);

  const response = await fetch(url, {
    method: "GET",
    cache: "no-store",
  });
  const payload: StudioOutputListResponse = await response.json().catch(() => ({
    ok: false,
    error: "Resposta invalida ao carregar arquivos.",
  }));

  if (!response.ok || !payload.ok) {
    throw new Error(payload.ok ? "Falha ao carregar arquivos." : payload.error);
  }

  return payload.outputs;
}

export function stripSignedOutputFields(
  output: StudioOutputLink | StudioOutputRecord,
): StudioOutputRecord {
  return {
    id: output.id,
    approvedPostId: output.approvedPostId,
    projectId: output.projectId,
    kind: output.kind,
    label: output.label,
    fileName: output.fileName,
    bucketId: output.bucketId,
    objectPath: output.objectPath,
    contentType: output.contentType,
    sizeBytes: output.sizeBytes,
    metadata: output.metadata,
    createdAt: output.createdAt,
    updatedAt: output.updatedAt,
    deletedAt: output.deletedAt,
  };
}

export function normalizeStudioOutputRecord(value: unknown) {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as Record<string, unknown>;
  const kind = candidate.kind;

  if (!isStudioOutputKind(kind)) {
    return null;
  }

  const id = safeString(candidate.id);
  const approvedPostId = safeString(
    candidate.approvedPostId || candidate.approved_post_id,
  );
  const objectPath = safeString(candidate.objectPath || candidate.object_path);

  if (!id || !approvedPostId || !objectPath) {
    return null;
  }

  return {
    id,
    approvedPostId,
    projectId: nullableString(candidate.projectId || candidate.project_id),
    kind,
    label: safeString(candidate.label) || outputKindLabels[kind],
    fileName:
      safeString(candidate.fileName || candidate.file_name) ||
      objectPath.split("/").at(-1) ||
      "arquivo",
    bucketId:
      safeString(candidate.bucketId || candidate.bucket_id) ||
      STUDIO_ASSET_BUCKET,
    objectPath,
    contentType:
      safeString(candidate.contentType || candidate.content_type) ||
      "application/octet-stream",
    sizeBytes: safeNumber(candidate.sizeBytes || candidate.size_bytes),
    metadata:
      candidate.metadata && typeof candidate.metadata === "object"
        ? (candidate.metadata as Record<string, unknown>)
        : {},
    createdAt:
      safeString(candidate.createdAt || candidate.created_at) ||
      new Date().toISOString(),
    updatedAt:
      safeString(candidate.updatedAt || candidate.updated_at) ||
      new Date().toISOString(),
    deletedAt: nullableString(candidate.deletedAt || candidate.deleted_at),
  } satisfies StudioOutputRecord;
}

export function mergeStudioOutputRecords(
  currentOutputs: StudioOutputRecord[],
  nextOutputs: StudioOutputRecord[],
) {
  const outputsByKey = new Map<string, StudioOutputRecord>();

  for (const output of [...currentOutputs, ...nextOutputs]) {
    outputsByKey.set(output.objectPath || output.id, stripSignedOutputFields(output));
  }

  return [...outputsByKey.values()].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

export const outputKindLabels: Record<StudioOutputKind, string> = {
  generated_asset: "Asset gerado",
  selected_asset: "Asset selecionado",
  final_post_png: "PNG final",
  final_post_svg: "SVG final",
  carousel_slide_png: "Slide PNG",
  carousel_slide_svg: "Slide SVG",
  carousel_zip: "ZIP do carrossel",
  final_package_zip: "ZIP final",
};

function isStudioOutputKind(value: unknown): value is StudioOutputKind {
  return (
    value === "generated_asset" ||
    value === "selected_asset" ||
    value === "final_post_png" ||
    value === "final_post_svg" ||
    value === "carousel_slide_png" ||
    value === "carousel_slide_svg" ||
    value === "carousel_zip" ||
    value === "final_package_zip"
  );
}

function safeString(value: unknown) {
  return typeof value === "string" && value.trim() ? value : "";
}

function nullableString(value: unknown) {
  return typeof value === "string" && value.trim() ? value : null;
}

function safeNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}
