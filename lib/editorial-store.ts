import "server-only";

import { getSupabaseAdminClient, isSupabaseConfigured } from "@/lib/supabase";

export type EditorialStatus = {
  configured: boolean;
  counts: {
    brandProfiles: number;
    personas: number;
    contentPillars: number;
    calendarItems: number;
    postDrafts: number;
    mediaAssets: number;
    zernioEvents: number;
  };
  recentEvents: Array<{
    id: string;
    event_id: string | null;
    event_type: string;
    zernio_post_id: string | null;
    received_at: string;
  }>;
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
    zernioEvents: 0,
  },
  recentEvents: [],
};

const COUNT_TABLES = {
  brandProfiles: "brand_profiles",
  personas: "personas",
  contentPillars: "content_pillars",
  calendarItems: "content_calendar_items",
  postDrafts: "post_drafts",
  mediaAssets: "media_assets",
  zernioEvents: "zernio_events",
} as const;

export async function getEditorialStatus(): Promise<EditorialStatus> {
  if (!isSupabaseConfigured()) {
    return EMPTY_STATUS;
  }

  const supabase = getSupabaseAdminClient();

  const [counts, recentEvents] = await Promise.all([
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
  ]);

  if (recentEvents.error) {
    throw new Error(
      `Erro ao listar eventos da Zernio: ${recentEvents.error.message}`,
    );
  }

  return {
    configured: true,
    counts: Object.fromEntries(counts) as EditorialStatus["counts"],
    recentEvents: recentEvents.data ?? [],
  };
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
