"use client";

/* eslint-disable @next/next/no-img-element -- approved post cards use local SVG previews generated in the browser */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  BRAND_PROFILE_STORAGE_KEY,
  type BrandProfile,
} from "../../lib/brand/profile";
import {
  APPROVED_POSTS_STORAGE_KEY,
  buildApprovedPostText,
  createDuplicateProjectFromApprovedPost,
  getApprovedPostBrand,
  getApprovedPostCaptionPackage,
  getApprovedPostConcept,
  getApprovedPostTypographicPiece,
  parseApprovedPosts,
  updateApprovedPostStatus,
  type ApprovedPost,
  type ApprovedPostStatus,
} from "../../lib/creative/approved-posts";
import { CREATIVE_PROJECT_STORAGE_KEY } from "../../lib/creative/concepts";
import { getSelectedCaptionVariant } from "../../lib/creative/captions";
import {
  getSelectedTypographicVariant,
  renderTypographicSvg,
  svgToDataUrl,
} from "../../lib/creative/typographic-piece";
import { downloadSvgAsPng, slugify } from "../create/export-utils";

const statusLabels: Record<ApprovedPostStatus, string> = {
  approved: "Aprovado",
  exported: "Exportado",
  ready_to_publish: "Pronto para publicar",
};

export function ApprovedPostLibrary() {
  const router = useRouter();
  const [posts, setPosts] = useState<ApprovedPost[]>([]);
  const [status, setStatus] = useState("");

  useEffect(() => {
    // The library is stored in browser-only localStorage.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPosts(readApprovedPosts());
  }, []);

  const sortedPosts = useMemo(
    () =>
      [...posts].sort(
        (a, b) =>
          new Date(b.approvedAt).getTime() - new Date(a.approvedAt).getTime(),
      ),
    [posts],
  );

  function persistPosts(nextPosts: ApprovedPost[]) {
    setPosts(nextPosts);
    window.localStorage.setItem(
      APPROVED_POSTS_STORAGE_KEY,
      JSON.stringify(nextPosts),
    );
  }

  function updateStatus(postId: string, nextStatus: ApprovedPostStatus) {
    persistPosts(updateApprovedPostStatus(posts, postId, nextStatus));
  }

  function openPost(post: ApprovedPost) {
    saveProjectSnapshot(
      post.projectSnapshot.brandSnapshot,
      post.projectSnapshot,
    );
    router.push("/create#final-post-package");
  }

  function duplicatePost(post: ApprovedPost) {
    const duplicateProject = createDuplicateProjectFromApprovedPost(post);
    saveProjectSnapshot(duplicateProject.brandSnapshot, duplicateProject);
    router.push("/create#typographic-piece");
  }

  async function copyText(value: string, successMessage: string) {
    try {
      await navigator.clipboard.writeText(value);
      setStatus(successMessage);
      window.setTimeout(() => setStatus(""), 2400);
    } catch {
      setStatus("Nao foi possivel copiar automaticamente.");
    }
  }

  async function downloadPost(post: ApprovedPost) {
    const view = buildApprovedPostView(post);

    if (!view) {
      setStatus("Post aprovado incompleto.");
      return;
    }

    setStatus("Gerando PNG...");

    try {
      await downloadSvgAsPng(
        view.svg,
        `${slugify(post.brandName || "social-studio")}-${slugify(post.title)}.png`,
      );
      updateStatus(post.id, "exported");
      setStatus("PNG exportado.");
      window.setTimeout(() => setStatus(""), 2600);
    } catch {
      setStatus("Nao foi possivel baixar o PNG.");
    }
  }

  return (
    <main className="brand-shell approved-shell">
      <header className="brand-header">
        <div className="nav-row">
          <Link className="text-link" href="/">
            Inicio
          </Link>
          <Link className="text-link" href="/brand">
            Brand Foundation
          </Link>
          <Link className="text-link" href="/create">
            Criar post
          </Link>
        </div>
        <div>
          <p className="eyebrow">Marco 3.3</p>
          <h1>Posts aprovados</h1>
          <p className="lead">
            Biblioteca local dos pacotes finais aprovados. Ainda sem Zernio,
            calendario, publicacao ou automacao.
          </p>
        </div>
      </header>

      <section className="approved-toolbar" aria-label="Acoes da biblioteca">
        <div>
          <strong>{sortedPosts.length}</strong>
          <span>
            {sortedPosts.length === 1 ? "post aprovado" : "posts aprovados"}
          </span>
        </div>
        <Link className="primary-button" href="/create">
          Criar novo post
        </Link>
        {status ? (
          <span className="next-step-status" role="status">
            {status}
          </span>
        ) : null}
      </section>

      {sortedPosts.length ? (
        <section className="approved-post-grid" aria-label="Posts aprovados">
          {sortedPosts.map((post) => {
            const view = buildApprovedPostView(post);

            return (
              <article className="approved-post-card" key={post.id}>
                {view ? (
                  <img
                    alt={`Preview aprovado de ${post.title}`}
                    className="approved-post-image"
                    height={1350}
                    src={view.dataUrl}
                    width={1080}
                  />
                ) : (
                  <div className="approved-post-missing">
                    Preview indisponivel
                  </div>
                )}

                <div className="approved-post-body">
                  <div className="approved-post-heading">
                    <span
                      className={`approved-status approved-status-${post.status}`}
                    >
                      {statusLabels[post.status]}
                    </span>
                    <strong>{post.title}</strong>
                    <small>
                      {post.brandName} -{" "}
                      {new Date(post.approvedAt).toLocaleString("pt-BR")}
                    </small>
                  </div>

                  {view ? (
                    <div className="approved-post-copy">
                      <p>{view.caption}</p>
                      {view.hashtags ? <span>{view.hashtags}</span> : null}
                      {view.firstComment ? (
                        <small>Comentario: {view.firstComment}</small>
                      ) : null}
                    </div>
                  ) : (
                    <p className="approved-post-copy">
                      Este snapshot esta incompleto.
                    </p>
                  )}

                  <div className="approved-post-actions">
                    <button
                      className="primary-button"
                      type="button"
                      onClick={() => openPost(post)}
                    >
                      Abrir
                    </button>
                    <button
                      className="secondary-button"
                      type="button"
                      onClick={() => duplicatePost(post)}
                    >
                      Duplicar
                    </button>
                    <button
                      className="secondary-button"
                      type="button"
                      onClick={() => downloadPost(post)}
                    >
                      Baixar PNG
                    </button>
                    <button
                      className="secondary-button"
                      type="button"
                      onClick={() =>
                        copyText(view?.caption || "", "Legenda copiada.")
                      }
                      disabled={!view?.caption}
                    >
                      Copiar legenda
                    </button>
                    <button
                      className="secondary-button"
                      type="button"
                      onClick={() =>
                        copyText(
                          view?.firstComment || "",
                          "Primeiro comentario copiado.",
                        )
                      }
                      disabled={!view?.firstComment}
                    >
                      Copiar comentario
                    </button>
                    <button
                      className="secondary-button"
                      type="button"
                      onClick={() =>
                        copyText(buildApprovedPostText(post), "Pacote copiado.")
                      }
                    >
                      Copiar pacote
                    </button>
                    <button
                      className="secondary-button"
                      type="button"
                      onClick={() => updateStatus(post.id, "ready_to_publish")}
                    >
                      Marcar pronto
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </section>
      ) : (
        <section className="approved-empty">
          <strong>Nenhum post aprovado ainda.</strong>
          <p>
            Aprove um pacote final em `/create` para ele aparecer aqui com PNG,
            legenda, primeiro comentario e acoes de exportacao.
          </p>
          <Link className="primary-button" href="/create">
            Criar primeiro post
          </Link>
        </section>
      )}
    </main>
  );
}

function readApprovedPosts() {
  try {
    const storedPosts = window.localStorage.getItem(APPROVED_POSTS_STORAGE_KEY);
    return parseApprovedPosts(storedPosts ? JSON.parse(storedPosts) : []);
  } catch {
    return [];
  }
}

function saveProjectSnapshot(
  brandProfile: BrandProfile,
  projectSnapshot: ApprovedPost["projectSnapshot"],
) {
  window.localStorage.setItem(
    BRAND_PROFILE_STORAGE_KEY,
    JSON.stringify(brandProfile),
  );
  window.localStorage.setItem(
    CREATIVE_PROJECT_STORAGE_KEY,
    JSON.stringify(projectSnapshot),
  );
}

function buildApprovedPostView(post: ApprovedPost) {
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

  return {
    svg,
    dataUrl: svgToDataUrl(svg),
    caption: captionVariant.caption,
    firstComment: captionVariant.firstComment,
    hashtags: captionVariant.hashtags.join(" "),
  };
}
