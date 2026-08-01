import type { BrandProfile } from "../brand/profile";
import type { CreativeConcept, CreativeProject } from "./concepts";

export const TYPOGRAPHIC_POST_WIDTH = 1080;
export const TYPOGRAPHIC_POST_HEIGHT = 1350;

export type TypographicVariantId =
  | "editorial-tension"
  | "conversation-clean"
  | "manifesto-mark";

export type TypographicCopy = {
  headline: string;
  support: string;
  cta: string;
};

export type TypographicVariant = {
  id: TypographicVariantId;
  name: string;
  layoutFamily: string;
  rationale: string;
};

export type TypographicPiece = {
  id: string;
  conceptId: string;
  generatedAt: string;
  dimensions: {
    width: typeof TYPOGRAPHIC_POST_WIDTH;
    height: typeof TYPOGRAPHIC_POST_HEIGHT;
  };
  copy: TypographicCopy;
  variants: TypographicVariant[];
  selectedVariantId: TypographicVariantId;
};

export const typographicVariants: TypographicVariant[] = [
  {
    id: "editorial-tension",
    name: "Editorial de tensao",
    layoutFamily: "Headline dominante, corte seco e acento lateral.",
    rationale:
      "Boa para dor concreta, frases fortes e cenas que precisam parecer urgentes.",
  },
  {
    id: "conversation-clean",
    name: "Conversa limpa",
    layoutFamily: "Area clara de conversa, fundo de marca e CTA compacto.",
    rationale:
      "Boa quando o conceito nasce de uma fala, pergunta ou interacao de atendimento.",
  },
  {
    id: "manifesto-mark",
    name: "Marca manifesto",
    layoutFamily: "Bloco central, contraste alto e assinatura de marca.",
    rationale:
      "Boa para transformar o conceito em uma frase memoravel e proprietaria.",
  },
];

export function createTypographicPiece(
  project: CreativeProject,
  concept: CreativeConcept,
  brandProfile: BrandProfile,
): TypographicPiece {
  return {
    id: `typographic-${Date.now()}`,
    conceptId: concept.id,
    generatedAt: new Date().toISOString(),
    dimensions: {
      width: TYPOGRAPHIC_POST_WIDTH,
      height: TYPOGRAPHIC_POST_HEIGHT,
    },
    copy: buildTypographicCopy(project, concept, brandProfile),
    variants: typographicVariants,
    selectedVariantId: "editorial-tension",
  };
}

export function getSelectedTypographicVariant(piece: TypographicPiece) {
  return (
    piece.variants.find((variant) => variant.id === piece.selectedVariantId) ||
    piece.variants[0]
  );
}

export function renderTypographicSvg(
  piece: TypographicPiece,
  variant: TypographicVariant,
  brandProfile: BrandProfile,
) {
  const palette = buildPalette(brandProfile);
  const font = buildFontFamilies(brandProfile);

  if (variant.id === "conversation-clean") {
    return renderConversationClean(piece, brandProfile, palette, font);
  }

  if (variant.id === "manifesto-mark") {
    return renderManifestoMark(piece, brandProfile, palette, font);
  }

  return renderEditorialTension(piece, brandProfile, palette, font);
}

export function svgToDataUrl(svg: string) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function buildTypographicCopy(
  project: CreativeProject,
  concept: CreativeConcept,
  brandProfile: BrandProfile,
): TypographicCopy {
  const headline = trimForDisplay(
    stripOuterQuotes(concept.hook || concept.title),
    86,
  );
  const support = buildSupportCopy(project, concept, headline);
  const cta = buildObjectiveCta(project, brandProfile);

  return {
    headline,
    support: trimForDisplay(support, 112),
    cta: trimForDisplay(cta, 42),
  };
}

function buildObjectiveCta(project: CreativeProject, brandProfile: BrandProfile) {
  if (project.briefing.objective === "lead_capture") {
    return "Comente GUIA.";
  }

  if (project.briefing.objective === "conversation") {
    return "No seu tom.";
  }

  if (project.briefing.objective === "conversion") {
    return "Antes da venda esfriar.";
  }

  if (brandProfile.brandName) {
    return `${brandProfile.brandName}. Sem sumir.`;
  }

  return "Sem sumir.";
}

