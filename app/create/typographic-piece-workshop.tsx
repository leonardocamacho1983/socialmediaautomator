"use client";

/* eslint-disable @next/next/no-img-element -- previews use local SVG data URLs generated in the browser */

import { useMemo, useState } from "react";
import type { BrandProfile } from "../../lib/brand/profile";
import type {
  CreativeConcept,
  CreativeProject,
} from "../../lib/creative/concepts";
import {
  getSelectedTypographicVariant,
  renderTypographicSvg,
  svgToDataUrl,
  TYPOGRAPHIC_POST_HEIGHT,
  TYPOGRAPHIC_POST_WIDTH,
  type TypographicCopy,
  type TypographicVariantId,
} from "../../lib/creative/typographic-piece";
import { downloadSvgAsPng, slugify } from "./export-utils";

type TypographicPieceWorkshopProps = {
  project: CreativeProject;
  selectedConcept: CreativeConcept;
  brandProfile: BrandProfile;
  regenerationInstruction: string;
  onProduce: () => void;
  onUpdateRegenerationInstruction: (value: string) => void;
  onUpdateCopy: (field: keyof TypographicCopy, value: string) => void;
  onSelectVariant: (variantId: TypographicVariantId) => void;
};

export function TypographicPieceWorkshop({
  project,
  selectedConcept,
  brandProfile,
  regenerationInstruction,
  onProduce,
  onUpdateRegenerationInstruction,
  onUpdateCopy,
  onSelectVariant,
}: TypographicPieceWorkshopProps) {
  const [exportStatus, setExportStatus] = useState("");
  const piece =
    project.typographicPiece?.conceptId === selectedConcept.id
      ? project.typographicPiece
      : null;
  const selectedVariant = piece ? getSelectedTypographicVariant(piece) : null;
  const selectedSvg = useMemo(() => {
    if (!piece || !selectedVariant) {
      return "";
    }

    return renderTypographicSvg(piece, selectedVariant, brandProfile);
  }, [brandProfile, piece, selectedVariant]);
  const selectedDataUrl = selectedSvg ? svgToDataUrl(selectedSvg) : "";
  const variantPreviews = useMemo(() => {
    if (!piece) {
      return [];
    }

    return piece.variants.map((variant) => {
      const svg = renderTypographicSvg(piece, variant, brandProfile);

      return {
        variant,
        dataUrl: svgToDataUrl(svg),
      };
    });
  }, [brandProfile, piece]);

  async function downloadSelectedPng() {
    if (!piece || !selectedVariant || !selectedSvg) {
      return;
    }

    setExportStatus("Gerando PNG...");

    try {
      await downloadSvgAsPng(
        selectedSvg,
        `${slugify(brandProfile.brandName || "social-studio")}-${selectedVariant.id}.png`,
      );
      setExportStatus("PNG pronto.");
      window.setTimeout(() => setExportStatus(""), 2600);
    } catch {
      setExportStatus("Nao foi possivel baixar o PNG.");
    }
  }

  return (
    <section
      className="typographic-workshop"
      id="typographic-piece"
      aria-labelledby="typographic-title"
    >
      <div className="section-heading">
        <p className="section-kicker">Marco 3</p>
        <h2 id="typographic-title">Primeira peca tipografica</h2>
      </div>

      {!piece ? (
        <div className="typographic-empty">
          <div>
            <strong>{selectedConcept.title}</strong>
            <p>
              Produza uma peca 1080x1350 usando apenas copy, hierarquia,
              contraste, cor e marca. Sem imagem, sem Recraft e sem carrossel.
            </p>
          </div>
          <button className="primary-button" type="button" onClick={onProduce}>
            Produzir peca tipografica
          </button>
        </div>
      ) : (
        <div className="typographic-layout">
          <div className="typographic-preview-panel">
            <div className="typographic-canvas-frame">
              <img
                alt={`Preview da variacao ${selectedVariant?.name || ""}`}
                className="typographic-preview-image"
                height={TYPOGRAPHIC_POST_HEIGHT}
                src={selectedDataUrl}
                width={TYPOGRAPHIC_POST_WIDTH}
              />
            </div>

            <div className="typographic-actions">
              <button
                className="primary-button"
                type="button"
                onClick={downloadSelectedPng}
              >
                Baixar PNG
              </button>
              <button
                className="secondary-button"
                type="button"
                onClick={onProduce}
              >
                Regenerar peca
              </button>
              {exportStatus ? (
                <span className="next-step-status" role="status">
                  {exportStatus}
                </span>
              ) : null}
            </div>
          </div>

          <aside className="typographic-control-panel">
            <div className="summary-block">
              <p className="section-kicker">Copy visual</p>
              <div className="typographic-copy-editor">
                <label className="field">
                  <span>Headline</span>
                  <textarea
                    value={piece.copy.headline}
                    maxLength={86}
                    rows={3}
                    onChange={(event) =>
                      onUpdateCopy("headline", event.target.value)
                    }
                  />
                  <small>{piece.copy.headline.length}/86</small>
                </label>

                <label className="field">
                  <span>Apoio</span>
                  <textarea
                    value={piece.copy.support}
                    maxLength={112}
                    rows={3}
                    onChange={(event) =>
                      onUpdateCopy("support", event.target.value)
                    }
                  />
                  <small>{piece.copy.support.length}/112</small>
                </label>

                <label className="field">
                  <span>CTA visual</span>
                  <input
                    value={piece.copy.cta}
                    maxLength={42}
                    onChange={(event) =>
                      onUpdateCopy("cta", event.target.value)
                    }
                  />
                  <small>{piece.copy.cta.length}/42</small>
                </label>
              </div>
            </div>

            <div className="summary-block">
              <label className="field typographic-regeneration-field">
                <span>Direcao para regenerar</span>
                <textarea
                  value={regenerationInstruction}
                  rows={3}
                  maxLength={900}
                  onChange={(event) =>
                    onUpdateRegenerationInstruction(event.target.value)
                  }
                  placeholder="Ex: mais minimalista, mais agressivo, parecer print de conversa, menos institucional"
                />
                <small>{regenerationInstruction.length}/900</small>
              </label>
            </div>

            <div className="summary-block">
              <p className="section-kicker">Variacoes</p>
              <div className="typographic-variant-grid">
                {variantPreviews.map(({ variant, dataUrl }) => {
                  const isSelected = variant.id === piece.selectedVariantId;

                  return (
                    <button
                      className={
                        isSelected
                          ? "typographic-variant typographic-variant-selected"
                          : "typographic-variant"
                      }
                      key={variant.id}
                      type="button"
                      aria-pressed={isSelected}
                      onClick={() => onSelectVariant(variant.id)}
                    >
                      <img
                        alt=""
                        height={TYPOGRAPHIC_POST_HEIGHT}
                        src={dataUrl}
                        width={TYPOGRAPHIC_POST_WIDTH}
                      />
                      <strong>{variant.name}</strong>
                      <span>{variant.rationale}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </aside>
        </div>
      )}
    </section>
  );
}
