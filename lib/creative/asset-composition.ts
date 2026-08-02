import type { BrandProfile } from "../brand/profile";
import type { GeneratedVisualAsset } from "./assets";
import type { TypographicPiece, TypographicVariant } from "./typographic-piece";
import {
  TYPOGRAPHIC_POST_HEIGHT,
  TYPOGRAPHIC_POST_WIDTH,
} from "./typographic-piece";

export function renderAssetCompositeSvg(
  piece: TypographicPiece,
  variant: TypographicVariant,
  brandProfile: BrandProfile,
  asset: GeneratedVisualAsset,
) {
  const palette = buildPalette(brandProfile);
  const font = buildFontFamilies(brandProfile);
  const headlineLines = wrapText(piece.copy.headline, 23, 4);
  const supportLines = wrapText(piece.copy.support, 54, 2);
  const ctaLines = wrapText(piece.copy.cta, 30, 1);
  const isConversationVariant = variant.id === "conversation-clean";
  const panelX = isConversationVariant ? 88 : 84;
  const panelY = isConversationVariant ? 640 : 626;
  const panelWidth = isConversationVariant ? 904 : 912;
  const panelHeight = isConversationVariant ? 526 : 548;
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
