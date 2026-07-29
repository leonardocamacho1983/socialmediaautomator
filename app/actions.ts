"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  clearAdminSession,
  requireAdminAction,
  setAdminSession,
  verifyAdminPassword,
} from "@/lib/auth";
import {
  buildBrandKnowledge,
  createBrandReference,
  deleteBrandAsset,
  deleteBrandReference,
  generateContentIdeas,
  generateEditorialPlan,
  updateContentIdeaStatus,
  uploadBrandAsset,
} from "@/lib/editorial-store";
import { compactErrorForUrl, getFormString, parseCreatePostPayload } from "@/lib/forms";
import {
  createPost,
  deletePost,
  getReadableZernioError,
  updatePost,
} from "@/lib/zernio";

function redirectWithResult(kind: "notice" | "error", value: string) {
  redirect(`/?${kind}=${compactErrorForUrl(value)}`);
}

export async function loginAction(formData: FormData) {
  const password = getFormString(formData, "password");

  if (!verifyAdminPassword(password)) {
    redirect("/login?error=1");
  }

  await setAdminSession();
  redirect("/");
}

export async function logoutAction() {
  await clearAdminSession();
  redirect("/login");
}

export async function createPostAction(formData: FormData) {
  await requireAdminAction();

  const intent = getFormString(formData, "intent");
  const payload = parseCreatePostPayload(formData);

  if (intent === "draft") {
    payload.isDraft = true;
  } else if (intent === "publish") {
    payload.publishNow = true;
    payload.isDraft = false;
  } else if (intent === "schedule") {
    payload.isDraft = false;

    if (!payload.scheduledFor) {
      redirectWithResult("error", "Informe uma data/hora para agendar.");
    }
  } else {
    redirectWithResult("error", "Ação inválida.");
  }

  try {
    await createPost(payload);
  } catch (error) {
    redirectWithResult("error", getReadableZernioError(error));
  }

  revalidatePath("/");
  redirectWithResult(
    "notice",
    intent === "draft"
      ? "Rascunho salvo na Zernio."
      : intent === "schedule"
        ? "Post aprovado e agendado na Zernio."
        : "Post enviado para publicação pela Zernio.",
  );
}

export async function updateExistingPostAction(formData: FormData) {
  await requireAdminAction();

  const postId = getFormString(formData, "postId");
  const intent = getFormString(formData, "intent");
  const scheduledFor = getFormString(formData, "scheduledFor");
  const timezone = getFormString(formData, "timezone") || "America/Sao_Paulo";

  if (!postId) {
    redirectWithResult("error", "Post ID ausente.");
  }

  try {
    if (intent === "delete") {
      await deletePost(postId);
    } else if (intent === "publish") {
      await updatePost(postId, {
        publishNow: true,
        isDraft: false,
        timezone,
      });
    } else if (intent === "schedule") {
      if (!scheduledFor) {
        redirectWithResult("error", "Informe uma data/hora para agendar.");
      }

      await updatePost(postId, {
        scheduledFor,
        isDraft: false,
        timezone,
      });
    } else {
      redirectWithResult("error", "Ação inválida.");
    }
  } catch (error) {
    redirectWithResult("error", getReadableZernioError(error));
  }

  revalidatePath("/");
  redirectWithResult(
    "notice",
    intent === "delete"
      ? "Post removido."
      : intent === "schedule"
        ? "Post aprovado e agendado."
        : "Post enviado para publicação.",
  );
}

export async function generateEditorialPlanAction(formData: FormData) {
  await requireAdminAction();

  const postsCount = Math.max(
    1,
    Math.min(14, Number(getFormString(formData, "postsCount") || 6)),
  );

  try {
    const result = await generateEditorialPlan({
      businessName: getFormString(formData, "businessName"),
      businessIdea: getFormString(formData, "businessIdea"),
      valueProposition: getFormString(formData, "valueProposition"),
      productScope: getFormString(formData, "productScope"),
      targetAudience: getFormString(formData, "targetAudience"),
      personas: getFormString(formData, "personas"),
      painsAndRemedies: getFormString(formData, "painsAndRemedies"),
      designSystem: getFormString(formData, "designSystem"),
      toneOfVoice: getFormString(formData, "toneOfVoice"),
      postsCount,
      startDate: getFormString(formData, "startDate"),
    });

    revalidatePath("/");
    redirectWithResult(
      "notice",
      `${result.generated} drafts gerados e salvos no Supabase usando ${result.provider}.`,
    );
  } catch (error) {
    redirectWithResult(
      "error",
      error instanceof Error
        ? error.message
        : "Erro ao gerar calendário editorial.",
    );
  }
}

