import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import postgres from "postgres";
import {
  dedupeStudioOutputs,
  normalizeStudioOutputRecord,
  STUDIO_ASSET_BUCKET,
  type StudioOutputKind,
  type StudioOutputLink,
  type StudioOutputPackage,
  type StudioOutputRecord,
  type StudioOutputSignedUploadTarget,
} from "./studio-outputs";

type StudioOutputRow = {
  id: string;
  approved_post_id: string;
  project_id: string | null;
  kind: string;
  label: string;
  file_name: string;
  bucket_id: string;
  object_path: string;
  content_type: string;
  size_bytes: number;
  metadata: unknown;
  created_at: Date | string;
  updated_at: Date | string;
  deleted_at: Date | string | null;
};

type UploadStudioOutputInput = {
  approvedPostId: string;
  projectId: string | null;
  kind: StudioOutputKind;
  label: string;
  fileName: string;
  contentType: string;
  body: Buffer;
  metadata: Record<string, unknown>;
};

type CreateStudioOutputSignedUploadInput = Omit<
  UploadStudioOutputInput,
  "body"
> & {
  sizeBytes: number;
};

type StudioOutputPackageRow = StudioOutputRow & {
  project_title: string | null;
  project_brand_name: string | null;
  project_status: string | null;
  project_visual_status: string | null;
  project_final_package_status: string | null;
  project_carousel_status: string | null;
  project_approved_post_data: unknown;
  project_summary: unknown;
  project_updated_at: Date | string | null;
};

const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24;
const STUDIO_OUTPUT_ROW_LIMIT = 1000;
const STUDIO_OUTPUT_PACKAGE_LIMIT = 100;

let sqlClient: ReturnType<typeof postgres> | null = null;
let schemaReadyPromise: Promise<void> | null = null;

export function isStudioStorageConfigured() {
  return Boolean(getSupabaseConfig() && getDatabaseUrl());
}

export async function listStudioOutputs(approvedPostId: string) {
  const sql = getSqlClient();
  await ensureStudioOutputSchema();

  const rows = await sql<StudioOutputRow[]>`
    select
      id,
      approved_post_id,
      project_id,
      kind,
      label,
      file_name,
      bucket_id,
      object_path,
      content_type,
      size_bytes,
      metadata,
      created_at,
      updated_at,
      deleted_at
    from public.studio_asset_outputs
    where approved_post_id = ${approvedPostId}
      and deleted_at is null
    order by created_at desc
    limit 200
  `;

  const records = dedupeStudioOutputs(
    rows
      .map(rowToStudioOutputRecord)
      .filter((record): record is StudioOutputRecord => Boolean(record)),
  );

  return Promise.all(records.map(withSignedUrl));
}

