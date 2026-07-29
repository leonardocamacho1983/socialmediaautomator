import crypto from "node:crypto";
import { recordZernioWebhookEvent } from "@/lib/editorial-store";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature =
    request.headers.get("x-zernio-signature") ??
    request.headers.get("x-late-signature");
  const webhookSecret = process.env.ZERNIO_WEBHOOK_SECRET;

  if (!webhookSecret && process.env.NODE_ENV === "production") {
    return new Response("Webhook secret is not configured.", { status: 503 });
  }

  if (webhookSecret && !signature) {
    return new Response("No signature provided.", { status: 401 });
  }

  if (webhookSecret && signature) {
    const computed = crypto
      .createHmac("sha256", webhookSecret)
      .update(rawBody)
      .digest("hex");

    if (!safeEqual(signature, computed)) {
      return new Response("Invalid signature.", { status: 400 });
    }
  }

  let payload: unknown;

  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new Response("Invalid JSON.", { status: 400 });
  }

  const eventId =
    request.headers.get("x-zernio-event-id") ??
    request.headers.get("x-late-event-id");

  console.info("zernio.webhook.accepted", {
    eventId,
    payload,
  });

  try {
    const storage = await recordZernioWebhookEvent({ eventId, payload });

    return Response.json({ ok: true, storage });
  } catch (error) {
    console.error("zernio.webhook.storage_failed", {
      eventId,
      error,
    });

    return Response.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Erro ao gravar evento do webhook.",
      },
      { status: 500 },
    );
  }
}

function safeEqual(a: string, b: string) {
  const aBuffer = Buffer.from(a);
  const bBuffer = Buffer.from(b);

  if (aBuffer.length !== bBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(aBuffer, bBuffer);
}
