import type { ApprovedPost } from "./approved-posts";
import type { AssetCompositionVariantId } from "./asset-composition";
import type { GeneratedVisualAsset } from "./assets";
import type { TypographicCopy } from "./typographic-piece";
import {
  TYPOGRAPHIC_POST_HEIGHT,
  TYPOGRAPHIC_POST_WIDTH,
} from "./typographic-piece";

export type VisualQualitySeverity = "blocker" | "warning";

export type VisualQualityIssue = {
  id: string;
  label: string;
  severity: VisualQualitySeverity;
  suggestion: string;
};

export type VisualQualityCheck = {
  id: string;
  label: string;
  status: "ok" | "review";
  note: string;
  issues: VisualQualityIssue[];
};

export type VisualQualityReport = {
  status: "ok" | "review";
  summary: string;
  blockerCount: number;
  warningCount: number;
  checks: VisualQualityCheck[];
  issues: VisualQualityIssue[];
};

export type VisualQualityInput = {
  post: ApprovedPost;
  finalSvg: string;
  copy: TypographicCopy;
  selectedAsset: GeneratedVisualAsset | null;
  compositionId: AssetCompositionVariantId;
};

export function buildVisualQualityReport(
  input: VisualQualityInput,
): VisualQualityReport {
  const checks = [
    buildCanvasCheck(input.finalSvg),
    buildCopyFitCheck(input.copy, input.compositionId),
    buildAssetCheck(input.post, input.selectedAsset),
    buildCompositionCheck(input.copy, input.selectedAsset, input.compositionId),
  ];
  const issues = checks.flatMap((check) => check.issues);
  const blockerCount = issues.filter(
    (issue) => issue.severity === "blocker",
  ).length;
  const warningCount = issues.filter(
    (issue) => issue.severity === "warning",
  ).length;

  return {
    status: issues.length ? "review" : "ok",
    summary: blockerCount
      ? `${blockerCount} trava(s), ${warningCount} alerta(s) visual(is).`
      : warningCount
        ? `${warningCount} alerta(s) visual(is), sem trava.`
        : "Visual sem alertas estruturais.",
    blockerCount,
    warningCount,
    checks,
    issues,
  };
}

function buildCanvasCheck(finalSvg: string): VisualQualityCheck {
  const issues: VisualQualityIssue[] = [];

  if (!finalSvg.includes("<svg")) {
    issues.push({
      id: "canvas-invalid-svg",
      label: "SVG inválido",
      severity: "blocker",
      suggestion: "Regere a peça visual antes de finalizar o pacote.",
    });
  }

  if (
    !finalSvg.includes(`width="${TYPOGRAPHIC_POST_WIDTH}"`) ||
    !finalSvg.includes(`height="${TYPOGRAPHIC_POST_HEIGHT}"`)
  ) {
    issues.push({
      id: "canvas-wrong-size",
      label: "Formato diferente de 1080x1350",
      severity: "blocker",
      suggestion: "Use o renderizador padrão 4:5 antes de salvar a entrega.",
    });
  }

  if (/NaN|undefined|null/i.test(finalSvg)) {
    issues.push({
      id: "canvas-broken-token",
      label: "Arte contém valor quebrado",
      severity: "blocker",
      suggestion:
        "Algum campo visual chegou vazio ao SVG. Regere a peça ou ajuste a copy.",
    });
  }

  return buildCheck({
    id: "canvas",
    label: "Arquivo final",
    okNote: "SVG e dimensão final estão consistentes.",
    reviewNote: "A arte final tem problema estrutural.",
    issues,
  });
}

