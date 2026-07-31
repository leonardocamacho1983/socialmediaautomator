import assert from "node:assert/strict";
import test from "node:test";
import { selectDecisionPolicy } from "../lib/social-os/decision-policy";
import { classifyEngagement } from "../lib/social-os/engagement-policy";
import { evaluateHumanWriting } from "../lib/social-os/human-writing";
import { buildLayoutSpec, selectVisualGrammar } from "../lib/social-os/visual-grammar";

test("human writing evaluator flags obvious AI writing patterns", () => {
  const evaluation = evaluateHumanWriting(
    "Em um mundo cada vez mais competitivo — transforme seu negocio com uma solucao inovadora. Saiba mais.",
  );

  assert.equal(evaluation.passed, false);
  assert.ok(evaluation.artificialityScore >= 35);
  assert.ok(evaluation.flags.some((flag) => flag.id === "dash_usage"));
  assert.ok(evaluation.flags.some((flag) => flag.id === "corporate_filler"));
});

test("decision policy prepares keyword-to-DM for lead capture", () => {
  const policy = selectDecisionPolicy({
    objective: "lead_capture",
    hasLeadMagnet: true,
  });

  assert.equal(policy.recommendedFormat, "carousel");
  assert.equal(policy.ctaType, "keyword_comment");
  assert.equal(policy.engagementAutomation, "keyword_to_dm");
  assert.equal(policy.trace.requiresHumanReview, false);
});

test("engagement classifier escalates commercial questions", () => {
  const decision = classifyEngagement({
    text: "Qual o valor para contratar uma demo?",
  });

  assert.equal(decision.intent, "purchase_interest");
  assert.equal(decision.autonomyLevel, "human_review");
  assert.ok(decision.commercialSignal > 0.7);
});

test("visual grammar builds stable 4:5 layout spec", () => {
  const grammar = selectVisualGrammar({ objective: "awareness" });
  const spec = buildLayoutSpec({
    grammar,
    headline: "Clientes esquecidos ainda podem comprar.",
    supportingCopy: "O problema e o follow-up que ninguem fez.",
    cta: "Comente GUIA.",
  });

  assert.equal(spec.aspectRatio, "4:5");
  assert.equal(spec.width, 1080);
  assert.equal(spec.height, 1350);
  assert.ok(spec.blocks.some((block) => block.role === "headline"));
  assert.ok(spec.safeArea.left > 0);
});
