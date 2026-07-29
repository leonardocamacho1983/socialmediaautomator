import "server-only";

import crypto from "node:crypto";
import JSZip from "jszip";
import { generateJsonWithGroq } from "@/lib/groq";
import { searchPexelsAsset, type PexelsAsset } from "@/lib/pexels";
import { getSupabaseAdminClient, isSupabaseConfigured } from "@/lib/supabase";

export type GeneratedDraft = {
  title: string;
  platform: "instagram" | "linkedin" | "both";
  format: string;
  objective: string;
  topic: string;
  viral_hook: string;
  angle: string;
  content: string;
  first_comment?: string;
  hashtags?: string[];
  pexels_query?: string;
  score?: number;
};

export type GeneratedIdea = {
  topic: string;
  hook: string;
  pain: string;
  promise: string;
  platform: "instagram" | "linkedin" | "both";
  format: string;
  viral_hypothesis: string;
  score?: number;
};

export type EditorialStatus = {
  configured: boolean;
  counts: {
    brandProfiles: number;
    personas: number;
    contentPillars: number;
    calendarItems: number;
    postDrafts: number;
    mediaAssets: number;
    brandAssets: number;
    brandReferences: number;
    brandKnowledge: number;
    contentIdeas: number;
    zernioEvents: number;
  };
  recentEvents: Array<{
    id: string;
    event_id: string | null;
    event_type: string;
    zernio_post_id: string | null;
    received_at: string;
  }>;
  recentDrafts: Array<{
    id: string;
    title: string;
    content: string;
    first_comment: string;
    hashtags: string[];
    platform: string;
    status: string;
    scheduled_for: string | null;
    media_asset_id: string | null;
    created_at: string;
    media_asset?: {
      id: string;
      url: string;
      thumbnail_url: string | null;
      media_type: string;
      source: string;
      author: string | null;
    } | null;
  }>;
  recentIdeas: Array<{
    id: string;
    topic: string;
    hook: string;
    pain: string;
    promise: string;
    platform: string;
    format: string;
    viral_hypothesis: string;
    score: number | null;
    status: string;
    created_at: string;
  }>;
  recentBrandAssets: Array<{
    id: string;
    title: string;
    type: string;
    storage_bucket: string;
    storage_path: string;
    content_type: string | null;
    created_at: string;
  }>;
  recentBrandReferences: Array<{
    id: string;
    title: string;
    type: string;
    url: string;
    created_at: string;
  }>;
  latestBrandKnowledge: {
    id: string;
    summary: string;
    visual_identity: Record<string, unknown>;
    asset_inventory: Array<{
      title: string;
      type: string;
      content_type: string | null;
      storage_path: string;
      tags: string[];
    }>;
    reference_inventory: Array<{
      title: string;
      type: string;
      url: string;
      tags: string[];
    }>;
    created_at: string;
  } | null;
};

export type BrandAssetSummary = EditorialStatus["recentBrandAssets"][number];
export type BrandReferenceSummary =
  EditorialStatus["recentBrandReferences"][number];
export type BrandKnowledgeAssetInventory = {
  title: string;
  type: string;
  content_type: string | null;
  storage_path: string;
  tags: string[];
};
export type BrandKnowledgeReferenceInventory = {
  title: string;
  type: string;
  url: string;
  tags: string[];
};
export type BrandAssetUploadResult = {
  id: string;
  extractedCount: number;
  skippedCount: number;
  isZipImport: boolean;
  batchId?: string;
};

const EMPTY_STATUS: EditorialStatus = {
  configured: false,
  counts: {
    brandProfiles: 0,
    personas: 0,
    contentPillars: 0,
    calendarItems: 0,
    postDrafts: 0,
    mediaAssets: 0,
    brandAssets: 0,
    brandReferences: 0,
    brandKnowledge: 0,
    contentIdeas: 0,
    zernioEvents: 0,
  },
  recentEvents: [],
  recentDrafts: [],
  recentIdeas: [],
  recentBrandAssets: [],
  recentBrandReferences: [],
  latestBrandKnowledge: null,
};

const COUNT_TABLES = {
  brandProfiles: "brand_profiles",
  personas: "personas",
  contentPillars: "content_pillars",
  calendarItems: "content_calendar_items",
  postDrafts: "post_drafts",
  mediaAssets: "media_assets",
  brandAssets: "brand_assets",
  brandReferences: "brand_references",
  brandKnowledge: "brand_knowledge",
  contentIdeas: "content_ideas",
  zernioEvents: "zernio_events",
} as const;

