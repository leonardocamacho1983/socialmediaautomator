import "server-only";

import crypto from "node:crypto";
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
    platform: string;
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
};

export type BrandAssetSummary = EditorialStatus["recentBrandAssets"][number];
export type BrandReferenceSummary =
  EditorialStatus["recentBrandReferences"][number];

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
    zernioEvents: 0,
  },
  recentEvents: [],
  recentDrafts: [],
  recentBrandAssets: [],
  recentBrandReferences: [],
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
    recentDrafts,
    recentBrandAssets,
    recentBrandReferences,
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
      .from("post_drafts")
      .select("id,title,platform,status,created_at")
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

  return {
    configured: true,
    counts: Object.fromEntries(counts) as EditorialStatus["counts"],
    recentEvents: recentEvents.data ?? [],
    recentDrafts: recentDrafts.data ?? [],
    recentBrandAssets: recentBrandAssets.data ?? [],
    recentBrandReferences: recentBrandReferences.data ?? [],
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

  return data;
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

export async function uploadBrandAsset(input: {
  file: File;
  type: string;
  title: string;
  description: string;
  tags: string[];
  usageNotes: string;
}) {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase não está configurado.");
  }

  if (!input.file.size) {
    throw new Error("Arquivo vazio.");
  }

  if (input.file.size > 50 * 1024 * 1024) {
    throw new Error("Arquivo acima de 50MB.");
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

  return data;
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
  const startedAt = Date.now();
  const generated = await generateJsonWithGroq<{ posts: GeneratedDraft[] }>({
    system:
      "Você é um planejador editorial sênior para Instagram e LinkedIn. Gere somente JSON válido. Foque em viralização ética, clareza, especificidade e aprovação humana antes de publicação.",
    prompt: buildPlannerPrompt(input),
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
}) {
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
