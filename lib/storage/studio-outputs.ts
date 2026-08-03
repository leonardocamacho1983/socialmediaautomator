import { createClient } from "@supabase/supabase-js";

export const STUDIO_OUTPUTS_API_PATH = "/api/storage/outputs";
export const STUDIO_OUTPUT_PACKAGES_API_PATH = "/api/storage/packages";
export const STUDIO_SIGNED_UPLOADS_API_PATH = "/api/storage/signed-uploads";
export const STUDIO_ASSET_BUCKET = "studio-assets";
export const DIRECT_STUDIO_UPLOAD_MIN_BYTES = 2_500_000;

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

export type StudioOutputPackage = {
  id: string;
  approvedPostId: string;
  projectId: string | null;
  title: string;
  brandName: string;
  status: string | null;
  visualStatus: string | null;
  finalPackageStatus: string | null;
  carouselStatus: string | null;
  caption: string;
  firstComment: string;
  hashtags: string[];
  outputCount: number;
  totalSizeBytes: number;
  savedAt: string;
  updatedAt: string | null;
  hasFinalPng: boolean;
  hasFinalZip: boolean;
  hasCarousel: boolean;
  hasSelectedAsset: boolean;
  outputs: StudioOutputLink[];
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

export type StudioOutputBlobUploadInput = Omit<
  StudioOutputUploadInput,
  "dataBase64"
> & {
  content: Blob;
};

export type StudioOutputSignedUploadTarget = StudioOutputRecord & {
  token: string;
  signedUploadUrl: string;
  supabaseUrl: string;
  supabaseKey: string;
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

export type StudioOutputSignedUploadCreateResponse =
  | {
      ok: true;
      upload: StudioOutputSignedUploadTarget;
    }
  | {
      ok: false;
      error: string;
      code?: string;
    };

export type StudioOutputSignedUploadCompleteResponse =
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

export type StudioOutputPackageListResponse =
  | {
      ok: true;
      packages: StudioOutputPackage[];
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

export async function uploadStudioOutputBlob(
  input: StudioOutputBlobUploadInput,
) {
  const upload = await createStudioOutputSignedUpload(input);
  const supabase = createClient(upload.supabaseUrl, upload.supabaseKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
  const uploadResult = await supabase.storage
    .from(upload.bucketId)
    .uploadToSignedUrl(upload.objectPath, upload.token, input.content, {
      contentType: input.contentType,
    });

  if (uploadResult.error) {
    throw new Error(uploadResult.error.message);
  }

  return completeStudioOutputSignedUpload(upload);
}

async function createStudioOutputSignedUpload(
  input: StudioOutputBlobUploadInput,
) {
  const response = await fetch(STUDIO_SIGNED_UPLOADS_API_PATH, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      action: "create",
      approvedPostId: input.approvedPostId,
      projectId: input.projectId || null,
      kind: input.kind,
      label: input.label,
      fileName: input.fileName,
      contentType: input.contentType,
      sizeBytes: input.content.size,
      metadata: input.metadata || {},
    }),
  });
  const payload: StudioOutputSignedUploadCreateResponse = await response
    .json()
    .catch(() => ({
      ok: false,
      error: "Resposta invalida ao preparar upload.",
    }));

  if (!response.ok || !payload.ok) {
    throw new Error(payload.ok ? "Falha ao preparar upload." : payload.error);
  }

  return payload.upload;
}

async function completeStudioOutputSignedUpload(
  upload: StudioOutputSignedUploadTarget,
) {
  const response = await fetch(STUDIO_SIGNED_UPLOADS_API_PATH, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      action: "complete",
      upload: stripSignedUploadFields(upload),
    }),
  });
  const payload: StudioOutputSignedUploadCompleteResponse = await response
    .json()
    .catch(() => ({
      ok: false,
      error: "Resposta invalida ao concluir upload.",
    }));

  if (!response.ok || !payload.ok) {
    throw new Error(payload.ok ? "Falha ao concluir upload." : payload.error);
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

export async function fetchStudioOutputPackages() {
  const response = await fetch(STUDIO_OUTPUT_PACKAGES_API_PATH, {
    method: "GET",
    cache: "no-store",
  });
  const payload: StudioOutputPackageListResponse = await response
    .json()
    .catch(() => ({
      ok: false,
      error: "Resposta invalida ao carregar entregas.",
    }));

  if (!response.ok || !payload.ok) {
    throw new Error(payload.ok ? "Falha ao carregar entregas." : payload.error);
  }

  return payload.packages;
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

function stripSignedUploadFields(
  upload: StudioOutputSignedUploadTarget,
): StudioOutputRecord {
  return stripSignedOutputFields(upload);
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
  return dedupeStudioOutputs(
    [...currentOutputs, ...nextOutputs].map(stripSignedOutputFields),
  );
}

export function dedupeStudioOutputs<T extends StudioOutputRecord>(outputs: T[]) {
  const outputsByKey = new Map<string, T>();
  const orderedOutputs = [...outputs].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  for (const output of orderedOutputs) {
    const key = getStudioOutputStableKey(output);

    if (!outputsByKey.has(key)) {
      outputsByKey.set(key, output);
    }
  }

  return [...outputsByKey.values()].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

export function getStudioOutputStableKey(
  output: Pick<StudioOutputRecord, "kind" | "fileName" | "metadata">,
) {
  if (
    output.kind === "carousel_slide_png" ||
    output.kind === "carousel_slide_svg"
  ) {
    const slideKey =
      metadataScalar(output.metadata, "slideId") ||
      metadataScalar(output.metadata, "slideIndex");

    if (slideKey) {
      return `${output.kind}:${slideKey}`;
    }
  }

  if (output.kind === "generated_asset") {
    const assetKey = metadataScalar(output.metadata, "assetId");

    if (assetKey) {
      return `${output.kind}:${assetKey}`;
    }
  }

  return output.kind;
}

function metadataScalar(metadata: Record<string, unknown>, key: string) {
  const value = metadata[key];

  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  return "";
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