export async function getEditorialStatus(): Promise<EditorialStatus> {
  if (!isSupabaseConfigured()) {
    return EMPTY_STATUS;
  }

  const supabase = getSupabaseAdminClient();

  const [
    counts,
    recentEvents,
    recentIdeas,
    recentDrafts,
    recentBrandAssets,
    recentBrandReferences,
    latestBrandKnowledge,
  ] = await Promise.all([
    Promise.all(
      Object.entries(COUNT_TABLES).map(async ([key, table]) => {
        const { count, error } = await supabase
          .from(table)
          .select("*", { count: "exact", head: true });

        if (error) {
          throw new Error(`Erro ao contar ${table}: ${error.message}`);
        }

        return [key, count ?? 0] as const;
      }),
    ),
    supabase
      .from("zernio_events")
      .select("id,event_id,event_type,zernio_post_id,received_at")
      .order("received_at", { ascending: false })
      .limit(5),
    supabase
      .from("content_ideas")
      .select("id,topic,hook,pain,promise,platform,format,viral_hypothesis,score,status,created_at")
      .order("created_at", { ascending: false })
      .limit(12),
    supabase
      .from("post_drafts")
      .select("id,title,content,first_comment,hashtags,platform,status,scheduled_for,media_asset_id,created_at")
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("brand_assets")
      .select("id,title,type,storage_bucket,storage_path,content_type,created_at")
      .order("created_at", { ascending: false })
      .limit(8),
    supabase
      .from("brand_references")
      .select("id,title,type,url,created_at")
      .order("created_at", { ascending: false })
      .limit(8),
    supabase
      .from("brand_knowledge")
      .select("id,summary,visual_identity,asset_inventory,reference_inventory,created_at")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (recentEvents.error) {
    throw new Error(
      `Erro ao listar eventos da Zernio: ${recentEvents.error.message}`,
    );
  }

  if (recentDrafts.error) {
    throw new Error(
      `Erro ao listar drafts editoriais: ${recentDrafts.error.message}`,
    );
  }

  if (recentIdeas.error) {
    throw new Error(
      `Erro ao listar ideias editoriais: ${recentIdeas.error.message}`,
    );
  }

  if (recentBrandAssets.error) {
    throw new Error(
      `Erro ao listar assets da marca: ${recentBrandAssets.error.message}`,
    );
  }

  if (recentBrandReferences.error) {
    throw new Error(
      `Erro ao listar referências da marca: ${recentBrandReferences.error.message}`,
    );
  }

  if (latestBrandKnowledge.error) {
    throw new Error(
      `Erro ao carregar conhecimento da marca: ${latestBrandKnowledge.error.message}`,
    );
  }

  const draftRows = recentDrafts.data ?? [];
  const mediaAssetIds = draftRows
    .map((draft) => draft.media_asset_id)
    .filter((id): id is string => Boolean(id));
  const mediaAssetsById = mediaAssetIds.length
    ? await getMediaAssetsById(mediaAssetIds)
    : new Map();

  return {
    configured: true,
    counts: Object.fromEntries(counts) as EditorialStatus["counts"],
    recentEvents: recentEvents.data ?? [],
    recentIdeas: recentIdeas.data ?? [],
    recentDrafts: draftRows.map((draft) => ({
      ...draft,
      hashtags: Array.isArray(draft.hashtags) ? draft.hashtags : [],
      media_asset: draft.media_asset_id
        ? mediaAssetsById.get(draft.media_asset_id) ?? null
        : null,
    })),
    recentBrandAssets: recentBrandAssets.data ?? [],
    recentBrandReferences: recentBrandReferences.data ?? [],
    latestBrandKnowledge: latestBrandKnowledge.data
      ? {
          ...latestBrandKnowledge.data,
          visual_identity:
            latestBrandKnowledge.data.visual_identity &&
            typeof latestBrandKnowledge.data.visual_identity === "object"
              ? (latestBrandKnowledge.data.visual_identity as Record<string, unknown>)
              : {},
          asset_inventory: Array.isArray(
            latestBrandKnowledge.data.asset_inventory,
          )
            ? (latestBrandKnowledge.data.asset_inventory as BrandKnowledgeAssetInventory[])
            : [],
          reference_inventory: Array.isArray(
            latestBrandKnowledge.data.reference_inventory,
          )
            ? (latestBrandKnowledge.data.reference_inventory as BrandKnowledgeReferenceInventory[])
            : [],
        }
      : null,
  };
}

export async function createBrandReference(input: {
  type: string;
  title: string;
  url: string;
  description: string;
  tags: string[];
  usageNotes: string;
}) {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase não está configurado.");
  }

  let parsedUrl: URL;

  try {
    parsedUrl = new URL(input.url);
  } catch {
    throw new Error("URL inválida.");
  }

  if (!["http:", "https:"].includes(parsedUrl.protocol)) {
    throw new Error("Use um link http ou https.");
  }

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("brand_references")
    .insert({
      type: normalizeBrandReferenceType(input.type),
      title: input.title || parsedUrl.hostname,
      url: parsedUrl.toString(),
      description: input.description,
      tags: input.tags,
      usage_notes: input.usageNotes,
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(`Erro ao salvar referência: ${error.message}`);
  }

  return {
    id: data.id,
    extractedCount: 1,
    skippedCount: 0,
    isZipImport: false,
  };
}

async function getMediaAssetsById(ids: string[]) {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("media_assets")
    .select("id,url,thumbnail_url,media_type,source,author")
    .in("id", [...new Set(ids)]);

  if (error) {
    throw new Error(`Erro ao carregar mídias dos drafts: ${error.message}`);
  }

  return new Map((data ?? []).map((asset) => [asset.id, asset]));
}

export async function deleteBrandAsset(assetId: string) {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase não está configurado.");
  }

  if (!assetId) {
    throw new Error("Asset ausente.");
  }

  const supabase = getSupabaseAdminClient();
  const { data: asset, error: getError } = await supabase
    .from("brand_assets")
    .select("id,storage_bucket,storage_path")
    .eq("id", assetId)
    .single();

  if (getError) {
    throw new Error(`Erro ao localizar asset: ${getError.message}`);
  }

  if (asset?.storage_bucket && asset?.storage_path) {
    const { error: storageError } = await supabase.storage
      .from(asset.storage_bucket)
      .remove([asset.storage_path]);

    if (storageError) {
      throw new Error(`Erro ao remover arquivo: ${storageError.message}`);
    }
  }

  const { error } = await supabase
    .from("brand_assets")
    .delete()
    .eq("id", assetId);

  if (error) {
    throw new Error(`Erro ao deletar asset: ${error.message}`);
  }
}

export async function deleteBrandReference(referenceId: string) {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase não está configurado.");
  }

  if (!referenceId) {
    throw new Error("Referência ausente.");
  }

  const supabase = getSupabaseAdminClient();
  const { error } = await supabase
    .from("brand_references")
    .delete()
    .eq("id", referenceId);

  if (error) {
    throw new Error(`Erro ao deletar referência: ${error.message}`);
  }
}

