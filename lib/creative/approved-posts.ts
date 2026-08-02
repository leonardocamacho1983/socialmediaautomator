import type { BrandProfile } from "../brand/profile";
import { renderAssetCompositeSvg } from "./asset-composition";
import type { GeneratedVisualAsset } from "./assets";
import { getSelectedCaptionVariant, type CaptionPackage } from "./captions";
import type { CreativeConcept, CreativeProject } from "./concepts";
import {
  getSelectedTypographicVariant,
  renderTypographicSvg,
  svgToDataUrl,
  type TypographicPiece,
} from "./typographic-piece";

export const APPROVED_POSTS_STORAGE_KEY =
  "socialmediaautomator.approvedPosts.v1";

export type ApprovedPostStatus = "approved" | "exported" | "ready_to_publish";

export type ApprovedPost = {
  id: string;
  title: string;
  brandName: string;
  approvedAt: string;
  updatedAt: string;
  status: ApprovedPostStatus;
  notes: string;
  generatedAssets: GeneratedVisualAsset[];
  selectedVisualAssetId: string | null;
  projectSnapshot: CreativeProject;
};

type StoredApprovedPost = Omit<
  ApprovedPost,
  "notes" | "generatedAssets" | "selectedVisualAssetId"
> & {
  notes?: string;
  generatedAssets?: GeneratedVisualAsset[];
  selectedVisualAssetId?: string | null;
};

export function createApprovedPostFromProject(
  project: CreativeProject,
  selectedConcept: CreativeConcept,
): ApprovedPost | null {
  if (
    !project.finalPostPackage ||
    !project.typographicPiece ||
    !project.captionPackage
  ) {
    return null;
  }

  return {
    id: project.finalPostPackage.id,
    title: selectedConcept.title,
    brandName: project.brandSnapshot.brandName || "Social Studio",
    approvedAt: project.finalPostPackage.approvedAt,
    updatedAt: new Date().toISOString(),
    status: "approved",
    notes: "",
    generatedAssets: [],
    selectedVisualAssetId: null,
    projectSnapshot: project,
  };
}

export function parseApprovedPosts(value: unknown): ApprovedPost[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter(isApprovedPost)
    .map((post) => ({
      ...post,
      notes: post.notes || "",
      generatedAssets: normalizeGeneratedAssets(post.generatedAssets),
      selectedVisualAssetId:
        typeof post.selectedVisualAssetId === "string"
          ? post.selectedVisualAssetId
          : null,
    }));
}

export function upsertApprovedPost(posts: ApprovedPost[], post: ApprovedPost) {
  const existingIndex = posts.findIndex((item) => item.id === post.id);

  if (existingIndex === -1) {
    return [post, ...posts].slice(0, 100);
  }

  return posts.map((item, index) =>
    index === existingIndex
      ? {
          ...post,
          notes: item.notes || "",
        }
      : item,
  );
}

export function updateApprovedPostStatus(
  posts: ApprovedPost[],
  postId: string,
  status: ApprovedPostStatus,
) {
  return posts.map((post) =>
    post.id === postId
      ? {
          ...post,
          status,
          updatedAt: new Date().toISOString(),
        }
      : post,
  );
}

export function updateApprovedPostNotes(
  posts: ApprovedPost[],
  postId: string,
  notes: string,
) {
  return posts.map((post) =>
    post.id === postId
      ? {
          ...post,
          notes,
          updatedAt: new Date().toISOString(),
        }
      : post,
  );
}

export function appendApprovedPostAssets(
  posts: ApprovedPost[],
  postId: string,
  assets: GeneratedVisualAsset[],
) {
  return posts.map((post) => {
    if (post.id !== postId) {
      return post;
    }

    const nextAssets = [...assets, ...post.generatedAssets].slice(0, 8);

    return {
      ...post,
      generatedAssets: nextAssets,
      selectedVisualAssetId: post.selectedVisualAssetId || assets[0]?.id || null,
      updatedAt: new Date().toISOString(),
    };
  });
}

export function selectApprovedPostAsset(
  posts: ApprovedPost[],
  postId: string,
  assetId: string | null,
) {
  return posts.map((post) =>
    post.id === postId
      ? {
          ...post,
          selectedVisualAssetId: assetId,
          updatedAt: new Date().toISOString(),
        }
      : post,
  );
}

export function createDuplicateProjectFromApprovedPost(post: ApprovedPost) {
  const now = Date.now();
  const sourceProject = post.projectSnapshot;
  const typographicPiece = sourceProject.typographicPiece
    ? {
        ...sourceProject.typographicPiece,
        id: `typographic-${now}`,
        generatedAt: new Date().toISOString(),
      }
    : null;
  const captionPackage = sourceProject.captionPackage
    ? {
        ...sourceProject.captionPackage,
        id: `caption-${now}`,
        typographicPieceId:
          typographicPiece?.id ||
          sourceProject.captionPackage.typographicPieceId,
        generatedAt: new Date().toISOString(),
      }
    : null;

  return {
    ...sourceProject,
    id: `project-${now}`,
    typographicPiece,
    captionPackage,
    finalPostPackage: null,
    updatedAt: new Date().toISOString(),
  };
}

