import type { BrandProfile } from "../brand/profile";
import type { CaptionVariant } from "./captions";
import type { CreativeBriefing, CreativeConcept } from "./concepts";
import {
  svgToDataUrl,
  TYPOGRAPHIC_POST_HEIGHT,
  TYPOGRAPHIC_POST_WIDTH,
  type TypographicPiece,
} from "./typographic-piece";

export type CarouselSlideRole =
  | "cover"
  | "scene"
  | "tension"
  | "mechanism"
  | "proof"
  | "close";

export type CarouselSlide = {
  id: string;
  index: number;
  role: CarouselSlideRole;
  eyebrow: string;
  headline: string;
  body: string;
  footer: string;
};

export type CarouselPackage = {
  id: string;
  postId: string;
  conceptId: string;
  generatedAt: string;
  format: "4:5";
  renderer: "deterministic-carousel-v1";
  slides: CarouselSlide[];
};

export type CarouselGenerationInput = {
  postId: string;
  brandProfile: BrandProfile;
  briefing: CreativeBriefing;
  concept: CreativeConcept;
  typographicPiece: TypographicPiece;
  captionVariant: CaptionVariant | null;
};

export function createCarouselPackage(
  input: CarouselGenerationInput,
): CarouselPackage {
  const now = Date.now();

  return {
    id: `carousel-${now}`,
    postId: input.postId,
    conceptId: input.concept.id,
    generatedAt: new Date().toISOString(),
    format: "4:5",
    renderer: "deterministic-carousel-v1",
    slides: buildSlides(input, now),
  };
}

export function renderCarouselSlideSvg(
  carouselPackage: CarouselPackage,
  slide: CarouselSlide,
  brandProfile: BrandProfile,
) {
  const palette = buildPalette(brandProfile);
  const font = buildFontFamilies(brandProfile);

  if (slide.role === "cover") {
    return renderCoverSlide(carouselPackage, slide, brandProfile, palette, font);
  }

  if (slide.role === "close") {
    return renderCloseSlide(carouselPackage, slide, brandProfile, palette, font);
  }

  return renderBodySlide(carouselPackage, slide, brandProfile, palette, font);
}

export function carouselSlideToDataUrl(
  carouselPackage: CarouselPackage,
  slide: CarouselSlide,
  brandProfile: BrandProfile,
) {
  return svgToDataUrl(renderCarouselSlideSvg(carouselPackage, slide, brandProfile));
}

function buildSlides(input: CarouselGenerationInput, seed: number) {
  const brandName = input.brandProfile.brandName || "Social Studio";
  const narrative = normalizeNarrative(input.concept.narrativeStructure);
  const captionOpening = firstSentence(input.captionVariant?.caption || "");
  const sourceBody =
    input.concept.centralIdea ||
    input.briefing.mainMessage ||
    input.typographicPiece.copy.support;

  return [
    {
      id: `carousel-slide-${seed}-1`,
      index: 1,
      role: "cover" as const,
      eyebrow: brandName,
      headline: cleanLine(input.typographicPiece.copy.headline, 92),
      body: cleanLine(input.typographicPiece.copy.support, 132),
      footer: "Arraste",
    },
    {
      id: `carousel-slide-${seed}-2`,
      index: 2,
      role: "scene" as const,
      eyebrow: "Cena",
      headline: headlineFromNarrative(narrative[0], "O problema aparece antes."),
      body: cleanLine(narrative[0] || captionOpening || sourceBody, 180),
      footer: brandName,
    },
    {
      id: `carousel-slide-${seed}-3`,
      index: 3,
      role: "tension" as const,
      eyebrow: "Tensao",
      headline: headlineFromNarrative(narrative[1], "A venda esfria no intervalo."),
      body: cleanLine(narrative[1] || input.concept.hook || sourceBody, 190),
      footer: input.typographicPiece.copy.cta,
    },
    {
      id: `carousel-slide-${seed}-4`,
      index: 4,
      role: "mechanism" as const,
      eyebrow: "Virada",
      headline: headlineFromNarrative(narrative[2], "Responder muda a conversa."),
      body: cleanLine(narrative[2] || input.briefing.mainMessage, 190),
      footer: brandName,
    },
    {
      id: `carousel-slide-${seed}-5`,
      index: 5,
      role: "proof" as const,
      eyebrow: "Como fica",
      headline: headlineFromNarrative(narrative[3], "Menos espera. Mais conversa."),
      body: cleanLine(
        narrative[3] ||
          input.concept.whyItFitsBrand ||
          input.concept.differentiationFromOthers,
        190,
      ),
      footer: input.typographicPiece.copy.cta,
    },
    {
      id: `carousel-slide-${seed}-6`,
      index: 6,
      role: "close" as const,
      eyebrow: brandName,
      headline: cleanLine(input.typographicPiece.copy.cta || brandName, 72),
      body: cleanLine(
        questionFromCaption(input.captionVariant?.firstComment || "") ||
          input.captionVariant?.firstComment ||
          "Hoje, quem responde quando voce nao esta online?",
        150,
      ),
      footer: "Comente ou salve para revisar depois.",
    },
  ];
}

