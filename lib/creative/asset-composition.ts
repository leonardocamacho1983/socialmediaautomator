import type { BrandProfile } from "../brand/profile";
import type { GeneratedVisualAsset } from "./assets";
import type { TypographicPiece } from "./typographic-piece";
import {
  TYPOGRAPHIC_POST_HEIGHT,
  TYPOGRAPHIC_POST_WIDTH,
} from "./typographic-piece";

export type AssetCompositionVariantId =
  | "lower-panel"
  | "editorial-split"
  | "clean-band";

export type AssetCompositionVariant = {
  id: AssetCompositionVariantId;
  name: string;
  layoutFamily: string;
  rationale: string;
};

export const assetCompositionVariants: AssetCompositionVariant[] = [
  {
    id: "lower-panel",
    name: "Painel inferior",
    layoutFamily: "Imagem como assunto, copy em painel escuro no terco inferior.",
    rationale:
      "Mais seguro para legibilidade quando o asset tem assunto forte no topo.",
  },
  {
    id: "editorial-split",
    name: "Editorial lateral",
    layoutFamily: "Faixa editorial vertical, texto em coluna e asset respirando.",
    rationale:
      "Boa para pecas com imagem menos poluida e headline curta ou media.",
  },
  {
    id: "clean-band",
    name: "Faixa limpa",
    layoutFamily: "Asset dominante com faixa clara de leitura no rodape.",
    rationale:
      "Boa quando a imagem ja tem peso visual e a copy precisa soar mais leve.",
  },
];

export function getAssetCompositionVariant(
  variantId?: string | null,
): AssetCompositionVariant {
  return (
    assetCompositionVariants.find((variant) => variant.id === variantId) ||
    assetCompositionVariants[0]
  );
}

export function renderAssetCompositeSvg(
  piece: TypographicPiece,
  brandProfile: BrandProfile,
  asset: GeneratedVisualAsset,
  compositionVariant: AssetCompositionVariant,
) {
  if (compositionVariant.id === "editorial-split") {
    return renderEditorialSplit(piece, brandProfile, asset);
  }

  if (compositionVariant.id === "clean-band") {
    return renderCleanBand(piece, brandProfile, asset);
  }

  return renderLowerPanel(piece, brandProfile, asset);
}

function renderLowerPanel(
  piece: TypographicPiece,
  brandProfile: BrandProfile,
  asset: GeneratedVisualAsset,
) {
  const palette = buildPalette(brandProfile);
  const font = buildFontFamilies(brandProfile);
  const headlineLines = wrapText(piece.copy.headline, 23, 4);
  const supportLines = wrapText(piece.copy.support, 54, 2);
  const ctaLines = wrapText(piece.copy.cta, 30, 1);
  const panelX = 84;
  const panelY = 626;
  const panelWidth = 912;
  const panelHeight = 548;
  const panelPaddingX = 42;
  const headlineSize =
    headlineLines.length >= 4 ? 60 : headlineLines.length === 3 ? 68 : 78;
  const headlineLineHeight = headlineSize + 8;
  const headlineY = panelY + 176;
  const supportY =
    headlineY + Math.max(1, headlineLines.length) * headlineLineHeight + 44;
  const footerY = panelY + panelHeight - 50;

  return svgShell(`
    <defs>
      <linearGradient id="assetOverlay" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${palette.text}" stop-opacity="0.04" />
        <stop offset="56%" stop-color="${palette.text}" stop-opacity="0.12" />
        <stop offset="100%" stop-color="${palette.text}" stop-opacity="0.48" />
      </linearGradient>
    </defs>
    <rect width="1080" height="1350" fill="${palette.background}" />
    <image href="${escapeAttribute(asset.dataUrl)}" x="0" y="0" width="1080" height="1350" preserveAspectRatio="xMidYMid slice" />
    <rect width="1080" height="1350" fill="url(#assetOverlay)" />
    <rect x="${panelX}" y="${panelY}" width="${panelWidth}" height="${panelHeight}" rx="0" fill="${palette.primary}" fill-opacity="0.91" />
    <rect x="${panelX}" y="${panelY}" width="12" height="${panelHeight}" fill="${palette.accent}" />
    <text x="${panelX + panelPaddingX}" y="${panelY + 66}" ${font.body} font-size="28" font-weight="850" fill="${palette.light}">${escapeXml(brandProfile.brandName || "Social Studio")}</text>
    ${renderTextLines({
      lines: headlineLines,
      x: panelX + panelPaddingX,
      y: headlineY,
      size: headlineSize,
      lineHeight: headlineLineHeight,
      weight: 900,
      fill: palette.light,
      font: font.heading,
    })}
    ${renderTextLines({
      lines: supportLines,
      x: panelX + panelPaddingX,
      y: supportY,
      size: 31,
      lineHeight: 39,
      weight: 720,
      fill: palette.light,
      font: font.body,
    })}
    <rect x="${panelX + panelWidth - 262}" y="${footerY - 36}" width="220" height="54" rx="27" fill="${palette.text}" fill-opacity="0.16" />
    ${renderTextLines({
      lines: ctaLines,
      x: panelX + panelWidth - 66,
      y: footerY,
      size: 28,
      lineHeight: 36,
      weight: 820,
      fill: palette.accent,
      font: font.body,
      anchor: "end",
    })}
  `);
}