export async function buildBrandKnowledge() {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase não está configurado.");
  }

  const supabase = getSupabaseAdminClient();
  const [assetsResult, referencesResult] = await Promise.all([
    supabase
      .from("brand_assets")
      .select("id,title,type,storage_bucket,storage_path,content_type,tags,usage_notes,created_at")
      .order("created_at", { ascending: false })
      .limit(200),
    supabase
      .from("brand_references")
      .select("id,title,type,url,tags,usage_notes,created_at")
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  if (assetsResult.error) {
    throw new Error(`Erro ao listar assets: ${assetsResult.error.message}`);
  }

  if (referencesResult.error) {
    throw new Error(
      `Erro ao listar referências: ${referencesResult.error.message}`,
    );
  }

  const assets = assetsResult.data ?? [];
  const references = referencesResult.data ?? [];
  const htmlTexts: string[] = [];
  const svgTexts: string[] = [];

  for (const asset of assets.slice(0, 60)) {
    if (
      asset.content_type !== "text/html" &&
      asset.content_type !== "image/svg+xml"
    ) {
      continue;
    }

    const { data, error } = await supabase.storage
      .from(asset.storage_bucket)
      .download(asset.storage_path);

    if (error || !data) {
      continue;
    }

    const text = await data.text();

    if (asset.content_type === "text/html") {
      htmlTexts.push(stripHtml(text).slice(0, 8000));
    } else {
      svgTexts.push(text.slice(0, 4000));
    }
  }

  const assetInventory = assets.map((asset) => ({
    id: asset.id,
    title: asset.title,
    type: classifyAssetFromName(asset.title, asset.type),
    content_type: asset.content_type,
    storage_path: asset.storage_path,
    tags: asset.tags ?? [],
    usage_notes: asset.usage_notes,
  }));
  const referenceInventory = references.map((reference) => ({
    id: reference.id,
    title: reference.title,
    type: reference.type,
    url: reference.url,
    tags: reference.tags ?? [],
    usage_notes: reference.usage_notes,
  }));
  const visualIdentity = {
    asset_counts: countBy(assetInventory, "type"),
    content_types: countBy(assetInventory, "content_type"),
    names: assetInventory.map((asset) => asset.title),
    likely_colors: extractLikelyColors([...htmlTexts, ...svgTexts].join("\n")),
    html_excerpt: htmlTexts.join("\n\n").slice(0, 12000),
  };
  const summary = buildBrandKnowledgeSummary({
    assetInventory,
    referenceInventory,
    visualIdentity,
  });

  const { data, error } = await supabase
    .from("brand_knowledge")
    .insert({
      source: "brand_assets",
      summary,
      visual_identity: visualIdentity,
      asset_inventory: assetInventory,
      reference_inventory: referenceInventory,
      generated_by: "system",
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(`Erro ao salvar conhecimento da marca: ${error.message}`);
  }

  await normalizeExistingBrandAssetTypes(assetInventory);

  return {
    id: data.id,
    assets: assetInventory.length,
    references: referenceInventory.length,
    colors: visualIdentity.likely_colors.length,
  };
}

export async function generateContentIdeas(input: {
  businessName: string;
  businessIdea: string;
  valueProposition: string;
  targetAudience: string;
  toneOfVoice: string;
  ideasCount: number;
}) {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase não está configurado.");
  }

  const supabase = getSupabaseAdminClient();
  const latestKnowledge = await getLatestBrandKnowledgeRecord();
  const brandKnowledge = await getLatestBrandKnowledgePromptContext();
  const fallback = buildFallbackIdeas(input);
  const startedAt = Date.now();
  const generated = await generateJsonWithGroq<{ ideas: GeneratedIdea[] }>({
    system:
      "Você é um diretor criativo para Instagram. Gere somente JSON válido. Foque em ideias fortes antes de escrever posts completos.",
    prompt: buildIdeasPrompt(input, brandKnowledge),
    fallback,
  });
  const ideas = normalizeGeneratedIdeas(generated.data.ideas, input.ideasCount);

  const { error: runError } = await supabase.from("generation_runs").insert({
    provider: generated.provider,
    model: generated.model,
    task: "generate_content_ideas",
    input,
    output: { ideas },
    status: "completed",
    duration_ms: Date.now() - startedAt,
  });

  if (runError) {
    throw new Error(`Erro ao registrar geração de ideias: ${runError.message}`);
  }

  const { error } = await supabase.from("content_ideas").insert(
    ideas.map((idea) => ({
      brand_knowledge_id: latestKnowledge?.id ?? null,
      topic: idea.topic,
      hook: idea.hook,
      pain: idea.pain,
      promise: idea.promise,
      platform: idea.platform,
      format: idea.format,
      viral_hypothesis: idea.viral_hypothesis,
      score: idea.score ?? null,
      status: "generated",
    })),
  );

  if (error) {
    throw new Error(`Erro ao salvar ideias: ${error.message}`);
  }

  return {
    provider: generated.provider,
    generated: ideas.length,
  };
}

export async function updateContentIdeaStatus(input: {
  ideaId: string;
  status: "approved" | "rejected" | "archived";
}) {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase não está configurado.");
  }

  if (!input.ideaId) {
    throw new Error("Ideia ausente.");
  }

  const supabase = getSupabaseAdminClient();
  const { error } = await supabase
    .from("content_ideas")
    .update({ status: input.status })
    .eq("id", input.ideaId);

  if (error) {
    throw new Error(`Erro ao atualizar ideia: ${error.message}`);
  }
}

async function normalizeExistingBrandAssetTypes(
  inventory: Array<{ id: string; title: string; type: string }>,
) {
  const supabase = getSupabaseAdminClient();

  for (const asset of inventory) {
    const nextType = classifyAssetFromName(asset.title, asset.type);

    if (nextType === asset.type) {
      continue;
    }

    await supabase.from("brand_assets").update({ type: nextType }).eq("id", asset.id);
  }
}

