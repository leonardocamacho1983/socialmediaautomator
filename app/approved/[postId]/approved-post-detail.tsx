"use client";

/* eslint-disable @next/next/no-img-element -- approved post details use local SVG previews generated in the browser */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  BRAND_PROFILE_STORAGE_KEY,
  type BrandProfile,
} from "../../../lib/brand/profile";
import {
  APPROVED_POSTS_STORAGE_KEY,
  buildApprovedPostText,
  buildApprovedPostView,
  createDuplicateProjectFromApprovedPost,
  parseApprovedPosts,
  updateApprovedPostNotes,
  updateApprovedPostStatus,
  type ApprovedPost,
  type ApprovedPostStatus,
} from "../../../lib/creative/approved-posts";
import { CREATIVE_PROJECT_STORAGE_KEY } from "../../../lib/creative/concepts";
import { downloadSvgAsPng, slugify } from "../../create/export-utils";

type ApprovedPostDetailProps = {
  postId: string;
};

const statusLabels: Record<ApprovedPostStatus, string> = {
  approved: "Aprovado",
  exported: "Exportado",
  ready_to_publish: "Pronto para publicar",
};

export function ApprovedPostDetail({ postId }: ApprovedPostDetailProps) {
  const router = useRouter();
  const notesRef = useRef<HTMLTextAreaElement>(null);
  const [posts, setPosts] = useState<ApprovedPost[]>([]);
  const [status, setStatus] = useState("");

  useEffect(() => {
    // The approved post library is stored in browser-only localStorage.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPosts(readApprovedPosts());
  }, []);

  const post = useMemo(
    () => posts.find((item) => item.id === postId) || null,
    [postId, posts],
  );
  const view = post ? buildApprovedPostView(post) : null;
  const finalChecklist = post?.projectSnapshot.finalPostPackage?.checklist || [];

  function persistPosts(nextPosts: ApprovedPost[]) {
    setPosts(nextPosts);
    window.localStorage.setItem(
      APPROVED_POSTS_STORAGE_KEY,
      JSON.stringify(nextPosts),
    );
  }

  function updateStatus(nextStatus: ApprovedPostStatus) {
    persistPosts(updateApprovedPostStatus(posts, postId, nextStatus));
    setStatus(`Status atualizado: ${statusLabels[nextStatus]}.`);
    window.setTimeout(() => setStatus(""), 2400);
  }

  function saveNotes() {
    const notes = notesRef.current?.value.trim() || "";
    persistPosts(updateApprovedPostNotes(posts, postId, notes));
    setStatus("Notas salvas.");
    window.setTimeout(() => setStatus(""), 2400);
  }

  function openPost() {
    if (!post) {
      return;
    }

    saveProjectSnapshot(
      post.projectSnapshot.brandSnapshot,
      post.projectSnapshot,
    );
    router.push("/create#final-post-package");
  }

  function duplicatePost() {
    if (!post) {
      return;
    }

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

  async function downloadPost() {
    if (!post || !view) {
      setStatus("Post aprovado incompleto.");
      return;
    }

    setStatus("Gerando PNG...");

    try {
      await downloadSvgAsPng(
        view.svg,
        `${slugify(post.brandName || "social-studio")}-${slugify(post.title)}.png`,
      );
      persistPosts(updateApprovedPostStatus(posts, post.id, "exported"));
      setStatus("PNG exportado.");
      window.setTimeout(() => setStatus(""), 2600);
    } catch {
      setStatus("Nao foi possivel baixar o PNG.");
    }
  }

  if (!post) {
    return (
      <main className="brand-shell approved-detail-shell">
        <header className="brand-header">
          <div className="nav-row">
            <Link className="text-link" href="/">
              Inicio
            </Link>
            <Link className="text-link" href="/approved">
              Posts aprovados
            </Link>
            <Link className="text-link" href="/create">
              Criar post
            </Link>
          </div>
          <div>
            <p className="eyebrow">Marco 3.4</p>
            <h1>Post nao encontrado</h1>
            <p className="lead">
              Este post nao existe na biblioteca local deste navegador.
            </p>
          </div>
        </header>

        <section className="approved-empty">
          <strong>Biblioteca local sem este item.</strong>
          <p>
            A biblioteca ainda vive no navegador. Se o post foi aprovado em
            outro dispositivo, ele nao aparece aqui.
          </p>
          <Link className="primary-button" href="/approved">
            Voltar para aprovados
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="brand-shell approved-detail-shell">
      <header className="brand-header">
        <div className="nav-row">
          <Link className="text-link" href="/">
            Inicio
          </Link>
          <Link className="text-link" href="/approved">
            Posts aprovados
          </Link>
          <Link className="text-link" href="/create">
            Criar post
          </Link>
        </div>
        <div>
          <p className="eyebrow">Marco 3.4</p>
          <h1>{post.title}</h1>
          <p className="lead">
            Revisao individual do post aprovado. Ainda sem publicacao, Zernio,
            banco de dados ou automacao.
          </p>
        </div>
      </header>

      <section className="approved-detail-toolbar" aria-label="Acoes do post">
        <span className={`approved-status approved-status-${post.status}`}>
          {statusLabels[post.status]}
        </span>
        <button className="primary-button" type="button" onClick={openPost}>
          Editar no fluxo
        </button>
        <button
          className="secondary-button"
          type="button"
          onClick={duplicatePost}
        >
          Duplicar
        </button>
        <button
          className="secondary-button"
          type="button"
          onClick={downloadPost}
        >
          Baixar PNG
        </button>
        {status ? (
          <span className="next-step-status" role="status">
            {status}
          </span>
        ) : null}
      </section>

      <section className="approved-detail-layout">
        <div className="approved-detail-preview">
          {view ? (
            <img
              alt={`Preview aprovado de ${post.title}`}
              className="approved-detail-image"
              height={1350}
              src={view.dataUrl}
              width={1080}
            />
          ) : (
            <div className="approved-post-missing">Preview indisponivel</div>
          )}
        </div>

        <aside className="approved-detail-panel">
          <section className="approved-detail-card">
            <p className="section-kicker">Status</p>
            <label className="field">
              <span>Status operacional</span>
              <select
                value={post.status}
                onChange={(event) =>
                  updateStatus(event.target.value as ApprovedPostStatus)
                }
              >
                <option value="approved">Aprovado</option>
                <option value="exported">Exportado</option>
                <option value="ready_to_publish">Pronto para publicar</option>
              </select>
            </label>
          </section>

          <section className="approved-detail-card">
            <p className="section-kicker">Resumo</p>
            <dl className="approved-detail-meta">
              <div>
                <dt>Marca</dt>
                <dd>{post.brandName}</dd>
              </div>
              <div>
                <dt>Aprovado em</dt>
                <dd>{new Date(post.approvedAt).toLocaleString("pt-BR")}</dd>
              </div>
              <div>
                <dt>Atualizado em</dt>
                <dd>{new Date(post.updatedAt).toLocaleString("pt-BR")}</dd>
              </div>
              {view ? (
                <>
                  <div>
                    <dt>Formato</dt>
                    <dd>{view.concept.recommendedFormat}</dd>
                  </div>
                  <div>
                    <dt>Visual</dt>
                    <dd>{view.typographicVariant.name}</dd>
                  </div>
                  <div>
                    <dt>Legenda</dt>
                    <dd>{view.captionVariant.label}</dd>
                  </div>
                </>
              ) : null}
            </dl>
          </section>
        </aside>
      </section>

      <section className="approved-detail-copy-grid">
        <article className="approved-detail-card">
          <p className="section-kicker">Legenda</p>
          <div className="approved-detail-copy">
            <p>{view?.caption || "Legenda indisponivel."}</p>
            <button
              className="secondary-button"
              type="button"
              onClick={() => copyText(view?.caption || "", "Legenda copiada.")}
              disabled={!view?.caption}
            >
              Copiar legenda
            </button>
          </div>
        </article>

        <article className="approved-detail-card">
          <p className="section-kicker">Primeiro comentario</p>
          <div className="approved-detail-copy">
            <p>{view?.firstComment || "Sem primeiro comentario."}</p>
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
          </div>
        </article>

        <article className="approved-detail-card">
          <p className="section-kicker">Hashtags</p>
          <div className="approved-detail-copy">
            <p>{view?.hashtags || "Sem hashtags."}</p>
            <button
              className="secondary-button"
              type="button"
              onClick={() =>
                copyText(view?.hashtags || "", "Hashtags copiadas.")
              }
              disabled={!view?.hashtags}
            >
              Copiar hashtags
            </button>
          </div>
        </article>

        <article className="approved-detail-card">
          <p className="section-kicker">Notas internas</p>
          <label className="field">
            <span>Notas</span>
            <textarea
              ref={notesRef}
              defaultValue={post.notes}
              placeholder="Ex: revisar depois com dado real, usar em campanha de atendimento, publicar de manha"
              rows={6}
            />
          </label>
          <div className="approved-detail-actions">
            <button className="primary-button" type="button" onClick={saveNotes}>
              Salvar notas
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
          </div>
        </article>
      </section>

      <section className="approved-detail-card">
        <p className="section-kicker">Checklist final</p>
        {finalChecklist.length ? (
          <div className="approved-detail-checklist">
            {finalChecklist.map((item) => (
              <div
                className={`final-check final-check-${item.status}`}
                key={item.id}
              >
                <span>{item.status === "ok" ? "OK" : "Revisar"}</span>
                <strong>{item.label}</strong>
                <p>{item.note}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="approved-detail-muted">Checklist indisponivel.</p>
        )}
      </section>
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
