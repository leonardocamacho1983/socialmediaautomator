import type { BrandProfile } from "../brand/profile";
import type { CaptionVariant } from "./captions";
import type { CarouselPackage, CarouselSlide } from "./carousel";
import type { TypographicCopy } from "./typographic-piece";

export type CopyQualitySeverity = "blocker" | "warning";

export type CopyQualityIssue = {
  id: string;
  field: string;
  fieldLabel: string;
  severity: CopyQualitySeverity;
  label: string;
  detail: string;
  suggestion: string;
  autoFixable: boolean;
};

export type CopyQualityCheck = {
  id: string;
  label: string;
  status: "ok" | "review";
  note: string;
  issues: CopyQualityIssue[];
};

export type CopyQualityReport = {
  status: "ok" | "review";
  summary: string;
  checks: CopyQualityCheck[];
  issues: CopyQualityIssue[];
  blockerCount: number;
  warningCount: number;
  autoFixableCount: number;
};

type ReviewCopyInput = {
  value: string;
  field: string;
  fieldLabel: string;
  required?: boolean;
  maxLength?: number;
  minLength?: number;
  role?: "visual" | "caption" | "comment" | "carousel" | "hashtag";
  brandProfile?: BrandProfile;
  compareAgainst?: string[];
};

export function buildCopyQualityReport(input: {
  brandProfile: BrandProfile;
  typographicCopy: TypographicCopy;
  captionVariant: CaptionVariant;
  carouselPackage?: CarouselPackage | null;
}): CopyQualityReport {
  const visualIssues = [
    ...reviewCopyText({
      value: input.typographicCopy.headline,
      field: "visual.headline",
      fieldLabel: "Headline visual",
      required: true,
      maxLength: 92,
      role: "visual",
      brandProfile: input.brandProfile,
    }),
    ...reviewCopyText({
      value: input.typographicCopy.support,
      field: "visual.support",
      fieldLabel: "Apoio visual",
      required: true,
      maxLength: 132,
      role: "visual",
      brandProfile: input.brandProfile,
    }),
    ...reviewCopyText({
      value: input.typographicCopy.cta,
      field: "visual.cta",
      fieldLabel: "CTA visual",
      required: true,
      maxLength: 48,
      role: "visual",
      brandProfile: input.brandProfile,
    }),
  ];

  const captionIssues = [
    ...reviewCopyText({
      value: input.captionVariant.caption,
      field: "caption",
      fieldLabel: "Legenda",
      required: true,
      minLength: 32,
      maxLength: 1800,
      role: "caption",
      brandProfile: input.brandProfile,
      compareAgainst: [
        input.typographicCopy.headline,
        input.typographicCopy.support,
      ],
    }),
    ...reviewInteractionCue(
      input.captionVariant.caption,
      input.captionVariant.firstComment,
    ),
  ];

  const commentIssues = reviewCopyText({
    value: input.captionVariant.firstComment,
    field: "firstComment",
    fieldLabel: "Primeiro comentário",
    maxLength: 320,
    role: "comment",
    brandProfile: input.brandProfile,
  });

  const hashtagIssues = reviewHashtags(input.captionVariant.hashtags);
  const carouselIssues = input.carouselPackage
    ? input.carouselPackage.slides.flatMap((slide) =>
        reviewCarouselSlideCopy(slide, input.brandProfile),
      )
    : [];

  return buildReport([
    buildCheck(
      "visual-copy",
      "Copy da imagem",
      "Headline, apoio e CTA visual estão publicáveis.",
      visualIssues,
    ),
    buildCheck(
      "caption",
      "Legenda",
      "A legenda passa nos criterios editoriais principais.",
      captionIssues,
    ),
    buildCheck(
      "first-comment",
      "Primeiro comentário",
      "O primeiro comentário não adiciona risco relevante.",
      commentIssues,
    ),
    buildCheck(
      "hashtags",
      "Hashtags",
      "Hashtags suficientes e sem escolhas excessivamente genéricas.",
      hashtagIssues,
    ),
    buildCheck(
      "carousel",
      "Slides do carrossel",
      input.carouselPackage
        ? "Todos os slides passam no gate editorial."
        : "Sem carrossel gerado ainda.",
      carouselIssues,
    ),
  ]);
}

