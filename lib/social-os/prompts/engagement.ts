export const ENGAGEMENT_PROMPT_CONTRACT = {
  engine: "engagement_orchestration_engine",
  output: "json",
  responsibilities: [
    "classify inbound comments and DMs",
    "separate low-risk automation from human review",
    "prepare keyword-to-DM flows",
    "prepare material delivery",
    "record contact and conversation outcomes",
  ],
  forbidden: [
    "send high-risk replies without approval",
    "make legal or commercial promises",
    "process sensitive personal data without escalation",
    "ignore platform reply windows",
  ],
  requiredTraceKeys: [
    "intent",
    "risk_level",
    "autonomy_level",
    "selected_action",
    "escalation_reason",
  ],
} as const;
