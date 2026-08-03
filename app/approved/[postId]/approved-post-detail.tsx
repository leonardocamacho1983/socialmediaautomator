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
  appendApprovedPostDurableOutputs,
  applyApprovedPostSafeCopyFixes,
  approveApprovedPostCarousel,
  approveApprovedPostVisual,
  buildApprovedPostText,
  buildApprovedPostView,
  createDuplicateProjectFromApprovedPost,
  deleteApprovedPostCarousel,
  deleteApprovedPostAsset,
  finalizeApprovedPostPackage,
  generateApprovedPostCarousel,
  getVisualAssetRejectionReason,
  parseApprovedPosts,
  rejectApprovedPostAsset,
  restoreApprovedPostAsset,
  selectApprovedPostAsset,
  selectApprovedPostAssetComposition,
  regenerateApprovedPostCarouselSlide,
  updateApprovedPostCarouselSlide,
  updateApprovedPostCaptionCopy,
  updateApprovedPostNotes,
  updateApprovedPostStatus,
  upsertApprovedPost,
  visualAssetRejectionReasons,
  type ApprovedPost,
  type ApprovedPostCaptionCopyEdit,
  type ApprovedPostCarouselStatus,
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
import {
  carouselSlideRoleLabels,
  carouselSlideToDataUrl,
  evaluateCarouselSlideCopy,
  renderCarouselSlideSvg,
  type CarouselSlide,
  type CarouselSlideCopyEdit,
} from "../../../lib/creative/carousel";
import {
  buildCopyQualityReport,
  suggestFirstComment,
  type CopyQualityReport,
} from "../../../lib/creative/copy-quality";
import {
  buildVisualQualityReport,
  type VisualQualityReport,
} from "../../../lib/creative/visual-quality";
import { CREATIVE_PROJECT_STORAGE_KEY } from "../../../lib/creative/concepts";
import {
  downloadSvgAsPng,
  downloadZipFile,
  createZipBlob,
  slugify,
  svgToPngBlob,
  type ZipDownloadFile,
} from "../../create/export-utils";
import {
  buildStudioProjectRecordFromApprovedPost,
  fetchStudioProjectRecord,
  syncStudioProjectRecord,
} from "../../../lib/persistence/studio-projects";
import {
  DIRECT_STUDIO_UPLOAD_MIN_BYTES,
  dedupeStudioOutputs,
  fetchStudioOutputs,
  getStudioOutputStableKey,
  outputKindLabels,
  stripSignedOutputFields,
  uploadStudioOutput,
  uploadStudioOutputBlob,
  type StudioOutputLink,
  type StudioOutputRecord,
  type StudioOutputKind,
} from "../../../lib/storage/studio-outputs";

type ApprovedPostDetailProps = {
  postId: string;
};

type ApprovedPostView = NonNullable<ReturnType<typeof buildApprovedPostView>>;

type DurableOutputDisplay = StudioOutputRecord & {
  signedUrl?: string;
  signedUrlExpiresAt?: string;
};

type DurableUploadFile = {
  kind: StudioOutputKind;
  label: string;
  fileName: string;
  content: Blob | string;
  contentType: string;
  metadata: Record<string, unknown>;
};

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

