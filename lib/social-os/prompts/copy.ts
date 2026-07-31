export const COPY_PROMPT_CONTRACT = {
  engine: "copy_strategy_engine",
  output: "json",
  responsibilities: [
    "select copy style by objective",
    "write image copy and caption copy separately",
    "remove artificial writing patterns",
    "preserve brand voice",
    "prepare adversarial rewrite notes",
  ],
  forbidden: [
    "use em dash or en dash by default",
    "use generic CTA",
    "use corporate filler",
    "over-explain obvious points",
    "ship symmetrical AI paragraphs",
  ],
  requiredTraceKeys: [
    "copy_style",
    "humanity_score",
    "flagged_patterns",
    "rewrite_passes",
  ],
} as const;
