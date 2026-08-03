import type { Metadata } from "next";
import { ProjectLibrary } from "./project-library";

export const metadata: Metadata = {
  title: "Projetos | Social Media Automator",
  description: "Biblioteca persistida de projetos do Social Studio.",
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function ProjectsPage() {
  return <ProjectLibrary />;
}
