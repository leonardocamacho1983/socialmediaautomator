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
  buildApprovedPostSearchText,
  buildApprovedPostView,
  buildApprovedPostText,
  createDuplicateProjectFromApprovedPost,
  parseApprovedPosts,
  updateApprovedPostStatus,
  type ApprovedPost,
  type ApprovedPostStatus,
} from "../../lib/creative/approved-posts";
import { CREATIVE_PROJECT_STORAGE_KEY } from "../../lib/creative/concepts";
import { downloadSvgAsPng, slugify } from "../create/export-utils";

const statusLabels: Record<ApprovedPostStatus, string> = {
  approved: "Aprovado",
  exported: "Exportado",
  ready_to_publish: "Pronto para publicar",
};

type ApprovedPostFilter = ApprovedPostStatus | "all";

const filterLabels: Record<ApprovedPostFilter, string> = {
  all: "Todos",
  ...statusLabels,
};

export function ApprovedPostLibrary() {
  const router = useRouter();
  const [posts, setPosts] = useState<ApprovedPost[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<ApprovedPostFilter>("all");
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
  const statusCounts = useMemo(() => countPostsByStatus(posts), [posts]);
  const normalizedSearchTerm = normalizeSearchText(searchTerm);
  const visiblePosts = useMemo(
    () =>
      sortedPosts.filter((post) => {
        const matchesStatus =
          statusFilter === "all" || post.status === statusFilter;

        if (!matchesStatus) {
          return false;
        }

        if (!normalizedSearchTerm) {
          return true;
        }

        return normalizeSearchText(buildApprovedPostSearchText(post)).includes(
          normalizedSearchTerm,
        );
      }),
    [normalizedSearchTerm, sortedPosts, statusFilter],
  );
  const hasActiveFilters = Boolean(searchTerm.trim()) || statusFilter !== "all";

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
          <p className="eyebrow">Marco 3.5</p>
          <h1>Posts aprovados</h1>
          <p className="lead">
            Cockpit local dos pacotes finais aprovados. Ainda sem Zernio,
            calendario, publicacao, banco de dados ou automacao.
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

      <section className="approved-cockpit" aria-label="Resumo dos aprovados">
        <button
          className={
            statusFilter === "all"
              ? "approved-metric approved-metric-active"
              : "approved-metric"
          }
          type="button"
          onClick={() => setStatusFilter("all")}
        >
          <span>{filterLabels.all}</span>
          <strong>{posts.length}</strong>
        </button>
        <button
          className={
            statusFilter === "approved"
              ? "approved-metric approved-metric-active"
              : "approved-metric"
          }
          type="button"
          onClick={() => setStatusFilter("approved")}
        >
          <span>{filterLabels.approved}</span>
          <strong>{statusCounts.approved}</strong>
        </button>
        <button
          className={
            statusFilter === "exported"
              ? "approved-metric approved-metric-active"
              : "approved-metric"
          }
          type="button"
          onClick={() => setStatusFilter("exported")}
        >
          <span>{filterLabels.exported}</span>
          <strong>{statusCounts.exported}</strong>
        </button>
        <button
          className={
            statusFilter === "ready_to_publish"
              ? "approved-metric approved-metric-active"
              : "approved-metric"
          }
          type="button"
          onClick={() => setStatusFilter("ready_to_publish")}
        >
          <span>{filterLabels.ready_to_publish}</span>
          <strong>{statusCounts.ready_to_publish}</strong>
        </button>
      </section>

      <section className="approved-filter-panel" aria-label="Filtros">
        <label className="field approved-search-field">
          <span>Busca</span>
          <input
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Buscar por titulo, marca, legenda, hashtag ou nota"
          />
        </label>
        <label className="field approved-status-field">
          <span>Status</span>
          <select
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(event.target.value as ApprovedPostFilter)
            }
          >
            <option value="all">Todos</option>
            <option value="approved">Aprovado</option>
            <option value="exported">Exportado</option>
            <option value="ready_to_publish">Pronto para publicar</option>
          </select>
        </label>
        <div className="approved-filter-summary">
          <strong>
            {visiblePosts.length} de {posts.length}
          </strong>
          <span>
            {visiblePosts.length === 1
              ? "post visivel"
              : "posts visiveis"}
          </span>
        </div>
        {hasActiveFilters ? (
          <button
            className="secondary-button"
            type="button"
            onClick={() => {
              setSearchTerm("");
              setStatusFilter("all");
            }}
          >
            Limpar filtros
          </button>
        ) : null}
      </section>

      {visiblePosts.length ? (
        <section className="approved-post-grid" aria-label="Posts aprovados">
          {visiblePosts.map((post) => {
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
                    <Link
                      className="primary-button"
                      href={`/approved/${encodeURIComponent(post.id)}`}
                    >
                      Detalhes
                    </Link>
                    <button
                      className="secondary-button"
                      type="button"
                      onClick={() => openPost(post)}
                    >
                      Editar no fluxo
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
      ) : posts.length ? (
        <section className="approved-empty">
          <strong>Nenhum post encontrado.</strong>
          <p>
            Ajuste a busca ou limpe os filtros para voltar a ver todos os
            aprovados.
          </p>
          <button
            className="primary-button"
            type="button"
            onClick={() => {
              setSearchTerm("");
              setStatusFilter("all");
            }}
          >
            Limpar filtros
          </button>
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

function countPostsByStatus(posts: ApprovedPost[]) {
  return posts.reduce(
    (counts, post) => ({
      ...counts,
      [post.status]: counts[post.status] + 1,
    }),
    {
      approved: 0,
      exported: 0,
      ready_to_publish: 0,
    } satisfies Record<ApprovedPostStatus, number>,
  );
}

function normalizeSearchText(value: string) {
  return value
    .toLocaleLowerCase("pt-BR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}
