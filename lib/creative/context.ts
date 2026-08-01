import type { BrandProfile } from "../brand/profile";
import type { CreativeBriefing } from "./concepts";

const MAX_TEXT_FIELD_LENGTH = 1200;
const MAX_LIST_ITEMS = 12;
const MAX_LIST_ITEM_LENGTH = 240;

function compactText(value: string, maxLength = MAX_TEXT_FIELD_LENGTH) {
  const normalized = value.replace(/\s+/g, " ").trim();

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength).trim()}...`;
}

function compactList(value: string[]) {
  return value
    .slice(0, MAX_LIST_ITEMS)
    .map((item) => compactText(item, MAX_LIST_ITEM_LENGTH))
    .filter(Boolean);
}

export function compactBrandProfileForGeneration(
  profile: BrandProfile,
): BrandProfile {
  return {
    brandName: compactText(profile.brandName, 120),
    businessDescription: compactText(profile.businessDescription),
    productOrService: compactText(profile.productOrService),
    valueProposition: compactText(profile.valueProposition),
    audience: compactText(profile.audience),
    toneOfVoice: compactText(profile.toneOfVoice),
    preferredWords: compactList(profile.preferredWords),
    forbiddenWords: compactList(profile.forbiddenWords),
    primaryColor: compactText(profile.primaryColor, 40),
    secondaryColor: compactText(profile.secondaryColor, 40),
    backgroundColor: compactText(profile.backgroundColor, 40),
    headingFont: compactText(profile.headingFont, 80),
    bodyFont: compactText(profile.bodyFont, 80),
    logoDataUrl: "",
    logoFileName: compactText(profile.logoFileName, 160),
    visualReferences: compactList(profile.visualReferences),
    goodExamples: compactText(profile.goodExamples),
    badExamples: compactText(profile.badExamples),
    updatedAt: profile.updatedAt,
  };
}

export function compactBriefingForGeneration(
  briefing: CreativeBriefing,
): CreativeBriefing {
  return {
    topic: compactText(briefing.topic, 220),
    mainMessage: compactText(briefing.mainMessage),
    objective: briefing.objective,
    context: compactText(briefing.context),
    reference: compactText(briefing.reference),
    relatedLink: compactText(briefing.relatedLink, 400),
    constraints: compactText(briefing.constraints, 800),
  };
}
