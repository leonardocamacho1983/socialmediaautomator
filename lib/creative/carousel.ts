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
  internalPurpose: string;
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
  renderer: "deterministic-carousel-v3";
  slides: CarouselSlide[];
};

export type CarouselSlideCopyEdit = Partial<
  Pick<CarouselSlide, "eyebrow" | "headline" | "body" | "footer">
>;

export type CarouselSlideCopyIssue = {
  field: keyof CarouselSlideCopyEdit;
  label: string;
};

export const CURRENT_CAROUSEL_RENDERER = "deterministic-carousel-v3";

export const carouselSlideRoleLabels: Record<CarouselSlideRole, string> = {
  cover: "Capa",
  scene: "Cena",
  tension: "Custo",
  mechanism: "Como muda",
  proof: "Na prática",
  close: "Fechamento",
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
    renderer: CURRENT_CAROUSEL_RENDERER,
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

export function updateCarouselSlideCopy(
  slide: CarouselSlide,
  changes: CarouselSlideCopyEdit,
): CarouselSlide {
  return {
    ...slide,
    eyebrow:
      changes.eyebrow === undefined
        ? slide.eyebrow
        : polishCarouselCopyField(changes.eyebrow, slide.eyebrow, 34),
    headline:
      changes.headline === undefined
        ? slide.headline
        : polishCarouselCopyField(changes.headline, slide.headline, 94),
    body:
      changes.body === undefined
        ? slide.body
        : polishCarouselCopyField(changes.body, slide.body, 180),
    footer:
      changes.footer === undefined
        ? slide.footer
        : polishCarouselCopyField(changes.footer, slide.footer, 56),
  };
}

export function evaluateCarouselSlideCopy(
  slide: CarouselSlide,
): CarouselSlideCopyIssue[] {
  const fields = {
    eyebrow: slide.eyebrow,
    headline: slide.headline,
    body: slide.body,
    footer: slide.footer,
  } satisfies Record<keyof CarouselSlideCopyEdit, string>;

  return Object.entries(fields).flatMap(([field, value]) => {
    const issues: CarouselSlideCopyIssue[] = [];
    const typedField = field as keyof CarouselSlideCopyEdit;

    if (hasBriefingLanguage(value)) {
      issues.push({
        field: typedField,
        label: "Parece linguagem de briefing, nao texto publico.",
      });
    }

    if (hasWeakCarouselCopy(value)) {
      issues.push({
        field: typedField,
        label: "Copy fraca ou mecanica. Reescreva antes de aprovar.",
      });
    }

    if (applyPortugueseQualityGate(value) !== value) {
      issues.push({
        field: typedField,
        label: "Revise acentos e portugues antes de aprovar.",
      });
    }

    return issues;
  });
}

function buildSlides(input: CarouselGenerationInput, seed: number) {
  return buildPublicCarouselCopy(input).map((slide, index) => ({
    id: `carousel-slide-${seed}-${index + 1}`,
    index: index + 1,
    ...slide,
  }));
}

type CarouselSlideDraft = Omit<CarouselSlide, "id" | "index">;

function buildPublicCarouselCopy(
  input: CarouselGenerationInput,
): CarouselSlideDraft[] {
  const brandName = input.brandProfile.brandName || "Social Studio";

  const drafts = isWhatsappSalesContext(input)
    ? buildWhatsappSalesCarousel(input, brandName)
    : buildGenericCarousel(input, brandName);

  return drafts.map((slide) => sanitizeSlideDraft(slide, input, brandName));
}

function buildWhatsappSalesCarousel(
  input: CarouselGenerationInput,
  brandName: string,
): CarouselSlideDraft[] {
  return [
    {
      role: "cover",
      internalPurpose: "Abrir com o hook aprovado sem explicar a estratégia.",
      eyebrow: brandName,
      headline: cleanLine(input.typographicPiece.copy.headline, 92),
      body: cleanLine(input.typographicPiece.copy.support, 132),
      footer: "Arraste",
    },
    {
      role: "scene",
      internalPurpose: "Colocar uma cena concreta de WhatsApp parado.",
      eyebrow: "O que acontece",
      headline: "O cliente chamou. Ninguém respondeu.",
      body: "Ele não está navegando. Está decidindo se espera você ou chama outro.",
      footer: brandName,
    },
    {
      role: "tension",
      internalPurpose: "Mostrar a consequência comercial da demora.",
      eyebrow: "O custo",
      headline: "Para você, foram só alguns minutos.",
      body: "Para ele, foi tempo suficiente para procurar outra empresa.",
      footer: input.typographicPiece.copy.cta,
    },
    {
      role: "mechanism",
      internalPurpose: "Introduzir a marca como mecanismo prático.",
      eyebrow: brandName,
      headline: `${brandName} responde antes da conversa esfriar.`,
      body: "Responde no tom do seu negócio e chama uma pessoa quando precisa.",
      footer: brandName,
    },
    {
      role: "proof",
      internalPurpose: "Diferenciar de chatbot genérico.",
      eyebrow: "Na prática",
      headline: "Não é robô empurrando formulário.",
      body: "É atendimento treinado para manter a conversa viva até o humano assumir.",
      footer: input.typographicPiece.copy.cta,
    },
    {
      role: "close",
      internalPurpose: "Fechar com pergunta que puxa comentário ou reflexão.",
      eyebrow: brandName,
      headline: "Hoje, quem segura seu WhatsApp quando você não está online?",
      body: "Olhe agora. Se a resposta demorou, a venda já começou a esfriar.",
      footer: input.typographicPiece.copy.cta || "Comente ou salve para revisar depois.",
    },
  ];
}

function buildGenericCarousel(
  input: CarouselGenerationInput,
  brandName: string,
): CarouselSlideDraft[] {
  const customer = inferAudienceSubject(input);
  const problem = publicProblem(input);
  const value = publicValue(input, brandName);

  return [
    {
      role: "cover",
      internalPurpose: "Abrir com o hook aprovado.",
      eyebrow: brandName,
      headline: cleanLine(input.typographicPiece.copy.headline, 92),
      body: cleanLine(input.typographicPiece.copy.support, 132),
      footer: "Arraste",
    },
    {
      role: "scene",
      internalPurpose: "Transformar a dor em cena pública.",
      eyebrow: "O que acontece",
      headline: `${customer} percebe antes de falar com você.`,
      body: cleanLine(problem, 170),
      footer: brandName,
    },
    {
      role: "tension",
      internalPurpose: "Mostrar o custo da dor.",
      eyebrow: "O custo",
      headline: "O intervalo cobra caro.",
      body: "Quando a resposta demora, a confiança cai antes da conversa começar.",
      footer: input.typographicPiece.copy.cta,
    },
    {
      role: "mechanism",
      internalPurpose: "Introduzir a marca como solução prática.",
      eyebrow: brandName,
      headline: `${brandName} entra antes do problema crescer.`,
      body: cleanLine(value, 170),
      footer: brandName,
    },
    {
      role: "proof",
      internalPurpose: "Explicar a diferenca pratica sem promessa exagerada.",
      eyebrow: "Na prática",
      headline: "Menos improviso. Mais clareza.",
      body: "A conversa ganha processo sem perder o tom humano da marca.",
      footer: input.typographicPiece.copy.cta,
    },
    {
      role: "close",
      internalPurpose: "Fechar com pergunta ou CTA.",
      eyebrow: brandName,
      headline: firstPublicQuestion(input) || "Onde a conversa trava hoje?",
      body: "Esse e o ponto que precisa aparecer antes da proxima campanha.",
      footer: input.typographicPiece.copy.cta || "Comente ou salve para revisar depois.",
    },
  ];
}

function sanitizeSlideDraft(
  slide: CarouselSlideDraft,
  input: CarouselGenerationInput,
  brandName: string,
): CarouselSlideDraft {
  const fallback = publicFallbackForRole(slide.role, input, brandName);
  const headline = sanitizePublicCopy(slide.headline, fallback.headline, 94);
  let body = sanitizePublicCopy(slide.body, fallback.body, 180);

  if (isDuplicateCopy(headline, body)) {
    body = fallback.body;
  }

  return {
    ...slide,
    eyebrow: sanitizePublicCopy(slide.eyebrow, fallback.eyebrow, 34),
    headline,
    body,
    footer: sanitizePublicCopy(slide.footer, fallback.footer, 56),
  };
}

function publicFallbackForRole(
  role: CarouselSlideRole,
  input: CarouselGenerationInput,
  brandName: string,
): Pick<CarouselSlideDraft, "eyebrow" | "headline" | "body" | "footer"> {
  const cta = input.typographicPiece.copy.cta || brandName;

  if (role === "cover") {
    return {
      eyebrow: brandName,
      headline: input.typographicPiece.copy.headline || input.concept.hook,
      body: input.typographicPiece.copy.support || input.briefing.mainMessage,
      footer: "Arraste",
    };
  }

  if (role === "scene") {
    return {
      eyebrow: "O que acontece",
      headline: "O problema aparece antes da venda.",
      body: "O cliente percebe a demora antes de conhecer a solucao.",
      footer: brandName,
    };
  }

  if (role === "tension") {
    return {
      eyebrow: "O custo",
      headline: "Demora tambem comunica.",
      body: "Quando ninguem assume a conversa, a confianca comeca a cair.",
      footer: cta,
    };
  }

  if (role === "mechanism") {
    return {
      eyebrow: brandName,
      headline: `${brandName} entra antes da conversa esfriar.`,
      body: "A resposta chega com criterio, tom de marca e passagem para humano quando precisa.",
      footer: brandName,
    };
  }

  if (role === "proof") {
    return {
      eyebrow: "Na pratica",
      headline: "Menos improviso. Mais clareza.",
      body: "A conversa segue sem depender de alguem estar olhando a tela o tempo todo.",
      footer: cta,
    };
  }

  return {
    eyebrow: brandName,
    headline: firstPublicQuestion(input) || "Onde a conversa trava hoje?",
    body: "Esse e o ponto que precisa aparecer antes da proxima campanha.",
    footer: cta || "Comente ou salve para revisar depois.",
  };
}

function sanitizePublicCopy(value: string, fallback: string, maxLength: number) {
  const cleaned = polishCarouselCopyField(value, fallback, maxLength);

  if (
    !cleaned ||
    hasBriefingLanguage(cleaned) ||
    hasWeakCarouselCopy(cleaned)
  ) {
    return cleanLine(applyPortugueseQualityGate(fallback), maxLength);
  }

  return cleaned;
}

function polishCarouselCopyField(
  value: string,
  fallback: string,
  maxLength: number,
) {
  return (
    cleanLine(applyPortugueseQualityGate(value), maxLength) ||
    cleanLine(applyPortugueseQualityGate(fallback), maxLength)
  );
}

function hasBriefingLanguage(value: string) {
  const normalized = normalizeForDetection(value);

  return BRIEFING_LANGUAGE.some((pattern) => pattern.test(normalized));
}

const BRIEFING_LANGUAGE = [
  /\bmetafora\b/,
  /\bvirada\b/,
  /\bfecho\b/,
  /\bmostrar\b/,
  /\bmostrando\b/,
  /\bideia de que\b/,
  /\bestrutura\b/,
  /\bnarrativa\b/,
  /\bdirecao\b/,
  /\bdirecao visual\b/,
  /\bprova\b/,
  /\bmecanismo\b/,
  /\bconceito\b/,
  /\bcopy\b/,
  /\bpost\b/,
  /\bslide\b/,
];

const WEAK_CAROUSEL_COPY = [
  /\bo cliente mandou mensagem\b/,
  /\bdemora tambem comunica\b/,
  /\bdemora também comunica\b/,
  /\bqual e o seu caso hoje\b/,
  /\bqual é o seu caso hoje\b/,
  /\bchatbot, ninguem ou voce\b/,
  /\bchatbot, ninguém ou você\b/,
  /\bvoce mesmo correndo atras\b/,
  /\bvocê mesmo correndo atrás\b/,
];

function hasWeakCarouselCopy(value: string) {
  const normalized = normalizeForDetection(value);

  return WEAK_CAROUSEL_COPY.some((pattern) => pattern.test(normalized));
}

function isDuplicateCopy(headline: string, body: string) {
  const cleanHeadline = normalizeForDetection(headline);
  const cleanBody = normalizeForDetection(body);

  return (
    cleanHeadline.length > 12 &&
    (cleanBody.includes(cleanHeadline) || cleanHeadline.includes(cleanBody))
  );
}

function isWhatsappSalesContext(input: CarouselGenerationInput) {
  const source = normalizeForDetection(
    [
      input.brandProfile.brandName,
      input.brandProfile.businessDescription,
      input.brandProfile.productOrService,
      input.brandProfile.valueProposition,
      input.briefing.topic,
      input.briefing.mainMessage,
      input.briefing.context,
      input.concept.title,
      input.concept.centralIdea,
      input.concept.hook,
      input.typographicPiece.copy.headline,
      input.typographicPiece.copy.support,
    ].join(" "),
  );

  return (
    source.includes("whatsapp") &&
    (source.includes("venda") ||
      source.includes("cliente") ||
      source.includes("mensagem") ||
      source.includes("resposta") ||
      source.includes("atendimento"))
  );
}

function firstPublicQuestion(input: CarouselGenerationInput) {
  const candidates = [
    input.captionVariant?.firstComment || "",
    input.captionVariant?.caption || "",
    input.typographicPiece.copy.cta,
  ];

  for (const candidate of candidates) {
    const question = applyPortugueseQualityGate(questionFromText(candidate));

    if (
      question &&
      !hasBriefingLanguage(question) &&
      !hasWeakCarouselCopy(question)
    ) {
      return cleanLine(question, 90);
    }
  }

  return "";
}

function publicProblem(input: CarouselGenerationInput) {
  const candidates = [
    input.briefing.mainMessage,
    input.concept.centralIdea,
    input.typographicPiece.copy.support,
    firstSentence(input.captionVariant?.caption || ""),
  ];

  for (const candidate of candidates) {
    if (
      candidate &&
      !hasBriefingLanguage(candidate) &&
      !hasWeakCarouselCopy(candidate)
    ) {
      return cleanLine(applyPortugueseQualityGate(candidate), 170);
    }
  }

  return "A pessoa sente o problema antes de entender sua oferta.";
}

function publicValue(input: CarouselGenerationInput, brandName: string) {
  const candidates = [
    input.brandProfile.valueProposition,
    input.brandProfile.productOrService,
    input.briefing.mainMessage,
    input.concept.whyItFitsBrand,
  ];

  for (const candidate of candidates) {
    if (
      candidate &&
      !hasBriefingLanguage(candidate) &&
      !hasWeakCarouselCopy(candidate)
    ) {
      return cleanLine(applyPortugueseQualityGate(candidate), 170);
    }
  }

  return `${brandName} organiza a resposta sem apagar o tom humano.`;
}

function inferAudienceSubject(input: CarouselGenerationInput) {
  const audience = normalizeForDetection(input.brandProfile.audience);

  if (audience.includes("cliente")) {
    return "O cliente";
  }

  if (audience.includes("empresa") || audience.includes("negocio")) {
    return "O negócio";
  }

  if (audience.includes("time")) {
    return "O time";
  }

  return "A pessoa";
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

function firstSentence(value: string) {
  return cleanLine(value.split(/[.!?]\s/)[0] || value, 160);
}

function questionFromText(value: string) {
  const question = value.match(/([^.!?\n]*\?)/);

  return question ? cleanLine(question[1], 160) : "";
}

function applyPortugueseQualityGate(value: string) {
  return value
    .replace(/\bNao\b/g, "Não")
    .replace(/\bnao\b/g, "não")
    .replace(/\bTambem\b/g, "Também")
    .replace(/\btambem\b/g, "também")
    .replace(/\bEsta\b/g, "Está")
    .replace(/\besta\b/g, "está")
    .replace(/\bVoce\b/g, "Você")
    .replace(/\bvoce\b/g, "você")
    .replace(/\bNegocio\b/g, "Negócio")
    .replace(/\bnegocio\b/g, "negócio")
    .replace(/\bRobo\b/g, "Robô")
    .replace(/\brobo\b/g, "robô")
    .replace(/\bAte\b/g, "Até")
    .replace(/\bate\b/g, "até")
    .replace(/\bNinguem\b/g, "Ninguém")
    .replace(/\bninguem\b/g, "ninguém")
    .replace(/\bAtras\b/g, "Atrás")
    .replace(/\batras\b/g, "atrás")
    .replace(/\bJa\b/g, "Já")
    .replace(/\bja\b/g, "já")
    .replace(/\bComecou\b/g, "Começou")
    .replace(/\bcomecou\b/g, "começou")
    .replace(/\bPratica\b/g, "Prática")
    .replace(/\bpratica\b/g, "prática")
    .replace(/\bConfianca\b/g, "Confiança")
    .replace(/\bconfianca\b/g, "confiança")
    .replace(/\bComecar\b/g, "Começar")
    .replace(/\bcomecar\b/g, "começar")
    .replace(/\bSolucao\b/g, "Solução")
    .replace(/\bsolucao\b/g, "solução")
    .replace(/\bPublica\b/g, "Pública")
    .replace(/\bpublica\b/g, "pública")
    .replace(/\bGenerico\b/g, "Genérico")
    .replace(/\bgenerico\b/g, "genérico")
    .replace(/\bConsequencia\b/g, "Consequência")
    .replace(/\bconsequencia\b/g, "consequência")
    .replace(/\bCriterio\b/g, "Critério")
    .replace(/\bcriterio\b/g, "critério")
    .replace(/\bAlguem\b/g, "Alguém")
    .replace(/\balguem\b/g, "alguém")
    .replace(/\bProxima\b/g, "Próxima")
    .replace(/\bproxima\b/g, "próxima")
    .replace(/\bQual e\b/g, "Qual é")
    .replace(/\bqual e\b/g, "qual é")
    .replace(/\bNao e\b/g, "Não é")
    .replace(/\bnão e\b/g, "não é")
    .replace(/^E atendimento\b/g, "É atendimento")
    .replace(/^e atendimento\b/g, "é atendimento")
    .trim();
}

function normalizeForDetection(value: string) {
  return value
    .toLocaleLowerCase("pt-BR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
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
