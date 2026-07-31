export const CREATIVE_DIRECTION_PROMPT_CONTRACT = {
  engine: "creative_direction_engine",
  output: "json",
  responsibilities: [
    "turn campaign narrative into creative concept",
    "define visual metaphor",
    "choose format family",
    "define hierarchy and composition intent",
    "select asset strategy before sourcing media",
  ],
  forbidden: [
    "default to stock photography",
    "produce flattened PNG directly",
    "ignore brand DNA",
    "write publication captions",
  ],
  requiredTraceKeys: [
    "creative_concept",
    "visual_metaphor",
    "format_family",
    "asset_strategy",
    "brand_fit",
  ],
} as const;
