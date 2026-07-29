import { requireAdminRequest } from "@/lib/auth";
import { getReadableZernioError, listSupportedAccounts } from "@/lib/zernio";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const authError = await requireAdminRequest(request);

  if (authError) {
    return authError;
  }

  try {
    const accounts = await listSupportedAccounts();
    return Response.json(accounts);
  } catch (error) {
    return Response.json(
      { error: getReadableZernioError(error) },
      { status: 502 },
    );
  }
}