export async function uploadBrandAsset(input: {
  file: File;
  type: string;
  title: string;
  description: string;
  tags: string[];
  usageNotes: string;
}): Promise<BrandAssetUploadResult> {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase não está configurado.");
  }

  if (!input.file.size) {
    throw new Error("Arquivo vazio.");
  }

  if (input.file.size > 50 * 1024 * 1024) {
    throw new Error("Arquivo acima de 50MB.");
  }

  if (isZipFile(input.file)) {
    return uploadBrandAssetZip(input);
  }

  const supabase = getSupabaseAdminClient();
  await ensureBrandAssetsBucket();

  const extension = getSafeExtension(input.file.name, input.file.type);
  const storagePath = `${new Date().toISOString().slice(0, 10)}/${cryptoRandomId()}${extension}`;
  const buffer = Buffer.from(await input.file.arrayBuffer());
  const { error: uploadError } = await supabase.storage
    .from("brand-assets")
    .upload(storagePath, buffer, {
      contentType: input.file.type || "application/octet-stream",
      upsert: false,
    });

  if (uploadError) {
    throw new Error(`Erro ao subir asset: ${uploadError.message}`);
  }

  const { data, error } = await supabase
    .from("brand_assets")
    .insert({
      type: normalizeBrandAssetType(input.type),
      title: input.title || input.file.name,
      description: input.description,
      storage_bucket: "brand-assets",
      storage_path: storagePath,
      content_type: input.file.type || null,
      size_bytes: input.file.size,
      tags: input.tags,
      usage_notes: input.usageNotes,
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(`Erro ao salvar asset: ${error.message}`);
  }

  return {
    id: data.id,
    extractedCount: 1,
    skippedCount: 0,
    isZipImport: false,
  };
}

async function uploadBrandAssetZip(input: {
  file: File;
  type: string;
  title: string;
  description: string;
  tags: string[];
  usageNotes: string;
}): Promise<BrandAssetUploadResult> {
  const zip = await JSZip.loadAsync(await input.file.arrayBuffer());
  const entries = Object.values(zip.files).filter((entry) => {
    return !entry.dir && isUsableZipEntry(entry.name);
  });

  if (!entries.length) {
    throw new Error("ZIP não contém arquivos utilizáveis.");
  }

  if (entries.length > 100) {
    throw new Error("ZIP com arquivos demais. Limite: 100 arquivos.");
  }

  const supabase = getSupabaseAdminClient();
  await ensureBrandAssetsBucket();

  const batchId = crypto.randomUUID();
  const savedAssetIds: string[] = [];
  let skipped = 0;

  for (const entry of entries) {
    const contentType = inferContentTypeFromPath(entry.name);

    if (!contentType) {
      skipped += 1;
      continue;
    }

    const bytes = await entry.async("uint8array");

    if (!bytes.byteLength || bytes.byteLength > 50 * 1024 * 1024) {
      skipped += 1;
      continue;
    }

    const extension = getSafeExtension(entry.name, contentType);
    const cleanName = getCleanFileName(entry.name);
    const storagePath = `${new Date().toISOString().slice(0, 10)}/${batchId}/${cryptoRandomId()}${extension}`;
    const { error: uploadError } = await supabase.storage
      .from("brand-assets")
      .upload(storagePath, Buffer.from(bytes), {
        contentType,
        upsert: false,
      });

    if (uploadError) {
      throw new Error(`Erro ao subir ${cleanName}: ${uploadError.message}`);
    }

    const { data, error } = await supabase
      .from("brand_assets")
      .insert({
        type: inferBrandAssetType(cleanName, contentType, input.type),
        title: input.title ? `${input.title} / ${cleanName}` : cleanName,
        description: input.description,
        storage_bucket: "brand-assets",
        storage_path: storagePath,
        content_type: contentType,
        size_bytes: bytes.byteLength,
        tags: [...input.tags, "zip-import"].filter(Boolean),
        usage_notes: [
          input.usageNotes,
          `Extraído do ZIP: ${input.file.name}`,
          `Lote: ${batchId}`,
          `Caminho original: ${entry.name}`,
        ]
          .filter(Boolean)
          .join("\n"),
      })
      .select("id")
      .single();

    if (error) {
      throw new Error(`Erro ao salvar ${cleanName}: ${error.message}`);
    }

    savedAssetIds.push(data.id);
  }

  if (!savedAssetIds.length) {
    throw new Error(
      "Nenhum arquivo interno do ZIP tinha formato aceito. Use imagens, vídeos, PDF ou HTML.",
    );
  }

  return {
    id: savedAssetIds[0],
    extractedCount: savedAssetIds.length,
    skippedCount: skipped,
    batchId,
    isZipImport: true,
  };
}

async function ensureBrandAssetsBucket() {
  const supabase = getSupabaseAdminClient();
  const { data: buckets, error: listError } = await supabase.storage.listBuckets();
  const bucketOptions = {
    public: false,
    fileSizeLimit: 50 * 1024 * 1024,
    allowedMimeTypes: [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/gif",
      "image/svg+xml",
      "video/mp4",
      "video/quicktime",
      "application/pdf",
      "text/html",
      "application/zip",
      "application/x-zip-compressed",
    ],
  };

  if (listError) {
    throw new Error(`Erro ao listar buckets: ${listError.message}`);
  }

  if (buckets.some((bucket) => bucket.name === "brand-assets")) {
    await supabase.storage.updateBucket("brand-assets", bucketOptions);
    return;
  }

  const { error } = await supabase.storage.createBucket("brand-assets", bucketOptions);

  if (error) {
    throw new Error(`Erro ao criar bucket brand-assets: ${error.message}`);
  }
}

function cryptoRandomId() {
  return crypto.randomUUID().replaceAll("-", "");
}

function getSafeExtension(fileName: string, contentType: string) {
  const match = fileName.toLowerCase().match(/\.[a-z0-9]+$/);

  if (match?.[0] && match[0].length <= 8) {
    return match[0];
  }

  if (contentType === "image/jpeg") return ".jpg";
  if (contentType === "image/png") return ".png";
  if (contentType === "image/webp") return ".webp";
  if (contentType === "video/mp4") return ".mp4";
  if (contentType === "application/pdf") return ".pdf";
  if (contentType === "text/html") return ".html";
  if (contentType === "application/zip") return ".zip";
  if (contentType === "application/x-zip-compressed") return ".zip";

  return "";
}

function isZipFile(file: File) {
  const name = file.name.toLowerCase();

  return (
    name.endsWith(".zip") ||
    file.type === "application/zip" ||
    file.type === "application/x-zip-compressed"
  );
}

