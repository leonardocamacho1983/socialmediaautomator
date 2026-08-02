import type { BrandProfile } from "../brand/profile";
import {
  assetCompositionVariants,
  getAssetCompositionVariant,
  renderAssetCompositeSvg,
  type AssetCompositionVariantId,
} from "./asset-composition";
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
export type ApprovedPostVisualStatus =
  | "typographic_only"
  | "asset_generated"
  | "asset_rejected"
  | "visual_approved";
export type VisualAssetRejectionReasonId =
  | "contains_text"
  | "too_generic"
  | "off_brand"
  | "too_busy"
  | "unclear_metaphor";

export type VisualAssetRejectionReason = {
  id: VisualAssetRejectionReasonId;
  label: string;
  regenerationInstruction: string;
};

export type VisualAssetRejection = {
  assetId: string;
  reasonId: VisualAssetRejectionReasonId;
  note: string;
  rejectedAt: string;
};

export const visualAssetRejectionReasons: VisualAssetRejectionReason[] = [
  {
    id: "contains_text",
    label: "Tem texto/numero",
    regenerationInstruction:
      "Refazer sem qualquer texto, numero, contador, badge, relogio, print ou interface legivel. Usar somente formas abstratas.",
  },
  {
    id: "too_generic",
    label: "Muito generico",
    regenerationInstruction:
      "Refazer com mais direcao editorial, menos banco de imagem, mais metafora visual proprietaria.",
  },
  {
    id: "off_brand",
    label: "Nao combina com a marca",
    regenerationInstruction:
      "Refazer mais alinhado a marca: direto, humano, limpo, premium e sem cara de chatbot generico.",
  },
  {
    id: "too_busy",
    label: "Poluido",
    regenerationInstruction:
      "Refazer com composicao mais limpa, menos elementos, assunto no topo e area inferior calma para texto.",
  },
  {
    id: "unclear_metaphor",
    label: "Metafora confusa",
    regenerationInstruction:
      "Refazer com metafora mais simples e imediatamente compreensivel, sem depender de leitura de detalhes.",
  },
];

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
  selectedAssetCompositionId: AssetCompositionVariantId;
  visualStatus: ApprovedPostVisualStatus;
  visualApprovedAt: string | null;
  visualAssetRejections: VisualAssetRejection[];
  projectSnapshot: CreativeProject;
};

type StoredApprovedPost = Omit<
  ApprovedPost,
  | "notes"
  | "generatedAssets"
  | "selectedVisualAssetId"
  | "selectedAssetCompositionId"
  | "visualStatus"
  | "visualApprovedAt"
  | "visualAssetRejections"
> & {
  notes?: string;
  generatedAssets?: GeneratedVisualAsset[];
  selectedVisualAssetId?: string | null;
  selectedAssetCompositionId?: string | null;
  visualStatus?: string | null;
  visualApprovedAt?: string | null;
  visualAssetRejections?: VisualAssetRejection[];
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
    selectedAssetCompositionId: "lower-panel",
    visualStatus: "typographic_only",
    visualApprovedAt: null,
    visualAssetRejections: [],
    projectSnapshot: project,
  };
}

