import type { CreatePostPayload, MediaItem, PlatformTarget, SupportedPlatform } from "@/lib/types";
import { inferMediaType } from "@/lib/zernio";

const DEFAULT_TIMEZONE = "America/Sao_Paulo";

export function getFormString(formData: FormData, key: string) {
  const value = formData.get(key);

  return typeof value === "string" ? value.trim() : "";
}

export function parseMediaItems(formData: FormData): MediaItem[] | undefined {
  const raw = getFormString(formData, "mediaUrls");

  if (!raw) {
    return undefined;
  }

  const mediaItems = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((url) => ({
      type: inferMediaType(url),
      url,
    }));

  return mediaItems.length ? mediaItems : undefined;
}

export function parseTargets(formData: FormData): PlatformTarget[] | undefined {
  const firstComment = getFormString(formData, "firstComment");
  const targets: PlatformTarget[] = formData
    .getAll("targets")
    .map(String)
    .map((value) => {
      const [platform, accountId] = value.split(":");

      if (!platform || !accountId) {
        return null;
      }

      if (platform !== "instagram" && platform !== "linkedin") {
        return null;
      }

      const target: PlatformTarget = {
        platform: platform as SupportedPlatform,
        accountId,
        ...(firstComment
          ? { platformSpecificData: { firstComment } }
          : {}),
      };

      return target;
    })
    .filter((target): target is PlatformTarget => Boolean(target));

  return targets.length ? targets : undefined;
}

export function parseCreatePostPayload(formData: FormData): CreatePostPayload {
  const title = getFormString(formData, "title");
  const content = getFormString(formData, "content");
  const scheduledFor = getFormString(formData, "scheduledFor");
  const timezone = getFormString(formData, "timezone") || DEFAULT_TIMEZONE;
  const mediaItems = parseMediaItems(formData);
  const platforms = parseTargets(formData);

  return {
    ...(title ? { title } : {}),
    ...(content ? { content } : {}),
    ...(mediaItems ? { mediaItems } : {}),
    ...(platforms ? { platforms } : {}),
    ...(scheduledFor ? { scheduledFor } : {}),
    timezone,
  };
}

export function compactErrorForUrl(message: string) {
  return encodeURIComponent(message.slice(0, 450));
}
