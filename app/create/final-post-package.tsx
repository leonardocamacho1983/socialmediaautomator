"use client";

/* eslint-disable @next/next/no-img-element -- final preview uses local SVG data URLs generated in the browser */

import { useMemo, useState } from "react";
import type { BrandProfile } from "../../lib/brand/profile";
import type {
  CreativeConcept,
  FinalPostChecklistItem,
  FinalPostPackage,
} from "../../lib/creative/concepts";
import {
  getSelectedCaptionVariant,
  type CaptionPackage,
  type CaptionVariant,
} from "../../lib/creative/captions";
import {
  getSelectedTypographicVariant,
  renderTypographicSvg,
  svgToDataUrl,
  TYPOGRAPHIC_POST_HEIGHT,
  TYPOGRAPHIC_POST_WIDTH,
  type TypographicPiece,
} from "../../lib/creative/typographic-piece";
import { downloadSvgAsPng, slugify } from "./export-utils";

type FinalPostPackageProps = {
  brandProfile: BrandProfile;
  selectedConcept: CreativeConcept;
  typographicPiece: TypographicPiece;
  captionPackage: CaptionPackage;
  finalPostPackage: FinalPostPackage | null;
  onApprove: (checklist: FinalPostChecklistItem[]) => void;
};

const statusLabels: Record<FinalPostChecklistItem["status"], string> = {
  ok: "OK",
  review: "Revisar",
};

