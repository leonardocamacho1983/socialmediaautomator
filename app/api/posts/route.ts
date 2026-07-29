import { requireAdminRequest } from "@/lib/auth";
import type { CreatePostPayload, SupportedPlatform } from "@/lib/types";
import {
  createPost,
  getReadableZernioError,
  inferMediaType,
  listPosts,
} from "@/lib/zernio";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const authError = await requireAdminRequest(request);

  if (authError) {
    return authError;
  }

  const url = new URL(request.url);
  const platformParam = url.searchParams.get("platform");
  const platform =
    platformParam === "instagram" || platformParam === "linkedin"
      ? (platformParam as SupportedPlatform)
      : undefined;

  try {
    const posts = await listPosts({
      status: url.searchParams.get("status") || undefined,
      platform,
      source:
        url.searchParams.get("source") === "external" ? "external" : "zernio",
      limit: Number(url.searchParams.get("limit") || 50),
    });

    return Response.json(posts);
  } catch (error) {
    return Response.json(
      { error: getReadableZernioError(error) },
      { status: 502 },
    );
  }
}

export async function POST(request: Request) {
  const authError = await requireAdminRequest(request);

  if (authError) {
    return authError;
  }

  try {
    const body = await request.json();
    const payload = normalizeCreatePayload(body);
    const post = await createPost(payload);

    return Response.json(post, { status: 201 });
  } catch (error) {
    return Response.json(
      { error: getReadableZernioError(error) },
      { status: 502 },
    );
  }
}

function normalizeCreatePayload(body: unknown): CreatePostPayload {
  if (!body || typeof body !== "object") {
    throw new Error("Body JSON inválido.");
  }

  const input = body as Record<string, unknown>;
  const mediaUrls = Array.isArray(input.mediaUrls)
    ? input.mediaUrls.filter((item): item is string => typeof item === "string")
    : undefined;

  return {
    title: typeof input.title === "string" ? input.title : undefined,
    content: typeof input.content === "string" ? input.content : undefined,
    mediaItems: Array.isArray(input.mediaItems)
      ? (input.mediaItems as CreatePostPayload["mediaItems"])
      : mediaUrls?.map((url) => ({ type: inferMediaType(url), url })),
    platforms: Array.isArray(input.platforms)
      ? (input.platforms as CreatePostPayload["platforms"])
      : undefined,
    scheduledFor:
      typeof input.scheduledFor === "string" ? input.scheduledFor : undefined,
    publishNow:
      typeof input.publishNow === "boolean" ? input.publishNow : undefined,
    isDraft: typeof input.isDraft === "boolean" ? input.isDraft : undefined,
    timezone: typeof input.timezone === "string" ? input.timezone : undefined,
  };
}