function isUsableZipEntry(path: string) {
  const normalized = path.replaceAll("\\", "/");
  const fileName = normalized.split("/").pop() ?? "";

  if (!fileName || fileName.startsWith(".") || normalized.includes("__MACOSX/")) {
    return false;
  }

  if (normalized.includes("../") || normalized.startsWith("/")) {
    return false;
  }

  return Boolean(inferContentTypeFromPath(path));
}

function inferContentTypeFromPath(path: string) {
  const lower = path.toLowerCase().split("?")[0] ?? "";

  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".svg")) return "image/svg+xml";
  if (lower.endsWith(".mp4")) return "video/mp4";
  if (lower.endsWith(".mov")) return "video/quicktime";
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".html") || lower.endsWith(".htm")) return "text/html";

  return null;
}

function getCleanFileName(path: string) {
  return path.replaceAll("\\", "/").split("/").pop() || "asset";
}

function inferBrandAssetType(fileName: string, contentType: string, fallback: string) {
  const lower = fileName.toLowerCase();

  if (lower.includes("logo")) return "logo";
  if (lower.includes("template")) return "template";
  if (lower.includes("screenshot") || lower.includes("screen")) return "screenshot";
  if (lower.includes("background") || lower.includes("bg")) return "background";
  if (contentType === "text/html" || contentType === "application/pdf") {
    return "reference";
  }
  if (contentType.startsWith("image/")) {
    return normalizeBrandAssetType(fallback === "other" ? "photo" : fallback);
  }

  return normalizeBrandAssetType(fallback);
}

function classifyAssetFromName(fileName: string, currentType: string) {
  const lower = fileName.toLowerCase();

  if (lower.includes("logo")) return "logo";
  if (
    lower.includes("simbolo") ||
    lower.includes("símbolo") ||
    lower.includes("symbol") ||
    lower.includes("favicon") ||
    lower.includes("avatar") ||
    lower.includes("icon")
  ) {
    return "reference";
  }
  if (lower.includes("template")) return "template";
  if (lower.includes("screenshot") || lower.includes("screen")) return "screenshot";
  if (lower.includes("background") || lower.includes("bg")) return "background";

  return normalizeBrandAssetType(currentType);
}

function stripHtml(value: string) {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function extractLikelyColors(value: string) {
  const matches = value.match(/#[0-9a-fA-F]{3,8}\b/g) ?? [];
  const counts = new Map<string, number>();

  for (const color of matches) {
    const normalized = color.toLowerCase();
    counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 16)
    .map(([color, count]) => ({ color, count }));
}

function countBy<T extends Record<string, unknown>>(items: T[], key: keyof T) {
  return items.reduce<Record<string, number>>((acc, item) => {
    const value = String(item[key] ?? "unknown");
    acc[value] = (acc[value] ?? 0) + 1;
    return acc;
  }, {});
}

function buildBrandKnowledgeSummary(input: {
  assetInventory: Array<{
    title: string;
    type: string;
    content_type: string | null;
    tags: string[];
    usage_notes: string;
  }>;
  referenceInventory: Array<{
    title: string;
    type: string;
    url: string;
    tags: string[];
    usage_notes: string;
  }>;
  visualIdentity: {
    asset_counts: Record<string, number>;
    content_types: Record<string, number>;
    names: string[];
    likely_colors: Array<{ color: string; count: number }>;
    html_excerpt: string;
  };
}) {
  const logos = input.assetInventory.filter((asset) => asset.type === "logo");
  const references = input.assetInventory.filter(
    (asset) => asset.type === "reference",
  );
  const colors = input.visualIdentity.likely_colors
    .map((item) => item.color)
    .join(", ");

  return [
    `Inventário: ${input.assetInventory.length} assets proprietários e ${input.referenceInventory.length} links de referência.`,
    logos.length
      ? `Logos disponíveis: ${logos.map((asset) => asset.title).join("; ")}.`
      : "Nenhum logo classificado explicitamente.",
    references.length
      ? `Referências visuais/documentais: ${references.map((asset) => asset.title).join("; ")}.`
      : "",
    colors ? `Cores prováveis extraídas: ${colors}.` : "",
    input.visualIdentity.html_excerpt
      ? `Texto extraído do design system: ${input.visualIdentity.html_excerpt.slice(0, 2500)}`
      : "",
    "Diretriz para geração: priorizar assets proprietários e manter consistência visual antes de recorrer a Pexels.",
  ]
    .filter(Boolean)
    .join("\n");
}

async function getLatestBrandKnowledgePromptContext() {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("brand_knowledge")
    .select("summary,visual_identity,asset_inventory,reference_inventory,created_at")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Erro ao carregar conhecimento da marca: ${error.message}`);
  }

  if (!data) {
    return "";
  }

  return [
    data.summary,
    `Visual identity JSON: ${JSON.stringify(data.visual_identity).slice(0, 4000)}`,
    `Assets: ${JSON.stringify(data.asset_inventory).slice(0, 5000)}`,
    `Referências: ${JSON.stringify(data.reference_inventory).slice(0, 2000)}`,
  ]
    .filter(Boolean)
    .join("\n\n")
    .slice(0, 12000);
}

async function getLatestBrandKnowledgeRecord() {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("brand_knowledge")
    .select("id")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Erro ao carregar conhecimento da marca: ${error.message}`);
  }

  return data;
}

