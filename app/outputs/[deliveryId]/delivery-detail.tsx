"use client";

/* eslint-disable @next/next/no-img-element -- delivery previews use short-lived signed storage URLs */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  BRAND_PROFILE_STORAGE_KEY,
  type BrandProfile,
} from "../../../lib/brand/profile";
import {
  APPROVED_POSTS_STORAGE_KEY,
  createDuplicateProjectFromApprovedPost,
  parseApprovedPosts,
  upsertApprovedPost,
  type ApprovedPost,
} from "../../../lib/creative/approved-posts";
import { CREATIVE_PROJECT_STORAGE_KEY } from "../../../lib/creative/concepts";
import {
  fetchStudioProjectRecord,
  type StudioProjectRecord,
} from "../../../lib/persistence/studio-projects";
import {
  deliveryOperationalStatusLabels,
  getDeliveryStatus,
  readDeliveryStatuses,
  writeDeliveryStatus,
  type DeliveryOperationalStatus,
  type DeliveryStatusMap,
} from "../../../lib/storage/delivery-statuses";
import {
  fetchStudioOutputPackages,
  outputKindLabels,
  type StudioOutputKind,
  type StudioOutputLink,
  type StudioOutputPackage,
} from "../../../lib/storage/studio-outputs";

type DeliveryDetailProps = {
  deliveryId: string;
};