export function FinalPostPackageWorkshop({
  brandProfile,
  selectedConcept,
  typographicPiece,
  captionPackage,
  finalPostPackage,
  onApprove,
}: FinalPostPackageProps) {
  const [status, setStatus] = useState("");
  const selectedTypographicVariant =
    getSelectedTypographicVariant(typographicPiece);
  const selectedCaptionVariant = getSelectedCaptionVariant(captionPackage);
  const selectedSvg = useMemo(
    () =>
      renderTypographicSvg(
        typographicPiece,
        selectedTypographicVariant,
        brandProfile,
      ),
    [brandProfile, selectedTypographicVariant, typographicPiece],
  );
  const selectedDataUrl = svgToDataUrl(selectedSvg);
  const checklist = useMemo(
    () =>
      buildFinalChecklist({
        selectedCaptionVariant,
        typographicPiece,
      }),
    [selectedCaptionVariant, typographicPiece],
  );
  const reviewItems = checklist.filter((item) => item.status === "review");
  const packageText = buildPackageText({
    brandName: brandProfile.brandName || "Social Studio",
    conceptTitle: selectedConcept.title,
    visualVariantName: selectedTypographicVariant.name,
    selectedCaptionVariant,
  });
  const approvedLabel = finalPostPackage
    ? `Aprovado em ${new Date(finalPostPackage.approvedAt).toLocaleString(
        "pt-BR",
      )}`
    : "";

  async function copyText(value: string, successMessage: string) {
    try {
      await navigator.clipboard.writeText(value);
      setStatus(successMessage);
      window.setTimeout(() => setStatus(""), 2400);
    } catch {
      setStatus("Nao foi possivel copiar automaticamente.");
    }
  }

  async function downloadFinalPng() {
    setStatus("Gerando PNG final...");

    try {
      await downloadSvgAsPng(
        selectedSvg,
        `${slugify(brandProfile.brandName || "social-studio")}-${selectedTypographicVariant.id}-final.png`,
      );
      setStatus("PNG final pronto.");
      window.setTimeout(() => setStatus(""), 2600);
    } catch {
      setStatus("Nao foi possivel baixar o PNG final.");
    }
  }

  return (
    <section
      className="final-package-workshop"
      id="final-post-package"
      aria-labelledby="final-package-title"
    >
      <div className="section-heading">
        <p className="section-kicker">Marco 3.2</p>
        <h2 id="final-package-title">Pacote final do post</h2>
      </div>

      <div className="final-package-layout">
        <div className="final-preview-panel">
          <div className="instagram-preview">
            <div className="instagram-preview-media">
              <img
                alt={`Preview final da variacao ${selectedTypographicVariant.name}`}
                height={TYPOGRAPHIC_POST_HEIGHT}
                src={selectedDataUrl}
                width={TYPOGRAPHIC_POST_WIDTH}
              />
            </div>
            <div className="instagram-preview-copy">
              <div>
                <strong>{brandProfile.brandName || "Social Studio"}</strong>
                <span>{selectedTypographicVariant.name}</span>
              </div>
              <p>{selectedCaptionVariant.caption}</p>
              {selectedCaptionVariant.hashtags.length ? (
                <p className="instagram-preview-hashtags">
                  {selectedCaptionVariant.hashtags.join(" ")}
                </p>
              ) : null}
              {selectedCaptionVariant.firstComment ? (
                <div className="first-comment-preview">
                  <span>Primeiro comentario</span>
                  <p>{selectedCaptionVariant.firstComment}</p>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <aside className="final-review-panel">
          <div className="summary-block">
            <p className="section-kicker">Versao final</p>
            <strong>
              {finalPostPackage ? "Post aprovado" : "Aguardando aprovacao"}
            </strong>
            <span>
              {approvedLabel ||
                `${selectedCaptionVariant.label} + ${selectedTypographicVariant.name}`}
            </span>
          </div>

          <div className="final-checklist" aria-label="Checklist final">
            {checklist.map((item) => (
              <div
                className={`final-check final-check-${item.status}`}
                key={item.id}
              >
                <span>{statusLabels[item.status]}</span>
                <strong>{item.label}</strong>
                <p>{item.note}</p>
              </div>
            ))}
          </div>

          <div className="final-package-actions">
            <button
              className="primary-button"
              type="button"
              onClick={() => onApprove(checklist)}
            >
              {finalPostPackage ? "Reaprovar pacote" : "Aprovar pacote final"}
            </button>
            <button
              className="secondary-button"
              type="button"
              onClick={downloadFinalPng}
            >
              Baixar PNG
            </button>
            <button
              className="secondary-button"
              type="button"
              onClick={() =>
                copyText(selectedCaptionVariant.caption, "Legenda copiada.")
              }
            >
              Copiar legenda
            </button>
            <button
              className="secondary-button"
              type="button"
              onClick={() =>
                copyText(
                  selectedCaptionVariant.firstComment,
                  "Primeiro comentario copiado.",
                )
              }
              disabled={!selectedCaptionVariant.firstComment}
            >
              Copiar comentario
            </button>
            <button
              className="secondary-button"
              type="button"
              onClick={() => copyText(packageText, "Pacote completo copiado.")}
            >
              Copiar pacote
            </button>
          </div>

          {reviewItems.length ? (
            <p className="final-warning">
              Ha pontos para revisar antes de publicar. O sistema ainda permite
              aprovar, mas deixa o risco visivel.
            </p>
          ) : null}

          {status ? (
            <span className="next-step-status" role="status">
              {status}
            </span>
          ) : null}
        </aside>
      </div>
    </section>
  );
}

function buildFinalChecklist(input: {
  selectedCaptionVariant: CaptionVariant;
  typographicPiece: TypographicPiece;
}): FinalPostChecklistItem[] {
  const caption = input.selectedCaptionVariant.caption.trim();
  const firstComment = input.selectedCaptionVariant.firstComment.trim();
  const visualCopy = input.typographicPiece.copy;
  const repeatsVisualCopy =
    hasMeaningfulOverlap(caption, visualCopy.headline) ||
    hasMeaningfulOverlap(caption, visualCopy.support);
  const hasInteractionCue = Boolean(firstComment) || /\?/.test(caption);
  const hasHashtags = input.selectedCaptionVariant.hashtags.length > 0;
  const review = input.selectedCaptionVariant.review;

  return [
    {
      id: "visual",
      label: "Imagem escolhida",
      status: input.typographicPiece.selectedVariantId ? "ok" : "review",
      note: `Variacao visual: ${input.typographicPiece.selectedVariantId}.`,
    },
    {
      id: "caption",
      label: "Legenda escolhida",
      status: caption.length >= 20 ? "ok" : "review",
      note:
        caption.length >= 20
          ? "Legenda selecionada e pronta para copia."
          : "A legenda ainda parece curta demais para publicar.",
    },
    {
      id: "complement",
      label: "Visual e legenda se complementam",
      status: repeatsVisualCopy ? "review" : "ok",
      note: repeatsVisualCopy
        ? "A legenda ainda repete demais a copy da imagem."
        : "A legenda acrescenta contexto em vez de repetir o card.",
    },
    {
      id: "interaction",
      label: "Gatilho de conversa",
      status:
        hasInteractionCue && review.commentPotential !== "baixo" ? "ok" : "review",
      note:
        hasInteractionCue && review.commentPotential !== "baixo"
          ? "Ha pergunta ou primeiro comentario para abrir conversa."
          : "Falta um convite mais claro para resposta real.",
    },
    {
      id: "risk-ai",
      label: "Risco de cara de IA",
      status: review.aiRisk === "alto" ? "review" : "ok",
      note:
        review.aiRisk === "alto"
          ? "A revisao marcou risco alto de texto artificial."
          : "A revisao nao encontrou risco alto de artificialidade.",
    },
    {
      id: "risk-promise",
      label: "Promessa segura",
      status: review.promiseRisk === "alto" ? "review" : "ok",
      note:
        review.promiseRisk === "alto"
          ? "A legenda pode prometer mais do que deveria."
          : "A legenda nao faz promessa exagerada.",
    },
    {
      id: "hashtags",
      label: "Hashtags prontas",
      status: hasHashtags ? "ok" : "review",
      note: hasHashtags
        ? "Hashtags selecionadas para o pacote."
        : "Nenhuma hashtag foi selecionada.",
    },
  ];
}

function buildPackageText(input: {
  brandName: string;
  conceptTitle: string;
  visualVariantName: string;
  selectedCaptionVariant: CaptionVariant;
}) {
  return [
    `Marca: ${input.brandName}`,
    `Conceito: ${input.conceptTitle}`,
    `Peca: ${input.visualVariantName}`,
    "",
    "Legenda:",
    input.selectedCaptionVariant.caption,
    "",
    input.selectedCaptionVariant.firstComment
      ? `Primeiro comentario:\n${input.selectedCaptionVariant.firstComment}`
      : "",
    input.selectedCaptionVariant.hashtags.length
      ? `Hashtags:\n${input.selectedCaptionVariant.hashtags.join(" ")}`
      : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function hasMeaningfulOverlap(text: string, fragment: string) {
  const normalizedText = text.toLocaleLowerCase("pt-BR");
  const normalizedFragment = fragment.toLocaleLowerCase("pt-BR");

  if (!normalizedText || normalizedFragment.length < 12) {
    return false;
  }

  const relevantWords = normalizedFragment
    .split(/\s+/)
    .map((word) => word.replace(/[^\p{L}\p{N}_]/gu, ""))
    .filter((word) => word.length > 4);

  if (!relevantWords.length) {
    return false;
  }

  const overlapCount = relevantWords.filter((word) =>
    normalizedText.includes(word),
  ).length;

  return overlapCount / relevantWords.length > 0.64;
}
