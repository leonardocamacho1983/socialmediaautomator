import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import postgres from "postgres";
import {
  normalizeStudioOutputRecord,
  STUDIO_ASSET_BUCKET,
  type StudioOutputKind,
  type StudioOutputLink,
  type StudioOutputRecord,
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

const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24;

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

  const records = rows
    .map(rowToStudioOutputRecord)
    .filter((record): record is StudioOutputRecord => Boolean(record));

  return Promise.all(records.map(withSignedUrl));
}

export async function uploadStudioOutputFile(input: UploadStudioOutputInput) {
  const config = getRequiredSupabaseConfig();
  const sql = getSqlClient();
  await ensureStudioOutputSchema();

  const bucketId = STUDIO_ASSET_BUCKET;
  const outputId = `output-${Date.now()}-${randomUUID().slice(0, 8)}`;
  const fileName = sanitizeFileName(input.fileName);
  const objectPath = [
    sanitizePathSegment(input.approvedPostId),
    input.kind,
    `${Date.now()}-${randomUUID().slice(0, 8)}-${fileName}`,
  ].join("/");
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

function getSupabaseConfig() {
  const url = cleanEnv(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL);
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