export async function generateContentIdeasAction(formData: FormData) {
  await requireAdminAction();

  const ideasCount = Math.max(
    3,
    Math.min(30, Number(getFormString(formData, "ideasCount") || 12)),
  );

  try {
    const result = await generateContentIdeas({
      businessName: getFormString(formData, "businessName"),
      businessIdea: getFormString(formData, "businessIdea"),
      valueProposition: getFormString(formData, "valueProposition"),
      targetAudience: getFormString(formData, "targetAudience"),
      toneOfVoice: getFormString(formData, "toneOfVoice"),
      ideasCount,
    });

    revalidatePath("/");
    redirectWithResult(
      "notice",
      `${result.generated} ideias geradas usando ${result.provider}. Revise antes de transformar em posts.`,
    );
  } catch (error) {
    redirectWithResult(
      "error",
      error instanceof Error ? error.message : "Erro ao gerar ideias.",
    );
  }
}

export async function updateContentIdeaStatusAction(formData: FormData) {
  await requireAdminAction();

  const intent = getFormString(formData, "intent");
  const status =
    intent === "approve"
      ? "approved"
      : intent === "reject"
        ? "rejected"
        : "archived";

  try {
    await updateContentIdeaStatus({
      ideaId: getFormString(formData, "ideaId"),
      status,
    });

    revalidatePath("/");
    redirectWithResult(
      "notice",
      status === "approved" ? "Ideia aprovada." : "Ideia descartada.",
    );
  } catch (error) {
    redirectWithResult(
      "error",
      error instanceof Error ? error.message : "Erro ao atualizar ideia.",
    );
  }
}

export async function uploadBrandAssetAction(formData: FormData) {
  await requireAdminAction();

  const file = formData.get("file");

  if (!(file instanceof File)) {
    throw new Error("Arquivo ausente.");
  }

  try {
    const result = await uploadBrandAsset({
      file,
      type: getFormString(formData, "type"),
      title: getFormString(formData, "title") || file.name,
      description: getFormString(formData, "description"),
      tags: getFormString(formData, "tags")
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
      usageNotes: getFormString(formData, "usageNotes"),
    });

    revalidatePath("/");
    redirectWithResult(
      "notice",
      result.isZipImport
        ? `${result.extractedCount} arquivos extraídos do ZIP e salvos como assets.${result.skippedCount ? ` ${result.skippedCount} ignorados por formato/tamanho.` : ""}`
        : "Asset da marca salvo.",
    );
  } catch (error) {
    redirectWithResult(
      "error",
      error instanceof Error ? error.message : "Erro ao subir asset da marca.",
    );
  }
}

export async function createBrandReferenceAction(formData: FormData) {
  await requireAdminAction();

  try {
    await createBrandReference({
      type: getFormString(formData, "type"),
      title: getFormString(formData, "title"),
      url: getFormString(formData, "url"),
      description: getFormString(formData, "description"),
      tags: getFormString(formData, "tags")
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
      usageNotes: getFormString(formData, "usageNotes"),
    });

    revalidatePath("/");
    redirectWithResult("notice", "Referência da marca salva.");
  } catch (error) {
    redirectWithResult(
      "error",
      error instanceof Error
        ? error.message
        : "Erro ao salvar referência da marca.",
    );
  }
}

export async function buildBrandKnowledgeAction() {
  await requireAdminAction();

  try {
    const result = await buildBrandKnowledge();

    revalidatePath("/");
    redirectWithResult(
      "notice",
      `Marca analisada: ${result.assets} assets, ${result.references} links e ${result.colors} cores prováveis.`,
    );
  } catch (error) {
    redirectWithResult(
      "error",
      error instanceof Error ? error.message : "Erro ao analisar marca.",
    );
  }
}

export async function deleteBrandAssetAction(formData: FormData) {
  await requireAdminAction();

  try {
    await deleteBrandAsset(getFormString(formData, "assetId"));

    revalidatePath("/");
    redirectWithResult("notice", "Asset da marca deletado.");
  } catch (error) {
    redirectWithResult(
      "error",
      error instanceof Error ? error.message : "Erro ao deletar asset.",
    );
  }
}

export async function deleteBrandReferenceAction(formData: FormData) {
  await requireAdminAction();

  try {
    await deleteBrandReference(getFormString(formData, "referenceId"));

    revalidatePath("/");
    redirectWithResult("notice", "Referência deletada.");
  } catch (error) {
    redirectWithResult(
      "error",
      error instanceof Error ? error.message : "Erro ao deletar referência.",
    );
  }
}