export function parseApprovedPosts(value: unknown): ApprovedPost[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter(isApprovedPost)
    .map((post) => {
      const generatedAssets = normalizeGeneratedAssets(post.generatedAssets);
      const selectedVisualAssetId =
        typeof post.selectedVisualAssetId === "string"
          ? post.selectedVisualAssetId
          : null;
      const selectedAssetCompositionId = normalizeAssetCompositionId(
        post.selectedAssetCompositionId,
      );
      const visualAssetRejections = normalizeVisualAssetRejections(
        post.visualAssetRejections,
      );

      return {
        ...post,
        notes: post.notes || "",
        generatedAssets,
        selectedVisualAssetId,
        selectedAssetCompositionId,
        visualStatus: normalizeVisualStatus(post.visualStatus, {
          generatedAssets,
          selectedVisualAssetId,
          visualAssetRejections,
        }),
        visualApprovedAt:
          typeof post.visualApprovedAt === "string"
            ? post.visualApprovedAt
            : null,
        visualAssetRejections,
      };
    });
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
          generatedAssets: item.generatedAssets || [],
          selectedVisualAssetId: item.selectedVisualAssetId || null,
          selectedAssetCompositionId:
            item.selectedAssetCompositionId || "lower-panel",
          visualStatus: item.visualStatus || ("typographic_only" as const),
          visualApprovedAt: item.visualApprovedAt || null,
          visualAssetRejections: item.visualAssetRejections || [],
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
): ApprovedPost[] {
  return posts.map((post) => {
    if (post.id !== postId) {
      return post;
    }

    const nextAssets = [...assets, ...post.generatedAssets].slice(0, 8);

    return {
      ...post,
      generatedAssets: nextAssets,
      selectedVisualAssetId: post.selectedVisualAssetId || assets[0]?.id || null,
      visualStatus: "asset_generated",
      visualApprovedAt: null,
      updatedAt: new Date().toISOString(),
    };
  });
}

export function selectApprovedPostAsset(
  posts: ApprovedPost[],
  postId: string,
  assetId: string | null,
): ApprovedPost[] {
  return posts.map((post) =>
    post.id === postId
      ? {
          ...post,
          selectedVisualAssetId: assetId,
          visualStatus: nextVisualStatusForAssetSelection(post, assetId),
          visualApprovedAt: null,
          status: assetId ? post.status : "approved",
          updatedAt: new Date().toISOString(),
        }
      : post,
  );
}

export function selectApprovedPostAssetComposition(
  posts: ApprovedPost[],
  postId: string,
  compositionId: AssetCompositionVariantId,
): ApprovedPost[] {
  return posts.map((post) =>
    post.id === postId
      ? {
          ...post,
          selectedAssetCompositionId: compositionId,
          visualStatus:
            post.visualStatus === "visual_approved"
              ? "asset_generated"
              : post.visualStatus,
          visualApprovedAt: null,
          status:
            post.visualStatus === "visual_approved" ? "approved" : post.status,
          updatedAt: new Date().toISOString(),
        }
      : post,
  );
}

export function rejectApprovedPostAsset(
  posts: ApprovedPost[],
  postId: string,
  assetId: string,
  reasonId: VisualAssetRejectionReasonId,
): ApprovedPost[] {
  const reason = getVisualAssetRejectionReason(reasonId);

  return posts.map((post) =>
    post.id === postId
      ? {
          ...post,
          selectedVisualAssetId:
            post.selectedVisualAssetId === assetId
              ? null
              : post.selectedVisualAssetId,
          visualStatus: "asset_rejected",
          visualApprovedAt: null,
          status: "approved" as ApprovedPostStatus,
          visualAssetRejections: [
            {
              assetId,
              reasonId,
              note: reason.label,
              rejectedAt: new Date().toISOString(),
            },
            ...post.visualAssetRejections.filter(
              (rejection) => rejection.assetId !== assetId,
            ),
          ].slice(0, 24),
          updatedAt: new Date().toISOString(),
        }
      : post,
  );
}

export function restoreApprovedPostAsset(
  posts: ApprovedPost[],
  postId: string,
  assetId: string,
): ApprovedPost[] {
  return posts.map((post) => {
    if (post.id !== postId) {
      return post;
    }

    const assetExists = post.generatedAssets.some(
      (asset) => asset.id === assetId,
    );
    const visualAssetRejections = post.visualAssetRejections.filter(
      (rejection) => rejection.assetId !== assetId,
    );

    return {
      ...post,
      selectedVisualAssetId: assetExists ? assetId : post.selectedVisualAssetId,
      visualStatus: assetExists
        ? "asset_generated"
        : visualAssetRejections.length
          ? "asset_rejected"
          : nextVisualStatusForAssetSelection(post, post.selectedVisualAssetId),
      visualApprovedAt: null,
      status: assetExists ? "approved" : post.status,
      visualAssetRejections,
      updatedAt: new Date().toISOString(),
    };
  });
}