function buildIdeasPrompt(input: {
  businessName: string;
  businessIdea: string;
  valueProposition: string;
  targetAudience: string;
  toneOfVoice: string;
  ideasCount: number;
}, brandKnowledge: string) {
  return `Gere ${input.ideasCount} ideias de conteúdo para Instagram, com foco em criatividade, clareza e potencial de compartilhamento.

Responda exclusivamente no formato JSON:
{
  "ideas": [
    {
      "topic": "tema",
      "hook": "frase forte de abertura",
      "pain": "dor específica que a ideia ataca",
      "promise": "promessa honesta do conteúdo",
      "platform": "instagram" | "linkedin" | "both",
      "format": "reel" | "carousel" | "image" | "text",
      "viral_hypothesis": "por que isso pode performar",
      "score": 0
    }
  ]
}

Negócio: ${input.businessName}
Ideia do negócio: ${input.businessIdea}
Proposta de valor: ${input.valueProposition}
Público-alvo: ${input.targetAudience}
Tom de voz: ${input.toneOfVoice}

Conhecimento de marca:
${brandKnowledge || "Sem conhecimento de marca ingerido."}

Critérios:
- Não escrever posts completos ainda.
- Gerar ideias com tensão, contraste, curiosidade ou utilidade prática.
- Evitar clichês como 'transforme seu negócio' e 'potencialize seus resultados'.
- Priorizar ideias visuais para Instagram.
- Cada ideia deve ter uma hipótese clara de viralização.`;
}

function buildFallbackIdeas(input: {
  businessName: string;
  businessIdea: string;
  valueProposition: string;
  ideasCount: number;
}): { ideas: GeneratedIdea[] } {
  const base: GeneratedIdea[] = [
    {
      topic: "Atendimento sem memória",
      hook: "Seu atendimento não falha por falta de equipe. Falha por falta de memória.",
      pain: "Clientes esquecidos, follow-up perdido e histórico espalhado.",
      promise: "Mostrar por que memória operacional melhora atendimento e recompra.",
      platform: "instagram",
      format: "carousel",
      viral_hypothesis:
        "Frase contraintuitiva + dor reconhecível por donos de negócio.",
      score: 82,
    },
    {
      topic: "Automação que parece humana",
      hook: "Automação ruim afasta. Automação com contexto aproxima.",
      pain: "Medo de parecer robótico no relacionamento com clientes.",
      promise: `Explicar como ${input.businessName || "a marca"} automatiza sem perder contexto.`,
      platform: "both",
      format: "reel",
      viral_hypothesis:
        "Quebra objeção comum e abre espaço para demonstração visual.",
      score: 78,
    },
    {
      topic: "Follow-up invisível",
      hook: "O dinheiro que você perde geralmente está no follow-up que ninguém fez.",
      pain: "Leads e clientes esfriam porque ninguém retoma a conversa.",
      promise: "Mostrar o custo invisível de não acompanhar contatos.",
      platform: "linkedin",
      format: "text",
      viral_hypothesis:
        "Tema comercial direto, com perda financeira clara e fácil identificação.",
      score: 80,
    },
  ];

  return {
    ideas: Array.from({ length: input.ideasCount }, (_, index) => ({
      ...base[index % base.length],
      topic: `${base[index % base.length].topic} #${index + 1}`,
    })),
  };
}

function normalizeGeneratedIdeas(ideas: GeneratedIdea[] | undefined, limit: number) {
  return (Array.isArray(ideas) ? ideas : [])
    .slice(0, limit)
    .map((idea, index) => ({
      topic: String(idea.topic || `Ideia #${index + 1}`).slice(0, 220),
      hook: String(idea.hook || idea.topic || "").slice(0, 300),
      pain: String(idea.pain || "").slice(0, 500),
      promise: String(idea.promise || "").slice(0, 500),
      platform: normalizePlatform(idea.platform),
      format: String(idea.format || "carousel").slice(0, 80),
      viral_hypothesis: String(idea.viral_hypothesis || "").slice(0, 700),
      score:
        typeof idea.score === "number"
          ? Math.max(0, Math.min(100, Math.round(idea.score)))
          : null,
    }));
}

function normalizeBrandReferenceType(value: string) {
  const allowed = new Set([
    "design_system",
    "brand_book",
    "figma",
    "canva",
    "landing_page",
    "site",
    "reference",
    "other",
  ]);

  return allowed.has(value) ? value : "reference";
}

function normalizeBrandAssetType(value: string) {
  const allowed = new Set([
    "logo",
    "photo",
    "product",
    "screenshot",
    "template",
    "background",
    "reference",
    "other",
  ]);

  return allowed.has(value) ? value : "other";
}