function buildCopyFitCheck(
  copy: TypographicCopy,
  compositionId: AssetCompositionVariantId,
): VisualQualityCheck {
  const issues: VisualQualityIssue[] = [];
  const headlineLength = countPublicChars(copy.headline);
  const supportLength = countPublicChars(copy.support);
  const ctaLength = countPublicChars(copy.cta);
  const headlineLimit = compositionId === "editorial-split" ? 72 : 86;
  const supportLimit = compositionId === "editorial-split" ? 96 : 118;

  if (headlineLength > headlineLimit) {
    issues.push({
      id: "copy-headline-long",
      label: "Headline longa para o layout",
      severity: "warning",
      suggestion:
        "Encurte a headline ou troque para uma composição com mais área de texto.",
    });
  }

  if (supportLength > supportLimit) {
    issues.push({
      id: "copy-support-long",
      label: "Texto de apoio longo",
      severity: "warning",
      suggestion:
        "Corte o apoio para uma frase concreta. O post deve ser lido em poucos segundos.",
    });
  }

  if (ctaLength > 42) {
    issues.push({
      id: "copy-cta-long",
      label: "CTA visual longo",
      severity: "warning",
      suggestion: "Transforme o CTA visual em uma assinatura curta.",
    });
  }

  return buildCheck({
    id: "copy-fit",
    label: "Encaixe da copy",
    okNote: "Headline, apoio e CTA cabem no layout atual.",
    reviewNote: "A copy pode ficar apertada no render final.",
    issues,
  });
}

function buildAssetCheck(
  post: ApprovedPost,
  selectedAsset: GeneratedVisualAsset | null,
): VisualQualityCheck {
  const issues: VisualQualityIssue[] = [];

  if (!selectedAsset) {
    return buildCheck({
      id: "asset",
      label: "Asset visual",
      okNote: "Peça tipográfica, sem dependência de asset externo.",
      reviewNote: "Sem asset selecionado.",
      issues,
    });
  }

  const rejection = post.visualAssetRejections.find(
    (item) => item.assetId === selectedAsset.id,
  );

  if (rejection) {
    issues.push({
      id: "asset-rejected",
      label: "Asset selecionado foi rejeitado",
      severity: "blocker",
      suggestion: "Desfaça a rejeição, escolha outro asset ou gere um novo.",
    });
  }

  if (!/sem texto|no text|do not include text|sem qualquer texto/i.test(selectedAsset.prompt)) {
    issues.push({
      id: "asset-text-instruction-missing",
      label: "Prompt sem trava explícita contra texto",
      severity: "warning",
      suggestion:
        "Regere o asset pedindo explicitamente ausência de texto, números, logos e badges.",
    });
  }

  return buildCheck({
    id: "asset",
    label: "Asset visual",
    okNote: "Asset selecionado não possui trava estrutural conhecida.",
    reviewNote: "O asset exige revisão antes do fechamento.",
    issues,
  });
}

function buildCompositionCheck(
  copy: TypographicCopy,
  selectedAsset: GeneratedVisualAsset | null,
  compositionId: AssetCompositionVariantId,
): VisualQualityCheck {
  const issues: VisualQualityIssue[] = [];

  if (
    selectedAsset &&
    compositionId === "lower-panel" &&
    countPublicChars(copy.headline) > 74
  ) {
    issues.push({
      id: "composition-lower-panel-dense",
      label: "Painel inferior pode ficar pesado",
      severity: "warning",
      suggestion:
        "Teste a composição Faixa limpa ou corte a headline antes de finalizar.",
    });
  }

  if (
    selectedAsset &&
    compositionId === "editorial-split" &&
    countPublicChars(copy.support) > 84
  ) {
    issues.push({
      id: "composition-split-support-dense",
      label: "Coluna lateral com apoio denso",
      severity: "warning",
      suggestion:
        "Reduza o apoio ou use uma composição com painel maior para preservar leitura.",
    });
  }

  return buildCheck({
    id: "composition",
    label: "Composição",
    okNote: "Composição e densidade textual parecem compatíveis.",
    reviewNote: "A composição pode precisar de ajuste fino.",
    issues,
  });
}

function buildCheck(input: {
  id: string;
  label: string;
  okNote: string;
  reviewNote: string;
  issues: VisualQualityIssue[];
}): VisualQualityCheck {
  return {
    id: input.id,
    label: input.label,
    status: input.issues.length ? "review" : "ok",
    note: input.issues.length ? input.reviewNote : input.okNote,
    issues: input.issues,
  };
}

function countPublicChars(value: string) {
  return value.replace(/\s+/g, " ").trim().length;
}
