import postgres from "postgres";
import {
  normalizeStudioProjectRecord,
  type StudioProjectRecord,
} from "./studio-projects";

type StudioProjectRow = {
  id: string;
  title: string;
  brand_name: string;
  source: string;
  status: string;
  visual_status: string | null;
  final_package_status: string | null;
  carousel_status: string | null;
  project_data: unknown;
  approved_post_data: unknown;
  summary: unknown;
  created_at: Date | string | null;
  updated_at: Date | string;
  deleted_at: Date | string | null;
};

const studioProjectSelect = [
  "id",
  "title",
  "brand_name",
  "source",
  "status",
  "visual_status",
  "final_package_status",
  "carousel_status",
  "project_data",
  "approved_post_data",
  "summary",
  "created_at",
  "updated_at",
  "deleted_at",
].join(",");

let sqlClient: ReturnType<typeof postgres> | null = null;
let schemaReadyPromise: Promise<void> | null = null;

export function isStudioPersistenceConfigured() {
  return Boolean(getDatabaseUrl() || getSupabaseRestConfig());
}

export async function listStudioProjects() {
  if (!getDatabaseUrl()) {
    return listStudioProjectsViaRest();
  }

  const sql = getSqlClient();
  await ensureStudioProjectsSchema();

  const rows = await sql<StudioProjectRow[]>`
    select
      id,
      title,
      brand_name,
      source,
      status,
      visual_status,
      final_package_status,
      carousel_status,
      project_data,
      approved_post_data,
      summary,
      created_at,
      updated_at,
      deleted_at
    from public.studio_projects
    where deleted_at is null
    order by updated_at desc
    limit 200
  `;

  return rows
    .map(rowToStudioProjectRecord)
    .filter((record): record is StudioProjectRecord => Boolean(record));
}

export async function getStudioProject(projectId: string) {
  if (!getDatabaseUrl()) {
    return getStudioProjectViaRest(projectId);
  }

  const sql = getSqlClient();
  await ensureStudioProjectsSchema();

  const rows = await sql<StudioProjectRow[]>`
    select
      id,
      title,
      brand_name,
      source,
      status,
      visual_status,
      final_package_status,
      carousel_status,
      project_data,
      approved_post_data,
      summary,
      created_at,
      updated_at,
      deleted_at
    from public.studio_projects
    where id = ${projectId}
      and deleted_at is null
    limit 1
  `;

  return rows[0] ? rowToStudioProjectRecord(rows[0]) : null;
}

export async function upsertStudioProject(record: StudioProjectRecord) {
  if (!getDatabaseUrl()) {
    return upsertStudioProjectViaRest(record);
  }

  const sql = getSqlClient();
  await ensureStudioProjectsSchema();

  const rows = await sql<StudioProjectRow[]>`
    insert into public.studio_projects (
      id,
      title,
      brand_name,
      source,
      status,
      visual_status,
      final_package_status,
      carousel_status,
      project_data,
      approved_post_data,
      summary,
      created_at,
      updated_at,
      deleted_at
    )
    values (
      ${record.id},
      ${record.title},
      ${record.brandName},
      ${record.source},
      ${record.status},
      ${record.visualStatus},
      ${record.finalPackageStatus},
      ${record.carouselStatus},
      ${sql.json(record.projectData)},
      ${record.approvedPostData ? sql.json(record.approvedPostData) : null},
      ${sql.json(record.summary)},
      ${record.createdAt || record.updatedAt},
      ${record.updatedAt},
      null
    )
    on conflict (id) do update set
      title = excluded.title,
      brand_name = excluded.brand_name,
      source = excluded.source,
      status = excluded.status,
      visual_status = excluded.visual_status,
      final_package_status = excluded.final_package_status,
      carousel_status = excluded.carousel_status,
      project_data = excluded.project_data,
      approved_post_data = excluded.approved_post_data,
      summary = excluded.summary,
      updated_at = excluded.updated_at,
      deleted_at = null
    returning
      id,
      title,
      brand_name,
      source,
      status,
      visual_status,
      final_package_status,
      carousel_status,
      project_data,
      approved_post_data,
      summary,
      created_at,
      updated_at,
      deleted_at
  `;

  const nextRecord = rowToStudioProjectRecord(rows[0]);

  if (!nextRecord) {
    throw new Error("Projeto persistido retornou vazio.");
  }

  return nextRecord;
}

export async function deleteStudioProject(projectId: string) {
  if (!getDatabaseUrl()) {
    return deleteStudioProjectViaRest(projectId);
  }

  const sql = getSqlClient();
  await ensureStudioProjectsSchema();

  await sql`
    update public.studio_projects
    set deleted_at = now(),
        updated_at = now()
    where id = ${projectId}
  `;
}