export function reviewCarouselSlideCopy(
  slide: CarouselSlide,
  brandProfile?: BrandProfile,
): CopyQualityIssue[] {
  return [
    ...reviewCopyText({
      value: slide.eyebrow,
      field: `carousel.${slide.index}.eyebrow`,
      fieldLabel: `Slide ${slide.index} - marcador`,
      required: true,
      maxLength: 34,
      role: "carousel",
      brandProfile,
    }),
    ...reviewCopyText({
      value: slide.headline,
      field: `carousel.${slide.index}.headline`,
      fieldLabel: `Slide ${slide.index} - headline`,
      required: true,
      maxLength: 94,
      role: "carousel",
      brandProfile,
    }),
    ...reviewCopyText({
      value: slide.body,
      field: `carousel.${slide.index}.body`,
      fieldLabel: `Slide ${slide.index} - apoio`,
      maxLength: 180,
      role: "carousel",
      brandProfile,
      compareAgainst: [slide.headline],
    }),
    ...reviewCopyText({
      value: slide.footer,
      field: `carousel.${slide.index}.footer`,
      fieldLabel: `Slide ${slide.index} - rodapé`,
      maxLength: 56,
      role: "carousel",
      brandProfile,
    }),
  ];
}

export function reviewCopyText(input: ReviewCopyInput): CopyQualityIssue[] {
  const value = input.value || "";
  const cleanValue = value.trim();
  const issues: CopyQualityIssue[] = [];

  if (input.required && !cleanValue) {
    issues.push(
      issue(input, "missing", "Texto ausente.", {
        detail: "Este campo precisa de uma frase pública antes de aprovar.",
        suggestion: "Escreva uma frase curta e concreta.",
        severity: "blocker",
      }),
    );
    return issues;
  }

  if (!cleanValue) {
    return issues;
  }

  if (input.minLength && cleanValue.length < input.minLength) {
    issues.push(
      issue(input, "too-short", "Texto curto demais.", {
        detail: "O trecho parece rascunho e não entrega contexto suficiente.",
        suggestion: "Inclua uma cena, uma tensão ou uma pergunta mais clara.",
        severity: "warning",
      }),
    );
  }

  if (input.maxLength && cleanValue.length > input.maxLength) {
    issues.push(
      issue(input, "too-long", "Texto longo demais para o formato.", {
        detail: `O limite recomendado para este campo é ${input.maxLength} caracteres.`,
        suggestion: "Corte explicação e preserve uma ideia por bloco.",
        severity: "blocker",
      }),
    );
  }

  if (applyPortugueseQualityGate(value) !== value) {
    issues.push(
      issue(input, "portuguese", "Revise acentos e português.", {
        detail: "Há palavras comuns sem acento ou com grafia fraca.",
        suggestion: "Aplicar correção segura ou editar manualmente.",
        severity: "blocker",
        autoFixable: true,
      }),
    );
  }

  if (/[—–]/.test(value)) {
    issues.push(
      issue(input, "dash", "Travessão com cara de IA.", {
        detail: "O texto usa travessão ou meia-risca, um padrão recorrente de copy artificial.",
        suggestion: "Troque por ponto, vírgula ou corte a segunda metade.",
        severity: "blocker",
        autoFixable: true,
      }),
    );
  }

  if (/\s{2,}/.test(value) || /[!?]{2,}/.test(value)) {
    issues.push(
      issue(input, "spacing", "Pontuação ou espaço irregular.", {
        detail: "Há espaços duplicados ou pontuação repetida.",
        suggestion: "Aplicar correção segura.",
        severity: "warning",
        autoFixable: true,
      }),
    );
  }

  if (hasBriefingLanguage(value)) {
    issues.push(
      issue(input, "briefing-language", "Parece briefing, não texto público.", {
        detail: "O trecho usa palavras de bastidor como conceito, estrutura, direção, slide ou metáfora.",
        suggestion: "Reescreva como frase que a audiência leria no post.",
        severity: "blocker",
      }),
    );
  }

  if (hasWeakPublicCopy(value)) {
    issues.push(
      issue(input, "weak-copy", "Copy fraca ou mecânica.", {
        detail: "A frase já foi marcada como genérica, dura demais ou pouco natural.",
        suggestion: "Troque por cena concreta, tensão clara ou fala mais humana.",
        severity: "blocker",
      }),
    );
  }

  if (hasAiCliche(value)) {
    issues.push(
      issue(input, "ai-cliche", "Formulação típica de IA.", {
        detail: "O trecho usa construção promocional, lisa demais ou previsível.",
        suggestion: "Corte abstração e use uma cena ou afirmação mais específica.",
        severity: "blocker",
      }),
    );
  }

  if (hasEngagementBait(value)) {
    issues.push(
      issue(input, "engagement-bait", "CTA parece engagement bait.", {
        detail: "O pedido de interacao parece artificial ou forçado.",
        suggestion: "Faça uma pergunta real, ligada ao problema do post.",
        severity: "blocker",
      }),
    );
  }

  if (hasOverPromise(value)) {
    issues.push(
      issue(input, "over-promise", "Promessa exagerada.", {
        detail: "A copy pode sugerir resultado absoluto ou dificil de sustentar.",
        suggestion: "Reduza a promessa e fale do mecanismo concreto.",
        severity: "blocker",
      }),
    );
  }

  const forbiddenWord = findForbiddenWord(value, input.brandProfile);
  if (forbiddenWord) {
    issues.push(
      issue(input, "forbidden-word", "Termo proibido pela marca.", {
        detail: `O texto usa "${forbiddenWord}".`,
        suggestion: "Troque por uma palavra permitida no perfil da marca.",
        severity: "blocker",
      }),
    );
  }

  if (
    input.role === "caption" &&
    cleanValue.length > 120 &&
    !hasConcreteLanguage(cleanValue)
  ) {
    issues.push(
      issue(input, "no-concrete-scene", "Falta cena concreta.", {
        detail: "A legenda explica, mas não mostra uma situação reconhecível.",
        suggestion: "Abra com cliente, conversa, horário, mensagem, venda ou conflito real.",
        severity: "warning",
      }),
    );
  }

  if (input.compareAgainst?.some((fragment) => hasMeaningfulOverlap(value, fragment))) {
    issues.push(
      issue(input, "repetition", "Repete demais outro trecho.", {
        detail: "A copy repete a imagem ou a própria headline em vez de acrescentar contexto.",
        suggestion: "Use esse espaço para cena, consequência ou pergunta.",
        severity: "warning",
      }),
    );
  }

  return issues;
}

