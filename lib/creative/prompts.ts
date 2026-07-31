import type { BrandProfile } from "../brand/profile";
import type { CreativeBriefing } from "./concepts";

export function buildCreativePromptBrandContext(brandProfile: BrandProfile) {
  const { logoDataUrl, ...profileWithoutEmbeddedLogo } = brandProfile;

  return {
    ...profileWithoutEmbeddedLogo,
    logo: {
      hasLogo: Boolean(logoDataUrl || brandProfile.logoFileName),
      fileName: brandProfile.logoFileName,
      embeddedAssetOmitted: Boolean(logoDataUrl),
    },
  };
}

export function buildCreativeConceptPrompt(
  brandProfile: BrandProfile,
  briefing: CreativeBriefing,
) {
  return [
    "Crie exatamente 3 conceitos criativos distintos para um post de Instagram.",
    "",
    "Regra de escopo:",
    "- Gere apenas conceitos criativos.",
    "- Nao escreva legenda final.",
    "- Nao escreva roteiro completo de carrossel.",
    "- Nao gere arte final.",
    "- Nao mencione ferramentas de publicacao, Zernio, Recraft ou automacao.",
    "- Cada conceito deve ser executavel depois por um motor visual, mas ainda nao deve virar asset.",
    "",
    "Qualidade esperada:",
    "- Os 3 conceitos precisam ser realmente diferentes entre si.",
    "- Evite linguagem generica, publicitaria ou com cara de IA.",
    "- Traga uma decisao clara de formato, narrativa, visual e copy.",
    "- Use as referencias da marca como sinais, nao como copia literal.",
    "- Prefira especificidade, tensao e ponto de vista.",
    "",
    "Perfil da marca:",
    JSON.stringify(buildCreativePromptBrandContext(brandProfile), null, 2),
    "",
    "Briefing do post:",
    JSON.stringify(briefing, null, 2),
  ].join("\n");
}
