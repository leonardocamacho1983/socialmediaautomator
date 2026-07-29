import "server-only";

import type { MediaItem } from "@/lib/types";

type PexelsPhoto = {
  id: number;
  photographer?: string;
  url?: string;
  src?: {
    large2x?: string;
    large?: string;
    medium?: string;
    original?: string;
  };
};

type PexelsVideo = {
  id: number;
  user?: { name?: string };
  url?: string;
  image?: string;
  video_files?: Array<{
    quality?: string;
    file_type?: string;
    link?: string;
    width?: number;
  }>;
};

export type PexelsAsset = {
  source: "pexels";
  media_type: MediaItem["type"];
  url: string;
  thumbnail_url: string | null;
  author: string | null;
  license: string;
  search_query: string;
  metadata: Record<string, unknown>;
};

export function isPexelsConfigured() {
  return Boolean(process.env.PEXELS_API_KEY ?? process.env.PEXELS_KEY);
}

export function getPexelsConfigStatus() {
  return {
    hasApiKey: isPexelsConfigured(),
  };
}

export async function searchPexelsAsset(input: {
  query: string;
  mediaType?: "image" | "video";
}): Promise<PexelsAsset | null> {
  const apiKey = process.env.PEXELS_API_KEY ?? process.env.PEXELS_KEY;

  if (!apiKey || !input.query.trim()) {
    return null;
  }

  const mediaType = input.mediaType ?? "image";
  const endpoint =
    mediaType === "video"
      ? "https://api.pexels.com/videos/search"
      : "https://api.pexels.com/v1/search";
  const url = new URL(endpoint);
  url.searchParams.set("query", input.query);
  url.searchParams.set("per_page", "1");
  url.searchParams.set("orientation", "portrait");

  const response = await fetch(url, {
    headers: {
      Authorization: apiKey,
    },
    cache: "no-store",
  });

  const body = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(
      `Pexels respondeu com HTTP ${response.status}: ${JSON.stringify(body)}`,
    );
  }

  if (mediaType === "video") {
    const video = body?.videos?.[0] as PexelsVideo | undefined;
    const file = video?.video_files
      ?.filter((item) => item.file_type === "video/mp4" && item.link)
      .sort((a, b) => (b.width ?? 0) - (a.width ?? 0))[0];

    if (!video || !file?.link) {
      return null;
    }

    return {
      source: "pexels",
      media_type: "video",
      url: file.link,
      thumbnail_url: video.image ?? null,
      author: video.user?.name ?? null,
      license: "Pexels",
      search_query: input.query,
      metadata: {
        pexels_id: video.id,
        pexels_url: video.url,
      },
    };
  }

  const photo = body?.photos?.[0] as PexelsPhoto | undefined;
  const imageUrl = photo?.src?.large2x ?? photo?.src?.large ?? photo?.src?.original;

  if (!photo || !imageUrl) {
    return null;
  }

  return {
    source: "pexels",
    media_type: "image",
    url: imageUrl,
    thumbnail_url: photo.src?.medium ?? null,
    author: photo.photographer ?? null,
    license: "Pexels",
    search_query: input.query,
    metadata: {
      pexels_id: photo.id,
      pexels_url: photo.url,
    },
  };
}
