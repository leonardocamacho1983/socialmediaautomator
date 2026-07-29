import { requireAdminRequest } from "@/lib/auth";
import type { CreatePostPayload } from "@/lib/types";
import {
  deletePost,
  getPost,
  getReadableZernioError,
  updatePost,
} from "@/lib/zernio";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ postId: string }>;
};

export async function GET(request: Request, { params }: RouteContext) {
  const authError = await requireAdminRequest(request);

  if (authError) {
    return authError;
  }

  const { postId } = await params;

  try {
    return Response.json(await getPost(postId));
  } catch (error) {
    return Response.json(
      { error: getReadableZernioError(error) },
      { status: 502 },
    );
  }
}

export async function PUT(request: Request, { params }: RouteContext) {
  const authError = await requireAdminRequest(request);

  if (authError) {
    return authError;
  }

  const { postId } = await params;

  try {
    const payload = (await request.json()) as CreatePostPayload;
    return Response.json(await updatePost(postId, payload));
  } catch (error) {
    return Response.json(
      { error: getReadableZernioError(error) },
      { status: 502 },
    );
  }
}

export async function DELETE(request: Request, { params }: RouteContext) {
  const authError = await requireAdminRequest(request);

  if (authError) {
    return authError;
  }

  const { postId } = await params;

  try {
    return Response.json(await deletePost(postId));
  } catch (error) {
    return Response.json(
      { error: getReadableZernioError(error) },
      { status: 502 },
    );
  }
}