export function DeliveryDetail({ deliveryId }: DeliveryDetailProps) {
  const router = useRouter();
  const [deliveryPackage, setDeliveryPackage] =
    useState<StudioOutputPackage | null>(null);
  const [projectRecord, setProjectRecord] = useState<StudioProjectRecord | null>(
    null,
  );
  const [status, setStatus] = useState("Carregando entrega.");
  const [isLoading, setIsLoading] = useState(true);
  const [operationalStatuses, setOperationalStatuses] =
    useState<DeliveryStatusMap>({});

  useEffect(() => {
    // The operational delivery status is local while publishing is manual.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOperationalStatuses(readDeliveryStatuses());
    void loadDelivery();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deliveryId]);

  const operationalStatus = getDeliveryStatus(
    operationalStatuses,
    deliveryPackage?.id || deliveryId,
  );
  const finalPng = useMemo(
    () => getOutputByKind(deliveryPackage?.outputs || [], "final_post_png"),
    [deliveryPackage?.outputs],
  );
  const finalSvg = useMemo(
    () => getOutputByKind(deliveryPackage?.outputs || [], "final_post_svg"),
    [deliveryPackage?.outputs],
  );
  const finalZip = useMemo(
    () => getOutputByKind(deliveryPackage?.outputs || [], "final_package_zip"),
    [deliveryPackage?.outputs],
  );
  const selectedAsset = useMemo(
    () => getOutputByKind(deliveryPackage?.outputs || [], "selected_asset"),
    [deliveryPackage?.outputs],
  );
  const carouselZip = useMemo(
    () => getOutputByKind(deliveryPackage?.outputs || [], "carousel_zip"),
    [deliveryPackage?.outputs],
  );
  const carouselSlides = useMemo(
    () => getCarouselSlideOutputs(deliveryPackage?.outputs || []),
    [deliveryPackage?.outputs],
  );
  const captionWithHashtags = deliveryPackage
    ? buildCaptionWithHashtags(deliveryPackage)
    : "";

  async function loadDelivery() {
    setIsLoading(true);
    setStatus("Carregando entrega do storage.");

    try {
      const packages = await fetchStudioOutputPackages();
      const nextDelivery =
        packages.find((item) => item.id === deliveryId) ||
        packages.find((item) => item.approvedPostId === deliveryId) ||
        null;

      if (!nextDelivery) {
        setDeliveryPackage(null);
        setStatus("Entrega nao encontrada no storage.");
        return;
      }

      setDeliveryPackage(nextDelivery);
      setStatus("Entrega carregada.");

      void fetchStudioProjectRecord(nextDelivery.approvedPostId)
        .then((record) => setProjectRecord(record))
        .catch(() => setProjectRecord(null));
    } catch (error) {
      setDeliveryPackage(null);
      setStatus(
        error instanceof Error
          ? error.message
          : "Nao foi possivel carregar a entrega.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  async function copyText(value: string, successMessage: string) {
    if (!value.trim()) {
      setStatus("Nao ha texto para copiar.");
      return;
    }

    try {
      await navigator.clipboard.writeText(value);
      setStatus(successMessage);
      window.setTimeout(() => setStatus(""), 2400);
    } catch {
      setStatus("Nao foi possivel copiar automaticamente.");
    }
  }

  function updateOperationalStatus(nextStatus: DeliveryOperationalStatus) {
    const targetDeliveryId = deliveryPackage?.id || deliveryId;

    setOperationalStatuses(writeDeliveryStatus(targetDeliveryId, nextStatus));
    setStatus(`Entrega marcada como ${deliveryOperationalStatusLabels[nextStatus]}.`);
    window.setTimeout(() => setStatus(""), 2600);
  }

  function recoverApprovedPost() {
    const approvedPost = projectRecord?.approvedPostData;

    if (!approvedPost) {
      setStatus("Post aprovado ainda nao foi carregado do banco.");
      return;
    }

    saveApprovedPostLocally(approvedPost);
    saveProjectSnapshot(
      approvedPost.projectSnapshot.brandSnapshot,
      approvedPost.projectSnapshot,
    );
    router.push(`/approved/${encodeURIComponent(approvedPost.id)}`);
  }

  function duplicateDelivery() {
    const approvedPost = projectRecord?.approvedPostData;

    if (!approvedPost) {
      setStatus("Post aprovado ainda nao foi carregado do banco.");
      return;
    }

    const duplicateProject = createDuplicateProjectFromApprovedPost(approvedPost);

    saveApprovedPostLocally(approvedPost);
    saveProjectSnapshot(duplicateProject.brandSnapshot, duplicateProject);
    router.push("/create#typographic-piece");
  }

  if (!deliveryPackage) {
    return (
      <main className="brand-shell deliveries-shell">
        <DeliveryNav />
        <section className="approved-empty">
          <strong>{isLoading ? "Carregando entrega." : "Entrega não encontrada."}</strong>
          <p>{status}</p>
          <button
            className="secondary-button"
            type="button"
            onClick={loadDelivery}
            disabled={isLoading}
          >
            Atualizar
          </button>
          <Link className="primary-button" href="/outputs">
            Voltar para entregas
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="brand-shell delivery-detail-shell">
      <header className="brand-header">
        <DeliveryNav />
        <div>
          <p className="eyebrow">Entrega salva</p>
          <h1>{deliveryPackage.title}</h1>
          <p className="lead">
            Pacote final salvo no storage, com imagem, copy, carrossel,
            metadados e arquivos prontos para publicação manual.
          </p>
        </div>
      </header>

      <section className="projects-toolbar" aria-label="Resumo da entrega">
        <div>
          <strong>{deliveryPackage.hasFinalZip ? "OK" : "Pendente"}</strong>
          <span>ZIP final</span>
        </div>
        <div>
          <strong>{deliveryPackage.outputCount}</strong>
          <span>arquivos</span>
        </div>
        <div>
          <strong>{carouselSlides.length}</strong>
          <span>slides</span>
        </div>
        <div>
          <strong>{formatBytes(deliveryPackage.totalSizeBytes)}</strong>
          <span>tamanho</span>
        </div>
        <button
          className="secondary-button"
          type="button"
          onClick={loadDelivery}
          disabled={isLoading}
        >
          {isLoading ? "Atualizando..." : "Atualizar"}
        </button>
        <span className="next-step-status" role="status">
          {status}
        </span>
      </section>

      <section className="delivery-detail-hero">
        <article className="delivery-preview-panel">
          {finalPng ? (
            <img
              alt={`Post final ${deliveryPackage.title}`}
              height={1350}
              src={finalPng.signedUrl}
              width={1080}
            />
          ) : (
            <div className="asset-composite-empty">
              <strong>Sem PNG final</strong>
              <p>Salve o pacote no storage novamente para gerar o PNG final.</p>
            </div>
          )}
        </article>

        <article className="approved-detail-card delivery-operation-card">
          <p className="section-kicker">Operação</p>
          <h2>Pacote pronto para usar</h2>
          <label className="delivery-status-select delivery-status-select-full">
            <span>Status manual</span>
            <select
              value={operationalStatus}
              onChange={(event) =>
                updateOperationalStatus(
                  event.target.value as DeliveryOperationalStatus,
                )
              }
            >
              {Object.entries(deliveryOperationalStatusLabels).map(
                ([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ),
              )}
            </select>
          </label>
          <div className="delivery-action-stack">
            {finalZip ? (
              <a
                className="primary-button"
                href={finalZip.signedUrl}
                rel="noreferrer"
                target="_blank"
              >
                Baixar ZIP final
              </a>
            ) : null}
            {finalPng ? (
              <a
                className="secondary-button"
                href={finalPng.signedUrl}
                rel="noreferrer"
                target="_blank"
              >
                Abrir PNG
              </a>
            ) : null}
            {finalSvg ? (
              <a
                className="secondary-button"
                href={finalSvg.signedUrl}
                rel="noreferrer"
                target="_blank"
              >
                Abrir SVG
              </a>
            ) : null}
            {carouselZip ? (
              <a
                className="secondary-button"
                href={carouselZip.signedUrl}
                rel="noreferrer"
                target="_blank"
              >
                Baixar ZIP do carrossel
              </a>
            ) : null}
            <button
              className="secondary-button"
              type="button"
              onClick={recoverApprovedPost}
              disabled={!projectRecord?.approvedPostData}
            >
              Retomar post
            </button>
            <button
              className="secondary-button"
              type="button"
              onClick={duplicateDelivery}
              disabled={!projectRecord?.approvedPostData}
            >
              Criar variação
            </button>
          </div>
        </article>
      </section>

      <section className="approved-detail-copy-grid">
        <CopyCard
          label="Legenda"
          onCopy={() => copyText(captionWithHashtags, "Legenda copiada.")}
          value={captionWithHashtags}
        />
        <CopyCard
          label="Primeiro comentário"
          onCopy={() =>
            copyText(
              deliveryPackage.firstComment,
              "Primeiro comentário copiado.",
            )
          }
          value={deliveryPackage.firstComment || "Sem primeiro comentário."}
        />
        <CopyCard
          label="Hashtags"
          onCopy={() =>
            copyText(deliveryPackage.hashtags.join(" "), "Hashtags copiadas.")
          }
          value={deliveryPackage.hashtags.join(" ") || "Sem hashtags."}
        />
        <CopyCard
          label="Prompt do asset"
          onCopy={() =>
            copyText(deliveryPackage.visualAssetPrompt, "Prompt copiado.")
          }
          value={deliveryPackage.visualAssetPrompt || "Sem prompt de asset."}
        />
      </section>

      {carouselSlides.length ? (
        <section className="approved-detail-card">
          <div className="asset-section-heading">
            <div>
              <p className="section-kicker">Carrossel</p>
              <h2>Slides salvos</h2>
            </div>
            <span className="delivery-chip">
              {carouselSlides.length} slides
            </span>
          </div>
          <div className="delivery-slide-grid">
            {carouselSlides.map((slide) => (
              <a
                className="delivery-slide-link"
                href={slide.signedUrl}
                key={slide.id}
                rel="noreferrer"
                target="_blank"
              >
                <img
                  alt={slide.label || `Slide ${readSlideIndex(slide)}`}
                  height={1350}
                  src={slide.signedUrl}
                  width={1080}
                />
                <span>Slide {readSlideIndex(slide)}</span>
              </a>
            ))}
          </div>
        </section>
      ) : null}

      <section className="approved-detail-card">
        <div className="asset-section-heading">
          <div>
            <p className="section-kicker">Arquivos</p>
            <h2>Conteúdo salvo</h2>
          </div>
          <span className="delivery-chip">
            {deliveryPackage.outputCount} arquivos
          </span>
        </div>
        <div className="durable-output-list">
          {deliveryPackage.outputs.map((output) => (
            <a
              className="durable-output-item"
              href={output.signedUrl}
              key={output.id}
              rel="noreferrer"
              target="_blank"
            >
              <div>
                <strong>{output.label || outputKindLabels[output.kind]}</strong>
                <span>
                  {output.fileName} | {formatBytes(output.sizeBytes)}
                </span>
              </div>
              <span>Abrir</span>
            </a>
          ))}
        </div>
      </section>

      <section className="approved-detail-card">
        <p className="section-kicker">Metadados</p>
        <div className="delivery-metadata-grid">
          <MetadataItem label="Marca" value={deliveryPackage.brandName} />
          <MetadataItem
            label="Salvo em"
            value={new Date(deliveryPackage.savedAt).toLocaleString("pt-BR")}
          />
          <MetadataItem
            label="Asset"
            value={
              selectedAsset
                ? `${deliveryPackage.visualAssetProvider || "provider"} / ${
                    deliveryPackage.visualAssetModel || "modelo"
                  }`
                : "Sem asset separado"
            }
          />
          <MetadataItem
            label="Status"
            value={deliveryOperationalStatusLabels[operationalStatus]}
          />
        </div>
      </section>
    </main>
  );
}

function DeliveryNav() {
  return (
    <div className="nav-row">
      <Link className="text-link" href="/">
        Inicio
      </Link>
      <Link className="text-link" href="/create">
        Criar post
      </Link>
      <Link className="text-link" href="/approved">
        Posts aprovados
      </Link>
      <Link className="text-link" href="/outputs">
        Entregas
      </Link>
    </div>
  );
}

function CopyCard({
  label,
  onCopy,
  value,
}: {
  label: string;
  onCopy: () => void;
  value: string;
}) {
  return (
    <article className="approved-detail-card">
      <p className="section-kicker">{label}</p>
      <div className="approved-detail-copy">
        <p>{value}</p>
        <button
          className="secondary-button"
          type="button"
          onClick={onCopy}
          disabled={!value || value.startsWith("Sem ")}
        >
          Copiar
        </button>
      </div>
    </article>
  );
}

function MetadataItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <strong>{label}</strong>
      <span>{value}</span>
    </div>
  );
}

function getOutputByKind(
  outputs: StudioOutputLink[],
  kind: StudioOutputKind,
) {
  return outputs.find((output) => output.kind === kind) || null;
}

function getCarouselSlideOutputs(outputs: StudioOutputLink[]) {
  return outputs
    .filter((output) => output.kind === "carousel_slide_png")
    .sort((a, b) => readSlideIndex(a) - readSlideIndex(b));
}

function readSlideIndex(output: StudioOutputLink) {
  const value = output.metadata.slideIndex;

  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsedValue = Number(value);

    if (Number.isFinite(parsedValue)) {
      return parsedValue;
    }
  }

  return 0;
}

function buildCaptionWithHashtags(deliveryPackage: StudioOutputPackage) {
  return [
    deliveryPackage.caption.trim(),
    deliveryPackage.hashtags.length
      ? deliveryPackage.hashtags.join(" ").trim()
      : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}

function saveProjectSnapshot(brand: BrandProfile, project: unknown) {
  window.localStorage.setItem(BRAND_PROFILE_STORAGE_KEY, JSON.stringify(brand));
  window.localStorage.setItem(
    CREATIVE_PROJECT_STORAGE_KEY,
    JSON.stringify(project),
  );
}

function saveApprovedPostLocally(approvedPost: ApprovedPost) {
  const currentPosts = parseApprovedPosts(
    JSON.parse(window.localStorage.getItem(APPROVED_POSTS_STORAGE_KEY) || "[]"),
  );
  const nextPosts = upsertApprovedPost(currentPosts, approvedPost);

  window.localStorage.setItem(
    APPROVED_POSTS_STORAGE_KEY,
    JSON.stringify(nextPosts),
  );
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
