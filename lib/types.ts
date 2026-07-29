export type SupportedPlatform = "instagram" | "linkedin";

export type PostStatus =
  | "draft"
  | "scheduled"
  | "publishing"
  | "published"
  | "failed"
  | "partial"
  | "cancelled";

export type MediaItem = {
  type: "image" | "video" | "document";
  url: string;
};

export type PlatformTarget = {
  platform: SupportedPlatform;
  accountId: string;
  platformSpecificData?: Record<string, unknown>;
};

export type SocialAccount = {
  _id: string;
  platform: string;
  profileId?: string;
  username?: string;
  displayName?: string;
  profilePicture?: string | null;
  profileUrl?: string;
  isActive: boolean;
  enabled?: boolean;
  needsReconnection?: boolean;
  followersCount?: number;
  metadata?: Record<string, unknown>;
};

export type ZernioPost = {
  _id: string;
  title?: string;
  content?: string;
  mediaItems?: MediaItem[];
  platforms?: Array<{
    platform: string;
    accountId: string;
    status?: string;
    platformPostUrl?: string;
    error?: string;
    platformSpecificData?: Record<string, unknown>;
  }>;
  scheduledFor?: string;
  timezone?: string;
  status: PostStatus | string;
  createdAt?: string;
  updatedAt?: string;
};

export type CreatePostPayload = {
  title?: string;
  content?: string;
  mediaItems?: MediaItem[];
  platforms?: PlatformTarget[];
  scheduledFor?: string;
  publishNow?: boolean;
  isDraft?: boolean;
  timezone?: string;
};

export type ZernioErrorBody = {
  error?: string;
  code?: string;
  type?: string;
  details?: unknown;
};