export function polishCopyText(value: string) {
  return applyPortugueseQualityGate(value)
    .replace(/\s*[—–]\s*/g, ". ")
    .replace(/[ \t]+/g, " ")
    .replace(/\s+([,.!?;:])/g, "$1")
    .replace(/([!?]){2,}/g, "$1")
    .replace(/\.{2,}/g, ".")
    .replace(/\n{3,}/g, "\n\n")
    .split("\n")
    .map((line) => capitalizeSentenceStarts(line.trim()))
    .join("\n")
    .trim();
}

export function applyPortugueseQualityGate(value: string) {
  return value
    .replace(/\bNao\b/g, "Não")
    .replace(/\bnao\b/g, "não")
    .replace(/\bTambem\b/g, "Também")
    .replace(/\btambem\b/g, "também")
    .replace(/\bEsta\b/g, "Está")
    .replace(/\besta\b/g, "está")
    .replace(/\bEstao\b/g, "Estão")
    .replace(/\bestao\b/g, "estão")
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
    .replace(/\bLa\b/g, "Lá")
    .replace(/\bla\b/g, "lá")
    .replace(/\bSerio\b/g, "Sério")
    .replace(/\bserio\b/g, "sério")
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
    .replace(/\bMetafora\b/g, "Metáfora")
    .replace(/\bmetafora\b/g, "metáfora")
    .replace(/\bDirecao\b/g, "Direção")
    .replace(/\bdirecao\b/g, "direção")
    .replace(/\bQual e\b/g, "Qual é")
    .replace(/\bqual e\b/g, "qual é")
    .replace(/\bNao e\b/g, "Não é")
    .replace(/\bNão e\b/g, "Não é")
    .replace(/\bnão e\b/g, "não é")
    .replace(/^E atendimento\b/g, "É atendimento")
    .replace(/^e atendimento\b/g, "é atendimento")
    .trim();
}

function capitalizeSentenceStarts(value: string) {
  return value.replace(
    /(^|[.!?]\s+)([a-záàâãéêíóôõúç])/g,
    (_, prefix: string, letter: string) => `${prefix}${letter.toLocaleUpperCase("pt-BR")}`,
  );
}

export function hasBriefingLanguage(value: string) {
  const normalized = normalizeForDetection(value);

  return BRIEFING_LANGUAGE.some((pattern) => pattern.test(normalized));
}

export function hasWeakPublicCopy(value: string) {
  const normalized = normalizeForDetection(value);

  return WEAK_PUBLIC_COPY.some((pattern) => pattern.test(normalized));
}

