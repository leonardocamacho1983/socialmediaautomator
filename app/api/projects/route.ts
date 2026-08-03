import { NextResponse } from "next/server";
import {
  isStudioPersistenceConfigured,
  listStudioProjects,
  upsertStudioProject,
} from "../../../lib/persistence/studio-project-store";
import {
  normalizeStudioProjectRecord,
  type StudioProjectApiResponse,
  type StudioProjectListApiResponse,
} from "../../../lib/persistence/studio-projects";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

export async function GET() {
  if (!isStudioPersistenceConfigured()) {
    return NextResponse.json<StudioProjectListApiResponse>(
      {
        ok: false,
        error: "Persistencia nao configurada.",
        code: "PERSISTENCE_NOT_CONFIGURED",
      },
      { status: 503 },
    );
  }

  try {
    const projects = await listStudioProjects();

    return NextResponse.json<StudioProjectListApiResponse>({
      ok: true,
      projects,
    });
  } catch (error) {
    return NextResponse.json<StudioProjectListApiResponse>(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Nao foi possivel carregar os projetos.",
        code: "PROJECT_LIST_FAILED",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  if (!isStudioPersistenceConfigured()) {
    return NextResponse.json<StudioProjectApiResponse>(
      {
        ok: false,
        error: "Persistencia nao configurada.",
        code: "PERSISTENCE_NOT_CONFIGURED",
      },
      { status: 503 },
    );
  }

  try {
    const payload: unknown = await request.json();
    const project =
      payload && typeof payload === "object" && "project" in payload
        ? normalizeStudioProjectRecord(
            (payload as { project: unknown }).project,
          )
        : null;

    if (!project) {
      return NextResponse.json<StudioProjectApiResponse>(
        {
          ok: false,
          error: "Projeto invalido.",
          code: "PROJECT_INVALID",
        },
        { status: 400 },
      );
    }

    const savedProject = await upsertStudioProject(project);

    return NextResponse.json<StudioProjectApiResponse>({
      ok: true,
      project: savedProject,
    });
  } catch (error) {
    return NextResponse.json<StudioProjectApiResponse>(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Nao foi possivel salvar o projeto.",
        code: "PROJECT_SAVE_FAILED",
      },
      { status: 500 },
    );
  }
}