function renderEditorialSplit(
  piece: TypographicPiece,
  brandProfile: BrandProfile,
  asset: GeneratedVisualAsset,
) {
  const palette = buildPalette(brandProfile);
  const font = buildFontFamilies(brandProfile);
  const headlineLines = wrapText(piece.copy.headline, 14, 5);
  const supportLines = wrapText(piece.copy.support, 28, 3);
  const ctaLines = wrapText(piece.copy.cta, 22, 1);
  const headlineSize =
    headlineLines.length >= 5 ? 56 : headlineLines.length >= 4 ? 62 : 70;
  const headlineLineHeight = headlineSize + 8;
  const panelX = 68;
  const panelY = 86;
  const panelWidth = 484;
  const panelHeight = 1178;
  const contentX = panelX + 42;
  const headlineY = panelY + 260;
  const supportY = headlineY + headlineLines.length * headlineLineHeight + 58;

  return svgShell(`
    <defs>
      <linearGradient id="splitOverlay" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stop-color="${palette.text}" stop-opacity="0.46" />
        <stop offset="54%" stop-color="${palette.text}" stop-opacity="0.08" />
        <stop offset="100%" stop-color="${palette.text}" stop-opacity="0" />
      </linearGradient>
    </defs>
    <rect width="1080" height="1350" fill="${palette.background}" />
    <image href="${escapeAttribute(asset.dataUrl)}" x="0" y="0" width="1080" height="1350" preserveAspectRatio="xMidYMid slice" />
    <rect width="1080" height="1350" fill="url(#splitOverlay)" />
    <rect x="${panelX}" y="${panelY}" width="${panelWidth}" height="${panelHeight}" fill="${palette.primary}" fill-opacity="0.93" />
    <rect x="${panelX}" y="${panelY}" width="10" height="${panelHeight}" fill="${palette.accent}" />
    <text x="${contentX}" y="${panelY + 72}" ${font.body} font-size="28" font-weight="850" fill="${palette.light}">${escapeXml(brandProfile.brandName || "Social Studio")}</text>
    ${renderTextLines({
      lines: headlineLines,
      x: contentX,
      y: headlineY,
      size: headlineSize,
      lineHeight: headlineLineHeight,
      weight: 900,
      fill: palette.light,
      font: font.heading,
    })}
    ${renderTextLines({
      lines: supportLines,
      x: contentX,
      y: supportY,
      size: 30,
      lineHeight: 39,
      weight: 720,
      fill: palette.light,
      font: font.body,
    })}
    ${renderTextLines({
      lines: ctaLines,
      x: contentX,
      y: panelY + panelHeight - 58,
      size: 28,
      lineHeight: 36,
      weight: 820,
      fill: palette.accent,
      font: font.body,
    })}
  `);
}

function renderCleanBand(
  piece: TypographicPiece,
  brandProfile: BrandProfile,
  asset: GeneratedVisualAsset,
) {
  const palette = buildPalette(brandProfile);
  const font = buildFontFamilies(brandProfile);
  const headlineLines = wrapText(piece.copy.headline, 28, 3);
  const supportLines = wrapText(piece.copy.support, 54, 2);
  const ctaLines = wrapText(piece.copy.cta, 30, 1);
  const bandX = 72;
  const bandY = 864;
  const bandWidth = 936;
  const bandHeight = 342;
  const contentX = bandX + 42;
  const headlineSize =
    headlineLines.length >= 3 ? 58 : headlineLines.length === 2 ? 66 : 74;
  const headlineLineHeight = headlineSize + 8;
  const headlineY = bandY + 104;
  const supportY = headlineY + headlineLines.length * headlineLineHeight + 34;

  return svgShell(`
    <rect width="1080" height="1350" fill="${palette.background}" />
    <image href="${escapeAttribute(asset.dataUrl)}" x="0" y="0" width="1080" height="1350" preserveAspectRatio="xMidYMid slice" />
    <rect x="0" y="0" width="1080" height="1350" fill="${palette.text}" opacity="0.1" />
    <rect x="${bandX}" y="${bandY}" width="${bandWidth}" height="${bandHeight}" fill="${palette.background}" fill-opacity="0.96" />
    <rect x="${bandX}" y="${bandY}" width="${bandWidth}" height="10" fill="${palette.accent}" />
    <text x="${contentX}" y="${bandY + 54}" ${font.body} font-size="25" font-weight="850" fill="${palette.primary}">${escapeXml(brandProfile.brandName || "Social Studio")}</text>
    ${renderTextLines({
      lines: headlineLines,
      x: contentX,
      y: headlineY,
      size: headlineSize,
      lineHeight: headlineLineHeight,
      weight: 900,
      fill: palette.text,
      font: font.heading,
    })}
    ${renderTextLines({
      lines: supportLines,
      x: contentX,
      y: supportY,
      size: 28,
      lineHeight: 36,
      weight: 700,
      fill: palette.primary,
      font: font.body,
    })}
    ${renderTextLines({
      lines: ctaLines,
      x: bandX + bandWidth - 42,
      y: bandY + bandHeight - 42,
      size: 26,
      lineHeight: 34,
      weight: 820,
      fill: palette.accent,
      font: font.body,
      anchor: "end",
    })}
  `);
}

function svgShell(content: string) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${TYPOGRAPHIC_POST_WIDTH}" height="${TYPOGRAPHIC_POST_HEIGHT}" viewBox="0 0 ${TYPOGRAPHIC_POST_WIDTH} ${TYPOGRAPHIC_POST_HEIGHT}" role="img" aria-label="Instagram post with generated visual asset">${content}</svg>`;
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

function wrapText(value: string, maxChars: number, maxLines: number) {
  const words = value.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
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

  return lines.length ? lines.slice(0, maxLines) : [""];
}

type Palette = {
  primary: string;
  accent: string;
  background: string;
  text: string;
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
    text: "#171615",
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
