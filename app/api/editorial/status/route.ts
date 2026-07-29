import { requireAdminRequest } from "@/lib/auth";
import { getEditorialStatus } from "@/lib/editorial-store";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const authError = await requireAdminRequest(request);

  if (authError) {
    return authError;
  }

  try {
    return Response.json(await getEditorialStatus());
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Erro ao carregar status editorial.",
      },
      { status: 500 },
    );
  }
}
