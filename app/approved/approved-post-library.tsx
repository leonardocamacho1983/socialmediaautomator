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
  type ApprovedPostFinalPackageStatus,
  type ApprovedPostStatus,
  type ApprovedPostVisualStatus,
} from "../../lib/creative/approved-posts";
import { CREATIVE_PROJECT_STORAGE_KEY } from "../../lib/creative/concepts";
import {
  buildStudioProjectRecordFromApprovedPost,
  fetchStudioProjectRecords,
  syncStudioProjectRecord,
} from "../../lib/persistence/studio-projects";
import { downloadSvgAsPng, slugify } from "../create/export-utils";

const statusLabels: Record<ApprovedPostStatus, string> = {
  approved: "Aprovado",
  exported: "Exportado",
  ready_to_publish: "Pronto para publicar",
};

const visualStatusLabels: Record<ApprovedPostVisualStatus, string> = {
  typographic_only: "So tipografico",
  asset_generated: "Com asset gerado",
  asset_rejected: "Asset rejeitado",
  visual_approved: "Visual aprovado",
};

const finalPackageStatusLabels: Record<ApprovedPostFinalPackageStatus, string> =
  {
    open: "Pacote em aberto",
    ready: "Pacote pronto",
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
  const [persistenceStatus, setPersistenceStatus] = useState(
    "Carregando biblioteca local.",
  );

  useEffect(() => {
    const localPosts = readApprovedPosts();
    // The library hydrates from browser storage first and then merges database records.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPosts(localPosts);
    setPersistenceStatus("Carregando projetos do banco...");

    void fetchStudioProjectRecords()
      .then((records) => {
        const persistedPosts = records
          .map((record) => record.approvedPostData)
          .filter((post): post is ApprovedPost => Boolean(post));
        const mergedPosts = mergeApprovedPosts(localPosts, persistedPosts);

        setPosts(mergedPosts);
        window.localStorage.setItem(
          APPROVED_POSTS_STORAGE_KEY,
          JSON.stringify(mergedPosts),
        );
        setPersistenceStatus("Biblioteca sincronizada com o banco.");
      })
      .catch(() => {
        setPersistenceStatus(
          "Usando biblioteca do navegador. Banco indisponivel ou nao configurado.",
        );
      });
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
  const visualStatusCounts = useMemo(
    () => countPostsByVisualStatus(posts),
    [posts],
  );
  const readyPackageCount = useMemo(
    () => posts.filter((post) => post.finalPackageStatus === "ready").length,
    [posts],
  );
  const carouselCount = useMemo(
    () => posts.filter((post) => post.carouselPackage).length,
    [posts],
  );
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
    void Promise.all(
      nextPosts.map((post) =>
        syncStudioProjectRecord(buildStudioProjectRecordFromApprovedPost(post)),
      ),
    )
      .then(() => {
        setPersistenceStatus("Biblioteca sincronizada com o banco.");
      })
      .catch(() => {
        setPersistenceStatus(
          "Alteracao salva no navegador. Banco indisponivel ou nao configurado.",
        );
      });
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
      const exportSvg = view.assetSvg || view.svg;
      const assetSuffix = view.selectedAsset ? "-com-asset" : "";
      await downloadSvgAsPng(
        exportSvg,
        `${slugify(post.brandName || "social-studio")}-${slugify(post.title)}${assetSuffix}.png`,
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
          <Link className="text-link" href="/projects">
            Projetos
          </Link>
        </div>
        <div>
          <p className="eyebrow">Marco 5</p>
          <h1>Posts aprovados</h1>
          <p className="lead">
            Cockpit local dos pacotes finais aprovados, agora com status visual,
            pacotes prontos para exportacao e carrossel deterministico. Ainda
            sem Zernio, calendario, publicacao ou automacao.
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
        <Link className="secondary-button" href="/projects">
          Biblioteca persistida
        </Link>
        {status ? (
          <span className="next-step-status" role="status">
            {status}
          </span>
        ) : null}
        <span className="next-step-status" role="status">
          {persistenceStatus}
        </span>
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

      <section
        className="approved-visual-cockpit"
        aria-label="Resumo visual dos aprovados"
      >
        <div className="approved-visual-metric">
          <span>{visualStatusLabels.typographic_only}</span>
          <strong>{visualStatusCounts.typographic_only}</strong>
        </div>
        <div className="approved-visual-metric">
          <span>{visualStatusLabels.asset_generated}</span>
          <strong>{visualStatusCounts.asset_generated}</strong>
        </div>
        <div className="approved-visual-metric">
          <span>{visualStatusLabels.asset_rejected}</span>
          <strong>{visualStatusCounts.asset_rejected}</strong>
        </div>
        <div className="approved-visual-metric">
          <span>{visualStatusLabels.visual_approved}</span>
          <strong>{visualStatusCounts.visual_approved}</strong>
        </div>
        <div className="approved-visual-metric">
          <span>{finalPackageStatusLabels.ready}</span>
          <strong>{readyPackageCount}</strong>
        </div>
        <div className="approved-visual-metric">
          <span>Com carrossel</span>
          <strong>{carouselCount}</strong>
        </div>
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
                    src={view.assetDataUrl || view.dataUrl}
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
                    <span
                      className={`visual-status visual-status-${post.visualStatus}`}
                    >
                      {visualStatusLabels[post.visualStatus]}
                    </span>
                    <span
                      className={`package-status package-status-${post.finalPackageStatus}`}
                    >
                      {finalPackageStatusLabels[post.finalPackageStatus]}
                    </span>
                    {post.carouselPackage ? (
                      <span className="carousel-status carousel-status-ready">
                        Carrossel
                      </span>
                    ) : null}
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

function mergeApprovedPosts(localPosts: ApprovedPost[], persistedPosts: ApprovedPost[]) {
  const postsById = new Map<string, ApprovedPost>();

  for (const post of [...persistedPosts, ...localPosts]) {
    const current = postsById.get(post.id);

    if (!current || getPostTime(post) >= getPostTime(current)) {
      postsById.set(post.id, post);
    }
  }

  return [...postsById.values()].sort(
    (a, b) => getPostTime(b) - getPostTime(a),
  );
}

function getPostTime(post: ApprovedPost) {
  return new Date(post.updatedAt || post.approvedAt).getTime();
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

function countPostsByVisualStatus(posts: ApprovedPost[]) {
  return posts.reduce(
    (counts, post) => ({
      ...counts,
      [post.visualStatus]: counts[post.visualStatus] + 1,
    }),
    {
      typographic_only: 0,
      asset_generated: 0,
      asset_rejected: 0,
      visual_approved: 0,
    } satisfies Record<ApprovedPostVisualStatus, number>,
  );
}

function normalizeSearchText(value: string) {
  return value
    .toLocaleLowerCase("pt-BR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}