export async function listStudioOutputPackages() {
  const sql = getSqlClient();
  await ensureStudioOutputSchema();

  const rows = await sql<StudioOutputPackageRow[]>`
    select
      output.id,
      output.approved_post_id,
      output.project_id,
      output.kind,
      output.label,
      output.file_name,
      output.bucket_id,
      output.object_path,
      output.content_type,
      output.size_bytes,
      output.metadata,
      output.created_at,
      output.updated_at,
      output.deleted_at,
      project.title as project_title,
      project.brand_name as project_brand_name,
      project.status as project_status,
      project.visual_status as project_visual_status,
      project.final_package_status as project_final_package_status,
      project.carousel_status as project_carousel_status,
      project.approved_post_data as project_approved_post_data,
      project.summary as project_summary,
      project.updated_at as project_updated_at
    from public.studio_asset_outputs as output
    left join public.studio_projects as project
      on project.id = output.approved_post_id
      and project.deleted_at is null
    where output.deleted_at is null
    order by output.created_at desc
    limit ${STUDIO_OUTPUT_ROW_LIMIT}
  `;

  const packageRows = new Map<
    string,
    {
      anchorRow: StudioOutputPackageRow;
      outputs: StudioOutputRecord[];
    }
  >();

  for (const row of rows) {
    const output = rowToStudioOutputRecord(row);

    if (!output) {
      continue;
    }

    const currentPackage = packageRows.get(output.approvedPostId);

    if (currentPackage) {
      currentPackage.outputs.push(output);
    } else {
      packageRows.set(output.approvedPostId, {
        anchorRow: row,
        outputs: [output],
      });
    }
  }

  const packages = await Promise.all(
    [...packageRows.values()].map(async (packageRow) => {
      const dedupedOutputs = dedupeStudioOutputs(packageRow.outputs);
      const signedOutputs = await Promise.all(
        dedupedOutputs.map(withSignedUrl),
      );

      return buildStudioOutputPackage(packageRow.anchorRow, signedOutputs);
    }),
  );

  return packages
    .sort(
      (a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime(),
    )
    .slice(0, STUDIO_OUTPUT_PACKAGE_LIMIT);
}

export async function uploadStudioOutputFile(input: UploadStudioOutputInput) {
  const config = getRequiredSupabaseConfig();
  const sql = getSqlClient();
  await ensureStudioOutputSchema();

  const bucketId = STUDIO_ASSET_BUCKET;
  const outputId = `output-${Date.now()}-${randomUUID().slice(0, 8)}`;
  const fileName = sanitizeFileName(input.fileName);
  const objectPath = buildOutputObjectPath(input.approvedPostId, input.kind, fileName);
  const supabase = createClient(config.url, config.serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const uploadResult = await supabase.storage.from(bucketId).upload(
    objectPath,
    input.body,
    {
      contentType: input.contentType,
      upsert: true,
    },
  );

  if (uploadResult.error) {
    throw new Error(uploadResult.error.message);
  }

  const rows = await sql<StudioOutputRow[]>`
    insert into public.studio_asset_outputs (
      id,
      approved_post_id,
      project_id,
      kind,
      label,
      file_name,
      bucket_id,
      object_path,
      content_type,
      size_bytes,
      metadata,
      created_at,
      updated_at,
      deleted_at
    )
    values (
      ${outputId},
      ${input.approvedPostId},
      ${input.projectId},
      ${input.kind},
      ${input.label},
      ${fileName},
      ${bucketId},
      ${objectPath},
      ${input.contentType},
      ${input.body.byteLength},
      ${sql.json(toSqlJson(input.metadata))},
      now(),
      now(),
      null
    )
    on conflict (object_path) do update set
      label = excluded.label,
      file_name = excluded.file_name,
      content_type = excluded.content_type,
      size_bytes = excluded.size_bytes,
      metadata = excluded.metadata,
      updated_at = now(),
      deleted_at = null
    returning
      id,
      approved_post_id,
      project_id,
      kind,
      label,
      file_name,
      bucket_id,
      object_path,
      content_type,
      size_bytes,
      metadata,
      created_at,
      updated_at,
      deleted_at
  `;

  const record = rowToStudioOutputRecord(rows[0]);

  if (!record) {
    throw new Error("Arquivo salvo retornou vazio.");
  }

  return withSignedUrl(record);
}

export async function createStudioOutputSignedUploadTarget(
  input: CreateStudioOutputSignedUploadInput,
): Promise<StudioOutputSignedUploadTarget> {
  const config = getRequiredSupabaseConfig();
  const publicConfig = getRequiredSupabasePublicConfig();
  await ensureStudioOutputSchema();

  const bucketId = STUDIO_ASSET_BUCKET;
  const outputId = `output-${Date.now()}-${randomUUID().slice(0, 8)}`;
  const fileName = sanitizeFileName(input.fileName);
  const objectPath = buildOutputObjectPath(input.approvedPostId, input.kind, fileName);
  const createdAt = new Date().toISOString();
  const supabase = createClient(config.url, config.serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
  const signedResult = await supabase.storage
    .from(bucketId)
    .createSignedUploadUrl(objectPath, {
      upsert: true,
    });

  if (
    signedResult.error ||
    !signedResult.data?.signedUrl ||
    !signedResult.data?.token
  ) {
    throw new Error(
      signedResult.error?.message ||
        "Nao foi possivel preparar o upload assinado.",
    );
  }

  return {
    id: outputId,
    approvedPostId: input.approvedPostId,
    projectId: input.projectId,
    kind: input.kind,
    label: input.label,
    fileName,
    bucketId,
    objectPath,
    contentType: input.contentType,
    sizeBytes: input.sizeBytes,
    metadata: input.metadata,
    createdAt,
    updatedAt: createdAt,
    deletedAt: null,
    token: signedResult.data.token,
    signedUploadUrl: signedResult.data.signedUrl,
    supabaseUrl: publicConfig.url,
    supabaseKey: publicConfig.key,
  };
}

export async function completeStudioOutputSignedUpload(
  upload: StudioOutputRecord,
) {
  const sql = getSqlClient();
  await ensureStudioOutputSchema();

  const rows = await sql<StudioOutputRow[]>`
    insert into public.studio_asset_outputs (
      id,
      approved_post_id,
      project_id,
      kind,
      label,
      file_name,
      bucket_id,
      object_path,
      content_type,
      size_bytes,
      metadata,
      created_at,
      updated_at,
      deleted_at
    )
    values (
      ${upload.id},
      ${upload.approvedPostId},
      ${upload.projectId},
      ${upload.kind},
      ${upload.label},
      ${sanitizeFileName(upload.fileName)},
      ${upload.bucketId || STUDIO_ASSET_BUCKET},
      ${upload.objectPath},
      ${upload.contentType},
      ${upload.sizeBytes},
      ${sql.json(toSqlJson(upload.metadata))},
      now(),
      now(),
      null
    )
    on conflict (object_path) do update set
      label = excluded.label,
      file_name = excluded.file_name,
      content_type = excluded.content_type,
      size_bytes = excluded.size_bytes,
      metadata = excluded.metadata,
      updated_at = now(),
      deleted_at = null
    returning
      id,
      approved_post_id,
      project_id,
      kind,
      label,
      file_name,
      bucket_id,
      object_path,
      content_type,
      size_bytes,
      metadata,
      created_at,
      updated_at,
      deleted_at
  `;

  const record = rowToStudioOutputRecord(rows[0]);

  if (!record) {
    throw new Error("Upload concluido retornou vazio.");
  }

  return withSignedUrl(record);
}

async function withSignedUrl(
  output: StudioOutputRecord,
): Promise<StudioOutputLink> {
  const config = getRequiredSupabaseConfig();
  const supabase = createClient(config.url, config.serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
  const signedResult = await supabase.storage
    .from(output.bucketId)
    .createSignedUrl(output.objectPath, SIGNED_URL_TTL_SECONDS, {
      download: output.fileName,
    });

  if (signedResult.error || !signedResult.data?.signedUrl) {
    throw new Error(
      signedResult.error?.message || "Nao foi possivel assinar o arquivo.",
    );
  }

  return {
    ...output,
    signedUrl: signedResult.data.signedUrl,
    signedUrlExpiresAt: new Date(
      Date.now() + SIGNED_URL_TTL_SECONDS * 1000,
    ).toISOString(),
  };
}

function getSqlClient() {
  const databaseUrl = getDatabaseUrl();

  if (!databaseUrl) {
    throw new Error("Persistencia de arquivos nao configurada.");
  }

  if (!sqlClient) {
    sqlClient = postgres(databaseUrl, {
      max: 1,
      prepare: false,
      ssl: isLocalDatabaseUrl(databaseUrl) ? false : "require",
    });
  }

  return sqlClient;
}

function getDatabaseUrl() {
  return cleanEnv(
    process.env.POSTGRES_URL ||
      process.env.POSTGRES_URL_NON_POOLING ||
      process.env.POSTGRES_PRISMA_URL,
  );
}

function getRequiredSupabaseConfig() {
  const config = getSupabaseConfig();

  if (!config) {
    throw new Error("Supabase Storage nao configurado.");
  }

  return config;
}

function getRequiredSupabasePublicConfig() {
  const config = getSupabasePublicConfig();

  if (!config) {
    throw new Error("Supabase Storage publico nao configurado.");
  }

  return config;
}

function getSupabaseConfig() {
  const url = cleanEnv(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
  );
  const serviceKey = cleanEnv(
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY,
  );

  if (!url || !serviceKey) {
    return null;
  }

  return {
    url,
    serviceKey,
  };
}

function getSupabasePublicConfig() {
  const url = cleanEnv(
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL,
  );
  const key = cleanEnv(
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      process.env.SUPABASE_PUBLISHABLE_KEY ||
      process.env.SUPABASE_ANON_KEY,
  );

  if (!url || !key) {
    return null;
  }

  return {
    url,
    key,
  };
}

function ensureStudioOutputSchema() {
  if (!schemaReadyPromise) {
    schemaReadyPromise = createStudioOutputSchema();
  }

  return schemaReadyPromise;
}

async function createStudioOutputSchema() {
  const sql = getSqlClient();

  await sql`
    insert into storage.buckets (id, name, public)
    values (${STUDIO_ASSET_BUCKET}, ${STUDIO_ASSET_BUCKET}, false)
    on conflict (id) do update set public = false
  `;
  await sql`
    create table if not exists public.studio_asset_outputs (
      id text primary key,
      approved_post_id text not null,
      project_id text,
      kind text not null check (
        kind in (
          'generated_asset',
          'selected_asset',
          'final_post_png',
          'final_post_svg',
          'carousel_slide_png',
          'carousel_slide_svg',
          'carousel_zip',
          'final_package_zip'
        )
      ),
      label text not null,
      file_name text not null,
      bucket_id text not null default 'studio-assets',
      object_path text not null unique,
      content_type text not null,
      size_bytes integer not null default 0,
      metadata jsonb not null default '{}'::jsonb,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      deleted_at timestamptz
    )
  `;
  await sql`alter table public.studio_asset_outputs enable row level security`;
  await sql`revoke all on table public.studio_asset_outputs from anon`;
  await sql`revoke all on table public.studio_asset_outputs from authenticated`;
  await sql`
    grant select, insert, update, delete
    on table public.studio_asset_outputs
    to service_role
  `;
  await sql`
    create index if not exists studio_asset_outputs_post_idx
      on public.studio_asset_outputs (approved_post_id, created_at desc)
      where deleted_at is null
  `;
  await sql`
    create index if not exists studio_asset_outputs_kind_idx
      on public.studio_asset_outputs (kind)
      where deleted_at is null
  `;
}

function rowToStudioOutputRecord(row: StudioOutputRow | undefined) {
  if (!row) {
    return null;
  }

  return normalizeStudioOutputRecord({
    id: row.id,
    approvedPostId: row.approved_post_id,
    projectId: row.project_id,
    kind: row.kind,
    label: row.label,
    fileName: row.file_name,
    bucketId: row.bucket_id,
    objectPath: row.object_path,
    contentType: row.content_type,
    sizeBytes: row.size_bytes,
    metadata: row.metadata,
    createdAt: dateToIso(row.created_at),
    updatedAt: dateToIso(row.updated_at),
    deletedAt: dateToIso(row.deleted_at),
  });
}

function buildStudioOutputPackage(
  row: StudioOutputPackageRow,
  outputs: StudioOutputLink[],
): StudioOutputPackage {
  const approvedPost = asRecord(row.project_approved_post_data);
  const summary = asRecord(row.project_summary);
  const copy = extractPackageCopy(approvedPost, summary);
  const visualAsset = extractPackageVisualAsset(approvedPost, outputs);
  const outputKinds = new Set(outputs.map((output) => output.kind));
  const firstProjectId =
    outputs.find((output) => output.projectId)?.projectId || row.project_id;
  const metadataTitle = firstNonEmpty(
    outputs.map((output) => safeRecordString(output.metadata, "title")),
  );
  const title =
    safeString(row.project_title) ||
    safeRecordString(approvedPost, "title") ||
    metadataTitle ||
    "Entrega sem titulo";
  const brandName =
    safeString(row.project_brand_name) ||
    safeRecordString(approvedPost, "brandName") ||
    "Marca sem nome";

  return {
    id: row.approved_post_id,
    approvedPostId: row.approved_post_id,
    projectId: firstProjectId,
    title,
    brandName,
    status: safeString(row.project_status) || null,
    visualStatus: safeString(row.project_visual_status) || null,
    finalPackageStatus: safeString(row.project_final_package_status) || null,
    carouselStatus: safeString(row.project_carousel_status) || null,
    caption: copy.caption,
    firstComment: copy.firstComment,
    hashtags: copy.hashtags,
    visualAssetPrompt: visualAsset.prompt,
    visualAssetProvider: visualAsset.provider,
    visualAssetModel: visualAsset.model,
    visualAssetGeneratedAt: visualAsset.generatedAt,
    outputCount: outputs.length,
    totalSizeBytes: outputs.reduce(
      (totalSize, output) => totalSize + output.sizeBytes,
      0,
    ),
    savedAt: latestDate(outputs.map((output) => output.createdAt)),
    updatedAt: dateToIso(row.project_updated_at),
    hasFinalPng: outputKinds.has("final_post_png"),
    hasFinalZip: outputKinds.has("final_package_zip"),
    hasCarousel:
      outputKinds.has("carousel_zip") || outputKinds.has("carousel_slide_png"),
    hasSelectedAsset: outputKinds.has("selected_asset"),
    outputs: outputs.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    ),
  };
}

function extractPackageVisualAsset(
  approvedPost: Record<string, unknown> | null,
  outputs: StudioOutputLink[],
) {
  const selectedAssetId = safeRecordString(approvedPost, "selectedVisualAssetId");
  const generatedAssets = Array.isArray(approvedPost?.generatedAssets)
    ? approvedPost.generatedAssets
        .map((asset) => asRecord(asset))
        .filter((asset): asset is Record<string, unknown> => Boolean(asset))
    : [];
  const selectedAsset =
    generatedAssets.find(
      (asset) => safeRecordString(asset, "id") === selectedAssetId,
    ) ||
    generatedAssets[0] ||
    null;
  const selectedAssetOutput =
    outputs.find((output) => output.kind === "selected_asset") || null;

  return {
    prompt:
      safeRecordString(selectedAsset, "prompt") ||
      safeRecordString(selectedAssetOutput?.metadata || null, "prompt"),
    provider:
      safeRecordString(selectedAsset, "provider") ||
      safeRecordString(selectedAssetOutput?.metadata || null, "provider"),
    model:
      safeRecordString(selectedAsset, "model") ||
      safeRecordString(selectedAssetOutput?.metadata || null, "model"),
    generatedAt:
      safeRecordString(selectedAsset, "generatedAt") ||
      safeRecordString(selectedAssetOutput?.metadata || null, "generatedAt") ||
      null,
  };
}

function extractPackageCopy(
  approvedPost: Record<string, unknown> | null,
  summary: Record<string, unknown> | null,
) {
  const projectSnapshot = asRecord(approvedPost?.projectSnapshot);
  const captionPackage = asRecord(projectSnapshot?.captionPackage);
  const selectedVariantId = safeRecordString(captionPackage, "selectedVariantId");
  const variants = Array.isArray(captionPackage?.variants)
    ? captionPackage.variants
        .map((variant) => asRecord(variant))
        .filter((variant): variant is Record<string, unknown> => Boolean(variant))
    : [];
  const selectedVariant =
    variants.find((variant) => safeRecordString(variant, "id") === selectedVariantId) ||
    variants[0] ||
    null;
  const hashtagsValue = selectedVariant?.hashtags;
  const hashtags = Array.isArray(hashtagsValue)
    ? hashtagsValue
        .map((hashtag) => safeString(hashtag))
        .filter((hashtag) => Boolean(hashtag))
    : [];

  return {
    caption:
      safeRecordString(selectedVariant, "caption") ||
      safeRecordString(summary, "captionPreview"),
    firstComment: safeRecordString(selectedVariant, "firstComment"),
    hashtags,
  };
}

function toSqlJson(value: unknown) {
  return JSON.parse(JSON.stringify(value));
}

function sanitizePathSegment(value: string) {
  return (
    value
      .toLocaleLowerCase("pt-BR")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "post"
  );
}

function buildOutputObjectPath(
  approvedPostId: string,
  kind: StudioOutputKind,
  fileName: string,
) {
  return [
    sanitizePathSegment(approvedPostId),
    kind,
    `${Date.now()}-${randomUUID().slice(0, 8)}-${fileName}`,
  ].join("/");
}

function sanitizeFileName(value: string) {
  const sanitized = value
    .replace(/\\/g, "/")
    .split("/")
    .at(-1)
    ?.normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w.-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);

  return sanitized || "arquivo";
}

function cleanEnv(value: string | undefined) {
  const normalized = (value || "").trim();

  if (!normalized || normalized === "\"\"" || normalized === "''") {
    return "";
  }

  return normalized;
}

function asRecord(value: unknown) {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;
}

function safeRecordString(
  value: Record<string, unknown> | null,
  key: string,
) {
  return safeString(value?.[key]);
}

function safeString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function firstNonEmpty(values: string[]) {
  return values.find((value) => value.trim()) || "";
}

function latestDate(values: string[]) {
  const dates = values
    .map((value) => new Date(value).getTime())
    .filter((value) => Number.isFinite(value));

  if (!dates.length) {
    return new Date().toISOString();
  }

  return new Date(Math.max(...dates)).toISOString();
}

function isLocalDatabaseUrl(databaseUrl: string) {
  return (
    databaseUrl.includes("localhost") ||
    databaseUrl.includes("127.0.0.1") ||
    databaseUrl.includes("host.docker.internal")
  );
}

function dateToIso(value: Date | string | null) {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  return value;
}
