import type { Metadata } from "next";
import { ConceptGenerator } from "./concept-generator";

export const metadata: Metadata = {
  title: "Creative Concepts | Social Media Automator",
  description: "Marco 2 creative concept generator.",
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function CreatePage() {
  return <ConceptGenerator />;
}