export async function generateEditorialPlan(input: {
  businessName: string;
  businessIdea: string;
  valueProposition: string;
  productScope: string;
  targetAudience: string;
  personas: string;
  painsAndRemedies: string;
  designSystem: string;
  toneOfVoice: string;
  postsCount: number;
  startDate: string;
}) {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase não está configurado.");
  }

  const supabase = getSupabaseAdminClient();
  const fallback = buildFallbackPlan(input);
  const brandKnowledge = await getLatestBrandKnowledgePromptContext();
  const startedAt = Date.now();
  const generated = await generateJsonWithGroq<{ posts: GeneratedDraft[] }>({
    system:
      "Você é um planejador editorial sênior para Instagram e LinkedIn. Gere somente JSON válido. Foque em viralização ética, clareza, especificidade e aprovação humana antes de publicação.",
    prompt: buildPlannerPrompt(input, brandKnowledge),
    fallback,
  });
  const posts = normalizeGeneratedPosts(generated.data.posts, input.postsCount);

  const { data: generationRun, error: generationError } = await supabase
    .from("generation_runs")
    .insert({
      provider: generated.provider,
      model: generated.model,
      task: "generate_editorial_plan",
      input,
      output: { posts },
      status: "completed",
      duration_ms: Date.now() - startedAt,
    })
    .select("id")
    .single();

  if (generationError) {
    throw new Error(`Erro ao registrar geração: ${generationError.message}`);
  }

  const { data: brandProfile, error: brandError } = await supabase
    .from("brand_profiles")
    .insert({
      name: input.businessName || "Meu negócio",
      business_idea: input.businessIdea,
      value_proposition: input.valueProposition,
      product_scope: input.productScope,
      target_audience: input.targetAudience,
      tone_of_voice: input.toneOfVoice,
      design_system_notes: input.designSystem,
      constraints: input.painsAndRemedies,
    })
    .select("id")
    .single();

  if (brandError) {
    throw new Error(`Erro ao salvar perfil do negócio: ${brandError.message}`);
  }

  const pillar = await ensureContentPillar({
    brandProfileId: brandProfile.id,
    name: "Viralização com autoridade",
    description:
      "Posts desenhados para alcance, clareza da proposta de valor e construção de confiança.",
  });
  const savedDrafts: string[] = [];

  for (const [index, post] of posts.entries()) {
    const scheduledFor = buildScheduleDate(input.startDate, index);
    const asset = post.pexels_query
      ? await savePexelsAsset(post.pexels_query, post.format)
      : null;
    const { data: calendarItem, error: calendarError } = await supabase
      .from("content_calendar_items")
      .insert({
        brand_profile_id: brandProfile.id,
        content_pillar_id: pillar.id,
        scheduled_for: scheduledFor,
        platform: post.platform,
        format: post.format,
        objective: post.objective,
        topic: post.topic,
        viral_hook: post.viral_hook,
        angle: post.angle,
        status: "drafted",
        score: post.score ?? null,
        notes: post.pexels_query
          ? `Busca Pexels sugerida: ${post.pexels_query}`
          : "",
      })
      .select("id")
      .single();

    if (calendarError) {
      throw new Error(`Erro ao salvar calendário: ${calendarError.message}`);
    }

    const { data: draft, error: draftError } = await supabase
      .from("post_drafts")
      .insert({
        calendar_item_id: calendarItem.id,
        media_asset_id: asset?.id ?? null,
        title: post.title,
        content: post.content,
        first_comment: post.first_comment ?? "",
        hashtags: post.hashtags ?? [],
        platform: post.platform,
        status: "draft",
        scheduled_for: scheduledFor,
        generation_run_id: generationRun.id,
      })
      .select("id")
      .single();

    if (draftError) {
      throw new Error(`Erro ao salvar draft: ${draftError.message}`);
    }

    savedDrafts.push(draft.id);
  }

  return {
    provider: generated.provider,
    model: generated.model,
    generated: posts.length,
    draftIds: savedDrafts,
  };
}

