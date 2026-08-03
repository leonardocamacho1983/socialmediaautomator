import type { ApprovedPost } from "../creative/approved-posts";
import type { CreativeProject } from "../creative/concepts";

export const STUDIO_PROJECTS_API_PATH = "/api/projects";

export type StudioProjectSource = "creative_project" | "approved_post";

export type StudioProjectStatus =
  | "draft"
  | "concept_selected"
  | "typographic_ready"
  | "caption_ready"
  | "approved"
  | "package_ready"
  | "exported"
  | "ready_to_publish";

export type StudioProjectSummary = {
  briefingTopic: string;
  selectedConceptTitle: string;
  objective: string;
  hasTypographicPiece: boolean;
  hasCaptionPackage: boolean;
  hasFinalPackage: boolean;
  hasVisualAsset: boolean;
  hasApprovedCarousel: boolean;
  captionPreview: string;
  updatedAt: string;
};

export type StudioProjectRecord = {
  id: string;
  title: string;
  brandName: string;
  source: StudioProjectSource;
  status: StudioProjectStatus;
  visualStatus: string | null;
  finalPackageStatus: string | null;
  carouselStatus: string | null;
  projectData: CreativeProject;
  approvedPostData: ApprovedPost | null;
  summary: StudioProjectSummary;
  createdAt: string | null;
  updatedAt: string;
  deletedAt: string | null;
};

export type StudioProjectApiResponse =
  | {
      ok: true;
      project: StudioProjectRecord;
    }
  | {
      ok: false;
      error: string;
      code?: string;
    };

export type StudioProjectListApiResponse =
  | {
      ok: true;
      projects: StudioProjectRecord[];
    }
  | {
      ok: false;
      error: string;
      code?: string;
    };

export function buildStudioProjectRecordFromProject(
  project: CreativeProject,
): StudioProjectRecord {
  const concept = getSelectedConcept(project);
  const now = project.updatedAt || new Date().toISOString();

  return {
    id: project.id,
    title: concept?.title || project.briefing.topic || "Projeto sem titulo",
    brandName: project.brandSnapshot.brandName || "Marca sem nome",
    source: "creative_project",
    status: deriveCreativeProjectStatus(project),
    visualStatus: null,
    finalPackageStatus: project.finalPostPackage ? "ready" : "open",
    carouselStatus: null,
    projectData: project,
    approvedPostData: null,
    summary: buildStudioProjectSummary(project, null),
    createdAt: null,
    updatedAt: now,
    deletedAt: null,
  };
}

export function buildStudioProjectRecordFromApprovedPost(
  post: ApprovedPost,
): StudioProjectRecord {
  return {
    id: post.id,
    title: post.title || "Post aprovado",
    brandName: post.brandName || "Marca sem nome",
    source: "approved_post",
    status: deriveApprovedPostStatus(post),
    visualStatus: post.visualStatus,
    finalPackageStatus: post.finalPackageStatus,
    carouselStatus: post.carouselStatus,
    projectData: post.projectSnapshot,
    approvedPostData: post,
    summary: buildStudioProjectSummary(post.projectSnapshot, post),
    createdAt: post.approvedAt || null,
    updatedAt: post.updatedAt || post.approvedAt || new Date().toISOString(),
    deletedAt: null,
  };
}

export function normalizeStudioProjectRecord(
  value: unknown,
): StudioProjectRecord | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as Record<string, unknown>;
  const projectData = candidate.projectData || candidate.project_data;

  if (!projectData || typeof projectData !== "object") {
    return null;
  }

  const approvedPostData =
    candidate.approvedPostData || candidate.approved_post_data || null;
  const fallbackProjectRecord = buildStudioProjectRecordFromProject(
    projectData as CreativeProject,
  );
  const fallbackApprovedRecord =
    approvedPostData && typeof approvedPostData === "object"
      ? buildStudioProjectRecordFromApprovedPost(approvedPostData as ApprovedPost)
      : null;
  const fallback = fallbackApprovedRecord || fallbackProjectRecord;

  return {
    id: safeString(candidate.id, fallback.id),
    title: safeString(candidate.title, fallback.title),
    brandName: safeString(
      candidate.brandName || candidate.brand_name,
      fallback.brandName,
    ),
    source: isStudioProjectSource(candidate.source)
      ? candidate.source
      : fallback.source,
    status: isStudioProjectStatus(candidate.status)
      ? candidate.status
      : fallback.status,
    visualStatus: nullableString(
      candidate.visualStatus || candidate.visual_status,
    ),
    finalPackageStatus: nullableString(
      candidate.finalPackageStatus || candidate.final_package_status,
    ),
    carouselStatus: nullableString(
      candidate.carouselStatus || candidate.carousel_status,
    ),
    projectData: projectData as CreativeProject,
    approvedPostData:
      approvedPostData && typeof approvedPostData === "object"
        ? (approvedPostData as ApprovedPost)
        : null,
    summary:
      candidate.summary && typeof candidate.summary === "object"
        ? (candidate.summary as StudioProjectSummary)
        : fallback.summary,
    createdAt: nullableString(candidate.createdAt || candidate.created_at),
    updatedAt: safeString(
      candidate.updatedAt || candidate.updated_at,
      fallback.updatedAt,
    ),
    deletedAt: nullableString(candidate.deletedAt || candidate.deleted_at),
  };
}