export function normalizeForDetection(value: string) {
  return value
    .toLocaleLowerCase("pt-BR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function cleanCopyLine(value: string, maxLength: number) {
  const normalized = value.replace(/\s+/g, " ").trim();

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, Math.max(0, maxLength - 3)).trim()}...`;
}

export function suggestFirstComment(input: {
  brandProfile: BrandProfile;
  caption: string;
  typographicCopy: TypographicCopy;
}) {
  const source = normalizeForDetection(
    [
      input.brandProfile.brandName,
      input.brandProfile.businessDescription,
      input.brandProfile.productOrService,
      input.brandProfile.valueProposition,
      input.brandProfile.audience,
      input.caption,
      input.typographicCopy.headline,
      input.typographicCopy.support,
      input.typographicCopy.cta,
    ].join(" "),
  );

  if (
    source.includes("whatsapp") &&
    (source.includes("venda") ||
      source.includes("cliente") ||
      source.includes("mensagem") ||
      source.includes("resposta") ||
      source.includes("atendimento"))
  ) {
    return "Hoje, quem assume essa conversa quando seu time não está online?";
  }

  if (source.includes("venda") || source.includes("compr")) {
    return "Em que momento a venda costuma esfriar antes de alguém perceber?";
  }

  if (
    source.includes("cliente") ||
    source.includes("atendimento") ||
    source.includes("suporte")
  ) {
    return "Qual pergunta do cliente ainda fica esperando alguém assumir?";
  }

  return "Qual parte dessa conversa mais parece o seu dia a dia hoje?";
}

function buildReport(checks: CopyQualityCheck[]): CopyQualityReport {
  const issues = checks.flatMap((check) => check.issues);
  const blockerCount = issues.filter((item) => item.severity === "blocker").length;
  const warningCount = issues.filter((item) => item.severity === "warning").length;
  const autoFixableCount = issues.filter((item) => item.autoFixable).length;

  return {
    status: issues.length ? "review" : "ok",
    summary: issues.length
      ? `${blockerCount} trava(s), ${warningCount} alerta(s), ${autoFixableCount} correção(ões) segura(s).`
      : "Copy sem alertas editoriais relevantes.",
    checks,
    issues,
    blockerCount,
    warningCount,
    autoFixableCount,
  };
}

function buildCheck(
  id: string,
  label: string,
  okNote: string,
  issues: CopyQualityIssue[],
): CopyQualityCheck {
  return {
    id,
    label,
    status: issues.length ? "review" : "ok",
    note: issues.length ? firstIssueSummary(issues) : okNote,
    issues,
  };
}

function firstIssueSummary(issues: CopyQualityIssue[]) {
  const blockerCount = issues.filter((item) => item.severity === "blocker").length;

  return blockerCount
    ? `${blockerCount} ponto(s) bloqueiam aprovação.`
    : `${issues.length} alerta(s) para revisar.`;
}

function issue(
  input: ReviewCopyInput,
  id: string,
  label: string,
  options: {
    detail: string;
    suggestion: string;
    severity: CopyQualitySeverity;
    autoFixable?: boolean;
  },
): CopyQualityIssue {
  return {
    id: `${input.field}.${id}`,
    field: input.field,
    fieldLabel: input.fieldLabel,
    severity: options.severity,
    label,
    detail: options.detail,
    suggestion: options.suggestion,
    autoFixable: Boolean(options.autoFixable),
  };
}

function reviewInteractionCue(
  caption: string,
  firstComment: string,
): CopyQualityIssue[] {
  const source = `${caption}\n${firstComment}`;

  if (/\?/.test(source) || /\b(comenta|me conta|responde|qual|quando)\b/i.test(source)) {
    return [];
  }

  return [
    {
      id: "caption.interaction-cue",
      field: "caption",
      fieldLabel: "Legenda",
      severity: "warning",
      label: "Falta convite real para conversa.",
      detail: "A copy não abre uma resposta clara do público.",
      suggestion: "Feche com uma pergunta concreta, sem pedir comentário por comentário.",
      autoFixable: false,
    },
  ];
}

function reviewHashtags(hashtags: string[]): CopyQualityIssue[] {
  if (!hashtags.length) {
    return [
      {
        id: "hashtags.missing",
        field: "hashtags",
        fieldLabel: "Hashtags",
        severity: "warning",
        label: "Sem hashtags.",
        detail: "O pacote não inclui hashtags.",
        suggestion: "Inclua poucas hashtags específicas ou deixe vazio de propósito.",
        autoFixable: false,
      },
    ];
  }

  const generic = hashtags.find((hashtag) =>
    GENERIC_HASHTAGS.has(normalizeForDetection(hashtag.replace(/^#/, ""))),
  );

  return generic
    ? [
        {
          id: "hashtags.generic",
          field: "hashtags",
          fieldLabel: "Hashtags",
          severity: "warning",
          label: "Hashtag genérica demais.",
          detail: `"${generic}" tende a parecer pacote automático.`,
          suggestion: "Prefira assunto, categoria ou dor mais específica.",
          autoFixable: false,
        },
      ]
    : [];
}

function hasAiCliche(value: string) {
  const normalized = normalizeForDetection(value);

  return AI_CLICHES.some((pattern) => pattern.test(normalized));
}

function hasEngagementBait(value: string) {
  const normalized = normalizeForDetection(value);

  return ENGAGEMENT_BAIT.some((pattern) => pattern.test(normalized));
}

function hasOverPromise(value: string) {
  const normalized = normalizeForDetection(value);

  return OVER_PROMISE.some((pattern) => pattern.test(normalized));
}

function hasConcreteLanguage(value: string) {
  const normalized = normalizeForDetection(value);

  return CONCRETE_LANGUAGE.some((pattern) => pattern.test(normalized));
}

function findForbiddenWord(value: string, brandProfile?: BrandProfile) {
  if (!brandProfile?.forbiddenWords.length) {
    return "";
  }

  const normalized = normalizeForDetection(value);

  return (
    brandProfile.forbiddenWords.find((word) => {
      const normalizedWord = normalizeForDetection(word);

      return normalizedWord && normalized.includes(normalizedWord);
    }) || ""
  );
}

function hasMeaningfulOverlap(text: string, fragment: string) {
  const normalizedText = normalizeForDetection(text);
  const relevantWords = normalizeForDetection(fragment)
    .split(/\s+/)
    .filter((word) => word.length > 4);

  if (!normalizedText || relevantWords.length < 3) {
    return false;
  }

  const overlapCount = relevantWords.filter((word) =>
    normalizedText.includes(word),
  ).length;

  return overlapCount / relevantWords.length > 0.64;
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

const WEAK_PUBLIC_COPY = [
  /\bo cliente mandou mensagem\b/,
  /\bdemora tambem comunica\b/,
  /\bdemora também comunica\b/,
  /\bqual e o seu caso hoje\b/,
  /\bqual é o seu caso hoje\b/,
  /\bchatbot, ninguem ou voce\b/,
  /\bchatbot, ninguém ou você\b/,
  /\bvoce mesmo correndo atras\b/,
  /\bvocê mesmo correndo atrás\b/,
  /\bda pra parar de perder venda\b/,
  /\bdá pra parar de perder venda\b/,
];

const AI_CLICHES = [
  /\bpotencialize\b/,
  /\bdesvende\b/,
  /\btransforme sua\b/,
  /\bjornada\b/,
  /\bsolucao inovadora\b/,
  /\bsolução inovadora\b/,
  /\bestrategia eficaz\b/,
  /\bestratégia eficaz\b/,
  /\bem um mundo\b/,
  /\bna era digital\b/,
  /\bvale ressaltar\b/,
  /\be importante destacar\b/,
  /\bé importante destacar\b/,
  /\bnao se trata apenas\b/,
  /\bnão se trata apenas\b/,
  /\bmais do que\b/,
];

const ENGAGEMENT_BAIT = [
  /\bcomente sim\b/,
  /\bcurta se\b/,
  /\bmarque alguem\b/,
  /\bmarque alguém\b/,
  /\bcompartilhe com\b/,
];

const OVER_PROMISE = [
  /\bgarantid/,
  /\bnunca mais\b/,
  /\b100%\b/,
  /\bdobrar\b/,
  /\btriplicar\b/,
  /\bvender automaticamente\b/,
];

const CONCRETE_LANGUAGE = [
  /\bcliente\b/,
  /\bmensagem\b/,
  /\bwhatsapp\b/,
  /\bresposta\b/,
  /\bpergunt/,
  /\bvenda\b/,
  /\bconversa\b/,
  /\bhora\b/,
  /\btime\b/,
  /\btela\b/,
];

const GENERIC_HASHTAGS = new Set([
  "marketing",
  "marketingdigital",
  "empreendedorismo",
  "negocios",
  "negócios",
  "sucesso",
  "inovacao",
  "inovação",
  "tecnologia",
]);