async function ensureContentPillar(input: {
  brandProfileId: string;
  name: string;
  description: string;
}) {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("content_pillars")
    .insert({
      brand_profile_id: input.brandProfileId,
      name: input.name,
      description: input.description,
      viral_angle:
        "Hooks fortes, tensão clara, linguagem direta e promessa específica.",
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(`Erro ao salvar pilar editorial: ${error.message}`);
  }

  return data;
}

async function savePexelsAsset(query: string, format: string) {
  const mediaType = /reel|video|short/i.test(format) ? "video" : "image";
  let asset: PexelsAsset | null = null;

  try {
    asset = await searchPexelsAsset({ query, mediaType });
  } catch (error) {
    console.warn("pexels.search_failed", { query, error });
  }

  if (!asset) {
    return null;
  }

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("media_assets")
    .insert(asset)
    .select("id")
    .single();

  if (error) {
    throw new Error(`Erro ao salvar mídia Pexels: ${error.message}`);
  }

  return data;
}

function buildPlannerPrompt(input: {
  businessName: string;
  businessIdea: string;
  valueProposition: string;
  productScope: string;
  targetAudience: string;
  personas: string;
  painsAndRemedies: string;
  designSystem: string;
  toneOfVoice: string;
  postsCount: number;
}, brandKnowledge: string) {
  return `Gere ${input.postsCount} posts para um calendário editorial.

Responda exclusivamente no formato:
{
  "posts": [
    {
      "title": "título interno",
      "platform": "instagram" | "linkedin" | "both",
      "format": "image" | "carousel" | "reel" | "text",
      "objective": "alcance" | "autoridade" | "leads" | "venda" | "comunidade",
      "topic": "tema do post",
      "viral_hook": "hook forte",
      "angle": "ângulo estratégico",
      "content": "legenda ou texto completo",
      "first_comment": "opcional",
      "hashtags": ["tag1", "tag2"],
      "pexels_query": "busca visual curta em inglês",
      "score": 0
    }
  ]
}

Negócio: ${input.businessName}
Ideia: ${input.businessIdea}
Proposta de valor: ${input.valueProposition}
Produto/escopo: ${input.productScope}
Público-alvo: ${input.targetAudience}
Personas: ${input.personas}
Dores e remédio: ${input.painsAndRemedies}
Design system: ${input.designSystem}
Tom de voz: ${input.toneOfVoice}

Conhecimento extraído dos assets e referências da marca:
${brandKnowledge || "Nenhum conhecimento de marca ingerido ainda."}

Critérios: hooks específicos, evitar clichês, adaptar Instagram e LinkedIn, não prometer resultado impossível, e sempre deixar pronto para aprovação humana.`;
}

function buildFallbackPlan(input: {
  businessName: string;
  businessIdea: string;
  valueProposition: string;
  postsCount: number;
}): { posts: GeneratedDraft[] } {
  const base: GeneratedDraft[] = [
    {
      title: "Erro comum que trava o crescimento",
      platform: "both",
      format: "image",
      objective: "alcance",
      topic: `Erro que o público de ${input.businessName || "negócio"} costuma cometer`,
      viral_hook: "O problema não é falta de esforço. É falta de direção.",
      angle: "Contraste entre esforço disperso e clareza estratégica.",
      content: `O erro mais caro é tentar resolver tudo ao mesmo tempo. Quando a proposta de valor fica clara, o próximo passo também fica. ${input.valueProposition}`,
      first_comment: "",
      hashtags: ["estrategia", "negocios", "clareza"],
      pexels_query: "focused entrepreneur planning",
      score: 72,
    },
    {
      title: "Antes e depois da clareza",
      platform: "linkedin",
      format: "text",
      objective: "autoridade",
      topic: "Transformação causada pela proposta de valor",
      viral_hook: "Antes parecia complexo. Depois ficou óbvio.",
      angle: "Mostrar transformação sem prometer milagre.",
      content: `Antes: muitas ideias competindo por atenção. Depois: uma proposta clara, uma dor central e um caminho de execução. Ideia-base: ${input.businessIdea}`,
      first_comment: "",
      hashtags: ["posicionamento", "produto", "execucao"],
      pexels_query: "business clarity whiteboard",
      score: 76,
    },
    {
      title: "Checklist de decisão",
      platform: "instagram",
      format: "carousel",
      objective: "comunidade",
      topic: "Checklist prático para o público",
      viral_hook: "Se você não consegue responder isso, ainda não está pronto para escalar.",
      angle: "Checklist compartilhável e salvável.",
      content: "Checklist rápido: 1. Qual dor você resolve? 2. Para quem? 3. Por que agora? 4. Qual primeiro passo? 5. O que deve ser ignorado?",
      first_comment: "",
      hashtags: ["checklist", "produtividade", "marketing"],
      pexels_query: "checklist notebook desk",
      score: 74,
    },
  ];

  return {
    posts: Array.from({ length: input.postsCount }, (_, index) => ({
      ...base[index % base.length],
      title: `${base[index % base.length].title} #${index + 1}`,
    })),
  };
}

function normalizeGeneratedPosts(posts: GeneratedDraft[] | undefined, limit: number) {
  return (Array.isArray(posts) ? posts : [])
    .slice(0, limit)
    .map((post, index) => ({
      title: String(post.title || `Post gerado #${index + 1}`).slice(0, 180),
      platform: normalizePlatform(post.platform),
      format: String(post.format || "image").slice(0, 80),
      objective: String(post.objective || "alcance").slice(0, 80),
      topic: String(post.topic || post.title || "Tema editorial").slice(0, 220),
      viral_hook: String(post.viral_hook || post.title || "").slice(0, 300),
      angle: String(post.angle || "").slice(0, 500),
      content: String(post.content || post.viral_hook || post.title || "").slice(
        0,
        5000,
      ),
      first_comment: post.first_comment
        ? String(post.first_comment).slice(0, 1000)
        : "",
      hashtags: Array.isArray(post.hashtags)
        ? post.hashtags.slice(0, 12).map((tag) => String(tag).replace(/^#/, ""))
        : [],
      pexels_query: post.pexels_query
        ? String(post.pexels_query).slice(0, 120)
        : undefined,
      score:
        typeof post.score === "number"
          ? Math.max(0, Math.min(100, Math.round(post.score)))
          : null,
    }));
}

function normalizePlatform(value: unknown): "instagram" | "linkedin" | "both" {
  return value === "instagram" || value === "linkedin" || value === "both"
    ? value
    : "both";
}

function buildScheduleDate(startDate: string, index: number) {
  const start = startDate ? new Date(`${startDate}T09:00:00-03:00`) : new Date();

  if (Number.isNaN(start.getTime())) {
    start.setTime(Date.now());
  }

  start.setDate(start.getDate() + index * 2);
  start.setHours(index % 2 === 0 ? 9 : 17, 0, 0, 0);

  return start.toISOString();
}

export async function recordZernioWebhookEvent(input: {
  eventId: string | null;
  payload: unknown;
}) {
  if (!isSupabaseConfigured()) {
    return { stored: false, reason: "supabase_not_configured" as const };
  }

  const payload =
    input.payload && typeof input.payload === "object"
      ? (input.payload as Record<string, unknown>)
      : {};
  const eventType = getWebhookEventType(payload);
  const zernioPostId = getWebhookPostId(payload);
  const supabase = getSupabaseAdminClient();

  const { error } = await supabase.from("zernio_events").upsert(
    {
      event_id: input.eventId,
      event_type: eventType,
      zernio_post_id: zernioPostId,
      payload,
    },
    input.eventId
      ? {
          onConflict: "event_id",
          ignoreDuplicates: true,
        }
      : undefined,
  );

  if (error) {
    throw new Error(`Erro ao gravar webhook da Zernio: ${error.message}`);
  }

  await syncPostDraftFromWebhook({
    eventType,
    zernioPostId,
    payload,
  });

  return { stored: true };
}

async function syncPostDraftFromWebhook(input: {
  eventType: string;
  zernioPostId: string | null;
  payload: Record<string, unknown>;
}) {
  if (!input.zernioPostId) {
    return;
  }

  const status = mapWebhookEventToDraftStatus(input.eventType);

  if (!status) {
    return;
  }

  const supabase = getSupabaseAdminClient();
  const patch: Record<string, unknown> = {
    status,
    last_error:
      status === "failed" ? getWebhookErrorMessage(input.payload) : null,
  };

  if (status === "published") {
    patch.published_at = new Date().toISOString();
  }

  const { error } = await supabase
    .from("post_drafts")
    .update(patch)
    .eq("zernio_post_id", input.zernioPostId);

  if (error) {
    throw new Error(`Erro ao sincronizar draft: ${error.message}`);
  }
}

function getWebhookEventType(payload: Record<string, unknown>) {
  return String(
    payload.event ??
      payload.type ??
      payload.eventType ??
      payload.name ??
      "unknown",
  );
}

function getWebhookPostId(payload: Record<string, unknown>) {
  const direct = payload.postId ?? payload.post_id ?? payload.zernioPostId;

  if (typeof direct === "string" && direct) {
    return direct;
  }

  const post = payload.post;

  if (post && typeof post === "object") {
    const postRecord = post as Record<string, unknown>;
    const id = postRecord._id ?? postRecord.id;

    if (typeof id === "string" && id) {
      return id;
    }
  }

  return null;
}

function getWebhookErrorMessage(payload: Record<string, unknown>) {
  const error = payload.error ?? payload.message;

  return typeof error === "string" ? error.slice(0, 500) : null;
}

function mapWebhookEventToDraftStatus(eventType: string) {
  if (
    eventType === "post.published" ||
    eventType === "post.platform.published"
  ) {
    return "published";
  }

  if (eventType === "post.failed" || eventType === "post.platform.failed") {
    return "failed";
  }

  if (eventType === "post.scheduled") {
    return "scheduled";
  }

  if (eventType === "post.cancelled") {
    return "cancelled";
  }

  return null;
}
