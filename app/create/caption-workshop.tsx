"use client";

import { useMemo, useState } from "react";
import type { BrandProfile } from "../../lib/brand/profile";
import type {
  CreativeConcept,
  CreativeProject,
} from "../../lib/creative/concepts";
import {
  getSelectedCaptionVariant,
  type CaptionPackage,
  type CaptionVariantId,
  type InstagramPerformanceReview,
} from "../../lib/creative/captions";

type CaptionWorkshopProps = {
  project: CreativeProject;
  selectedConcept: CreativeConcept;
  brandProfile: BrandProfile;
  captionPackage: CaptionPackage | null;
  isGeneratingCaption: boolean;
  captionError: string;
  onGenerateCaption: () => void;
  onSelectCaptionVariant: (variantId: CaptionVariantId) => void;
  onUpdateCaptionVariant: (
    field: "caption" | "firstComment",
    value: string,
  ) => void;
  onUpdateCaptionHashtags: (value: string) => void;
  onReviewCaption: () => void;
};

const scoreLabels: Record<string, string> = {
  baixo: "Baixo",
  medio: "Medio",
  alto: "Alto",
};

export function CaptionWorkshop({
  project,
  selectedConcept,
  brandProfile,
  captionPackage,
  isGeneratingCaption,
  captionError,
  onGenerateCaption,
  onSelectCaptionVariant,
  onUpdateCaptionVariant,
  onUpdateCaptionHashtags,
  onReviewCaption,
}: CaptionWorkshopProps) {
  const [copyStatus, setCopyStatus] = useState("");
  const selectedVariant = captionPackage
    ? getSelectedCaptionVariant(captionPackage)
    : null;
  const hashtagsText = selectedVariant?.hashtags.join(" ") || "";
  const reviewMetrics = useMemo(() => {
    if (!selectedVariant) {
      return [];
    }

    return buildReviewMetrics(selectedVariant.review);
  }, [selectedVariant]);

  async function copySelectedCaption() {
    if (!selectedVariant) {
      return;
    }

    const copyText = [
      selectedVariant.caption,
      selectedVariant.firstComment
        ? `Primeiro comentario: ${selectedVariant.firstComment}`
        : "",
      selectedVariant.hashtags.join(" "),
    ]
      .filter(Boolean)
      .join("\n\n");

    try {
      await navigator.clipboard.writeText(copyText);
      setCopyStatus("Legenda copiada.");
      window.setTimeout(() => setCopyStatus(""), 2400);
    } catch {
      setCopyStatus("Nao foi possivel copiar automaticamente.");
    }
  }

  return (
    <section
      className="caption-workshop"
      id="caption-workshop"
      aria-labelledby="caption-title"
    >
      <div className="section-heading">
        <p className="section-kicker">Marco 3.1</p>
        <h2 id="caption-title">Legenda do post</h2>
      </div>

      {!captionPackage || !selectedVariant ? (
        <div className="caption-empty">
          <div>
            <strong>{selectedConcept.title}</strong>
            <p>
              Gere a legenda depois da peca tipografica para que o texto
              complemente o visual, abra conversa e evite repetir o card.
            </p>
            <span>
              Marca: {brandProfile.brandName || project.brandSnapshot.brandName}
            </span>
          </div>
          <button
            className="primary-button"
            type="button"
            disabled={isGeneratingCaption}
            onClick={onGenerateCaption}
          >
            {isGeneratingCaption ? "Gerando..." : "Gerar legenda"}
          </button>
          {captionError ? <p className="error-message">{captionError}</p> : null}
        </div>
      ) : (
        <div className="caption-layout">
          <div className="caption-editor-panel">
            <div className="caption-variant-grid">
              {captionPackage.variants.map((variant) => {
                const isSelected = variant.id === captionPackage.selectedVariantId;

                return (
                  <button
                    className={
                      isSelected
                        ? "caption-variant caption-variant-selected"
                        : "caption-variant"
                    }
                    key={variant.id}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => onSelectCaptionVariant(variant.id)}
                  >
                    <strong>{variant.label}</strong>
                    <span>{variant.strategicRole}</span>
                    <small>
                      Comentario {scoreLabels[variant.review.commentPotential]} /
                      IA {scoreLabels[variant.review.aiRisk]}
                    </small>
                  </button>
                );
              })}
            </div>

            <label className="field caption-main-field">
              <span>Legenda</span>
              <textarea
                value={selectedVariant.caption}
                rows={12}
                maxLength={2200}
                onChange={(event) =>
                  onUpdateCaptionVariant("caption", event.target.value)
                }
              />
              <small>{selectedVariant.caption.length}/2200</small>
            </label>

            <label className="field">
              <span>Primeiro comentario</span>
              <textarea
                value={selectedVariant.firstComment}
                rows={3}
                maxLength={280}
                onChange={(event) =>
                  onUpdateCaptionVariant("firstComment", event.target.value)
                }
              />
              <small>{selectedVariant.firstComment.length}/280</small>
            </label>

            <label className="field">
              <span>Hashtags</span>
              <input
                value={hashtagsText}
                onChange={(event) => onUpdateCaptionHashtags(event.target.value)}
                placeholder="#atendimento #whatsapp #vendas"
              />
            </label>

            <div className="caption-actions">
              <button
                className="primary-button"
                type="button"
                onClick={onReviewCaption}
              >
                Revisar para Instagram
              </button>
              <button
                className="secondary-button"
                type="button"
                onClick={copySelectedCaption}
              >
                Copiar legenda
              </button>
              <button
                className="secondary-button"
                type="button"
                disabled={isGeneratingCaption}
                onClick={onGenerateCaption}
              >
                {isGeneratingCaption ? "Gerando..." : "Regenerar legendas"}
              </button>
              {copyStatus ? (
                <span className="next-step-status" role="status">
                  {copyStatus}
                </span>
              ) : null}
            </div>

            {captionError ? <p className="error-message">{captionError}</p> : null}
          </div>

          <aside className="caption-review-panel">
            <div className="summary-block">
              <p className="section-kicker">Revisao</p>
              <strong>{selectedVariant.label}</strong>
              <span>{selectedVariant.strategicRole}</span>
            </div>

            <div className="caption-score-grid">
              {reviewMetrics.map((metric) => (
                <div className="caption-score" key={metric.label}>
                  <span>{metric.label}</span>
                  <strong className={`score-badge score-badge-${metric.value}`}>
                    {scoreLabels[metric.value]}
                  </strong>
                </div>
              ))}
            </div>

            <div className="caption-review-note">
              <strong>Leitura estrategica</strong>
              <p>{selectedVariant.review.rationale || "Sem leitura registrada."}</p>
            </div>

            <div className="caption-review-note">
              <strong>Ajustes sugeridos</strong>
              <ul>
                {selectedVariant.review.improvementNotes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            </div>
          </aside>
        </div>
      )}
    </section>
  );
}

function buildReviewMetrics(review: InstagramPerformanceReview) {
  return [
    {
      label: "Compartilhamento",
      value: review.sharePotential,
    },
    {
      label: "Comentario",
      value: review.commentPotential,
    },
    {
      label: "Salvamento",
      value: review.savePotential,
    },
    {
      label: "Abertura",
      value: review.openingClarity,
    },
    {
      label: "Marca",
      value: review.brandFit,
    },
    {
      label: "Risco IA",
      value: review.aiRisk,
    },
    {
      label: "Promessa",
      value: review.promiseRisk,
    },
  ];
}
