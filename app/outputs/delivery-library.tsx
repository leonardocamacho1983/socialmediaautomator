"use client";

/* eslint-disable @next/next/no-img-element -- delivery previews use short-lived signed storage URLs */

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  deliveryOperationalStatusLabels,
  getDeliveryStatus,
  readDeliveryStatuses,
  writeDeliveryStatus,
  type DeliveryOperationalStatus,
  type DeliveryStatusMap,
} from "../../lib/storage/delivery-statuses";
import {
  fetchStudioOutputPackages,
  outputKindLabels,
  type StudioOutputKind,
  type StudioOutputLink,
  type StudioOutputPackage,
} from "../../lib/storage/studio-outputs";

type DeliveryFilter =
  | "all"
  | "final_zip"
  | "carousel"
  | "asset"
  | "copy_ready";

const deliveryFilterLabels: Record<DeliveryFilter, string> = {
  all: "Todas",
  final_zip: "ZIP final",
  carousel: "Com carrossel",
  asset: "Com asset",
  copy_ready: "Copy pronta",
};

const primaryOutputKinds: StudioOutputKind[] = [
  "final_post_png",
  "final_package_zip",
  "carousel_zip",
  "selected_asset",
  "final_post_svg",
];

export function DeliveryLibrary() {
  const [packages, setPackages] = useState<StudioOutputPackage[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [deliveryFilter, setDeliveryFilter] =
    useState<DeliveryFilter>("all");
  const [isLoading, setIsLoading] = useState(true);
  const [status, setStatus] = useState("Carregando entregas do storage.");
  const [operationalStatuses, setOperationalStatuses] =
    useState<DeliveryStatusMap>({});

  useEffect(() => {
    // The operational delivery status is local because publishing is not in scope yet.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOperationalStatuses(readDeliveryStatuses());
    void loadPackages();
  }, []);

  const stats = useMemo(() => buildDeliveryStats(packages), [packages]);
  const normalizedSearchTerm = normalizeText(searchTerm);
  const visiblePackages = useMemo(
    () =>
      packages.filter((deliveryPackage) => {
        if (!matchesDeliveryFilter(deliveryPackage, deliveryFilter)) {
          return false;
        }

        if (!normalizedSearchTerm) {
          return true;
        }

        return normalizeText(buildPackageSearchText(deliveryPackage)).includes(
          normalizedSearchTerm,
        );
      }),
    [deliveryFilter, normalizedSearchTerm, packages],
  );

  async function loadPackages() {
    setIsLoading(true);
    setStatus("Carregando entregas do storage.");

    try {
      const nextPackages = await fetchStudioOutputPackages();

      setPackages(nextPackages);
      setStatus(
        nextPackages.length
          ? "Entregas carregadas do storage."
          : "Nenhuma entrega salva no storage ainda.",
      );
    } catch (error) {
      setPackages([]);
      setStatus(
        error instanceof Error
          ? error.message
          : "Nao foi possivel carregar as entregas.",
      );
    } finally {
      setIsLoading(false);
    }
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

  function updateOperationalStatus(
    deliveryId: string,
    nextStatus: DeliveryOperationalStatus,
  ) {
    setOperationalStatuses(writeDeliveryStatus(deliveryId, nextStatus));
    setStatus(`Entrega marcada como ${deliveryOperationalStatusLabels[nextStatus]}.`);
    window.setTimeout(() => setStatus(""), 2600);
  }

  return (
    <main className="brand-shell deliveries-shell">
      <header className="brand-header">
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
          <Link className="text-link" href="/projects">
            Projetos
          </Link>
        </div>
        <div>
          <p className="eyebrow">Marco 9</p>
          <h1>Entregas</h1>
          <p className="lead">
            Biblioteca dos pacotes finais salvos no storage. Use esta tela para
            voltar em PNGs, ZIPs, carrosséis e copy pronta para publicação
            manual.
          </p>
        </div>
      </header>

      <section className="projects-toolbar" aria-label="Resumo das entregas">
        <div>
          <strong>{packages.length}</strong>
          <span>{packages.length === 1 ? "entrega salva" : "entregas salvas"}</span>
        </div>
        <div>
          <strong>{stats.finalZipCount}</strong>
          <span>com ZIP final</span>
        </div>
        <div>
          <strong>{stats.carouselCount}</strong>
          <span>com carrossel</span>
        </div>
        <div>
          <strong>{stats.outputCount}</strong>
          <span>arquivos</span>
        </div>
        <button
          className="primary-button"
          type="button"
          onClick={loadPackages}
          disabled={isLoading}
        >
          {isLoading ? "Atualizando..." : "Atualizar"}
        </button>
        <span className="next-step-status" role="status">
          {status}
        </span>
      </section>

      <section className="approved-filter-panel" aria-label="Filtros de entrega">
        <label className="field approved-search-field">
          <span>Busca</span>
          <input
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Buscar por titulo, marca, legenda, arquivo ou hashtag"
          />
        </label>
        <label className="field">
          <span>Tipo</span>
          <select
            value={deliveryFilter}
            onChange={(event) =>
              setDeliveryFilter(event.target.value as DeliveryFilter)
            }
          >
            {Object.entries(deliveryFilterLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <div className="approved-filter-summary">
          <strong>
            {visiblePackages.length} de {packages.length}
          </strong>
          <span>
            {visiblePackages.length === 1
              ? "entrega visivel"
              : "entregas visiveis"}
          </span>
        </div>
        {searchTerm.trim() || deliveryFilter !== "all" ? (
          <button
            className="secondary-button"
            type="button"
            onClick={() => {
              setSearchTerm("");
              setDeliveryFilter("all");
            }}
          >
            Limpar filtros
          </button>
        ) : null}
      </section>

      {visiblePackages.length ? (
        <section className="deliveries-grid" aria-label="Entregas salvas">
          {visiblePackages.map((deliveryPackage) => (
            <DeliveryPackageCard
              deliveryPackage={deliveryPackage}
              key={deliveryPackage.id}
              operationalStatus={getDeliveryStatus(
                operationalStatuses,
                deliveryPackage.id,
              )}
              onCopy={copyText}
              onStatusChange={updateOperationalStatus}
            />
          ))}
        </section>
      ) : (
        <section className="approved-empty">
          <strong>Nenhuma entrega encontrada.</strong>
          <p>
            Finalize um pacote, clique em salvar no storage e volte aqui para
            ver os arquivos persistidos.
          </p>
          <Link className="primary-button" href="/approved">
            Ver posts aprovados
          </Link>
        </section>
      )}
    </main>
  );
}

function DeliveryPackageCard({
  deliveryPackage,
  operationalStatus,
  onCopy,
  onStatusChange,
}: {
  deliveryPackage: StudioOutputPackage;
  operationalStatus: DeliveryOperationalStatus;
  onCopy: (value: string, successMessage: string) => void;
  onStatusChange: (
    deliveryId: string,
    nextStatus: DeliveryOperationalStatus,
  ) => void;
}) {
  const primaryOutputs = getPrimaryOutputs(deliveryPackage.outputs);
  const captionCopy = buildCopyBlock(deliveryPackage, "caption");
  const firstCommentCopy = buildCopyBlock(deliveryPackage, "firstComment");
  const hashtagCopy = deliveryPackage.hashtags.join(" ").trim();
  const finalPng = getOutputByKind(deliveryPackage.outputs, "final_post_png");
  const finalZip = getOutputByKind(deliveryPackage.outputs, "final_package_zip");

  return (
    <article className="delivery-card">
      {finalPng ? (
        <Link
          className="delivery-card-preview"
          href={`/outputs/${encodeURIComponent(deliveryPackage.id)}`}
        >
          <img
            alt={`Preview da entrega ${deliveryPackage.title}`}
            height={1350}
            src={finalPng.signedUrl}
            width={1080}
          />
        </Link>
      ) : null}
      <div className="project-card-heading">
        <span className="project-source">Entrega</span>
        {deliveryPackage.hasFinalZip ? (
          <span className="project-status project-status-ready_to_publish">
            ZIP final
          </span>
        ) : null}
        {deliveryPackage.hasCarousel ? (
          <span className="delivery-chip">Carrossel</span>
        ) : null}
        <span className={`delivery-chip delivery-chip-${operationalStatus}`}>
          {deliveryOperationalStatusLabels[operationalStatus]}
        </span>
        <h2>{deliveryPackage.title}</h2>
        <p>{deliveryPackage.brandName}</p>
      </div>

      <dl className="project-card-meta">
        <div>
          <dt>Salvo em</dt>
          <dd>{new Date(deliveryPackage.savedAt).toLocaleString("pt-BR")}</dd>
        </div>
        <div>
          <dt>Arquivos</dt>
          <dd>
            {deliveryPackage.outputCount} arquivo(s),{" "}
            {formatBytes(deliveryPackage.totalSizeBytes)}
          </dd>
        </div>
        <div>
          <dt>Pacote</dt>
          <dd>{deliveryPackage.finalPackageStatus || "Sem status"}</dd>
        </div>
      </dl>

      {deliveryPackage.caption ? (
        <p className="project-card-copy">{deliveryPackage.caption}</p>
      ) : null}

      <div className="delivery-file-grid">
        {primaryOutputs.map((output) => (
          <a
            className="delivery-file-link"
            href={output.signedUrl}
            key={output.id}
            rel="noreferrer"
            target="_blank"
          >
            <strong>{outputKindLabels[output.kind]}</strong>
            <span>
              {output.fileName} | {formatBytes(output.sizeBytes)}
            </span>
          </a>
        ))}
      </div>

      <div className="approved-post-actions">
        <Link
          className="primary-button"
          href={`/outputs/${encodeURIComponent(deliveryPackage.id)}`}
        >
          Abrir entrega
        </Link>
        {finalZip ? (
          <a
            className="secondary-button"
            href={finalZip.signedUrl}
            rel="noreferrer"
            target="_blank"
          >
            Baixar ZIP
          </a>
        ) : null}
        <Link
          className="secondary-button"
          href={`/approved/${encodeURIComponent(deliveryPackage.approvedPostId)}`}
        >
          Retomar post
        </Link>
        <button
          className="secondary-button"
          type="button"
          onClick={() => onCopy(captionCopy, "Legenda copiada.")}
          disabled={!captionCopy}
        >
          Copiar legenda
        </button>
        <button
          className="secondary-button"
          type="button"
          onClick={() =>
            onCopy(firstCommentCopy, "Primeiro comentario copiado.")
          }
          disabled={!firstCommentCopy}
        >
          Copiar comentário
        </button>
        <button
          className="secondary-button"
          type="button"
          onClick={() => onCopy(hashtagCopy, "Hashtags copiadas.")}
          disabled={!hashtagCopy}
        >
          Copiar hashtags
        </button>
        <label className="delivery-status-select">
          <span>Status</span>
          <select
            value={operationalStatus}
            onChange={(event) =>
              onStatusChange(
                deliveryPackage.id,
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
      </div>

      {deliveryPackage.outputs.length > primaryOutputs.length ? (
        <details className="delivery-details">
          <summary>Ver todos os arquivos</summary>
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
        </details>
      ) : null}
    </article>
  );
}

function getOutputByKind(
  outputs: StudioOutputLink[],
  kind: StudioOutputKind,
) {
  return outputs.find((output) => output.kind === kind) || null;
}

function buildDeliveryStats(packages: StudioOutputPackage[]) {
  return {
    finalZipCount: packages.filter((deliveryPackage) =>
      deliveryPackage.hasFinalZip,
    ).length,
    carouselCount: packages.filter((deliveryPackage) =>
      deliveryPackage.hasCarousel,
    ).length,
    outputCount: packages.reduce(
      (total, deliveryPackage) => total + deliveryPackage.outputCount,
      0,
    ),
  };
}

function matchesDeliveryFilter(
  deliveryPackage: StudioOutputPackage,
  deliveryFilter: DeliveryFilter,
) {
  if (deliveryFilter === "all") {
    return true;
  }

  if (deliveryFilter === "final_zip") {
    return deliveryPackage.hasFinalZip;
  }

  if (deliveryFilter === "carousel") {
    return deliveryPackage.hasCarousel;
  }

  if (deliveryFilter === "asset") {
    return deliveryPackage.hasSelectedAsset;
  }

  return Boolean(deliveryPackage.caption || deliveryPackage.firstComment);
}

function buildPackageSearchText(deliveryPackage: StudioOutputPackage) {
  return [
    deliveryPackage.title,
    deliveryPackage.brandName,
    deliveryPackage.status,
    deliveryPackage.finalPackageStatus,
    deliveryPackage.carouselStatus,
    deliveryPackage.caption,
    deliveryPackage.firstComment,
    deliveryPackage.hashtags.join(" "),
    ...deliveryPackage.outputs.flatMap((output) => [
      output.kind,
      output.label,
      output.fileName,
    ]),
  ]
    .filter(Boolean)
    .join(" ");
}

function getPrimaryOutputs(outputs: StudioOutputLink[]) {
  const outputByKind = new Map<StudioOutputKind, StudioOutputLink>();

  for (const output of outputs) {
    if (!outputByKind.has(output.kind)) {
      outputByKind.set(output.kind, output);
    }
  }

  return primaryOutputKinds
    .map((kind) => outputByKind.get(kind))
    .filter((output): output is StudioOutputLink => Boolean(output));
}

function buildCopyBlock(
  deliveryPackage: StudioOutputPackage,
  type: "caption" | "firstComment",
) {
  if (type === "firstComment") {
    return deliveryPackage.firstComment.trim();
  }

  return [
    deliveryPackage.caption.trim(),
    deliveryPackage.hashtags.length
      ? deliveryPackage.hashtags.join(" ").trim()
      : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}

function normalizeText(value: string) {
  return value
    .toLocaleLowerCase("pt-BR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
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
