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
  appendApprovedPostAssets,
  approveApprovedPostVisual,
  buildApprovedPostText,
  buildApprovedPostView,
  createDuplicateProjectFromApprovedPost,
  deleteApprovedPostAsset,
  finalizeApprovedPostPackage,
  getVisualAssetRejectionReason,
  parseApprovedPosts,
  rejectApprovedPostAsset,
  restoreApprovedPostAsset,
  selectApprovedPostAsset,
  selectApprovedPostAssetComposition,
  updateApprovedPostNotes,
  updateApprovedPostStatus,
  visualAssetRejectionReasons,
  type ApprovedPost,
  type ApprovedPostFinalPackageStatus,
  type ApprovedPostStatus,
  type ApprovedPostVisualStatus,
  type VisualAssetRejectionReasonId,
} from "../../../lib/creative/approved-posts";
import type { AssetCompositionVariantId } from "../../../lib/creative/asset-composition";
import {
  buildDefaultAssetInstruction,
  type GeneratedVisualAsset,
} from "../../../lib/creative/assets";
import { CREATIVE_PROJECT_STORAGE_KEY } from "../../../lib/creative/concepts";
import {
  downloadSvgAsPng,
  downloadZipFile,
  slugify,
  svgToPngBlob,
  type ZipDownloadFile,
} from "../../create/export-utils";

type ApprovedPostDetailProps = {
  postId: string;
};

type ApprovedPostView = NonNullable<ReturnType<typeof buildApprovedPostView>>;

const statusLabels: Record<ApprovedPostStatus, string> = {
  approved: "Aprovado",
  exported: "Exportado",
  ready_to_publish: "Pronto para publicar",
};

const finalPackageStatusLabels: Record<ApprovedPostFinalPackageStatus, string> =
  {
    open: "Pacote em aberto",
    ready: "Pacote pronto",
  };

const visualStatusLabels: Record<ApprovedPostVisualStatus, string> = {
  typographic_only: "So tipografico",
  asset_generated: "Com asset gerado",
  asset_rejected: "Asset rejeitado",
  visual_approved: "Visual aprovado",
};

const assetPromptPresets = [
  {
    label: "Sem texto",
    prompt:
      "Remover qualquer texto, numero, contador, badge ou interface legivel. Manter apenas formas abstratas.",
  },
  {
    label: "Mais premium",
    prompt:
      "Deixar mais premium, editorial e menos cartunesco. Usar menos elementos e mais respiro.",
  },
  {
    label: "Metafora simples",
    prompt:
      "Fazer uma metafora mais simples e imediatamente compreensivel, sem depender de detalhe pequeno.",
  },
];

