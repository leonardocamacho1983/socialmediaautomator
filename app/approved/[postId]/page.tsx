import type { Metadata } from "next";
import { ApprovedPostDetail } from "./approved-post-detail";

export const metadata: Metadata = {
  title: "Detalhe do post aprovado | Social Media Automator",
  description: "Revisao local de um post aprovado.",
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

type ApprovedPostDetailPageProps = {
  params: Promise<{
    postId: string;
  }>;
};

export default async function ApprovedPostDetailPage({
  params,
}: ApprovedPostDetailPageProps) {
  const { postId } = await params;

  return <ApprovedPostDetail postId={postId} />;
}
