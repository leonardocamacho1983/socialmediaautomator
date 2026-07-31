export type BrandProfile = {
  brandName: string;
  businessDescription: string;
  productOrService: string;
  valueProposition: string;
  audience: string;
  toneOfVoice: string;
  preferredWords: string[];
  forbiddenWords: string[];
  primaryColor: string;
  secondaryColor: string;
  backgroundColor: string;
  headingFont: string;
  bodyFont: string;
  logoDataUrl: string;
  logoFileName: string;
  visualReferences: string[];
  goodExamples: string;
  badExamples: string;
  updatedAt: string | null;
};

export type BrandWritingProfile = {
  voiceSummary: string;
  audience: string;
  toneOfVoice: string;
  preferredWords: string[];
  forbiddenWords: string[];
  goodExamples: string;
  badExamples: string;
};

export type BrandVisualProfile = {
  colors: {
    primary: string;
    secondary: string;
    background: string;
  };
  typography: {
    heading: string;
    body: string;
  };
  logo: {
    fileName: string;
    hasLogo: boolean;
  };
  visualReferences: string[];
};

export const BRAND_PROFILE_STORAGE_KEY =
  "socialmediaautomator.brandProfile.v1";

export const emptyBrandProfile: BrandProfile = {
  brandName: "",
  businessDescription: "",
  productOrService: "",
  valueProposition: "",
  audience: "",
  toneOfVoice: "",
  preferredWords: [],
  forbiddenWords: [],
  primaryColor: "#123c39",
  secondaryColor: "#d95f3d",
  backgroundColor: "#f6f7f2",
  headingFont: "Inter",
  bodyFont: "Inter",
  logoDataUrl: "",
  logoFileName: "",
  visualReferences: [],
  goodExamples: "",
  badExamples: "",
  updatedAt: null,
};

export function normalizeList(value: string) {
  return value
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function listToText(value: string[]) {
  return value.join("\n");
}

export function buildWritingProfile(
  profile: BrandProfile,
): BrandWritingProfile {
  return {
    voiceSummary: [
      profile.brandName,
      profile.valueProposition,
      profile.toneOfVoice,
    ]
      .filter(Boolean)
      .join(" | "),
    audience: profile.audience,
    toneOfVoice: profile.toneOfVoice,
    preferredWords: profile.preferredWords,
    forbiddenWords: profile.forbiddenWords,
    goodExamples: profile.goodExamples,
    badExamples: profile.badExamples,
  };
}

export function buildVisualProfile(profile: BrandProfile): BrandVisualProfile {
  return {
    colors: {
      primary: profile.primaryColor,
      secondary: profile.secondaryColor,
      background: profile.backgroundColor,
    },
    typography: {
      heading: profile.headingFont,
      body: profile.bodyFont,
    },
    logo: {
      fileName: profile.logoFileName,
      hasLogo: Boolean(profile.logoDataUrl),
    },
    visualReferences: profile.visualReferences,
  };
}

export function stripEmbeddedBrandAssets(profile: BrandProfile): BrandProfile {
  return {
    ...profile,
    logoDataUrl: "",
  };
}

export function isBrandProfile(value: unknown): value is BrandProfile {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.brandName === "string" &&
    typeof candidate.businessDescription === "string" &&
    typeof candidate.valueProposition === "string" &&
    Array.isArray(candidate.preferredWords) &&
    Array.isArray(candidate.forbiddenWords) &&
    typeof candidate.primaryColor === "string"
  );
}
