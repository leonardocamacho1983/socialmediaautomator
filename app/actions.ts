"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  clearAdminSession,
  requireAdminAction,
  setAdminSession,
  verifyAdminPassword,
} from "@/lib/auth";
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