export function getApprovedPostConcept(post: ApprovedPost) {
  const selectedConceptId = post.projectSnapshot.selectedConceptId;

  return (
    post.projectSnapshot.batch.concepts.find(
      (concept) => concept.id === selectedConceptId,
    ) || post.projectSnapshot.batch.concepts[0]
  );
}

export function getApprovedPostBrand(post: ApprovedPost): BrandProfile {
  return post.projectSnapshot.brandSnapshot;
}

export function getApprovedPostTypographicPiece(
  post: ApprovedPost,
): TypographicPiece | null {
  return post.projectSnapshot.typographicPiece || null;
}

export function getApprovedPostCaptionPackage(
  post: ApprovedPost,
): CaptionPackage | null {
  return post.projectSnapshot.captionPackage || null;
}

export function buildApprovedPostText(post: ApprovedPost) {
  const view = buildApprovedPostView(post);

  if (!view) {
    return "";
  }

  return [
    `Marca: ${post.brandName}`,
    `Conceito: ${view.concept.title}`,
    "",
    "Legenda:",
    view.caption,
    "",
    view.firstComment ? `Primeiro comentario:\n${view.firstComment}` : "",
    view.hashtags.length ? `Hashtags:\n${view.hashtags}` : "",
    view.selectedAsset
      ? `Asset visual:\n${view.selectedAsset.prompt}`
      : "",
    post.notes ? `Notas internas:\n${post.notes}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildApprovedPostSearchText(post: ApprovedPost) {
  const concept = getApprovedPostConcept(post);
  const captionPackage = getApprovedPostCaptionPackage(post);
  const selectedCaption = captionPackage
    ? getSelectedCaptionVariant(captionPackage)
    : null;

  return [
    post.title,
    post.brandName,
    post.notes,
    post.status,
    concept?.title,
    concept?.centralIdea,
    concept?.hook,
    selectedCaption?.caption,
    selectedCaption?.firstComment,
    selectedCaption?.hashtags.join(" "),
    post.generatedAssets.map((asset) => asset.prompt).join(" "),
  ]
    .filter(Boolean)
    .join(" ");
}

export function buildApprovedPostView(post: ApprovedPost) {
  const brand = getApprovedPostBrand(post);
  const concept = getApprovedPostConcept(post);
  const typographicPiece = getApprovedPostTypographicPiece(post);
  const captionPackage = getApprovedPostCaptionPackage(post);

  if (!concept || !typographicPiece || !captionPackage) {
    return null;
  }

  const typographicVariant = getSelectedTypographicVariant(typographicPiece);
  const captionVariant = getSelectedCaptionVariant(captionPackage);

  if (!captionVariant) {
    return null;
  }

  const svg = renderTypographicSvg(typographicPiece, typographicVariant, brand);
  const selectedAsset =
    post.generatedAssets.find(
      (asset) => asset.id === post.selectedVisualAssetId,
    ) || null;
  const assetSvg = selectedAsset
    ? renderAssetCompositeSvg(
        typographicPiece,
        typographicVariant,
        brand,
        selectedAsset,
      )
    : null;

  return {
    assetDataUrl: assetSvg ? svgToDataUrl(assetSvg) : null,
    assetSvg,
    brand,
    captionPackage,
    captionVariant,
    concept,
    dataUrl: svgToDataUrl(svg),
    firstComment: captionVariant.firstComment,
    hashtags: captionVariant.hashtags.join(" "),
    svg,
    selectedAsset,
    typographicPiece,
    typographicVariant,
    caption: captionVariant.caption,
  };
}

function normalizeGeneratedAssets(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(isGeneratedVisualAsset).slice(0, 8);
}

function isGeneratedVisualAsset(value: unknown): value is GeneratedVisualAsset {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return (
    typeof candidate.id === "string" &&
    typeof candidate.model === "string" &&
    candidate.provider === "recraft" &&
    typeof candidate.prompt === "string" &&
    typeof candidate.mediaType === "string" &&
    typeof candidate.dataUrl === "string" &&
    typeof candidate.generatedAt === "string"
  );
}

function isApprovedPost(value: unknown): value is StoredApprovedPost {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return (
    typeof candidate.id === "string" &&
    typeof candidate.title === "string" &&
    typeof candidate.brandName === "string" &&
    typeof candidate.approvedAt === "string" &&
    typeof candidate.updatedAt === "string" &&
    typeof candidate.projectSnapshot === "object" &&
    candidate.projectSnapshot !== null &&
    (candidate.status === "approved" ||
      candidate.status === "exported" ||
      candidate.status === "ready_to_publish")
  );
}