export async function fetchStudioProjectRecords() {
  const response = await fetch(STUDIO_PROJECTS_API_PATH, {
    method: "GET",
    cache: "no-store",
  });
  const payload: StudioProjectListApiResponse = await response
    .json()
    .catch(() => ({
      ok: false,
      error: "Resposta invalida da biblioteca persistida.",
    }));

  if (!response.ok || !payload.ok) {
    throw new Error(payload.ok ? "Falha ao carregar biblioteca." : payload.error);
  }

  return payload.projects;
}

export async function fetchStudioProjectRecord(projectId: string) {
  const response = await fetch(
    `${STUDIO_PROJECTS_API_PATH}/${encodeURIComponent(projectId)}`,
    {
      method: "GET",
      cache: "no-store",
    },
  );
  const payload: StudioProjectApiResponse = await response.json().catch(() => ({
    ok: false,
    error: "Resposta invalida do projeto persistido.",
  }));

  if (!response.ok || !payload.ok) {
    throw new Error(payload.ok ? "Falha ao carregar projeto." : payload.error);
  }

  return payload.project;
}

export async function syncStudioProjectRecord(record: StudioProjectRecord) {
  const response = await fetch(STUDIO_PROJECTS_API_PATH, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ project: record }),
  });
  const payload: StudioProjectApiResponse = await response.json().catch(() => ({
    ok: false,
    error: "Resposta invalida ao sincronizar projeto.",
  }));

  if (!response.ok || !payload.ok) {
    throw new Error(payload.ok ? "Falha ao sincronizar projeto." : payload.error);
  }

  return payload.project;
}

export async function deleteStudioProjectRecord(projectId: string) {
  const response = await fetch(
    `${STUDIO_PROJECTS_API_PATH}/${encodeURIComponent(projectId)}`,
    {
      method: "DELETE",
    },
  );
  const payload: { ok: boolean; error?: string } = await response
    .json()
    .catch(() => ({
      ok: false,
      error: "Resposta invalida ao remover projeto.",
    }));

  if (!response.ok || !payload.ok) {
    throw new Error(payload.error || "Falha ao remover projeto.");
  }
}

function buildStudioProjectSummary(
  project: CreativeProject,
  approvedPost: ApprovedPost | null,
): StudioProjectSummary {
  const concept = getSelectedConcept(project);
  const captionVariant = project.captionPackage?.variants.find(
    (variant) => variant.id === project.captionPackage?.selectedVariantId,
  );

  return {
    briefingTopic: project.briefing.topic,
    selectedConceptTitle: concept?.title || "",
    objective: project.briefing.objective,
    hasTypographicPiece: Boolean(project.typographicPiece),
    hasCaptionPackage: Boolean(project.captionPackage),
    hasFinalPackage: Boolean(project.finalPostPackage),
    hasVisualAsset: Boolean(approvedPost?.selectedVisualAssetId),
    hasApprovedCarousel: approvedPost?.carouselStatus === "approved",
    captionPreview: captionVariant?.caption.slice(0, 220) || "",
    updatedAt:
      approvedPost?.updatedAt || project.updatedAt || new Date().toISOString(),
  };
}

function deriveCreativeProjectStatus(
  project: CreativeProject,
): StudioProjectStatus {
  if (project.finalPostPackage) {
    return "approved";
  }

  if (project.captionPackage) {
    return "caption_ready";
  }

  if (project.typographicPiece) {
    return "typographic_ready";
  }

  if (project.selectedConceptId) {
    return "concept_selected";
  }

  return "draft";
}

function deriveApprovedPostStatus(post: ApprovedPost): StudioProjectStatus {
  if (post.status === "ready_to_publish") {
    return "ready_to_publish";
  }

  if (post.status === "exported") {
    return "exported";
  }

  if (post.finalPackageStatus === "ready") {
    return "package_ready";
  }

  return "approved";
}

function getSelectedConcept(project: CreativeProject) {
  return (
    project.batch.concepts.find(
      (concept) => concept.id === project.selectedConceptId,
    ) || project.batch.concepts[0] || null
  );
}

function isStudioProjectSource(value: unknown): value is StudioProjectSource {
  return value === "creative_project" || value === "approved_post";
}

function isStudioProjectStatus(value: unknown): value is StudioProjectStatus {
  return (
    value === "draft" ||
    value === "concept_selected" ||
    value === "typographic_ready" ||
    value === "caption_ready" ||
    value === "approved" ||
    value === "package_ready" ||
    value === "exported" ||
    value === "ready_to_publish"
  );
}

function safeString(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function nullableString(value: unknown) {
  return typeof value === "string" ? value : null;
}
