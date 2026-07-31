import type { CreativeVariant, JsonRecord, LayoutSpec } from "@/lib/social-os/types";

export type RenderingPlan = {
  renderer: "html_svg_sharp" | "remotion";
  runtime: "server";
  outputFormats: Array<"png" | "jpg" | "mp4">;
  layoutSpec: LayoutSpec;
  notes: string[];
  constraints: JsonRecord;
};

export function buildRenderingPlan(variant: Pick<CreativeVariant, "format" | "layoutSpec">): RenderingPlan {
  const isVideo = /reel|video|short/i.test(variant.format);

  return {
    renderer: isVideo ? "remotion" : "html_svg_sharp",
    runtime: "server",
    outputFormats: isVideo ? ["mp4"] : ["png", "jpg"],
    layoutSpec: variant.layoutSpec,
    notes: [
      "Open Design nao e dependencia operacional.",
      "A IA produz intencao e layout_spec; o renderer executa geometria.",
      "Assets finais devem ser salvos em Storage antes da publicacao.",
    ],
    constraints: {
      max_text_blocks: variant.layoutSpec.blocks.length,
      aspect_ratio: variant.layoutSpec.aspectRatio,
      safe_area: variant.layoutSpec.safeArea,
    },
  };
}
