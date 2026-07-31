import type {
  BrandWritingProfile,
  HumanWritingEvaluation,
  WritingPatternFlag,
} from "@/lib/social-os/types";

type ArtificialPatternRule = {
  id: string;
  label: string;
  severity: WritingPatternFlag["severity"];
  weight: number;
  test: (text: string) => string[];
};

const AI_FILLER_TERMS = [
  "potencialize",
  "transforme",
  "desbloqueie",
  "jornada",
  "solucao inovadora",
  "resultados extraordinarios",
  "em um mundo cada vez mais",
  "mais do que nunca",
  "de forma eficiente",
  "estrategia assertiva",
  "elevar seu negocio",
];

const SYMMETRIC_OPENERS = [
  "nao e sobre",
  "o problema nao e",
  "a verdade e que",
  "imagine um cenario",
  "voce sabia que",
  "no final do dia",
];

const PATTERN_RULES: ArtificialPatternRule[] = [
  {
    id: "dash_usage",
    label: "Uso de travessao editorial tipico de IA",
    severity: "high",
    weight: 22,
    test: (text) => collectMatches(text, /[—–―]/g),
  },
  {
    id: "corporate_filler",
    label: "Cliches corporativos e promessas vazias",
    severity: "high",
    weight: 18,
    test: (text) => collectTerms(text, AI_FILLER_TERMS),
  },
  {
    id: "mechanical_openers",
    label: "Aberturas previsiveis ou excessivamente arrumadas",
    severity: "medium",
    weight: 12,
    test: (text) => collectTerms(text, SYMMETRIC_OPENERS),
  },
  {
    id: "excessive_lists",
    label: "Enumeracao artificial",
    severity: "medium",
    weight: 10,
    test: (text) => collectMatches(text, /(^|\n)\s*(\d+\.|- )/g).slice(0, 8),
  },
  {
    id: "generic_cta",
    label: "CTA generico",
    severity: "medium",
    weight: 12,
    test: (text) =>
      collectMatches(
        text,
        /(saiba mais|clique no link|entre em contato|compartilhe sua opiniao|comente aqui)/gi,
      ),
  },
  {
    id: "too_symmetric",
    label: "Ritmo simetrico demais",
    severity: "low",
    weight: 8,
    test: findSymmetricParagraphs,
  },
  {
    id: "over_explained",
    label: "Explicacao longa sem imagem concreta",
    severity: "low",
    weight: 8,
    test: findLongAbstractSentences,
  },
];

export const DEFAULT_WRITING_PROFILE: BrandWritingProfile = {
  language: "pt-BR",
  rhythm: {
    sentence_length: "short_to_medium",
    variation: "high",
    fragments_allowed: true,
  },
  vocabulary: {
    technical_density: "medium",
    promotional_density: "low",
  },
  punctuationPolicy: {
    em_dash: "forbidden",
    en_dash: "forbidden",
    colon: "moderate",
    semicolon: "rare",
  },
  aiPatternBans: {
    corporate_filler: AI_FILLER_TERMS,
    predictable_openers: SYMMETRIC_OPENERS,
    generic_ctas: ["saiba mais", "entre em contato", "clique no link"],
  },
  copyStyleDefaults: {
    preferred: ["founder_pov", "diagnostic", "case_breakdown"],
    avoid: ["generic_educational", "corporate_manifesto"],
  },
  humanImperfections: {
    asymmetry: "preferred",
    fragments: "allowed",
    concrete_examples: "required",
  },
  status: "draft",
};