const carouselStatusLabels: Record<ApprovedPostCarouselStatus, string> = {
  draft: "Carrossel em revisao",
  approved: "Carrossel aprovado",
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
  const [storageStatus, setStorageStatus] = useState("");
  const [isGeneratingAsset, setIsGeneratingAsset] = useState(false);
  const [isSavingDurableOutputs, setIsSavingDurableOutputs] = useState(false);
  const [outputLinks, setOutputLinks] = useState<StudioOutputLink[]>([]);
  const [status, setStatus] = useState("");

  useEffect(() => {
    // The approved post library hydrates from browser storage before fetching durable files.
    const localPosts = readApprovedPosts();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPosts(localPosts);
    setStorageStatus("Carregando post e arquivos duraveis...");

    void Promise.allSettled([
      fetchStudioProjectRecord(postId),
      fetchStudioOutputs(postId),
    ]).then(([projectResult, outputsResult]) => {
      let nextPosts = localPosts;
      const recoveredPost =
        projectResult.status === "fulfilled"
          ? projectResult.value.approvedPostData
          : null;

      if (recoveredPost) {
        nextPosts = upsertApprovedPost(nextPosts, recoveredPost);
        setStatus("Post recuperado da biblioteca persistida.");
        window.setTimeout(() => setStatus(""), 2600);
      }

      if (outputsResult.status === "fulfilled") {
        const outputs = outputsResult.value;
        const durableOutputs = outputs.map(stripSignedOutputFields);

        nextPosts = appendApprovedPostDurableOutputs(
          nextPosts,
          postId,
          durableOutputs,
        );

        setOutputLinks(outputs);
        setStorageStatus(
          outputs.length
            ? "Arquivos duraveis carregados."
            : "Nenhum arquivo duravel salvo ainda.",
        );
      } else {
        setStorageStatus(
          "Storage indisponivel ou nao configurado. Os arquivos continuam no navegador.",
        );
      }

      setPosts(nextPosts);
      window.localStorage.setItem(
        APPROVED_POSTS_STORAGE_KEY,
        JSON.stringify(nextPosts),
      );
    });
  }, [postId]);

  const post = useMemo(
    () => posts.find((item) => item.id === postId) || null,
    [postId, posts],
  );
  const view = post ? buildApprovedPostView(post) : null;
  const copyQualityReport =
    post && view
      ? buildCopyQualityReport({
          brandProfile: view.brand,
          typographicCopy: view.typographicPiece.copy,
          captionVariant: view.captionVariant,
          carouselPackage: post.carouselPackage,
        })
      : null;
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
  const firstCommentSuggestion = view
    ? suggestFirstComment({
        brandProfile: view.brand,
        caption: view.caption,
        typographicCopy: view.typographicPiece.copy,
      })
    : "";
  const firstCommentIssues =
    copyQualityReport?.issues.filter(
      (issue) => issue.field === "firstComment",
    ) || [];
  const durableOutputs = useMemo(
    () => mergeDurableOutputLinks(post?.durableOutputs || [], outputLinks),
    [outputLinks, post?.durableOutputs],
  );
  const visualQualityReport =
    post && view
      ? buildVisualQualityReport({
          post,
          finalSvg: view.assetSvg || view.svg,
          copy: view.typographicPiece.copy,
          selectedAsset: view.selectedAsset,
          compositionId: post.selectedAssetCompositionId,
        })
      : null;
  const hasDurableFinalZip = durableOutputs.some(
    (output) => output.kind === "final_package_zip",
  );

  function persistPosts(nextPosts: ApprovedPost[]) {
    setPosts(nextPosts);
    window.localStorage.setItem(
      APPROVED_POSTS_STORAGE_KEY,
      JSON.stringify(nextPosts),
    );
    const changedPost = nextPosts.find((candidate) => candidate.id === postId);

    if (changedPost) {
      void syncStudioProjectRecord(
        buildStudioProjectRecordFromApprovedPost(changedPost),
      ).catch(() => {
        setStatus(
          "Alteracao salva no navegador. Banco indisponivel ou nao configurado.",
        );
      });
    }
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

  function saveCaptionCopy(changes: ApprovedPostCaptionCopyEdit) {
    if (!post) {
      return;
    }

    persistPosts(updateApprovedPostCaptionCopy(posts, post.id, changes));
    setStatus("Copy salva. Revise o Quality Gate novamente.");
    window.setTimeout(() => setStatus(""), 2800);
  }

  function applyFirstCommentSuggestion() {
    if (!post || !view) {
      return;
    }

    const suggestion = suggestFirstComment({
      brandProfile: view.brand,
      caption: view.caption,
      typographicCopy: view.typographicPiece.copy,
    });

    persistPosts(
      updateApprovedPostCaptionCopy(posts, post.id, {
        firstComment: suggestion,
      }),
    );
    setStatus("Sugestão aplicada ao primeiro comentário.");
    window.setTimeout(() => setStatus(""), 2800);
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

    setStatus("Montando pacote final...");

    try {
      const { baseFileName, files } = await buildFinalPackageFiles(post, view);

      await downloadZipFile(files, `${baseFileName}-pacote-final.zip`);
      persistPosts(updateApprovedPostStatus(posts, post.id, "exported"));
      setStatus("Pacote final exportado.");
      window.setTimeout(() => setStatus(""), 2600);
    } catch {
      setStatus("Nao foi possivel baixar o pacote final.");
    }
  }

  async function saveDurableOutputs() {
    if (!post || !view) {
      setStorageStatus("Post aprovado incompleto.");
      return;
    }

    if (post.finalPackageStatus !== "ready") {
      setStorageStatus("Finalize o pacote antes de salvar arquivos duraveis.");
      return;
    }

    setIsSavingDurableOutputs(true);
    setStorageStatus("Preparando arquivos duraveis...");

    const savedOutputs: StudioOutputLink[] = [];
    let baseOutputLinks = outputLinks;

    try {
      const files = await buildDurableUploadFiles(post, view);
      const remoteOutputs = await fetchStudioOutputs(post.id).catch(() => []);

      if (remoteOutputs.length) {
        baseOutputLinks = mergeStudioOutputLinks(outputLinks, remoteOutputs);
        setOutputLinks(baseOutputLinks);
        persistPosts(
          appendApprovedPostDurableOutputs(
            posts,
            post.id,
            baseOutputLinks.map(stripSignedOutputFields),
          ),
        );
      }

      const existingOutputKeys = new Set(
        baseOutputLinks.map(getStudioOutputStableKey),
      );
      const pendingFiles = files.filter(
        (file) => !existingOutputKeys.has(getDurableUploadFileStableKey(file)),
      );

      if (!pendingFiles.length) {
        setStorageStatus("Todos os arquivos deste pacote ja estavam salvos.");
        return;
      }

      for (const [index, file] of pendingFiles.entries()) {
        setStorageStatus(
          `Salvando ${index + 1}/${pendingFiles.length}: ${file.label}.`,
        );
        const blob =
          typeof file.content === "string"
            ? new Blob([file.content], { type: file.contentType })
            : file.content;
        const output = await uploadDurableOutputFile(post, file, blob);

        savedOutputs.push(output);
      }

      const nextOutputLinks = mergeStudioOutputLinks(
        baseOutputLinks,
        savedOutputs,
      );
      const skippedCount = files.length - pendingFiles.length;

      setOutputLinks(nextOutputLinks);
      persistPosts(
        appendApprovedPostDurableOutputs(
          posts,
          post.id,
          nextOutputLinks.map(stripSignedOutputFields),
        ),
      );
      setStorageStatus(
        [
          `${savedOutputs.length} arquivo(s) salvo(s) no storage.`,
          skippedCount ? `${skippedCount} arquivo(s) ja existiam.` : "",
        ]
          .filter(Boolean)
          .join(" "),
      );
    } catch (error) {
      if (savedOutputs.length) {
        const partialOutputLinks = mergeStudioOutputLinks(
          baseOutputLinks,
          savedOutputs,
        );

        setOutputLinks(partialOutputLinks);
        persistPosts(
          appendApprovedPostDurableOutputs(
            posts,
            post.id,
            partialOutputLinks.map(stripSignedOutputFields),
          ),
        );
      }

      setStorageStatus(
        error instanceof Error
          ? error.message
          : "Nao foi possivel salvar os arquivos no storage.",
      );
    } finally {
      setIsSavingDurableOutputs(false);
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
    if (!post || !view) {
      setStatus("Post aprovado incompleto.");
      return;
    }

    if (!view.caption) {
      setStatus("Legenda indisponivel. Revise o pacote antes de finalizar.");
      return;
    }

    if (copyQualityReport?.blockerCount) {
      setStatus(
        "Quality Gate encontrou travas de copy. Corrija antes de finalizar.",
      );
      window.setTimeout(() => setStatus(""), 3600);
      return;
    }

    if (visualQualityReport?.blockerCount) {
      setStatus(
        "Quality Gate visual encontrou travas. Corrija antes de finalizar.",
      );
      window.setTimeout(() => setStatus(""), 3600);
      return;
    }

    persistPosts(finalizeApprovedPostPackage(posts, post.id));
    setStatus("Pacote finalizado.");
    setAssetStatus("Pacote final pronto para baixar.");
    window.setTimeout(() => setStatus(""), 2600);
  }

  function fixCopyQuality() {
    if (!post || !copyQualityReport) {
      return;
    }

    if (!copyQualityReport.autoFixableCount) {
      setStatus(
        "Não há correção automática segura. Edite ou regenere os trechos marcados.",
      );
      window.setTimeout(() => setStatus(""), 3600);
      return;
    }

    persistPosts(applyApprovedPostSafeCopyFixes(posts, post.id));
    setStatus(
      "Correções seguras aplicadas. Revise a copy antes de finalizar novamente.",
    );
    window.setTimeout(() => setStatus(""), 3600);
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

  function generateCarousel() {
    if (!post || !view) {
      setStatus("Post aprovado incompleto.");
      return;
    }

    persistPosts(generateApprovedPostCarousel(posts, post.id));
    setStatus("Carrossel gerado em modo revisao.");
    window.setTimeout(() => setStatus(""), 2600);
  }

  function saveCarouselSlide(
    slideId: string,
    changes: CarouselSlideCopyEdit,
  ) {
    if (!post) {
      return;
    }

    persistPosts(updateApprovedPostCarouselSlide(posts, post.id, slideId, changes));
    setStatus("Slide salvo. Revise e aprove o carrossel novamente.");
    window.setTimeout(() => setStatus(""), 2800);
  }

  function regenerateCarouselSlide(slideId: string) {
    if (!post) {
      return;
    }

    persistPosts(regenerateApprovedPostCarouselSlide(posts, post.id, slideId));
    setStatus("Slide regenerado. O carrossel voltou para revisao.");
    window.setTimeout(() => setStatus(""), 2800);
  }

  function approveCarousel() {
    if (!post?.carouselPackage) {
      setStatus("Gere o carrossel antes de aprovar.");
      return;
    }

    const issues = post.carouselPackage.slides.flatMap((slide) =>
      evaluateCarouselSlideCopy(slide),
    );

    if (issues.length) {
      setStatus("Ainda ha alertas de copy nos slides. Revise antes de aprovar.");
      window.setTimeout(() => setStatus(""), 3400);
      return;
    }

    persistPosts(approveApprovedPostCarousel(posts, post.id));
    setStatus("Carrossel aprovado. ZIP liberado.");
    window.setTimeout(() => setStatus(""), 2800);
  }

  function deleteCarousel() {
    if (!post) {
      return;
    }

    persistPosts(deleteApprovedPostCarousel(posts, post.id));
    setStatus("Carrossel apagado.");
    window.setTimeout(() => setStatus(""), 2400);
  }

  async function downloadCarouselZip() {
    if (!post || !view || !post.carouselPackage) {
      setStatus("Gere o carrossel antes de baixar o ZIP.");
      return;
    }

    if (post.carouselStatus !== "approved") {
      setStatus("Aprove o carrossel antes de baixar o ZIP.");
      return;
    }

    setStatus("Montando ZIP do carrossel...");

    try {
      const baseFileName = `${slugify(post.brandName || "social-studio")}-${slugify(post.title)}-carrossel`;
      const files = await buildCarouselZipFiles(post, view);

      await downloadZipFile(files, `${baseFileName}.zip`);
      persistPosts(updateApprovedPostStatus(posts, post.id, "exported"));
      setStatus("ZIP do carrossel exportado.");
      window.setTimeout(() => setStatus(""), 2600);
    } catch {
      setStatus("Nao foi possivel baixar o carrossel.");
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
            <Link className="text-link" href="/projects">
              Projetos
            </Link>
            <Link className="text-link" href="/outputs">
              Entregas
            </Link>
          </div>
          <div>
            <p className="eyebrow">Marco 6</p>
            <h1>Post não encontrado</h1>
            <p className="lead">
              Este post não existe na biblioteca carregada neste navegador.
            </p>
          </div>
        </header>

        <section className="approved-empty">
          <strong>Biblioteca local sem este item.</strong>
          <p>
            Abra a biblioteca persistida para carregar projetos salvos no banco
            ou volte para os aprovados deste navegador.
          </p>
          <Link className="secondary-button" href="/projects">
            Ver projetos
          </Link>
          <Link className="secondary-button" href="/outputs">
            Ver entregas
          </Link>
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
          <Link className="text-link" href="/projects">
            Projetos
          </Link>
          <Link className="text-link" href="/outputs">
            Entregas
          </Link>
        </div>
        <div>
          <p className="eyebrow">Marco 6</p>
          <h1>{post.title}</h1>
          <p className="lead">
            Revisão individual do post aprovado, com escolha de asset,
            composição visual, Quality Gate de copy, aprovação final e primeiro
            carrossel. Agora sincroniza o snapshot no banco, ainda sem
            publicação, Zernio ou automação.
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
                  assetStatus.includes("Não") ||
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
              O asset não deve trazer texto. A headline, a marca e o CTA são
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
            <span>{view?.selectedAsset ? "Com asset visual" : "Tipográfico"}</span>
          </div>
          <div>
            <strong>Legenda</strong>
            <span>{view?.caption ? "Incluída" : "Indisponível"}</span>
          </div>
          <div>
            <strong>Comentário</strong>
            <span>{view?.firstComment ? "Incluído" : "Vazio"}</span>
          </div>
          <div>
            <strong>Carrossel</strong>
            <span>
              {post.carouselStatus === "approved" && post.carouselPackage
                ? `${post.carouselPackage.slides.length} slides incluídos`
                : "Não incluído"}
            </span>
          </div>
          <div>
            <strong>Histórico</strong>
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
            disabled={!view || post.finalPackageStatus === "ready"}
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
            Baixar pacote final
          </button>
          <button
            className="secondary-button"
            type="button"
            onClick={saveDurableOutputs}
            disabled={
              !view ||
              post.finalPackageStatus !== "ready" ||
              isSavingDurableOutputs
            }
          >
            {isSavingDurableOutputs
              ? "Salvando arquivos..."
              : "Salvar no storage"}
          </button>
          {hasDurableFinalZip ? (
            <Link
              className="secondary-button"
              href={`/outputs/${encodeURIComponent(post.id)}`}
            >
              Abrir entrega
            </Link>
          ) : null}
        </div>

        <FinalPackageNextStep
          copyQualityReport={copyQualityReport}
          hasDurableFinalZip={hasDurableFinalZip}
          post={post}
          visualQualityReport={visualQualityReport}
        />

        <p className="approved-detail-muted">
          Finalizar aprova o visual atual e libera um ZIP organizado com README,
          PNG final 1080x1350, SVG fonte, legenda, primeiro comentário,
          hashtags, pacote de copy, prompt do asset, metadados e carrossel
          aprovado quando houver.
        </p>

        <div className="durable-output-panel">
          <div>
            <strong>Arquivos duraveis</strong>
            <span>{storageStatus}</span>
          </div>
          {durableOutputs.length ? (
            <div className="durable-output-list">
              {durableOutputs.slice(0, 12).map((output) => (
                <article className="durable-output-item" key={output.id}>
                  <div>
                    <strong>{output.label || outputKindLabels[output.kind]}</strong>
                    <span>
                      {output.fileName} | {formatBytes(output.sizeBytes)}
                    </span>
                  </div>
                  {output.signedUrl ? (
                    <a
                      className="secondary-button"
                      href={output.signedUrl}
                      rel="noreferrer"
                      target="_blank"
                    >
                      Abrir
                    </a>
                  ) : (
                    <span className="durable-output-missing-link">
                      Link indisponivel
                    </span>
                  )}
                </article>
              ))}
            </div>
          ) : (
            <p className="approved-detail-muted">
              Nenhum arquivo duravel salvo para este pacote ainda.
            </p>
          )}
        </div>
      </section>

      {visualQualityReport ? (
        <VisualQualityPanel report={visualQualityReport} />
      ) : null}

      {copyQualityReport ? (
        <CopyQualityPanel
          firstCommentSuggestion={firstCommentSuggestion}
          onApplyFirstCommentSuggestion={applyFirstCommentSuggestion}
          report={copyQualityReport}
          onFixCopy={fixCopyQuality}
        />
      ) : null}

      <section className="approved-detail-card carousel-card">
        <div className="asset-section-heading">
          <div>
            <p className="section-kicker">Marco 5</p>
            <h2>Carrossel do post</h2>
          </div>
          <span
            className={
              post.carouselPackage && post.carouselStatus === "approved"
                ? "carousel-status carousel-status-ready"
                : "carousel-status"
            }
          >
            {post.carouselPackage
              ? carouselStatusLabels[post.carouselStatus]
              : "Sem carrossel"}
          </span>
        </div>

        <p className="approved-detail-muted">
          Esta primeira versao transforma o conceito escolhido em seis slides
          1080x1350. Revise a copy de cada slide, aprove a sequencia e so entao
          baixe o ZIP. Ainda e deterministica: nao usa Recraft, video,
          publicacao ou automacao.
        </p>

        <div className="approved-detail-actions">
          <button
            className="primary-button"
            type="button"
            onClick={generateCarousel}
            disabled={!view}
          >
            {post.carouselPackage ? "Regenerar carrossel" : "Gerar carrossel"}
          </button>
          <button
            className="secondary-button"
            type="button"
            onClick={approveCarousel}
            disabled={!post.carouselPackage || post.carouselStatus === "approved"}
          >
            {post.carouselStatus === "approved"
              ? "Carrossel aprovado"
              : "Aprovar carrossel"}
          </button>
          <button
            className="secondary-button"
            type="button"
            onClick={downloadCarouselZip}
            disabled={
              !view ||
              !post.carouselPackage ||
              post.carouselStatus !== "approved"
            }
          >
            Baixar ZIP do carrossel
          </button>
          {post.carouselPackage ? (
            <button
              className="secondary-button secondary-danger"
              type="button"
              onClick={deleteCarousel}
            >
              Apagar carrossel
            </button>
          ) : null}
        </div>

        {post.carouselPackage && view ? (
          <div className="carousel-preview-grid" aria-label="Slides gerados">
            {post.carouselPackage.slides.map((slide) => (
              <CarouselSlideEditor
                key={`${slide.id}-${slide.eyebrow}-${slide.headline}-${slide.body}-${slide.footer}`}
                brand={view.brand}
                carouselPackage={post.carouselPackage!}
                isApproved={post.carouselStatus === "approved"}
                onRegenerate={() => regenerateCarouselSlide(slide.id)}
                onSave={(changes) => saveCarouselSlide(slide.id, changes)}
                slide={slide}
              />
            ))}
          </div>
        ) : (
          <div className="carousel-empty">
            <strong>Nenhum roteiro de carrossel criado ainda.</strong>
            <p>
              Gere o carrossel depois de aprovar o pacote final para testar se o
              mesmo conceito tambem funciona como sequencia.
            </p>
          </div>
        )}
        {post.carouselEvents.length ? (
          <div className="carousel-history-list" aria-label="Historico do carrossel">
            {post.carouselEvents.slice(0, 4).map((event) => (
              <article className="visual-history-item" key={event.id}>
                <strong>{event.label}</strong>
                <span>{new Date(event.createdAt).toLocaleString("pt-BR")}</span>
                <p>{event.detail}</p>
              </article>
            ))}
          </div>
        ) : null}
      </section>

      <section className="approved-detail-copy-grid">
        <article className="approved-detail-card">
          <p className="section-kicker">Legenda</p>
          <CaptionCopyEditor
            emptyText="Legenda indisponível."
            key={`caption-${view?.caption || ""}`}
            label="Legenda"
            onCopy={() => copyText(view?.caption || "", "Legenda copiada.")}
            onSave={(caption) => saveCaptionCopy({ caption })}
            rows={8}
            value={view?.caption || ""}
          />
        </article>

        <article className="approved-detail-card">
          <p className="section-kicker">Primeiro comentário</p>
          <FirstCommentCopyEditor
            issues={firstCommentIssues}
            key={`first-comment-${view?.firstComment || ""}`}
            onApplySuggestion={applyFirstCommentSuggestion}
            onCopy={() =>
              copyText(
                view?.firstComment || "",
                "Primeiro comentário copiado.",
              )
            }
            onSave={(firstComment) => saveCaptionCopy({ firstComment })}
            suggestion={firstCommentSuggestion}
            value={view?.firstComment || ""}
          />
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

type CarouselSlideEditorProps = {
  brand: BrandProfile;
  carouselPackage: NonNullable<ApprovedPost["carouselPackage"]>;
  isApproved: boolean;
  onRegenerate: () => void;
  onSave: (changes: CarouselSlideCopyEdit) => void;
  slide: CarouselSlide;
};

function FinalPackageNextStep({
  copyQualityReport,
  hasDurableFinalZip,
  post,
  visualQualityReport,
}: {
  copyQualityReport: CopyQualityReport | null;
  hasDurableFinalZip: boolean;
  post: ApprovedPost;
  visualQualityReport: VisualQualityReport | null;
}) {
  const nextStep = getFinalPackageNextStep({
    copyQualityReport,
    hasDurableFinalZip,
    post,
    visualQualityReport,
  });

  return (
    <div className={`package-next-step package-next-step-${nextStep.status}`}>
      <strong>{nextStep.title}</strong>
      <p>{nextStep.body}</p>
      {nextStep.href ? (
        <Link className="secondary-button" href={nextStep.href}>
          {nextStep.action}
        </Link>
      ) : (
        <span>{nextStep.action}</span>
      )}
    </div>
  );
}

function VisualQualityPanel({ report }: { report: VisualQualityReport }) {
  const hasIssues = report.status === "review";

  return (
    <section className="approved-detail-card visual-quality-card">
      <div className="asset-section-heading">
        <div>
          <p className="section-kicker">Quality Gate visual</p>
          <h2>Acabamento da peça</h2>
        </div>
        <span
          className={
            hasIssues
              ? "copy-quality-status copy-quality-status-review"
              : "copy-quality-status copy-quality-status-ok"
          }
        >
          {hasIssues ? "Revisar" : "OK"}
        </span>
      </div>

      <div className="copy-quality-summary">
        <strong>{report.summary}</strong>
        <span>
          {report.blockerCount
            ? "Travas visuais bloqueiam a finalização do pacote."
            : "Sem trava visual bloqueando o pacote final."}
        </span>
      </div>

      <div className="copy-quality-grid">
        {report.checks.map((check) => (
          <article
            className={
              check.status === "ok"
                ? "copy-quality-check copy-quality-check-ok"
                : "copy-quality-check copy-quality-check-review"
            }
            key={check.id}
          >
            <div>
              <span>{check.status === "ok" ? "OK" : "Revisar"}</span>
              <strong>{check.label}</strong>
            </div>
            <p>{check.note}</p>
            {check.issues.length ? (
              <div className="copy-quality-issues">
                {check.issues.map((issue) => (
                  <div className="copy-quality-issue" key={issue.id}>
                    <strong>{issue.label}</strong>
                    <p>{issue.suggestion}</p>
                  </div>
                ))}
              </div>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}

function CopyQualityPanel({
  firstCommentSuggestion,
  onApplyFirstCommentSuggestion,
  report,
  onFixCopy,
}: {
  firstCommentSuggestion: string;
  onApplyFirstCommentSuggestion: () => void;
  report: CopyQualityReport;
  onFixCopy: () => void;
}) {
  const hasIssues = report.status === "review";
  const hasFirstCommentBlocker = report.issues.some(
    (issue) => issue.field === "firstComment" && issue.severity === "blocker",
  );

  return (
    <section className="approved-detail-card copy-quality-card">
      <div className="asset-section-heading">
        <div>
          <p className="section-kicker">Marco 6</p>
          <h2>Quality Gate de Copy</h2>
        </div>
        <span
          className={
            hasIssues
              ? "copy-quality-status copy-quality-status-review"
              : "copy-quality-status copy-quality-status-ok"
          }
        >
          {hasIssues ? "Revisar" : "OK"}
        </span>
      </div>

      {hasFirstCommentBlocker && firstCommentSuggestion ? (
        <div className="copy-suggestion-box copy-quality-suggestion">
          <strong>Sugestão para o primeiro comentário</strong>
          <p>{firstCommentSuggestion}</p>
          <button
            className="secondary-button"
            type="button"
            onClick={onApplyFirstCommentSuggestion}
          >
            Aplicar sugestão
          </button>
        </div>
      ) : null}

      <div className="copy-quality-summary">
        <strong>{report.summary}</strong>
        <span>
          {report.blockerCount
            ? "Travas bloqueiam a finalização do pacote."
            : "Sem trava editorial bloqueando o pacote final."}
        </span>
      </div>

      <div className="copy-quality-actions">
        <button
          className="primary-button"
          type="button"
          onClick={onFixCopy}
          disabled={!report.autoFixableCount}
        >
          Corrigir copy
        </button>
        <span>
          {report.autoFixableCount
            ? "Aplica apenas acentos, espaços, pontuação e travessões."
            : "Os pontos restantes exigem edição manual ou regeneração."}
        </span>
      </div>

      <div className="copy-quality-grid">
        {report.checks.map((check) => (
          <article
            className={
              check.status === "ok"
                ? "copy-quality-check copy-quality-check-ok"
                : "copy-quality-check copy-quality-check-review"
            }
            key={check.id}
          >
            <div>
              <span>{check.status === "ok" ? "OK" : "Revisar"}</span>
              <strong>{check.label}</strong>
            </div>
            <p>{check.note}</p>
            {check.issues.length ? (
              <div className="copy-quality-issues">
                {check.issues.slice(0, 4).map((issue) => (
                  <div className="copy-quality-issue" key={issue.id}>
                    <strong>
                      {issue.fieldLabel}: {issue.label}
                    </strong>
                    <p>{issue.suggestion}</p>
                  </div>
                ))}
              </div>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}

function CaptionCopyEditor({
  emptyText,
  label,
  onCopy,
  onSave,
  rows,
  value,
}: {
  emptyText: string;
  label: string;
  onCopy: () => void;
  onSave: (value: string) => void;
  rows: number;
  value: string;
}) {
  const [draft, setDraft] = useState(value);

  const hasChanges = draft.trim() !== value.trim();

  return (
    <div className="approved-detail-copy copy-edit-panel">
      <label className="field">
        <span>{label}</span>
        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={emptyText}
          rows={rows}
        />
      </label>
      <div className="approved-detail-actions">
        <button
          className="primary-button"
          type="button"
          onClick={() => onSave(draft)}
          disabled={!hasChanges}
        >
          Salvar copy
        </button>
        <button
          className="secondary-button"
          type="button"
          onClick={onCopy}
          disabled={!value}
        >
          Copiar
        </button>
      </div>
    </div>
  );
}

function FirstCommentCopyEditor({
  issues,
  onApplySuggestion,
  onCopy,
  onSave,
  suggestion,
  value,
}: {
  issues: CopyQualityReport["issues"];
  onApplySuggestion: () => void;
  onCopy: () => void;
  onSave: (value: string) => void;
  suggestion: string;
  value: string;
}) {
  const [draft, setDraft] = useState(value);

  const hasChanges = draft.trim() !== value.trim();
  const hasBlocker = issues.some((issue) => issue.severity === "blocker");

  return (
    <div className="approved-detail-copy copy-edit-panel">
      <label className="field">
        <span>Primeiro comentário</span>
        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Ex: Hoje, quem assume essa conversa quando seu time não está online?"
          rows={5}
        />
      </label>

      {hasBlocker && suggestion ? (
        <div className="copy-suggestion-box">
          <strong>Sugestão para destravar</strong>
          <p>{suggestion}</p>
          <button
            className="secondary-button"
            type="button"
            onClick={onApplySuggestion}
          >
            Aplicar sugestão
          </button>
        </div>
      ) : null}

      <div className="approved-detail-actions">
        <button
          className="primary-button"
          type="button"
          onClick={() => onSave(draft)}
          disabled={!hasChanges}
        >
          Salvar comentário
        </button>
        <button
          className="secondary-button"
          type="button"
          onClick={onCopy}
          disabled={!value}
        >
          Copiar comentário
        </button>
      </div>
    </div>
  );
}

function CarouselSlideEditor({
  brand,
  carouselPackage,
  isApproved,
  onRegenerate,
  onSave,
  slide,
}: CarouselSlideEditorProps) {
  const [eyebrow, setEyebrow] = useState(slide.eyebrow);
  const [headline, setHeadline] = useState(slide.headline);
  const [body, setBody] = useState(slide.body);
  const [footer, setFooter] = useState(slide.footer);

  const draftSlide = {
    ...slide,
    eyebrow,
    headline,
    body,
    footer,
  };
  const issues = evaluateCarouselSlideCopy(draftSlide);
  const hasChanges =
    eyebrow !== slide.eyebrow ||
    headline !== slide.headline ||
    body !== slide.body ||
    footer !== slide.footer;

  return (
    <article className="carousel-slide-card">
      <img
        alt={`Slide ${slide.index}: ${headline}`}
        height={1350}
        src={carouselSlideToDataUrl(carouselPackage, draftSlide, brand)}
        width={1080}
      />
      <div className="carousel-slide-card-header">
        <strong>Slide {slide.index}</strong>
        <span>
          {carouselSlideRoleLabels[slide.role]} | Variacao{" "}
          {Math.max(
            0,
            Math.floor(slide.variation ?? carouselPackage.variation ?? 0),
          ) + 1}
        </span>
      </div>
      <label className="field carousel-slide-field">
        <span>Marcador</span>
        <input
          value={eyebrow}
          onChange={(event) => setEyebrow(event.target.value)}
        />
      </label>
      <label className="field carousel-slide-field">
        <span>Headline</span>
        <textarea
          value={headline}
          onChange={(event) => setHeadline(event.target.value)}
          rows={3}
        />
      </label>
      <label className="field carousel-slide-field">
        <span>Apoio</span>
        <textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          rows={4}
        />
      </label>
      <label className="field carousel-slide-field">
        <span>Rodapé</span>
        <input
          value={footer}
          onChange={(event) => setFooter(event.target.value)}
        />
      </label>
      {issues.length ? (
        <div className="carousel-slide-issues" role="alert">
          {issues.slice(0, 3).map((issue, index) => (
            <p key={`${issue.field}-${index}`}>
              <strong>{carouselIssueFieldLabels[issue.field]}:</strong>{" "}
              {issue.label}
            </p>
          ))}
        </div>
      ) : null}
      {isApproved && hasChanges ? (
        <p className="carousel-slide-note">
          Alterar este slide volta o carrossel para revisao.
        </p>
      ) : null}
      <div className="carousel-slide-actions">
        <button
          className="primary-button"
          type="button"
          onClick={() => onSave({ eyebrow, headline, body, footer })}
          disabled={!hasChanges}
        >
          Salvar slide
        </button>
        <button
          className="secondary-button"
          type="button"
          onClick={onRegenerate}
        >
          Regenerar slide
        </button>
      </div>
    </article>
  );
}

const carouselIssueFieldLabels: Record<keyof CarouselSlideCopyEdit, string> = {
  eyebrow: "Marcador",
  headline: "Headline",
  body: "Apoio",
  footer: "Rodapé",
};

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

type FinalPackageFileManifestOptions = {
  carouselIncluded: boolean;
  fileNames: string[];
};

async function buildFinalPackageFiles(
  post: ApprovedPost,
  view: ApprovedPostView,
) {
  const exportSvg = view.assetSvg || view.svg;
  const pngBlob = await svgToPngBlob(exportSvg);
  const baseFileName = `${slugify(post.brandName || "social-studio")}-${slugify(post.title)}`;
  const files: ZipDownloadFile[] = [
    {
      name: "01-post/post-final-1080x1350.png",
      content: pngBlob,
    },
    {
      name: "01-post/post-final.svg",
      content: exportSvg,
    },
    {
      name: "02-copy/legenda.txt",
      content: view.caption,
    },
    {
      name: "02-copy/primeiro-comentario.txt",
      content: view.firstComment || "",
    },
    {
      name: "02-copy/hashtags.txt",
      content: view.hashtags || "",
    },
    {
      name: "02-copy/post-completo.txt",
      content: buildReadyToPublishCopy(view),
    },
    {
      name: "02-copy/pacote-copy.md",
      content: buildCopyPackageMarkdown(post, view),
    },
    {
      name: "04-assets/asset-prompt.txt",
      content: view.selectedAsset?.prompt || "Sem asset visual selecionado.",
    },
    {
      name: "05-metadata/post.json",
      content: JSON.stringify(buildFinalPackageMetadata(post, view), null, 2),
    },
    {
      name: "05-metadata/visual-history.json",
      content: JSON.stringify(post.visualEvents, null, 2),
    },
    {
      name: "05-metadata/carousel-history.json",
      content: JSON.stringify(post.carouselEvents, null, 2),
    },
  ];

  if (view.selectedAsset?.dataUrl) {
    files.push({
      name: "04-assets/selected-asset.png",
      content: dataUrlToBlob(view.selectedAsset.dataUrl),
    });
  } else {
    files.push({
      name: "04-assets/README.md",
      content:
        "Este pacote usa apenas a composicao tipografica renderizada pelo sistema. Nao ha asset visual separado.",
    });
  }

  const carouselIncluded = await appendFinalPackageCarouselFiles(
    files,
    post,
    view,
  );
  const readmeName = "README.md";
  const manifestName = "05-metadata/manifest.json";
  const packageFileNames = [
    readmeName,
    ...files.map((file) => file.name),
    manifestName,
  ];

  files.unshift({
    name: readmeName,
    content: buildFinalPackageReadme(post, view, {
      carouselIncluded,
      fileNames: packageFileNames,
    }),
  });
  files.push({
    name: manifestName,
    content: JSON.stringify(
      buildFinalPackageManifest(post, view, {
        carouselIncluded,
        fileNames: packageFileNames,
      }),
      null,
      2,
    ),
  });

  return {
    baseFileName,
    carouselIncluded,
    files,
  };
}

async function buildDurableUploadFiles(
  post: ApprovedPost,
  view: ApprovedPostView,
) {
  const exportSvg = view.assetSvg || view.svg;
  const finalPngBlob = await svgToPngBlob(exportSvg);
  const baseFileName = `${slugify(post.brandName || "social-studio")}-${slugify(post.title)}`;
  const uploadFiles: DurableUploadFile[] = [
    {
      kind: "final_post_png",
      label: "PNG final 1080x1350",
      fileName: `${baseFileName}-post-final.png`,
      content: finalPngBlob,
      contentType: "image/png",
      metadata: {
        postId: post.id,
        title: post.title,
        source: "final-package",
      },
    },
    {
      kind: "final_post_svg",
      label: "SVG fonte do post",
      fileName: `${baseFileName}-post-final.svg`,
      content: exportSvg,
      contentType: "image/svg+xml;charset=utf-8",
      metadata: {
        postId: post.id,
        title: post.title,
        source: "final-package",
      },
    },
  ];

  if (view.selectedAsset?.dataUrl) {
    uploadFiles.push({
      kind: "selected_asset",
      label: "Asset visual selecionado",
      fileName: `${baseFileName}-asset-selecionado.png`,
      content: dataUrlToBlob(view.selectedAsset.dataUrl),
      contentType: view.selectedAsset.mediaType || "image/png",
      metadata: {
        assetId: view.selectedAsset.id,
        provider: view.selectedAsset.provider,
        model: view.selectedAsset.model,
        prompt: view.selectedAsset.prompt,
        generatedAt: view.selectedAsset.generatedAt,
        mediaType: view.selectedAsset.mediaType,
      },
    });
  }

  if (post.carouselPackage && post.carouselStatus === "approved") {
    for (const slide of post.carouselPackage.slides) {
      const slideNumber = String(slide.index).padStart(2, "0");
      const svg = renderCarouselSlideSvg(post.carouselPackage, slide, view.brand);
      const pngBlob = await svgToPngBlob(svg);

      uploadFiles.push(
        {
          kind: "carousel_slide_png",
          label: `Slide ${slideNumber} PNG`,
          fileName: `${baseFileName}-slide-${slideNumber}.png`,
          content: pngBlob,
          contentType: "image/png",
          metadata: {
            carouselId: post.carouselPackage.id,
            slideId: slide.id,
            slideIndex: slide.index,
          },
        },
        {
          kind: "carousel_slide_svg",
          label: `Slide ${slideNumber} SVG`,
          fileName: `${baseFileName}-slide-${slideNumber}.svg`,
          content: svg,
          contentType: "image/svg+xml;charset=utf-8",
          metadata: {
            carouselId: post.carouselPackage.id,
            slideId: slide.id,
            slideIndex: slide.index,
          },
        },
      );
    }

    const carouselZipBlob = await createZipBlob(
      await buildCarouselZipFiles(post, view),
    );

    uploadFiles.push({
      kind: "carousel_zip",
      label: "ZIP do carrossel",
      fileName: `${baseFileName}-carrossel.zip`,
      content: carouselZipBlob,
      contentType: "application/zip",
      metadata: {
        carouselId: post.carouselPackage.id,
        slideCount: post.carouselPackage.slides.length,
      },
    });
  }

  const finalPackage = await buildFinalPackageFiles(post, view);
  const finalZipBlob = await createZipBlob(finalPackage.files);

  uploadFiles.push({
    kind: "final_package_zip",
    label: "ZIP final completo",
    fileName: `${finalPackage.baseFileName}-pacote-final.zip`,
    content: finalZipBlob,
    contentType: "application/zip",
    metadata: {
      postId: post.id,
      title: post.title,
      carouselIncluded: finalPackage.carouselIncluded,
      fileCount: finalPackage.files.length,
    },
  });

  return uploadFiles;
}

async function uploadDurableOutputFile(
  approvedPost: ApprovedPost,
  file: DurableUploadFile,
  blob: Blob,
) {
  if (shouldUseDirectStudioUpload(file, blob)) {
    return uploadStudioOutputBlob({
      approvedPostId: approvedPost.id,
      projectId: approvedPost.projectSnapshot.id,
      kind: file.kind,
      label: file.label,
      fileName: file.fileName,
      contentType: file.contentType,
      content: blob,
      metadata: file.metadata,
    });
  }

  return uploadStudioOutput({
    approvedPostId: approvedPost.id,
    projectId: approvedPost.projectSnapshot.id,
    kind: file.kind,
    label: file.label,
    fileName: file.fileName,
    contentType: file.contentType,
    dataBase64: await blobToBase64(blob),
    metadata: file.metadata,
  });
}

function shouldUseDirectStudioUpload(file: DurableUploadFile, blob: Blob) {
  return (
    file.kind === "final_package_zip" ||
    blob.size >= DIRECT_STUDIO_UPLOAD_MIN_BYTES
  );
}

function getDurableUploadFileStableKey(file: DurableUploadFile) {
  return getStudioOutputStableKey({
    kind: file.kind,
    fileName: file.fileName,
    metadata: file.metadata,
  });
}

async function buildCarouselZipFiles(
  post: ApprovedPost,
  view: ApprovedPostView,
) {
  if (!post.carouselPackage) {
    return [];
  }

  const files: ZipDownloadFile[] = [];

  for (const slide of post.carouselPackage.slides) {
    const svg = renderCarouselSlideSvg(post.carouselPackage, slide, view.brand);
    const pngBlob = await svgToPngBlob(svg);

    files.push({
      name: `slides/slide-${String(slide.index).padStart(2, "0")}.png`,
      content: pngBlob,
    });
  }

  files.push(
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
      name: "roteiro.txt",
      content: buildCarouselScript(post),
    },
    {
      name: "metadata.json",
      content: JSON.stringify(
        {
          postId: post.id,
          title: post.title,
          brandName: post.brandName,
          carouselPackage: post.carouselPackage,
        },
        null,
        2,
      ),
    },
  );

  return files;
}

async function appendFinalPackageCarouselFiles(
  files: ZipDownloadFile[],
  post: ApprovedPost,
  view: ApprovedPostView,
) {
  if (!post.carouselPackage || post.carouselStatus !== "approved") {
    files.push({
      name: "03-carrossel/README.md",
      content: [
        "# Carrossel",
        "",
        "Nenhum carrossel aprovado foi incluido neste pacote.",
        "",
        post.carouselPackage
          ? "Existe um carrossel em revisao. Aprove o carrossel antes de baixar o pacote final se quiser incluir os slides."
          : "Gere e aprove um carrossel antes de baixar o pacote final se quiser incluir os slides.",
      ].join("\n"),
    });

    return false;
  }

  for (const slide of post.carouselPackage.slides) {
    const slideNumber = String(slide.index).padStart(2, "0");
    const svg = renderCarouselSlideSvg(post.carouselPackage, slide, view.brand);
    const pngBlob = await svgToPngBlob(svg);

    files.push(
      {
        name: `03-carrossel/slides/slide-${slideNumber}.png`,
        content: pngBlob,
      },
      {
        name: `03-carrossel/source/slide-${slideNumber}.svg`,
        content: svg,
      },
    );
  }

  files.push(
    {
      name: "03-carrossel/roteiro.md",
      content: buildCarouselScript(post),
    },
    {
      name: "03-carrossel/metadata.json",
      content: JSON.stringify(
        {
          status: post.carouselStatus,
          approvedAt: post.carouselApprovedAt,
          package: post.carouselPackage,
        },
        null,
        2,
      ),
    },
  );

  return true;
}

function buildReadyToPublishCopy(view: ApprovedPostView) {
  return [
    view.caption,
    view.firstComment ? `Primeiro comentario:\n${view.firstComment}` : "",
    view.hashtags ? `Hashtags:\n${view.hashtags}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}

function buildCopyPackageMarkdown(post: ApprovedPost, view: ApprovedPostView) {
  return [
    `# Copy do post - ${post.title}`,
    "",
    "## Legenda",
    "",
    view.caption || "Sem legenda.",
    "",
    "## Primeiro comentario",
    "",
    view.firstComment || "Sem primeiro comentario.",
    "",
    "## Hashtags",
    "",
    view.hashtags || "Sem hashtags.",
    "",
    "## Copy visual",
    "",
    `Headline: ${view.typographicPiece.copy.headline}`,
    view.typographicPiece.copy.support
      ? `Apoio: ${view.typographicPiece.copy.support}`
      : "",
    view.typographicPiece.copy.cta ? `CTA: ${view.typographicPiece.copy.cta}` : "",
  ]
    .filter(Boolean)
    .join("\n");
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
    carousel: post.carouselPackage
      ? {
          status: post.carouselStatus,
          approvedAt: post.carouselApprovedAt,
          packageId: post.carouselPackage.id,
          renderer: post.carouselPackage.renderer,
          slideCount: post.carouselPackage.slides.length,
        }
      : null,
    notes: post.notes,
  };
}

function buildFinalPackageManifest(
  post: ApprovedPost,
  view: ApprovedPostView,
  options: FinalPackageFileManifestOptions,
) {
  return {
    packageType: "social-studio-final-post-package",
    packageVersion: 2,
    exportedAt: new Date().toISOString(),
    postId: post.id,
    title: post.title,
    brandName: post.brandName,
    finalPackageStatus: post.finalPackageStatus,
    finalPackageReadyAt: post.finalPackageReadyAt,
    includes: {
      finalPostPng: true,
      finalPostSvg: true,
      copy: true,
      selectedAsset: Boolean(view.selectedAsset?.dataUrl),
      approvedCarousel: options.carouselIncluded,
      metadata: true,
    },
    copy: {
      captionIncluded: Boolean(view.caption),
      firstCommentIncluded: Boolean(view.firstComment),
      hashtagCount: view.captionVariant.hashtags.length,
    },
    carousel: {
      status: post.carouselStatus,
      included: options.carouselIncluded,
      slideCount:
        options.carouselIncluded && post.carouselPackage
          ? post.carouselPackage.slides.length
          : 0,
      approvedAt: post.carouselApprovedAt,
    },
    files: options.fileNames,
  };
}

function buildFinalPackageReadme(
  post: ApprovedPost,
  view: ApprovedPostView,
  options: FinalPackageFileManifestOptions,
) {
  return [
    `# Pacote final - ${post.title}`,
    "",
    `Titulo: ${post.title}`,
    `Marca: ${post.brandName}`,
    `Status: ${post.finalPackageStatus === "ready" ? "pronto" : "em aberto"}`,
    post.finalPackageReadyAt
      ? `Finalizado em: ${new Date(post.finalPackageReadyAt).toLocaleString("pt-BR")}`
      : "",
    "",
    "## Como usar",
    "",
    "1. Use `01-post/post-final-1080x1350.png` como imagem principal do post.",
    "2. Use `02-copy/legenda.txt`, `02-copy/primeiro-comentario.txt` e `02-copy/hashtags.txt` para publicacao.",
    "3. Se o carrossel estiver incluido, use os PNGs em `03-carrossel/slides/` na ordem numerica.",
    "4. Consulte `05-metadata/manifest.json` para ver tudo que foi incluido.",
    "",
    "## Conteudo incluido",
    "",
    "- Post final em PNG 1080x1350.",
    "- SVG fonte do post final.",
    "- Legenda, primeiro comentario, hashtags e pacote de copy consolidado.",
    options.carouselIncluded
      ? `- Carrossel aprovado com ${post.carouselPackage?.slides.length || 0} slides em PNG e SVG.`
      : "- Carrossel nao incluido porque ainda nao existe carrossel aprovado.",
    view.selectedAsset
      ? "- Asset visual selecionado e prompt do asset."
      : "- Sem asset visual separado; a entrega usa apenas a composicao final.",
    "- Metadados, historico visual e historico do carrossel.",
    "",
    "## Arquivos",
    "",
    ...options.fileNames.map((fileName) => `- ${fileName}`),
  ]
    .filter(Boolean)
    .join("\n");
}

function buildCarouselScript(post: ApprovedPost) {
  if (!post.carouselPackage) {
    return "";
  }

  return [
    `Carrossel: ${post.title}`,
    `Marca: ${post.brandName}`,
    `Gerado em: ${new Date(post.carouselPackage.generatedAt).toLocaleString("pt-BR")}`,
    "",
    ...post.carouselPackage.slides.flatMap((slide) => [
      `Slide ${slide.index} - ${slide.eyebrow}`,
      slide.headline,
      slide.body,
      slide.footer ? `Rodapé: ${slide.footer}` : "",
      "",
    ]),
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

async function blobToBase64(blob: Blob) {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Falha ao ler arquivo."));
    reader.readAsDataURL(blob);
  });

  return dataUrl.split(",")[1] || "";
}

function mergeStudioOutputLinks(
  currentOutputs: StudioOutputLink[],
  nextOutputs: StudioOutputLink[],
) {
  return dedupeStudioOutputs([...currentOutputs, ...nextOutputs]);
}

function mergeDurableOutputLinks(
  durableOutputs: StudioOutputRecord[],
  signedOutputs: StudioOutputLink[],
) {
  const signedByStableKey = new Map(
    dedupeStudioOutputs(signedOutputs).map((output) => [
      getStudioOutputStableKey(output),
      output,
    ]),
  );
  const signedByPath = new Map(
    signedOutputs.map((output) => [output.objectPath, output]),
  );

  return dedupeStudioOutputs([
    ...durableOutputs,
    ...signedOutputs.map(stripSignedOutputFields),
  ]).map((output) => {
    const signedOutput =
      signedByPath.get(output.objectPath) ||
      signedByStableKey.get(getStudioOutputStableKey(output));

    return {
      ...output,
      signedUrl: signedOutput?.signedUrl,
      signedUrlExpiresAt: signedOutput?.signedUrlExpiresAt,
    };
  }) satisfies DurableOutputDisplay[];
}

function getFinalPackageNextStep({
  copyQualityReport,
  hasDurableFinalZip,
  post,
  visualQualityReport,
}: {
  copyQualityReport: CopyQualityReport | null;
  hasDurableFinalZip: boolean;
  post: ApprovedPost;
  visualQualityReport: VisualQualityReport | null;
}) {
  if (copyQualityReport?.blockerCount) {
    return {
      status: "review",
      title: "Corrigir copy antes de fechar",
      body: "O pacote ainda tem trava editorial. Corrija a legenda, comentário ou slides marcados no Quality Gate.",
      action: "Use o botão Corrigir copy ou edite manualmente abaixo.",
    };
  }

  if (visualQualityReport?.blockerCount) {
    return {
      status: "review",
      title: "Corrigir visual antes de fechar",
      body: "A peça final tem uma trava estrutural, como formato inválido ou asset rejeitado.",
      action: "Ajuste o visual e revise o gate visual.",
    };
  }

  if (post.finalPackageStatus !== "ready") {
    return {
      status: "ready",
      title: "Próximo passo: finalizar pacote",
      body: "Copy e visual não têm travas bloqueantes. Finalize para congelar a entrega e liberar ZIP/storage.",
      action: "Clique em Finalizar pacote.",
    };
  }

  if (!hasDurableFinalZip) {
    return {
      status: "ready",
      title: "Próximo passo: salvar no storage",
      body: "O pacote está finalizado, mas ainda precisa de arquivo durável para aparecer completo em Entregas.",
      action: "Clique em Salvar no storage.",
    };
  }

  return {
    status: "done",
    title: "Entrega fechada",
    body: "O pacote final já tem ZIP durável salvo. A próxima ação é revisar a entrega ou criar uma nova variação.",
    action: "Abrir entrega",
    href: `/outputs/${encodeURIComponent(post.id)}`,
  };
}

function formatBytes(value: number) {
  if (!value) {
    return "0 KB";
  }

  if (value < 1024 * 1024) {
    return `${Math.max(1, Math.round(value / 1024))} KB`;
  }

  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}