export function ApprovedPostDetail({ postId }: ApprovedPostDetailProps) {
  const router = useRouter();
  const notesRef = useRef<HTMLTextAreaElement>(null);
  const [posts, setPosts] = useState<ApprovedPost[]>([]);
  const [assetPrompt, setAssetPrompt] = useState("");
  const [assetStatus, setAssetStatus] = useState("");
  const [isGeneratingAsset, setIsGeneratingAsset] = useState(false);
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
  const generatedAssets = post?.generatedAssets || [];
  const suggestedAssetPrompt =
    post && view
      ? buildDefaultAssetInstruction(
          post.projectSnapshot.briefing,
          view.concept,
          view.typographicPiece,
        )
      : "";

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
      const exportSvg = view.assetSvg || view.svg;
      const assetSuffix = view.selectedAsset ? "-com-asset" : "";
      await downloadSvgAsPng(
        exportSvg,
        `${slugify(post.brandName || "social-studio")}-${slugify(post.title)}${assetSuffix}.png`,
      );
      persistPosts(updateApprovedPostStatus(posts, post.id, "exported"));
      setStatus("PNG exportado.");
      window.setTimeout(() => setStatus(""), 2600);
    } catch {
      setStatus("Nao foi possivel baixar o PNG.");
    }
  }

  async function downloadFinalPackage() {
    if (!post || !view) {
      setStatus("Post aprovado incompleto.");
      return;
    }

    if (post.finalPackageStatus !== "ready") {
      setStatus("Finalize o pacote antes de baixar o ZIP.");
      return;
    }

    setStatus("Montando ZIP...");

    try {
      const exportSvg = view.assetSvg || view.svg;
      const pngBlob = await svgToPngBlob(exportSvg);
      const baseFileName = `${slugify(post.brandName || "social-studio")}-${slugify(post.title)}`;
      const files: ZipDownloadFile[] = [
        {
          name: "final/post-1080x1350.png",
          content: pngBlob,
        },
        {
          name: "copy/legenda.txt",
          content: view.caption,
        },
        {
          name: "copy/primeiro-comentario.txt",
          content: view.firstComment || "",
        },
        {
          name: "copy/hashtags.txt",
          content: view.hashtags || "",
        },
        {
          name: "asset/asset-prompt.txt",
          content: view.selectedAsset?.prompt || "Sem asset visual selecionado.",
        },
        {
          name: "metadata.json",
          content: JSON.stringify(buildFinalPackageMetadata(post, view), null, 2),
        },
        {
          name: "visual-history.json",
          content: JSON.stringify(post.visualEvents, null, 2),
        },
        {
          name: "README.txt",
          content: buildFinalPackageReadme(post),
        },
      ];

      if (view.selectedAsset?.dataUrl) {
        files.push({
          name: "asset/selected-asset.png",
          content: dataUrlToBlob(view.selectedAsset.dataUrl),
        });
      }

      await downloadZipFile(files, `${baseFileName}-pacote-final.zip`);
      persistPosts(updateApprovedPostStatus(posts, post.id, "exported"));
      setStatus("ZIP exportado.");
      window.setTimeout(() => setStatus(""), 2600);
    } catch {
      setStatus("Nao foi possivel baixar o pacote final.");
    }
  }

  async function generateAssets() {
    if (!post || !view) {
      setStatus("Post aprovado incompleto.");
      return;
    }

    const prompt = assetPrompt.trim() || suggestedAssetPrompt;

    if (!prompt.trim()) {
      setAssetStatus("Descreva a direcao visual antes de gerar.");
      return;
    }

    setIsGeneratingAsset(true);
    setAssetStatus("Gerando asset visual...");
    setStatus("Gerando asset visual...");

    try {
      const response = await fetch("/api/assets", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          brandProfile: view.brand,
          briefing: post.projectSnapshot.briefing,
          selectedConcept: view.concept,
          typographicPiece: view.typographicPiece,
          userPrompt: prompt,
          count: 1,
        }),
      });
      const payload = (await response.json()) as {
        assets?: GeneratedVisualAsset[];
        error?: string;
        details?: string;
      };

      if (!response.ok || !payload.assets?.length) {
        throw new Error(
          payload.details
            ? `${payload.error || "Nao foi possivel gerar asset visual."} (${payload.details})`
            : payload.error || "Nao foi possivel gerar asset visual.",
        );
      }

      persistPosts(appendApprovedPostAssets(posts, post.id, payload.assets));
      setAssetStatus(
        payload.assets.length === 1
          ? "Asset gerado e selecionado."
          : "Assets gerados. O primeiro foi selecionado.",
      );
      setStatus(
        payload.assets.length === 1
          ? "Asset gerado e selecionado."
          : "Assets gerados. O primeiro foi selecionado.",
      );
      window.setTimeout(() => setStatus(""), 3200);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Nao foi possivel gerar asset visual.";
      setAssetStatus(message);
      setStatus(message);
    } finally {
      setIsGeneratingAsset(false);
    }
  }

  function selectAsset(assetId: string | null) {
    if (!post) {
      return;
    }

    persistPosts(selectApprovedPostAsset(posts, post.id, assetId));
    setAssetStatus(
      assetId ? "Asset selecionado." : "Asset removido da composicao.",
    );
    setStatus(assetId ? "Asset selecionado." : "Asset removido da composicao.");
    window.setTimeout(() => setStatus(""), 2400);
  }

  function selectComposition(compositionId: AssetCompositionVariantId) {
    if (!post) {
      return;
    }

    persistPosts(
      selectApprovedPostAssetComposition(posts, post.id, compositionId),
    );
    setAssetStatus("Composicao atualizada.");
    setStatus("Composicao atualizada.");
    window.setTimeout(() => setStatus(""), 2400);
  }

  function rejectAsset(
    assetId: string,
    reasonId: VisualAssetRejectionReasonId,
  ) {
    if (!post) {
      return;
    }

    const reason = getVisualAssetRejectionReason(reasonId);
    persistPosts(rejectApprovedPostAsset(posts, post.id, assetId, reasonId));
    setAssetPrompt(reason.regenerationInstruction);
    setAssetStatus(
      `Asset rejeitado: ${reason.label}. A instrucao de regeneracao foi preparada.`,
    );
    setStatus("Asset rejeitado.");
    window.setTimeout(() => setStatus(""), 2400);
  }

  function restoreAsset(assetId: string) {
    if (!post) {
      return;
    }

    persistPosts(restoreApprovedPostAsset(posts, post.id, assetId));
    setAssetStatus("Rejeicao desfeita. Asset selecionado novamente.");
    setStatus("Rejeicao desfeita.");
    window.setTimeout(() => setStatus(""), 2400);
  }

  function approveVisualFinal() {
    if (!post || !view?.selectedAsset) {
      setAssetStatus("Selecione um asset antes de aprovar o visual final.");
      return;
    }

    persistPosts(approveApprovedPostVisual(posts, post.id));
    setAssetStatus("Visual final aprovado. Post marcado como pronto.");
    setStatus("Visual final aprovado.");
    window.setTimeout(() => setStatus(""), 2400);
  }

  function finalizePackage() {
    if (!post) {
      return;
    }

    if (post.visualStatus !== "visual_approved") {
      setStatus("Aprove o visual final antes de finalizar o pacote.");
      setAssetStatus("Aprove o visual final antes de finalizar o pacote.");
      return;
    }

    persistPosts(finalizeApprovedPostPackage(posts, post.id));
    setStatus("Pacote finalizado.");
    setAssetStatus("Pacote final pronto para baixar.");
    window.setTimeout(() => setStatus(""), 2600);
  }

  function deleteAsset(assetId: string) {
    if (!post) {
      return;
    }

    persistPosts(deleteApprovedPostAsset(posts, post.id, assetId));
    setAssetStatus("Asset apagado da lista.");
    setStatus("Asset apagado.");
    window.setTimeout(() => setStatus(""), 2400);
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
            <p className="eyebrow">Marco 4.2</p>
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
          <p className="eyebrow">Marco 4.2</p>
          <h1>{post.title}</h1>
          <p className="lead">
            Revisao individual do post aprovado, com escolha de asset,
            composicao visual e aprovacao final. Ainda sem publicacao, Zernio,
            banco de dados ou automacao.
          </p>
        </div>
      </header>

      <section className="approved-detail-toolbar" aria-label="Acoes do post">
        <span className={`approved-status approved-status-${post.status}`}>
          {statusLabels[post.status]}
        </span>
        <span className={`visual-status visual-status-${post.visualStatus}`}>
          {visualStatusLabels[post.visualStatus]}
        </span>
        <span
          className={`package-status package-status-${post.finalPackageStatus}`}
        >
          {finalPackageStatusLabels[post.finalPackageStatus]}
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
              src={view.assetDataUrl || view.dataUrl}
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
                  <div>
                    <dt>Status visual</dt>
                    <dd>{visualStatusLabels[post.visualStatus]}</dd>
                  </div>
                  <div>
                    <dt>Pacote</dt>
                    <dd>{finalPackageStatusLabels[post.finalPackageStatus]}</dd>
                  </div>
                  {post.finalPackageReadyAt ? (
                    <div>
                      <dt>Finalizado em</dt>
                      <dd>
                        {new Date(post.finalPackageReadyAt).toLocaleString(
                          "pt-BR",
                        )}
                      </dd>
                    </div>
                  ) : null}
                  {view.selectedAsset ? (
                    <div>
                      <dt>Composicao</dt>
                      <dd>{view.selectedAssetCompositionVariant.name}</dd>
                    </div>
                  ) : null}
                </>
              ) : null}
            </dl>
          </section>
        </aside>
      </section>

      <section className="approved-detail-card visual-asset-card">
        <div className="asset-section-heading">
          <div>
            <p className="section-kicker">Asset visual</p>
            <h2>Gerar imagem para este post</h2>
          </div>
          {view?.selectedAsset ? (
            <div className="asset-header-actions">
              <button
                className="primary-button"
                type="button"
                onClick={approveVisualFinal}
                disabled={post.visualStatus === "visual_approved"}
              >
                {post.visualStatus === "visual_approved"
                  ? "Visual aprovado"
                  : "Aprovar visual final"}
              </button>
              <button
                className="secondary-button"
                type="button"
                onClick={() => selectAsset(null)}
              >
                Voltar para tipografico
              </button>
            </div>
          ) : null}
        </div>

        <div className="asset-workbench">
          <div className="asset-prompt-panel">
            <label className="field">
              <span>Direcao visual antes de gerar</span>
              <textarea
                value={assetPrompt}
                onChange={(event) => setAssetPrompt(event.target.value)}
                placeholder={suggestedAssetPrompt || "Ex: metafora visual editorial, sem texto, sem logo, com espaco limpo para headline"}
                rows={6}
              />
            </label>
            <div className="asset-preset-row" aria-label="Ajustes rapidos">
              {assetPromptPresets.map((preset) => (
                <button
                  className="secondary-button"
                  type="button"
                  key={preset.label}
                  onClick={() => setAssetPrompt(preset.prompt)}
                  disabled={isGeneratingAsset}
                >
                  {preset.label}
                </button>
              ))}
            </div>
            <div className="approved-detail-actions">
              <button
                className="secondary-button"
                type="button"
                onClick={() => setAssetPrompt(suggestedAssetPrompt)}
                disabled={!suggestedAssetPrompt || isGeneratingAsset}
              >
                Usar sugestao
              </button>
              <button
                className="primary-button"
                type="button"
                onClick={generateAssets}
                disabled={isGeneratingAsset || !view}
              >
                {isGeneratingAsset
                  ? "Gerando..."
                  : view?.selectedAsset
                    ? "Regenerar asset"
                    : "Gerar asset"}
              </button>
            </div>
            {assetStatus ? (
              <p
                className={
                  assetStatus.includes("Nao") ||
                  assetStatus.includes("erro") ||
                  assetStatus.includes("recusou") ||
                  assetStatus.includes("limite") ||
                  assetStatus.includes("configurado")
                    ? "asset-status asset-status-error"
                    : "asset-status"
                }
                role="status"
              >
                {assetStatus}
              </p>
            ) : null}
            <p className="approved-detail-muted">
              O asset nao deve trazer texto. A headline, a marca e o CTA sao
              aplicados pelo renderizador do sistema.
            </p>
          </div>

          <div className="asset-composite-panel">
            {view?.assetDataUrl ? (
              <>
                <img
                  alt={`Composicao com asset visual de ${post.title}`}
                  className="asset-composite-image"
                  height={1350}
                  src={view.assetDataUrl}
                  width={1080}
                />
                <span className="asset-selected-note">
                  Asset selecionado: {view.selectedAsset?.model} |{" "}
                  {view.selectedAssetCompositionVariant.name}
                </span>
              </>
            ) : (
              <div className="asset-composite-empty">
                <strong>Sem asset selecionado</strong>
                <p>
                  Gere uma imagem e escolha uma opcao para ver a composicao
                  final com texto por cima.
                </p>
              </div>
            )}
          </div>
        </div>

        {view?.selectedAsset ? (
          <div className="asset-composition-grid">
            {view.assetCompositionVariants.map((composition) => {
              const selected =
                composition.id === post.selectedAssetCompositionId;

              return (
                <button
                  className={
                    selected
                      ? "asset-composition-card asset-composition-card-selected"
                      : "asset-composition-card"
                  }
                  type="button"
                  key={composition.id}
                  onClick={() => selectComposition(composition.id)}
                >
                  <strong>{composition.name}</strong>
                  <span>{composition.layoutFamily}</span>
                </button>
              );
            })}
          </div>
        ) : null}

        {generatedAssets.length ? (
          <div className="asset-card-grid">
            {generatedAssets.map((asset) => {
              const selected = asset.id === post.selectedVisualAssetId;
              const rejection = post.visualAssetRejections.find(
                (item) => item.assetId === asset.id,
              );
              const rejectionReason = rejection
                ? getVisualAssetRejectionReason(rejection.reasonId)
                : null;

              return (
                <article
                  className={
                    selected ? "asset-card asset-card-selected" : "asset-card"
                  }
                  key={asset.id}
                >
                  <img
                    alt="Asset visual gerado"
                    height={1350}
                    src={asset.dataUrl}
                    width={1080}
                  />
                  <div>
                    <strong>{asset.model}</strong>
                    <span>
                      {new Date(asset.generatedAt).toLocaleString("pt-BR")}
                    </span>
                  </div>
                  <p>{asset.prompt}</p>
                  {rejectionReason ? (
                    <div className="asset-rejection-recovery">
                      <span className="asset-rejection-note">
                        Rejeitado: {rejectionReason.label}
                      </span>
                      <button
                        className="secondary-button"
                        type="button"
                        onClick={() => restoreAsset(asset.id)}
                      >
                        Desfazer rejeicao
                      </button>
                    </div>
                  ) : null}
                  <button
                    className={selected ? "primary-button" : "secondary-button"}
                    type="button"
                    disabled={Boolean(rejection)}
                    onClick={() => selectAsset(asset.id)}
                  >
                    {selected ? "Selecionado" : "Usar este asset"}
                  </button>
                  <button
                    className="secondary-button secondary-danger"
                    type="button"
                    onClick={() => deleteAsset(asset.id)}
                  >
                    Apagar asset
                  </button>
                  {selected && !rejection ? (
                    <div className="asset-rejection-actions">
                      <strong>Rejeitar asset</strong>
                      {visualAssetRejectionReasons.map((reason) => (
                        <button
                          className="secondary-button"
                          type="button"
                          key={reason.id}
                          onClick={() => rejectAsset(asset.id, reason.id)}
                        >
                          {reason.label}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        ) : (
          <p className="approved-detail-muted">
            Nenhum asset visual gerado para este post ainda.
          </p>
        )}
      </section>

      <section className="approved-detail-card final-package-card">
        <div className="asset-section-heading">
          <div>
            <p className="section-kicker">Pacote final</p>
            <h2>Fechar entrega do post</h2>
          </div>
          <span
            className={`package-status package-status-${post.finalPackageStatus}`}
          >
            {finalPackageStatusLabels[post.finalPackageStatus]}
          </span>
        </div>

        <div className="final-package-grid">
          <div>
            <strong>Imagem final</strong>
            <span>{view?.selectedAsset ? "Com asset visual" : "Tipografico"}</span>
          </div>
          <div>
            <strong>Legenda</strong>
            <span>{view?.caption ? "Incluida" : "Indisponivel"}</span>
          </div>
          <div>
            <strong>Comentario</strong>
            <span>{view?.firstComment ? "Incluido" : "Vazio"}</span>
          </div>
          <div>
            <strong>Historico</strong>
            <span>
              {post.visualEvents.length === 1
                ? "1 evento"
                : `${post.visualEvents.length} eventos`}
            </span>
          </div>
        </div>

        <div className="approved-detail-actions">
          <button
            className="primary-button"
            type="button"
            onClick={finalizePackage}
            disabled={
              post.visualStatus !== "visual_approved" ||
              post.finalPackageStatus === "ready"
            }
          >
            {post.finalPackageStatus === "ready"
              ? "Pacote finalizado"
              : "Finalizar pacote"}
          </button>
          <button
            className="secondary-button"
            type="button"
            onClick={downloadFinalPackage}
            disabled={!view || post.finalPackageStatus !== "ready"}
          >
            Baixar ZIP
          </button>
        </div>

        <p className="approved-detail-muted">
          O ZIP inclui PNG final 1080x1350, legenda, primeiro comentario,
          hashtags, prompt do asset, metadados e historico visual.
        </p>
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
        <p className="section-kicker">Historico visual</p>
        {post.visualEvents.length ? (
          <div className="visual-history-list">
            {post.visualEvents.map((event) => (
              <article className="visual-history-item" key={event.id}>
                <strong>{event.label}</strong>
                <span>{new Date(event.createdAt).toLocaleString("pt-BR")}</span>
                <p>{event.detail}</p>
              </article>
            ))}
          </div>
        ) : (
          <p className="approved-detail-muted">
            Nenhuma decisao visual registrada ainda.
          </p>
        )}
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

function buildFinalPackageMetadata(
  post: ApprovedPost,
  view: ApprovedPostView,
) {
  return {
    id: post.id,
    title: post.title,
    brandName: post.brandName,
    approvedAt: post.approvedAt,
    finalPackageStatus: post.finalPackageStatus,
    finalPackageReadyAt: post.finalPackageReadyAt,
    operationalStatus: post.status,
    visualStatus: post.visualStatus,
    concept: {
      id: view.concept.id,
      title: view.concept.title,
      hook: view.concept.hook,
      centralIdea: view.concept.centralIdea,
      recommendedFormat: view.concept.recommendedFormat,
      visualDirection: view.concept.visualDirection,
    },
    typography: {
      variant: view.typographicVariant.name,
      headline: view.typographicPiece.copy.headline,
      support: view.typographicPiece.copy.support,
      cta: view.typographicPiece.copy.cta,
    },
    caption: {
      variant: view.captionVariant.label,
      caption: view.caption,
      firstComment: view.firstComment,
      hashtags: view.hashtags,
    },
    visualAsset: view.selectedAsset
      ? {
          id: view.selectedAsset.id,
          provider: view.selectedAsset.provider,
          model: view.selectedAsset.model,
          prompt: view.selectedAsset.prompt,
          generatedAt: view.selectedAsset.generatedAt,
        }
      : null,
    composition: view.selectedAsset
      ? {
          id: view.selectedAssetCompositionVariant.id,
          name: view.selectedAssetCompositionVariant.name,
          layoutFamily: view.selectedAssetCompositionVariant.layoutFamily,
        }
      : null,
    notes: post.notes,
  };
}

function buildFinalPackageReadme(post: ApprovedPost) {
  return [
    "Pacote final de post",
    "",
    `Titulo: ${post.title}`,
    `Marca: ${post.brandName}`,
    `Status: ${post.finalPackageStatus === "ready" ? "pronto" : "em aberto"}`,
    post.finalPackageReadyAt
      ? `Finalizado em: ${new Date(post.finalPackageReadyAt).toLocaleString("pt-BR")}`
      : "",
    "",
    "Arquivos:",
    "- final/post-1080x1350.png",
    "- copy/legenda.txt",
    "- copy/primeiro-comentario.txt",
    "- copy/hashtags.txt",
    "- asset/asset-prompt.txt",
    "- asset/selected-asset.png, quando houver asset selecionado",
    "- metadata.json",
    "- visual-history.json",
  ]
    .filter(Boolean)
    .join("\n");
}

function dataUrlToBlob(dataUrl: string) {
  const [header, encodedData] = dataUrl.split(",");
  const mimeMatch = header.match(/^data:([^;]+);base64$/);
  const mimeType = mimeMatch?.[1] || "application/octet-stream";
  const binary = window.atob(encodedData || "");
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return new Blob([bytes], { type: mimeType });
}
