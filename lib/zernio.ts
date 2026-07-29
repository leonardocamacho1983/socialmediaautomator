import "server-only";

import crypto from "node:crypto";
import type {
  CreatePostPayload,
  SocialAccount,
  SupportedPlatform,
  ZernioErrorBody,
  ZernioPost,
} from "@/lib/types";

const ZERNIO_API_BASE = "https://zernio.com/api/v1";
const SUPPORTED_PLATFORMS = new Set<SupportedPlatform>([
  "instagram",
  "linkedin",
]);

export class ZernioApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body?: ZernioErrorBody | unknown,
  ) {
    super(message);
    this.name = "ZernioApiError";
  }
}

export function isZernioConfigured() {
  return Boolean(process.env.ZERNIO_API_KEY);
}

export function getZernioConfigStatus() {
  return {
    hasApiKey: isZernioConfigured(),
    baseUrl: ZERNIO_API_BASE,
  };
}

function getApiKey() {
  const apiKey = process.env.ZERNIO_API_KEY;

  if (!apiKey) {
    throw new ZernioApiError("ZERNIO_API_KEY não está configurada.", 503);
  }

  return apiKey;
}

async function parseResponse(response: Response) {
  const text = await response.text();

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

async function zernioFetch<T>(
  path: string,
  init: RequestInit & { requestId?: string } = {},
): Promise<T> {
  const { requestId, headers, ...requestInit } = init;
  const response = await fetch(`${ZERNIO_API_BASE}${path}`, {
    ...requestInit,
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${getApiKey()}`,
      Accept: "application/json",
      ...(requestInit.body ? { "Content-Type": "application/json" } : {}),
      ...(requestId ? { "x-request-id": requestId } : {}),
      ...headers,
    },
  });

  const body = await parseResponse(response);

  if (!response.ok) {
    const errorBody = body as ZernioErrorBody | null;
    const message =
      errorBody?.error ||
      `Zernio respondeu com HTTP ${response.status}.`;

    throw new ZernioApiError(message, response.status, body);
  }

  return body as T;
}

function toSearchParams(input: Record<string, string | undefined>) {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(input)) {
    if (value) {
      params.set(key, value);
    }
  }

  const query = params.toString();
  return query ? `?${query}` : "";
}

export async function listAccounts(options: {
  platform?: SupportedPlatform;
  status?: "connected" | "disconnected";
} = {}) {
  const query = toSearchParams({
    platform: options.platform,
    status: options.status,
  });
  const data = await zernioFetch<{
    accounts: SocialAccount[];
    hasAnalyticsAccess: boolean;
  }>(`/accounts${query}`);

  return data;
}

export async function listSupportedAccounts() {
  const data = await listAccounts();

  return {
    ...data,
    accounts: data.accounts.filter((account) => {
      return (
        SUPPORTED_PLATFORMS.has(account.platform as SupportedPlatform) &&
        account.enabled !== false
      );
    }),
  };
}

export async function listPosts(options: {
  status?: string;
  platform?: SupportedPlatform;
  source?: "zernio" | "external";
  limit?: number;
} = {}) {
  const query = toSearchParams({
    status: options.status,
    platform: options.platform,
    source: options.source,
    limit: String(options.limit ?? 50),
    page: "1",
  });

  return zernioFetch<{
    posts: ZernioPost[];
    pagination?: {
      page: number;
      limit: number;
      total: number;
      pages: number;
    };
  }>(`/posts${query}`);
}

export async function getPost(postId: string) {
  return zernioFetch<{ post: ZernioPost }>(
    `/posts/${encodeURIComponent(postId)}`,
  );
}

export async function createPost(payload: CreatePostPayload) {
  return zernioFetch<{ message?: string; post: ZernioPost; existingPost?: ZernioPost }>(
    "/posts",
    {
      method: "POST",
      body: JSON.stringify(payload),
      requestId: crypto.randomUUID(),
    },
  );
}

export async function updatePost(postId: string, payload: CreatePostPayload) {
  return zernioFetch<{ message?: string; post: ZernioPost }>(
    `/posts/${encodeURIComponent(postId)}`,
    {
      method: "PUT",
      body: JSON.stringify(payload),
      requestId: crypto.randomUUID(),
    },
  );
}

export async function deletePost(postId: string) {
  return zernioFetch<{ message?: string }>(
    `/posts/${encodeURIComponent(postId)}`,
    {
      method: "DELETE",
    },
  );
}

export function inferMediaType(url: string): "image" | "video" | "document" {
  const lower = url.toLowerCase().split("?")[0] ?? "";

  if (/\.(mp4|mov|avi|webm)$/.test(lower)) {
    return "video";
  }

  if (/\.(pdf|ppt|pptx|doc|docx)$/.test(lower)) {
    return "document";
  }

  return "image";
}

export function getReadableZernioError(error: unknown) {
  if (error instanceof ZernioApiError) {
    const details =
      typeof error.body === "object" &&
      error.body &&
      "details" in error.body
        ? ` Detalhes: ${JSON.stringify(error.body.details)}`
        : "";

    return `${error.message}${details}`;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Erro desconhecido.";
}