export function approveApprovedPostVisual(
  posts: ApprovedPost[],
  postId: string,
): ApprovedPost[] {
  return posts.map((post) =>
    post.id === postId && post.selectedVisualAssetId
      ? {
          ...post,
          visualStatus: "visual_approved",
          visualApprovedAt: new Date().toISOString(),
          status: "ready_to_publish" as ApprovedPostStatus,
          updatedAt: new Date().toISOString(),
        }
      : post,
  );
}

export function getVisualAssetRejectionReason(
  reasonId: VisualAssetRejectionReasonId,
) {
  return (
    visualAssetRejectionReasons.find((reason) => reason.id === reasonId) ||
    visualAssetRejectionReasons[0]
  );
}

function nextVisualStatusForAssetSelection(
  post: ApprovedPost,
  assetId: string | null,
): ApprovedPostVisualStatus {
  if (assetId) {
    return "asset_generated";
  }

  return post.generatedAssets.length ? "asset_generated" : "typographic_only";
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
    post.visualStatus,
    post.selectedAssetCompositionId,
    concept?.title,
    concept?.centralIdea,
    concept?.hook,
    selectedCaption?.caption,
    selectedCaption?.firstComment,
    selectedCaption?.hashtags.join(" "),
    post.generatedAssets.map((asset) => asset.prompt).join(" "),
    post.visualAssetRejections.map((rejection) => rejection.note).join(" "),
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
  const assetCompositionVariant = getAssetCompositionVariant(
    post.selectedAssetCompositionId,
  );
  const assetSvg = selectedAsset
    ? renderAssetCompositeSvg(
        typographicPiece,
        brand,
        selectedAsset,
        assetCompositionVariant,
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
    selectedAssetCompositionVariant: assetCompositionVariant,
    assetCompositionVariants,
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

function normalizeAssetCompositionId(
  value: unknown,
): AssetCompositionVariantId {
  const match = assetCompositionVariants.find(
    (variant) => variant.id === value,
  );

  return match?.id || "lower-panel";
}

function normalizeVisualStatus(
  value: unknown,
  context: {
    generatedAssets: GeneratedVisualAsset[];
    selectedVisualAssetId: string | null;
    visualAssetRejections: VisualAssetRejection[];
  },
): ApprovedPostVisualStatus {
  if (
    value === "typographic_only" ||
    value === "asset_generated" ||
    value === "asset_rejected" ||
    value === "visual_approved"
  ) {
    return value;
  }

  if (context.selectedVisualAssetId) {
    return "asset_generated";
  }

  if (context.visualAssetRejections.length) {
    return "asset_rejected";
  }

  if (context.generatedAssets.length) {
    return "asset_generated";
  }

  return "typographic_only";
}

function normalizeVisualAssetRejections(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(isVisualAssetRejection).slice(0, 24);
}

function isGeneratedVisualAsset(value: unknown): value is GeneratedVisualAsset {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return (
    typeof candidate.id === "string" &&
    typeof candidate.model === "string" &&
    typeof candidate.provider === "string" &&
    typeof candidate.prompt === "string" &&
    typeof candidate.mediaType === "string" &&
    typeof candidate.dataUrl === "string" &&
    typeof candidate.generatedAt === "string"
  );
}

function isVisualAssetRejection(
  value: unknown,
): value is VisualAssetRejection {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return (
    typeof candidate.assetId === "string" &&
    isVisualAssetRejectionReasonId(candidate.reasonId) &&
    typeof candidate.note === "string" &&
    typeof candidate.rejectedAt === "string"
  );
}

function isVisualAssetRejectionReasonId(
  value: unknown,
): value is VisualAssetRejectionReasonId {
  return visualAssetRejectionReasons.some((reason) => reason.id === value);
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