function getSqlClient() {
  const databaseUrl = getDatabaseUrl();

  if (!databaseUrl) {
    throw new Error("Persistencia nao configurada.");
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

function getSupabaseRestConfig() {
  const url = cleanEnv(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL);
  const serviceKey = cleanEnv(
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY,
  );

  if (!url || !serviceKey) {
    return null;
  }

  return {
    restUrl: `${url.replace(/\/+$/, "")}/rest/v1/studio_projects`,
    serviceKey,
  };
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

async function listStudioProjectsViaRest() {
  const config = getRequiredSupabaseRestConfig();
  const url = new URL(config.restUrl);
  url.searchParams.set("select", studioProjectSelect);
  url.searchParams.set("deleted_at", "is.null");
  url.searchParams.set("order", "updated_at.desc");
  url.searchParams.set("limit", "200");

  const rows = await supabaseRestFetch<StudioProjectRow[]>(config, url, {
    method: "GET",
  });

  return rows
    .map(rowToStudioProjectRecord)
    .filter((record): record is StudioProjectRecord => Boolean(record));
}

async function getStudioProjectViaRest(projectId: string) {
  const config = getRequiredSupabaseRestConfig();
  const url = new URL(config.restUrl);
  url.searchParams.set("select", studioProjectSelect);
  url.searchParams.set("id", `eq.${projectId}`);
  url.searchParams.set("deleted_at", "is.null");
  url.searchParams.set("limit", "1");

  const rows = await supabaseRestFetch<StudioProjectRow[]>(config, url, {
    method: "GET",
  });

  return rows[0] ? rowToStudioProjectRecord(rows[0]) : null;
}

async function upsertStudioProjectViaRest(record: StudioProjectRecord) {
  const config = getRequiredSupabaseRestConfig();
  const url = new URL(config.restUrl);
  url.searchParams.set("on_conflict", "id");

  const rows = await supabaseRestFetch<StudioProjectRow[]>(config, url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=representation",
    },
    body: JSON.stringify(toStudioProjectRestPayload(record)),
  });
  const nextRecord = rowToStudioProjectRecord(rows[0]);

  if (!nextRecord) {
    throw new Error("Projeto persistido retornou vazio.");
  }

  return nextRecord;
}

async function deleteStudioProjectViaRest(projectId: string) {
  const config = getRequiredSupabaseRestConfig();
  const url = new URL(config.restUrl);
  url.searchParams.set("id", `eq.${projectId}`);

  await supabaseRestFetch<unknown>(config, url, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({
      deleted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }),
  });
}

function getRequiredSupabaseRestConfig() {
  const config = getSupabaseRestConfig();

  if (!config) {
    throw new Error("Persistencia nao configurada.");
  }

  return config;
}

async function supabaseRestFetch<T>(
  config: NonNullable<ReturnType<typeof getSupabaseRestConfig>>,
  url: URL,
  init: RequestInit,
) {
  const headers = new Headers(init.headers);
  headers.set("apikey", config.serviceKey);
  headers.set("Authorization", `Bearer ${config.serviceKey}`);

  const response = await fetch(url, {
    ...init,
    headers,
    cache: "no-store",
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    const message =
      payload && typeof payload === "object" && "message" in payload
        ? String(payload.message)
        : "Falha na API do Supabase.";

    throw new Error(message);
  }

  if (response.status === 204) {
    return null as T;
  }

  return (await response.json()) as T;
}

function toStudioProjectRestPayload(record: StudioProjectRecord) {
  return {
    id: record.id,
    title: record.title,
    brand_name: record.brandName,
    source: record.source,
    status: record.status,
    visual_status: record.visualStatus,
    final_package_status: record.finalPackageStatus,
    carousel_status: record.carouselStatus,
    project_data: record.projectData,
    approved_post_data: record.approvedPostData,
    summary: record.summary,
    created_at: record.createdAt || record.updatedAt,
    updated_at: record.updatedAt,
    deleted_at: null,
  };
}

function ensureStudioProjectsSchema() {
  if (!schemaReadyPromise) {
    schemaReadyPromise = createStudioProjectsSchema();
  }

  return schemaReadyPromise;
}

async function createStudioProjectsSchema() {
  const sql = getSqlClient();

  await sql`
    create table if not exists public.studio_projects (
      id text primary key,
      title text not null,
      brand_name text not null,
      source text not null check (source in ('creative_project', 'approved_post')),
      status text not null check (
        status in (
          'draft',
          'concept_selected',
          'typographic_ready',
          'caption_ready',
          'approved',
          'package_ready',
          'exported',
          'ready_to_publish'
        )
      ),
      visual_status text,
      final_package_status text,
      carousel_status text,
      project_data jsonb not null,
      approved_post_data jsonb,
      summary jsonb not null default '{}'::jsonb,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      deleted_at timestamptz
    )
  `;

  await sql`alter table public.studio_projects enable row level security`;
  await sql`revoke all on table public.studio_projects from anon`;
  await sql`revoke all on table public.studio_projects from authenticated`;
  await sql`
    grant select, insert, update, delete
    on table public.studio_projects
    to service_role
  `;
  await sql`
    create index if not exists studio_projects_updated_at_idx
      on public.studio_projects (updated_at desc)
      where deleted_at is null
  `;
  await sql`
    create index if not exists studio_projects_brand_name_idx
      on public.studio_projects (brand_name)
      where deleted_at is null
  `;
  await sql`
    create index if not exists studio_projects_status_idx
      on public.studio_projects (status)
      where deleted_at is null
  `;
  await sql`
    create index if not exists studio_projects_summary_gin_idx
      on public.studio_projects using gin (summary)
  `;
}

function rowToStudioProjectRecord(row: StudioProjectRow) {
  return normalizeStudioProjectRecord({
    id: row.id,
    title: row.title,
    brandName: row.brand_name,
    source: row.source,
    status: row.status,
    visualStatus: row.visual_status,
    finalPackageStatus: row.final_package_status,
    carouselStatus: row.carousel_status,
    projectData: row.project_data,
    approvedPostData: row.approved_post_data,
    summary: row.summary,
    createdAt: dateToIso(row.created_at),
    updatedAt: dateToIso(row.updated_at) || new Date().toISOString(),
    deletedAt: dateToIso(row.deleted_at),
  });
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