function buildSupportCopy(
  project: CreativeProject,
  concept: CreativeConcept,
  headline: string,
) {
  const source = [
    project.briefing.topic,
    project.briefing.mainMessage,
    project.briefing.context,
    concept.centralIdea,
    concept.copyDirection.openingMove,
    concept.visualDirection.visualFamily,
  ]
    .join(" ")
    .toLocaleLowerCase("pt-BR");
  const headlineSource = headline.toLocaleLowerCase("pt-BR");

  if (/\b(14h|19h|hor[aá]rio|demor|atras|esfri)/i.test(source)) {
    return "A pergunta chegou. A resposta demorou. A venda esfriou.";
  }

  if (
    headlineSource.includes("como posso te ajudar") ||
    /\b(atendimento|cliente|whatsapp|mensagem|conversa)\b/i.test(source)
  ) {
    return "Seu cliente não espera até você ter tempo.";
  }

  if (/\b(fila|espera|acumul)/i.test(source)) {
    return "Enquanto a fila cresce, a venda vai embora.";
  }

  return removeDuplicateLead(concept.centralIdea || project.briefing.topic, headline);
}

function removeDuplicateLead(value: string, headline: string) {
  const cleanValue = compactWhitespace(value);
  const cleanHeadline = compactWhitespace(headline);

  if (
    cleanValue.toLocaleLowerCase("pt-BR").startsWith(
      cleanHeadline.toLocaleLowerCase("pt-BR"),
    )
  ) {
    return cleanValue.slice(cleanHeadline.length).replace(/^[\s.,"'-]+/, "");
  }

  return cleanValue;
}

function stripOuterQuotes(value: string) {
  return compactWhitespace(value).replace(/^["'“”]+|["'“”]+$/g, "");
}

function renderEditorialTension(
  piece: TypographicPiece,
  brandProfile: BrandProfile,
  palette: Palette,
  font: FontFamilies,
) {
  const headlineLines = wrapText(piece.copy.headline, 17, 5);
  const supportLines = wrapText(piece.copy.support, 38, 4);
  const ctaLines = wrapText(piece.copy.cta, 34, 2);
  const supportY = 388 + headlineLines.length * 112;
  const brandMark = renderBrandMark(brandProfile, {
    x: 76,
    y: 1208,
    fill: palette.primary,
    font,
  });

  return svgShell(
    `
    <rect width="1080" height="1350" fill="${palette.background}" />
    <rect x="72" y="82" width="10" height="184" fill="${palette.accent}" />
    <text x="104" y="116" ${font.body} font-size="28" font-weight="850" fill="${palette.primary}">${escapeXml(brandProfile.brandName || "Social Studio")}</text>
    ${renderTextLines({
      lines: headlineLines,
      x: 92,
      y: 382,
      size: 104,
      lineHeight: 112,
      weight: 900,
      fill: palette.text,
      font: font.heading,
    })}
    <rect x="92" y="${supportY + 18}" width="152" height="8" fill="${palette.accent}" />
    ${renderTextLines({
      lines: supportLines,
      x: 92,
      y: supportY + 98,
      size: 42,
      lineHeight: 54,
      weight: 720,
      fill: palette.primary,
      font: font.body,
    })}
    ${brandMark}
    ${renderTextLines({
      lines: ctaLines,
      x: 76,
      y: 1284,
      size: 30,
      lineHeight: 38,
      weight: 780,
      fill: palette.muted,
      font: font.body,
    })}
    <circle cx="964" cy="1210" r="36" fill="${palette.accent}" />
    <circle cx="964" cy="1210" r="18" fill="${palette.background}" opacity="0.92" />
  `,
    palette.background,
  );
}

function renderConversationClean(
  piece: TypographicPiece,
  brandProfile: BrandProfile,
  palette: Palette,
  font: FontFamilies,
) {
  const headlineLines = wrapText(piece.copy.headline, 15, 5);
  const supportLines = wrapText(piece.copy.support, 34, 4);
  const ctaLines = wrapText(piece.copy.cta, 28, 2);
  const brandMark = renderBrandMark(brandProfile, {
    x: 96,
    y: 1262,
    fill: palette.light,
    font,
  });

  return svgShell(
    `
    <rect width="1080" height="1350" fill="${palette.primary}" />
    <rect x="80" y="92" width="920" height="832" rx="8" fill="${palette.background}" />
    <circle cx="138" cy="158" r="15" fill="${palette.accent}" />
    <circle cx="184" cy="158" r="15" fill="${palette.muted}" opacity="0.38" />
    <circle cx="230" cy="158" r="15" fill="${palette.muted}" opacity="0.24" />
    <rect x="144" y="260" width="600" height="74" rx="8" fill="${palette.surface}" />
    <text x="180" y="308" ${font.body} font-size="28" font-weight="780" fill="${palette.primary}">Mensagem recebida</text>
    ${renderTextLines({
      lines: headlineLines,
      x: 140,
      y: 490,
      size: 92,
      lineHeight: 100,
      weight: 900,
      fill: palette.text,
      font: font.heading,
    })}
    <rect x="140" y="930" width="800" height="2" fill="${palette.primary}" opacity="0.18" />
    ${renderTextLines({
      lines: supportLines,
      x: 140,
      y: 1014,
      size: 38,
      lineHeight: 50,
      weight: 690,
      fill: palette.light,
      font: font.body,
    })}
    ${brandMark}
    ${renderTextLines({
      lines: ctaLines,
      x: 570,
      y: 1262,
      size: 32,
      lineHeight: 40,
      weight: 820,
      fill: palette.accent,
      font: font.body,
      anchor: "end",
    })}
  `,
    palette.primary,
  );
}

function renderManifestoMark(
  piece: TypographicPiece,
  brandProfile: BrandProfile,
  palette: Palette,
  font: FontFamilies,
) {
  const headlineLines = wrapText(piece.copy.headline, 16, 6);
  const supportLines = wrapText(piece.copy.support, 34, 4);
  const ctaLines = wrapText(piece.copy.cta, 36, 2);
  const brandMark = renderBrandMark(brandProfile, {
    x: 76,
    y: 1266,
    fill: palette.light,
    font,
  });

  return svgShell(
    `
    <rect width="1080" height="1350" fill="${palette.text}" />
    <rect x="0" y="0" width="1080" height="240" fill="${palette.accent}" />
    <rect x="72" y="300" width="936" height="708" fill="${palette.primary}" opacity="0.34" />
    <text x="76" y="132" ${font.body} font-size="30" font-weight="850" fill="${palette.text}">${escapeXml(brandProfile.brandName || "Social Studio")}</text>
    ${renderTextLines({
      lines: headlineLines,
      x: 112,
      y: 432,
      size: 96,
      lineHeight: 106,
      weight: 900,
      fill: palette.light,
      font: font.heading,
    })}
    <rect x="112" y="1058" width="120" height="8" fill="${palette.accent}" />
    ${renderTextLines({
      lines: supportLines,
      x: 112,
      y: 1140,
      size: 34,
      lineHeight: 44,
      weight: 680,
      fill: palette.light,
      font: font.body,
    })}
    ${brandMark}
    ${renderTextLines({
      lines: ctaLines,
      x: 1004,
      y: 1266,
      size: 28,
      lineHeight: 36,
      weight: 800,
      fill: palette.accent,
      font: font.body,
      anchor: "end",
    })}
  `,
    palette.text,
  );
}

function svgShell(content: string, background: string) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${TYPOGRAPHIC_POST_WIDTH}" height="${TYPOGRAPHIC_POST_HEIGHT}" viewBox="0 0 ${TYPOGRAPHIC_POST_WIDTH} ${TYPOGRAPHIC_POST_HEIGHT}" role="img" aria-label="Typographic Instagram post" style="background:${background}">${content}</svg>`;
}

type TextLinesInput = {
  lines: string[];
  x: number;
  y: number;
  size: number;
  lineHeight: number;
  weight: number;
  fill: string;
  font: string;
  anchor?: "start" | "end" | "middle";
};

function renderTextLines({
  lines,
  x,
  y,
  size,
  lineHeight,
  weight,
  fill,
  font,
  anchor = "start",
}: TextLinesInput) {
  return lines
    .map(
      (line, index) =>
        `<text x="${x}" y="${y + index * lineHeight}" ${font} font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}">${escapeXml(line)}</text>`,
    )
    .join("");
}

function renderBrandMark(
  brandProfile: BrandProfile,
  options: {
    x: number;
    y: number;
    fill: string;
    font: FontFamilies;
  },
) {
  if (brandProfile.logoDataUrl) {
    return `<image href="${escapeAttribute(brandProfile.logoDataUrl)}" x="${options.x}" y="${options.y - 58}" width="168" height="72" preserveAspectRatio="xMinYMid meet" />`;
  }

  return `<text x="${options.x}" y="${options.y}" ${options.font.body} font-size="30" font-weight="900" fill="${options.fill}">${escapeXml(brandProfile.brandName || "Social Studio")}</text>`;
}

type Palette = {
  primary: string;
  accent: string;
  background: string;
  surface: string;
  text: string;
  muted: string;
  light: string;
};

function buildPalette(brandProfile: BrandProfile): Palette {
  const background = ensureColor(brandProfile.backgroundColor, "#f6f7f2");
  const primary = ensureColor(brandProfile.primaryColor, "#123c39");
  const accent = ensureColor(brandProfile.secondaryColor, "#d95f3d");

  return {
    primary,
    accent,
    background,
    surface: "#ffffff",
    text: "#171615",
    muted: "#6f6a61",
    light: readableTextOn(primary),
  };
}

type FontFamilies = {
  heading: string;
  body: string;
};

function buildFontFamilies(brandProfile: BrandProfile): FontFamilies {
  return {
    heading: `font-family="${escapeAttribute(fontStack(brandProfile.headingFont))}"`,
    body: `font-family="${escapeAttribute(fontStack(brandProfile.bodyFont))}"`,
  };
}

function fontStack(fontName: string) {
  return `${fontName || "Inter"}, Arial, sans-serif`;
}

function wrapText(value: string, maxChars: number, maxLines: number) {
  const words = compactWhitespace(value).split(" ").filter(Boolean);
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    const nextLine = currentLine ? `${currentLine} ${word}` : word;

    if (nextLine.length <= maxChars) {
      currentLine = nextLine;
      continue;
    }

    if (currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      lines.push(word.slice(0, maxChars));
      currentLine = word.slice(maxChars);
    }

    if (lines.length === maxLines) {
      break;
    }
  }

  if (currentLine && lines.length < maxLines) {
    lines.push(currentLine);
  }

  if (lines.length > maxLines) {
    return lines.slice(0, maxLines);
  }

  const sourceWasTrimmed = compactWhitespace(value).length > lines.join(" ").length;
  if (sourceWasTrimmed && lines.length) {
    const lastIndex = lines.length - 1;
    lines[lastIndex] = trimForDisplay(lines[lastIndex], maxChars);
  }

  return lines.length ? lines : [""];
}

function trimForDisplay(value: string, maxLength: number) {
  const normalized = compactWhitespace(value);

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, Math.max(0, maxLength - 3)).trim()}...`;
}

function compactWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function ensureColor(value: string, fallback: string) {
  return /^#[0-9a-f]{3,8}$/i.test(value) ? value : fallback;
}

function readableTextOn(hexColor: string) {
  const hex = hexColor.replace("#", "");
  const normalized =
    hex.length === 3
      ? hex
          .split("")
          .map((part) => `${part}${part}`)
          .join("")
      : hex.slice(0, 6);
  const red = Number.parseInt(normalized.slice(0, 2), 16);
  const green = Number.parseInt(normalized.slice(2, 4), 16);
  const blue = Number.parseInt(normalized.slice(4, 6), 16);
  const luminance = (0.2126 * red + 0.7152 * green + 0.0722 * blue) / 255;

  return luminance > 0.58 ? "#171615" : "#f6f7f2";
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeAttribute(value: string) {
  return escapeXml(value).replace(/"/g, "&quot;");
}