function renderCoverSlide(
  carouselPackage: CarouselPackage,
  slide: CarouselSlide,
  brandProfile: BrandProfile,
  palette: Palette,
  font: FontFamilies,
) {
  const headlineLines = wrapText(slide.headline, 15, 5);
  const bodyLines = wrapText(slide.body, 38, 3);
  const headlineSize =
    headlineLines.length >= 5 ? 62 : headlineLines.length >= 4 ? 70 : 82;

  return svgShell(`
    <rect width="1080" height="1350" fill="${palette.primary}" />
    <rect x="72" y="72" width="936" height="1206" fill="${palette.primary}" stroke="${palette.accent}" stroke-width="12" />
    <text x="116" y="142" ${font.body} font-size="28" font-weight="850" fill="${palette.light}">${escapeXml(slide.eyebrow)}</text>
    <text x="964" y="142" ${font.body} font-size="24" font-weight="800" fill="${palette.light}" text-anchor="end">${slide.index}/${carouselPackage.slides.length}</text>
    ${renderTextLines({
      lines: headlineLines,
      x: 116,
      y: 430,
      size: headlineSize,
      lineHeight: headlineSize + 10,
      weight: 900,
      fill: palette.light,
      font: font.heading,
    })}
    ${renderTextLines({
      lines: bodyLines,
      x: 116,
      y: 1018,
      size: 34,
      lineHeight: 44,
      weight: 720,
      fill: palette.light,
      font: font.body,
    })}
    <rect x="116" y="1176" width="132" height="8" fill="${palette.accent}" />
    <text x="964" y="1192" ${font.body} font-size="28" font-weight="820" fill="${palette.accent}" text-anchor="end">${escapeXml(slide.footer)}</text>
  `);
}

function renderBodySlide(
  carouselPackage: CarouselPackage,
  slide: CarouselSlide,
  brandProfile: BrandProfile,
  palette: Palette,
  font: FontFamilies,
) {
  const headlineLines = wrapText(slide.headline, 18, 4);
  const bodyLines = wrapText(slide.body, 35, 6);
  const headlineSize =
    headlineLines.length >= 4 ? 58 : headlineLines.length === 3 ? 66 : 76;

  return svgShell(`
    <rect width="1080" height="1350" fill="${palette.background}" />
    <rect x="72" y="72" width="936" height="1206" fill="#ffffff" stroke="${palette.border}" stroke-width="2" />
    <rect x="72" y="72" width="12" height="1206" fill="${palette.accent}" />
    <text x="124" y="142" ${font.body} font-size="24" font-weight="850" fill="${palette.primary}">${escapeXml(slide.eyebrow)}</text>
    <text x="956" y="142" ${font.body} font-size="24" font-weight="800" fill="${palette.muted}" text-anchor="end">${slide.index}/${carouselPackage.slides.length}</text>
    ${renderTextLines({
      lines: headlineLines,
      x: 124,
      y: 360,
      size: headlineSize,
      lineHeight: headlineSize + 10,
      weight: 900,
      fill: palette.text,
      font: font.heading,
    })}
    <rect x="124" y="690" width="132" height="8" fill="${palette.accent}" />
    ${renderTextLines({
      lines: bodyLines,
      x: 124,
      y: 792,
      size: 34,
      lineHeight: 46,
      weight: 650,
      fill: palette.primary,
      font: font.body,
    })}
    <text x="124" y="1194" ${font.body} font-size="26" font-weight="820" fill="${palette.muted}">${escapeXml(brandProfile.brandName || slide.footer)}</text>
  `);
}