export function evaluateHumanWriting(
  text: string,
  profile: BrandWritingProfile = DEFAULT_WRITING_PROFILE,
): HumanWritingEvaluation {
  const normalized = normalizeText(text);
  const flags = PATTERN_RULES.map((rule) => {
    const examples = rule.test(normalized);

    if (!examples.length) {
      return null;
    }

    return {
      id: rule.id,
      label: rule.label,
      severity: rule.severity,
      occurrences: examples.length,
      examples: examples.slice(0, 3),
    } satisfies WritingPatternFlag;
  }).filter((flag): flag is WritingPatternFlag => Boolean(flag));

  const rawScore = flags.reduce((score, flag) => {
    const rule = PATTERN_RULES.find((item) => item.id === flag.id);
    return score + (rule?.weight ?? 0) * Math.min(flag.occurrences, 3);
  }, 0);
  const punctuationPolicy = profile.punctuationPolicy;
  const punctuationPenalty =
    punctuationPolicy.em_dash === "forbidden" && /[—]/.test(text) ? 10 : 0;
  const artificialityScore = Math.min(100, rawScore + punctuationPenalty);

  return {
    artificialityScore,
    passed: artificialityScore < 35 && flags.every((flag) => flag.severity !== "high"),
    flags,
    rewriteNotes: buildRewriteNotes(flags),
  };
}

export function buildAdversarialRewritePrompt(input: {
  text: string;
  evaluation: HumanWritingEvaluation;
  profile?: BrandWritingProfile;
}) {
  const profile = input.profile ?? DEFAULT_WRITING_PROFILE;

  return [
    "Reescreva o texto mantendo sentido, marca e objetivo, mas remova sinais de texto artificial.",
    "Nao explique o que voce mudou. Responda apenas com a nova versao.",
    `Pontuacao proibida: ${JSON.stringify(profile.punctuationPolicy)}.`,
    `Padroes encontrados: ${JSON.stringify(input.evaluation.flags)}.`,
    `Notas de reescrita: ${input.evaluation.rewriteNotes.join(" ")}`,
    "Texto:",
    input.text,
  ].join("\n\n");
}

function normalizeText(text: string) {
  return text.normalize("NFKC").trim();
}

function collectMatches(text: string, pattern: RegExp) {
  return [...text.matchAll(pattern)]
    .map((match) => match[0].trim())
    .filter(Boolean);
}

function collectTerms(text: string, terms: string[]) {
  const lower = removeAccents(text.toLowerCase());

  return terms.filter((term) => lower.includes(removeAccents(term.toLowerCase())));
}

function findSymmetricParagraphs(text: string) {
  return text
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => {
      const sentences = paragraph.split(/[.!?]\s+/).filter(Boolean);
      if (sentences.length < 3) return false;

      const lengths = sentences.map((sentence) => sentence.length);
      const average =
        lengths.reduce((total, length) => total + length, 0) / lengths.length;
      const maxVariance = Math.max(
        ...lengths.map((length) => Math.abs(length - average)),
      );

      return maxVariance < 18;
    })
    .slice(0, 3);
}

function findLongAbstractSentences(text: string) {
  const abstractTerms = [
    "estrategia",
    "performance",
    "resultado",
    "processo",
    "experiencia",
    "solucao",
    "eficiencia",
  ];

  return text
    .split(/[.!?]\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => {
      if (sentence.length < 180) return false;

      const lower = removeAccents(sentence.toLowerCase());
      const hasConcreteMarker = /\b(exemplo|ontem|hoje|cliente|print|whatsapp|reuniao|pedido)\b/.test(
        lower,
      );
      const abstractCount = abstractTerms.filter((term) => lower.includes(term))
        .length;

      return abstractCount >= 2 && !hasConcreteMarker;
    })
    .slice(0, 3);
}

function buildRewriteNotes(flags: WritingPatternFlag[]) {
  if (!flags.length) {
    return ["Manter o texto assim; nao ha sinais fortes de artificialidade."];
  }

  return flags.map((flag) => {
    if (flag.id === "dash_usage") {
      return "Trocar travessoes por frases menores, ponto ou quebra natural.";
    }

    if (flag.id === "corporate_filler") {
      return "Substituir cliches por uma cena, detalhe ou observacao especifica.";
    }

    if (flag.id === "generic_cta") {
      return "Trocar CTA generico por uma acao contextual ao post.";
    }

    return `Reescrever trechos marcados por ${flag.label.toLowerCase()}.`;
  });
}

function removeAccents(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}
