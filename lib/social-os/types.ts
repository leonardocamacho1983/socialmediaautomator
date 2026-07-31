export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

export type JsonRecord = Record<string, JsonValue>;

export type SocialPlatform = "instagram" | "linkedin" | "both";

export type FunnelStage =
  | "awareness"
  | "consideration"
  | "trust"
  | "conversation"
  | "lead_capture"
  | "conversion"
  | "retention"
  | "advocacy";

export type RiskLevel = "low" | "medium" | "high" | "blocked";

export type AutomationAutonomy = "autonomous" | "assisted" | "human_review";

export type DecisionTrace = {
  subjectTable: string;
  subjectId?: string;
  engine: string;
  decisionKey: string;
  selectedValue: string;
  alternatives: string[];
  context: JsonRecord;
  ruleIds: string[];
  confidenceScore: number;
  riskLevel: RiskLevel;
  requiresHumanReview: boolean;
};

export type BusinessProfile = {
  id?: string;
  name: string;
  businessSummary: string;
  productScope: string;
  valueProposition: string;
  market: string;
  primaryOffer: string;
  operatingConstraints: JsonRecord;
  defaultLocale: string;
  defaultTimezone: string;
  status: "active" | "paused" | "archived";
};

export type BrandDna = {
  id?: string;
  businessProfileId?: string;
  personality: JsonRecord;
  mission: string;
  enemy: string;
  transformation: string;
  verbalCodes: JsonRecord;
  visualCodes: JsonRecord;
  forbiddenPatterns: JsonRecord;
  confidenceScore: number;
  status: "draft" | "active" | "archived";
  version: number;
};

export type BrandWritingProfile = {
  id?: string;
  brandDnaId?: string;
  language: string;
  rhythm: JsonRecord;
  vocabulary: JsonRecord;
  punctuationPolicy: JsonRecord;
  aiPatternBans: JsonRecord;
  copyStyleDefaults: JsonRecord;
  humanImperfections: JsonRecord;
  status: "draft" | "active" | "archived";
};

export type BrandVisualSystem = {
  id?: string;
  brandDnaId?: string;
  colors: JsonRecord;
  typography: JsonRecord;
  compositionRules: JsonRecord;
  logoRules: JsonRecord;
  assetRules: JsonRecord;
  visualGrammars: JsonRecord[];
  status: "draft" | "active" | "archived";
};

export type AudienceSegment = {
  id?: string;
  businessProfileId?: string;
  name: string;
  maturityStage:
    | "unaware"
    | "problem_aware"
    | "solution_aware"
    | "decision"
    | "retention"
    | "mixed";
  description: string;
  pains: string[];
  desiredOutcomes: string[];
  objections: string[];
  languagePatterns: JsonRecord;
  channels: SocialPlatform[];
  priority: number;
};

export type ContentStrategy = {
  id?: string;
  businessProfileId?: string;
  title: string;
  objective: FunnelStage;
  periodStart?: string;
  periodEnd?: string;
  narrativeThesis: string;
  successMetrics: string[];
  constraints: JsonRecord;
  status: "draft" | "active" | "completed" | "archived";
};

export type Campaign = {
  id?: string;
  contentStrategyId?: string;
  audienceSegmentId?: string;
  name: string;
  narrative: string;
  coreTension: string;
  funnelStage: FunnelStage;
  objective: FunnelStage;
  hypotheses: string[];
  decisionPolicy: JsonRecord;
  priority: number;
  startsOn?: string;
  endsOn?: string;
  status: "planned" | "active" | "paused" | "completed" | "archived";
};

export type CreativeConcept = {
  id?: string;
  campaignId?: string;
  title: string;
  coreIdea: string;
  psychologicalTrigger: string;
  emotion: string;
  story: string;
  visualMetaphor: string;
  visualStyle: string;
  composition: string;
  recommendedFormat: string;
  expectedEngagement: JsonRecord;
  brandRules: JsonRecord;
  status: "proposed" | "approved" | "rejected" | "archived";
};

export type CreativePiece = {
  id?: string;
  campaignId?: string;
  creativeConceptId?: string;
  title: string;
  platform: SocialPlatform;
  contentObjective: FunnelStage;
  formatFamily: string;
  hypothesis: JsonRecord;
  status:
    | "planned"
    | "in_production"
    | "review"
    | "approved"
    | "rendered"
    | "scheduled"
    | "published"
    | "archived";
};

export type LayoutSpec = {
  grammarId: string;
  aspectRatio: "1:1" | "4:5" | "9:16";
  width: number;
  height: number;
  safeArea: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
  tokens: JsonRecord;
  blocks: Array<{
    id: string;
    role: "headline" | "supporting" | "media" | "logo" | "cta" | "meta";
    content?: string;
    priority: number;
    maxLines?: number;
  }>;
};

export type CreativeVariant = {
  id?: string;
  creativePieceId?: string;
  variantLabel: string;
  platform: SocialPlatform;
  format: string;
  aspectRatio: LayoutSpec["aspectRatio"];
  copyPayload: JsonRecord;
  layoutSpec: LayoutSpec;
  assetPlan: JsonRecord;
  engagementPlan: JsonRecord;
  qualityScores: JsonRecord;
  approvalStatus: "draft" | "needs_revision" | "approved" | "rejected";
};

export type WritingPatternFlag = {
  id: string;
  label: string;
  severity: "low" | "medium" | "high";
  occurrences: number;
  examples: string[];
};

export type HumanWritingEvaluation = {
  artificialityScore: number;
  passed: boolean;
  flags: WritingPatternFlag[];
  rewriteNotes: string[];
};

export type EngagementIntent =
  | "compliment"
  | "question"
  | "objection"
  | "purchase_interest"
  | "keyword_request"
  | "criticism"
  | "spam"
  | "support"
  | "partnership"
  | "personal_story"
  | "unclear";

export type EngagementPolicyDecision = {
  intent: EngagementIntent;
  sentiment: "positive" | "neutral" | "negative";
  commercialSignal: number;
  publicReply: boolean;
  privateMessage: boolean;
  materialDelivery: boolean;
  autonomyLevel: AutomationAutonomy;
  riskLevel: RiskLevel;
  escalationReason?: string;
};

export type SocialOsStatus = {
  configured: boolean;
  migrationReady: boolean;
  errors: string[];
  counts: Record<string, number>;
  legacyCounts: Record<string, number>;
  recentDecisionTraces: Array<{
    id: string;
    engine: string;
    decision_key: string;
    selected_value: string;
    risk_level: RiskLevel;
    requires_human_review: boolean;
    created_at: string;
  }>;
};
