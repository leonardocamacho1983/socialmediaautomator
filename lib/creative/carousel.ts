import type { BrandProfile } from "../brand/profile";
import type { CaptionVariant } from "./captions";
import type { CreativeBriefing, CreativeConcept } from "./concepts";
import {
  applyPortugueseQualityGate,
  cleanCopyLine as cleanLine,
  hasBriefingLanguage,
  hasWeakPublicCopy,
  normalizeForDetection,
  reviewCopyText,
} from "./copy-quality";
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
  variation: number;
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
  variation: number;
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

export type CarouselGenerationOptions = {
  variation?: number;
};

export function createCarouselPackage(
  input: CarouselGenerationInput,
  options: CarouselGenerationOptions = {},
): CarouselPackage {
  const now = Date.now();
  const variation = Math.max(0, Math.floor(options.variation || 0));

  return {
    id: `carousel-${now}`,
    postId: input.postId,
    conceptId: input.concept.id,
    generatedAt: new Date().toISOString(),
    format: "4:5",
    renderer: CURRENT_CAROUSEL_RENDERER,
    variation,
    slides: buildSlides(input, now, variation),
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
  return svgToDataUrl(
    renderCarouselSlideSvg(carouselPackage, slide, brandProfile),
  );
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
  const maxLengthByField = {
    eyebrow: 34,
    headline: 94,
    body: 180,
    footer: 56,
  } satisfies Record<keyof CarouselSlideCopyEdit, number>;
  const fieldLabels = {
    eyebrow: "Marcador",
    headline: "Headline",
    body: "Apoio",
    footer: "Rodapé",
  } satisfies Record<keyof CarouselSlideCopyEdit, string>;

  return Object.entries(fields).flatMap(([field, value]) => {
    const typedField = field as keyof CarouselSlideCopyEdit;

    return reviewCopyText({
      value,
      field,
      fieldLabel: fieldLabels[typedField],
      required: typedField !== "body" && typedField !== "footer",
      maxLength: maxLengthByField[typedField],
      role: "carousel",
      compareAgainst: typedField === "body" ? [slide.headline] : undefined,
    })
      .filter((issue) => issue.severity === "blocker")
      .map((issue) => ({
        field: typedField,
        label: issue.label,
      }));
  });
}

function buildSlides(
  input: CarouselGenerationInput,
  seed: number,
  variation: number,
) {
  return buildPublicCarouselCopy(input, variation).map((slide, index) => ({
    id: `carousel-slide-${seed}-${index + 1}`,
    index: index + 1,
    variation,
    ...slide,
  }));
}

type CarouselSlideDraft = Omit<CarouselSlide, "id" | "index" | "variation">;

function buildPublicCarouselCopy(
  input: CarouselGenerationInput,
  variation: number,
): CarouselSlideDraft[] {
  const brandName = input.brandProfile.brandName || "Social Studio";

  const drafts = isWhatsappSalesContext(input)
    ? buildWhatsappSalesCarousel(input, brandName, variation)
    : buildGenericCarousel(input, brandName, variation);

  return drafts.map((slide) => sanitizeSlideDraft(slide, input, brandName));
}

function buildWhatsappSalesCarousel(
  input: CarouselGenerationInput,
  brandName: string,
  variation: number,
): CarouselSlideDraft[] {
  return [
    {
      role: "cover",
      internalPurpose: "Abrir com o hook aprovado sem explicar a estratégia.",
      eyebrow: brandName,
      headline: pickVariant(
        [
          cleanLine(input.typographicPiece.copy.headline, 92),
          "A fila do WhatsApp não espera.",
          "Mensagem parada também derruba venda.",
          "Cliente esperando vira venda em risco.",
        ],
        variation,
      ),
      body: pickVariant(
        [
          cleanLine(input.typographicPiece.copy.support, 132),
          "A conversa chega. O tempo passa. A intenção esfria.",
          "Se ninguém assume a conversa, alguém assume o cliente.",
          "O problema não é só responder tarde. É parecer ausente.",
        ],
        variation,
      ),
      footer: "Arraste",
    },
    {
      role: "scene",
      internalPurpose: "Colocar uma cena concreta de WhatsApp parado.",
      eyebrow: "O que acontece",
      headline: pickVariant(
        [
          "O cliente chamou. Ninguém respondeu.",
          "A mensagem chegou. A resposta ficou para depois.",
          "Seu WhatsApp virou sala de espera.",
          "O cliente não sabe que você está ocupado.",
        ],
        variation,
      ),
      body: pickVariant(
        [
          "Ele não está navegando. Está decidindo se espera você ou chama outro.",
          "Nesse intervalo, ele compara, pergunta para outro e segue sem você.",
          "Quanto mais a fila cresce, mais a venda perde temperatura.",
          "Para ele, silêncio parece falta de prioridade.",
        ],
        variation,
      ),
      footer: brandName,
    },
    {
      role: "tension",
      internalPurpose: "Mostrar a consequência comercial da demora.",
      eyebrow: "O custo",
      headline: pickVariant(
        [
          "Para você, foram só alguns minutos.",
          "A demora não parece interna. Parece descaso.",
          "O cliente não vê sua operação. Vê sua ausência.",
          "Resposta lenta muda a temperatura da compra.",
        ],
        variation,
      ),
      body: pickVariant(
        [
          "Para ele, foi tempo suficiente para procurar outra empresa.",
          "Ele não sabe quem está ocupado. Só sabe quem respondeu primeiro.",
          "Cada minuto sem resposta aumenta a chance de perder contexto.",
          "A intenção ainda existe, mas começa a procurar outro caminho.",
        ],
        variation,
      ),
      footer: input.typographicPiece.copy.cta,
    },
    {
      role: "mechanism",
      internalPurpose: "Introduzir a marca como mecanismo prático.",
      eyebrow: brandName,
      headline: pickVariant(
        [
          `${brandName} responde antes da conversa esfriar.`,
          `${brandName} segura a conversa até seu time chegar.`,
          `${brandName} entra enquanto o cliente ainda quer comprar.`,
          `${brandName} organiza a fila antes dela virar perda.`,
        ],
        variation,
      ),
      body: pickVariant(
        [
          "Responde no tom do seu negócio e chama uma pessoa quando precisa.",
          "Mantém o atendimento vivo e passa para humano quando o assunto pede.",
          "A resposta chega com contexto, sem parecer robô empurrando formulário.",
          "A conversa continua sem depender de alguém olhando a tela o tempo todo.",
        ],
        variation,
      ),
      footer: brandName,
    },
    {
      role: "proof",
      internalPurpose: "Diferenciar de chatbot genérico.",
      eyebrow: "Na prática",
      headline: pickVariant(
        [
          "Não é robô empurrando formulário.",
          "Não é resposta genérica para todo mundo.",
          "Não é sumir e voltar horas depois.",
          "Não é trocar humano por script ruim.",
        ],
        variation,
      ),
      body: pickVariant(
        [
          "É atendimento treinado para manter a conversa viva até o humano assumir.",
          "É a marca respondendo com critério antes da venda perder força.",
          "É presença no WhatsApp sem apagar o jeito do seu negócio falar.",
          "É processo para a conversa não depender de improviso.",
        ],
        variation,
      ),
      footer: input.typographicPiece.copy.cta,
    },
    {
      role: "close",
      internalPurpose: "Fechar com pergunta que puxa comentário ou reflexão.",
      eyebrow: brandName,
      headline: pickVariant(
        [
          "Hoje, quem segura seu WhatsApp quando você não está online?",
          "Agora, quem responde antes da venda esfriar?",
          "Quantas conversas estão esperando alguém assumir?",
          "Seu cliente está esperando ou já foi atendido por outro?",
        ],
        variation,
      ),
      body: pickVariant(
        [
          "Olhe agora. Se a resposta demorou, a venda já começou a esfriar.",
          "Abra a fila. Se tem cliente parado, tem venda perdendo força.",
          "O problema aparece antes do relatório: na conversa sem dono.",
          "Se a pergunta chegou e ninguém respondeu, a decisão já começou.",
        ],
        variation,
      ),
      footer: input.typographicPiece.copy.cta || "Comente ou salve para revisar depois.",
    },
  ];
}

function buildGenericCarousel(
  input: CarouselGenerationInput,
  brandName: string,
  variation: number,
): CarouselSlideDraft[] {
  const customer = inferAudienceSubject(input);
  const problem = publicProblem(input);
  const value = publicValue(input, brandName);

  return [
    {
      role: "cover",
      internalPurpose: "Abrir com o hook aprovado.",
      eyebrow: brandName,
      headline: pickVariant(
        [
          cleanLine(input.typographicPiece.copy.headline, 92),
          stripOuterQuotes(input.concept.title || input.concept.hook),
          publicProblem(input),
          publicValue(input, brandName),
        ],
        variation,
      ),
      body: pickVariant(
        [
          cleanLine(input.typographicPiece.copy.support, 132),
          cleanLine(input.briefing.mainMessage, 132),
          "O ponto não é explicar mais. É fazer a pessoa sentir o problema.",
          "A sequência começa pelo incômodo antes de apresentar a solução.",
        ],
        variation,
      ),
      footer: "Arraste",
    },
    {
      role: "scene",
      internalPurpose: "Transformar a dor em cena pública.",
      eyebrow: "O que acontece",
      headline: pickVariant(
        [
          `${customer} percebe antes de falar com você.`,
          "O problema aparece antes da explicação.",
          "A primeira impressão acontece no detalhe.",
          "A pessoa sente antes de entender.",
        ],
        variation,
      ),
      body: pickVariant(
        [
          cleanLine(problem, 170),
          "Quando a experiência falha no começo, a oferta precisa remar contra.",
          "Antes da decisão racional, já existe uma leitura emocional.",
          "O incômodo parece pequeno por dentro e grande para quem está fora.",
        ],
        variation,
      ),
      footer: brandName,
    },
    {
      role: "tension",
      internalPurpose: "Mostrar o custo da dor.",
      eyebrow: "O custo",
      headline: pickVariant(
        [
          "O intervalo cobra caro.",
          "O detalhe pequeno vira sinal grande.",
          "O custo aparece antes da venda.",
          "A demora muda o que a pessoa sente.",
        ],
        variation,
      ),
      body: pickVariant(
        [
          "Quando a resposta demora, a confiança cai antes da conversa começar.",
          "A pessoa não vê seu bastidor. Ela sente o atrito.",
          "O problema não precisa ser enorme para derrubar intenção.",
          "A confiança começa a cair quando ninguém assume o próximo passo.",
        ],
        variation,
      ),
      footer: input.typographicPiece.copy.cta,
    },
    {
      role: "mechanism",
      internalPurpose: "Introduzir a marca como solução prática.",
      eyebrow: brandName,
      headline: pickVariant(
        [
          `${brandName} entra antes do problema crescer.`,
          `${brandName} transforma atrito em processo.`,
          `${brandName} organiza o ponto que costuma escapar.`,
          `${brandName} deixa a experiência menos solta.`,
        ],
        variation,
      ),
      body: pickVariant(
        [
          cleanLine(value, 170),
          "A solução aparece no momento em que a experiência começa a perder força.",
          "O processo segura a conversa sem tirar o tom humano da marca.",
          "A marca para de depender de improviso no ponto mais sensível.",
        ],
        variation,
      ),
      footer: brandName,
    },
    {
      role: "proof",
      internalPurpose: "Explicar a diferenca pratica sem promessa exagerada.",
      eyebrow: "Na prática",
      headline: pickVariant(
        [
          "Menos improviso. Mais clareza.",
          "Menos ruído. Mais presença.",
          "Menos solto. Mais consistente.",
          "Menos atraso. Mais controle.",
        ],
        variation,
      ),
      body: pickVariant(
        [
          "A conversa ganha processo sem perder o tom humano da marca.",
          "O atendimento deixa de depender de memória, sorte ou pressa.",
          "A experiência fica mais previsível sem soar engessada.",
          "O cliente sente continuidade, não remendo.",
        ],
        variation,
      ),
      footer: input.typographicPiece.copy.cta,
    },
    {
      role: "close",
      internalPurpose: "Fechar com pergunta ou CTA.",
      eyebrow: brandName,
      headline: pickVariant(
        [
          firstPublicQuestion(input) || "Onde a conversa trava hoje?",
          "Qual ponto da experiência ainda depende de improviso?",
          "Onde seu cliente sente atrito antes de comprar?",
          "Que detalhe pequeno está custando confiança?",
        ],
        variation,
      ),
      body: pickVariant(
        [
          "Esse é o ponto que precisa aparecer antes da próxima campanha.",
          "Comece por aí antes de pedir mais atenção para a marca.",
          "A melhora mais importante talvez esteja antes da oferta.",
          "O próximo passo deve nascer desse ponto, não de uma frase solta.",
        ],
        variation,
      ),
      footer: input.typographicPiece.copy.cta || "Comente ou salve para revisar depois.",
    },
  ];
}

function pickVariant(values: string[], variation: number) {
  const safeValues = values.filter(Boolean);
  const index = safeValues.length ? variation % safeValues.length : 0;

  return safeValues[index] || "";
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
    body: "Esse é o ponto que precisa aparecer antes da próxima campanha.",
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

function hasWeakCarouselCopy(value: string) {
  return hasWeakPublicCopy(value);
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
  const headlineLines = wrapText(slide.headline, 18, 6);
  const bodyLines = wrapText(slide.body, 38, 3);
  const headlineSize =
    headlineLines.length >= 6
      ? 58
      : headlineLines.length >= 5
        ? 62
        : headlineLines.length >= 4
          ? 70
          : 82;

  return svgShell(`
    <rect width="1080" height="1350" fill="${palette.primary}" />
    ${renderCoverTexture(palette)}
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
  const bodyLines = wrapText(slide.body, 28, 5);
  const headlineSize =
    headlineLines.length >= 4 ? 58 : headlineLines.length === 3 ? 66 : 76;

  return svgShell(`
    <rect width="1080" height="1350" fill="${palette.background}" />
    <rect x="72" y="72" width="936" height="1206" fill="#ffffff" stroke="${palette.border}" stroke-width="2" />
    <rect x="72" y="72" width="12" height="1206" fill="${palette.accent}" />
    <text x="124" y="142" ${font.body} font-size="24" font-weight="850" fill="${palette.primary}">${escapeXml(slide.eyebrow)}</text>
    <text x="956" y="142" ${font.body} font-size="24" font-weight="800" fill="${palette.muted}" text-anchor="end">${slide.index}/${carouselPackage.slides.length}</text>
    ${renderRoleVisual(slide, palette)}
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
      y: 820,
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
  const headlineLines = wrapText(slide.headline, 16, 5);
  const bodyLines = wrapText(slide.body, 34, 4);
  const headlineSize =
    headlineLines.length >= 5 ? 68 : headlineLines.length >= 4 ? 76 : 84;

  return svgShell(`
    <rect width="1080" height="1350" fill="${palette.background}" />
    <rect x="72" y="72" width="936" height="1206" fill="${palette.text}" />
    ${renderCloseTexture(palette)}
    <rect x="112" y="112" width="856" height="1126" fill="${palette.text}" stroke="${palette.accent}" stroke-width="4" />
    <text x="140" y="174" ${font.body} font-size="27" font-weight="850" fill="${palette.light}">${escapeXml(slide.eyebrow || brandProfile.brandName)}</text>
    <text x="940" y="174" ${font.body} font-size="24" font-weight="800" fill="${palette.light}" text-anchor="end">${slide.index}/${carouselPackage.slides.length}</text>
    ${renderTextLines({
      lines: headlineLines,
      x: 140,
      y: 420,
      size: headlineSize,
      lineHeight: headlineSize + 8,
      weight: 900,
      fill: palette.light,
      font: font.heading,
    })}
    ${renderTextLines({
      lines: bodyLines,
      x: 140,
      y: 846,
      size: 34,
      lineHeight: 46,
      weight: 700,
      fill: palette.light,
      font: font.body,
    })}
    <rect x="140" y="1052" width="270" height="76" fill="${palette.accent}" rx="38" />
    <circle cx="860" cy="1088" r="76" fill="${palette.accent}" opacity="0.96" />
    <circle cx="860" cy="1088" r="28" fill="${palette.text}" />
    <text x="140" y="1168" ${font.body} font-size="28" font-weight="820" fill="${palette.accent}">${escapeXml(slide.footer)}</text>
  `);
}

function renderCoverTexture(palette: Palette) {
  return `
    <g opacity="0.18">
      <rect x="636" y="182" width="248" height="104" fill="${palette.light}" rx="52" />
      <rect x="702" y="316" width="206" height="78" fill="${palette.light}" rx="39" />
      <rect x="604" y="430" width="292" height="78" fill="${palette.light}" rx="39" />
      <circle cx="686" cy="234" r="10" fill="${palette.primary}" />
      <circle cx="730" cy="234" r="10" fill="${palette.primary}" />
      <circle cx="774" cy="234" r="10" fill="${palette.primary}" />
    </g>
    <g opacity="0.14">
      ${Array.from({ length: 8 })
        .map(
          (_, index) =>
            `<rect x="${118 + index * 108}" y="1260" width="56" height="8" fill="${palette.light}" />`,
        )
        .join("")}
    </g>
  `;
}

function renderCloseTexture(palette: Palette) {
  return `
    <g opacity="0.12">
      <circle cx="832" cy="286" r="158" fill="${palette.accent}" />
      <circle cx="848" cy="286" r="82" fill="${palette.text}" />
      <rect x="674" y="990" width="240" height="98" fill="${palette.light}" rx="49" />
      <rect x="624" y="1118" width="174" height="62" fill="${palette.light}" rx="31" />
    </g>
  `;
}

function renderRoleVisual(slide: CarouselSlide, palette: Palette) {
  if (slide.role === "scene") {
    return renderSceneVisual(palette);
  }

  if (slide.role === "tension") {
    return renderTensionVisual(palette);
  }

  if (slide.role === "mechanism") {
    return renderMechanismVisual(palette);
  }

  if (slide.role === "proof") {
    return renderProofVisual(palette);
  }

  return "";
}

function renderSceneVisual(palette: Palette) {
  return `
    <g transform="translate(686 512) scale(0.76)">
      <rect x="0" y="0" width="292" height="346" fill="${palette.primary}" opacity="0.08" rx="40" />
      <rect x="38" y="34" width="216" height="278" fill="#ffffff" stroke="${palette.primary}" stroke-width="10" rx="38" />
      <rect x="72" y="84" width="124" height="42" fill="${palette.primary}" opacity="0.88" rx="21" />
      <rect x="96" y="154" width="128" height="42" fill="${palette.accent}" opacity="0.88" rx="21" />
      <rect x="70" y="224" width="156" height="42" fill="${palette.primary}" opacity="0.88" rx="21" />
      <circle cx="104" cy="105" r="7" fill="#ffffff" opacity="0.95" />
      <circle cx="134" cy="105" r="7" fill="#ffffff" opacity="0.95" />
      <circle cx="164" cy="105" r="7" fill="#ffffff" opacity="0.95" />
      <path d="M62 288 C104 342 198 342 244 286" fill="none" stroke="${palette.accent}" stroke-width="12" stroke-linecap="round" />
    </g>
  `;
}

function renderTensionVisual(palette: Palette) {
  return `
    <g transform="translate(686 512) scale(0.76)">
      <rect x="0" y="0" width="300" height="346" fill="${palette.primary}" opacity="0.08" rx="40" />
      <circle cx="150" cy="128" r="92" fill="#ffffff" stroke="${palette.primary}" stroke-width="12" />
      <path d="M150 128 L150 66" stroke="${palette.accent}" stroke-width="12" stroke-linecap="round" />
      <path d="M150 128 L204 158" stroke="${palette.primary}" stroke-width="12" stroke-linecap="round" />
      <rect x="118" y="16" width="64" height="24" fill="${palette.primary}" rx="12" />
      <rect x="52" y="252" width="196" height="20" fill="${palette.primary}" opacity="0.86" rx="10" />
      <rect x="52" y="292" width="132" height="20" fill="${palette.accent}" opacity="0.92" rx="10" />
      <rect x="52" y="332" width="74" height="20" fill="${palette.primary}" opacity="0.44" rx="10" />
    </g>
  `;
}

function renderMechanismVisual(palette: Palette) {
  return `
    <g transform="translate(664 512) scale(0.76)">
      <rect x="0" y="0" width="326" height="344" fill="${palette.primary}" opacity="0.08" rx="42" />
      <rect x="46" y="42" width="216" height="72" fill="#ffffff" stroke="${palette.primary}" stroke-width="8" rx="36" />
      <rect x="78" y="144" width="216" height="72" fill="${palette.primary}" opacity="0.92" rx="36" />
      <rect x="46" y="246" width="216" height="72" fill="#ffffff" stroke="${palette.accent}" stroke-width="8" rx="36" />
      <path d="M154 118 L154 140" stroke="${palette.accent}" stroke-width="10" stroke-linecap="round" />
      <path d="M190 220 L190 242" stroke="${palette.accent}" stroke-width="10" stroke-linecap="round" />
      <circle cx="92" cy="78" r="12" fill="${palette.primary}" opacity="0.9" />
      <circle cx="130" cy="78" r="12" fill="${palette.primary}" opacity="0.9" />
      <circle cx="126" cy="180" r="12" fill="#ffffff" opacity="0.96" />
      <circle cx="164" cy="180" r="12" fill="#ffffff" opacity="0.96" />
      <path d="M110 284 C138 252 174 252 202 284" fill="none" stroke="${palette.primary}" stroke-width="9" stroke-linecap="round" />
      <circle cx="156" cy="282" r="20" fill="${palette.accent}" />
    </g>
  `;
}

function renderProofVisual(palette: Palette) {
  return `
    <g transform="translate(672 512) scale(0.76)">
      <rect x="0" y="0" width="318" height="340" fill="${palette.primary}" opacity="0.08" rx="42" />
      <rect x="36" y="48" width="246" height="94" fill="#ffffff" stroke="${palette.border}" stroke-width="3" rx="22" />
      <rect x="36" y="198" width="246" height="94" fill="${palette.primary}" rx="22" />
      <path d="M92 80 L128 116 M128 80 L92 116" stroke="${palette.accent}" stroke-width="12" stroke-linecap="round" />
      <path d="M84 242 L110 266 L150 222" fill="none" stroke="${palette.accent}" stroke-width="13" stroke-linecap="round" stroke-linejoin="round" />
      <rect x="162" y="82" width="82" height="14" fill="${palette.muted}" opacity="0.36" rx="7" />
      <rect x="162" y="110" width="54" height="14" fill="${palette.muted}" opacity="0.24" rx="7" />
      <rect x="162" y="234" width="82" height="14" fill="#ffffff" opacity="0.74" rx="7" />
      <rect x="162" y="262" width="54" height="14" fill="#ffffff" opacity="0.52" rx="7" />
    </g>
  `;
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

function stripOuterQuotes(value: string) {
  return value.replace(/^["'“”‘’]+|["'“”‘’]+$/g, "").trim();
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
