import { NextResponse } from "next/server";
import {
  deleteStudioProject,
  getStudioProject,
  isStudioPersistenceConfigured,
} from "../../../../lib/persistence/studio-project-store";
import type { StudioProjectApiResponse } from "../../../../lib/persistence/studio-projects";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

type ProjectRouteProps = {
  params: Promise<{
    projectId: string;
  }>;
};

export async function GET(_request: Request, { params }: ProjectRouteProps) {
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

  const { projectId } = await params;

  try {
    const project = await getStudioProject(projectId);

    if (!project) {
      return NextResponse.json<StudioProjectApiResponse>(
        {
          ok: false,
          error: "Projeto nao encontrado.",
          code: "PROJECT_NOT_FOUND",
        },
        { status: 404 },
      );
    }

    return NextResponse.json<StudioProjectApiResponse>({
      ok: true,
      project,
    });
  } catch (error) {
    return NextResponse.json<StudioProjectApiResponse>(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Nao foi possivel carregar o projeto.",
        code: "PROJECT_LOAD_FAILED",
      },
      { status: 500 },
    );
  }
}

export async function DELETE(_request: Request, { params }: ProjectRouteProps) {
  if (!isStudioPersistenceConfigured()) {
    return NextResponse.json(
      {
        ok: false,
        error: "Persistencia nao configurada.",
        code: "PERSISTENCE_NOT_CONFIGURED",
      },
      { status: 503 },
    );
  }

  const { projectId } = await params;

  try {
    await deleteStudioProject(projectId);

    return NextResponse.json({
      ok: true,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Nao foi possivel apagar o projeto.",
        code: "PROJECT_DELETE_FAILED",
      },
      { status: 500 },
    );
  }
}