function renderCloseSlide(
  carouselPackage: CarouselPackage,
  slide: CarouselSlide,
  brandProfile: BrandProfile,
  palette: Palette,
  font: FontFamilies,
) {
  const headlineLines = wrapText(slide.headline, 16, 4);
  const bodyLines = wrapText(slide.body, 34, 4);

  return svgShell(`
    <rect width="1080" height="1350" fill="${palette.background}" />
    <rect x="72" y="72" width="936" height="1206" fill="${palette.text}" />
    <rect x="112" y="112" width="856" height="1126" fill="${palette.text}" stroke="${palette.accent}" stroke-width="4" />
    <text x="140" y="174" ${font.body} font-size="27" font-weight="850" fill="${palette.light}">${escapeXml(slide.eyebrow || brandProfile.brandName)}</text>
    <text x="940" y="174" ${font.body} font-size="24" font-weight="800" fill="${palette.light}" text-anchor="end">${slide.index}/${carouselPackage.slides.length}</text>
    ${renderTextLines({
      lines: headlineLines,
      x: 140,
      y: 458,
      size: 80,
      lineHeight: 90,
      weight: 900,
      fill: palette.light,
      font: font.heading,
    })}
    ${renderTextLines({
      lines: bodyLines,
      x: 140,
      y: 878,
      size: 34,
      lineHeight: 46,
      weight: 700,
      fill: palette.light,
      font: font.body,
    })}
    <text x="140" y="1168" ${font.body} font-size="28" font-weight="820" fill="${palette.accent}">${escapeXml(slide.footer)}</text>
  `);
}

function svgShell(content: string) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${TYPOGRAPHIC_POST_WIDTH}" height="${TYPOGRAPHIC_POST_HEIGHT}" viewBox="0 0 ${TYPOGRAPHIC_POST_WIDTH} ${TYPOGRAPHIC_POST_HEIGHT}" role="img" aria-label="Instagram carousel slide">${content}</svg>`;
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
}: TextLinesInput) {
  return lines
    .map(
      (line, index) =>
        `<text x="${x}" y="${y + index * lineHeight}" ${font} font-size="${size}" font-weight="${weight}" fill="${fill}">${escapeXml(line)}</text>`,
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

function headlineFromNarrative(value: string | undefined, fallback: string) {
  const source = cleanLine(value || fallback, 88);
  const [firstPart] = source.split(/[.:;]/);

  if (firstPart && firstPart.length >= 18) {
    return firstPart;
  }

  return source;
}

function normalizeNarrative(value: string[]) {
  return value.map((item) => cleanLine(item, 220)).filter(Boolean);
}

function firstSentence(value: string) {
  return cleanLine(value.split(/[.!?]\s/)[0] || value, 160);
}

function questionFromCaption(value: string) {
  const question = value.match(/([^.!?\n]*\?)/);

  return question ? cleanLine(question[1], 160) : "";
}

function cleanLine(value: string, maxLength: number) {
  const normalized = value.replace(/\s+/g, " ").trim();

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, Math.max(0, maxLength - 3)).trim()}...`;
}

type Palette = {
  primary: string;
  accent: string;
  background: string;
  text: string;
  muted: string;
  border: string;
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
    muted: "#6f6a61",
    border: "#d8ded8",
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
