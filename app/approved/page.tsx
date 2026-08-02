import type { Metadata } from "next";
import { ApprovedPostLibrary } from "./approved-post-library";

export const metadata: Metadata = {
  title: "Posts aprovados | Social Media Automator",
  description: "Biblioteca local de posts aprovados.",
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function ApprovedPostsPage() {
  return <ApprovedPostLibrary />;
}
