export const STRATEGY_PROMPT_CONTRACT = {
  engine: "strategy_engine",
  output: "json",
  responsibilities: [
    "extract business context",
    "define narrative thesis",
    "select audience priority",
    "propose campaign sequence",
    "write measurable hypotheses",
  ],
  forbidden: [
    "generate finished posts",
    "choose final layouts",
    "publish or schedule content",
    "hide assumptions",
  ],
  requiredTraceKeys: [
    "campaign_objective",
    "audience_segment",
    "narrative_thesis",
    "success_metric",
    "risk_level",
  ],
} as const;
