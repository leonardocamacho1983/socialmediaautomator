import "server-only";

import crypto from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const ADMIN_COOKIE_NAME = "sma_admin_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

export function isAdminConfigured() {
  return Boolean(process.env.ADMIN_PASSWORD);
}

export function getAdminConfigStatus() {
  return {
    hasAdminPassword: isAdminConfigured(),
  };
}

function hash(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function safeEqual(a: string, b: string) {
  const aHash = Buffer.from(hash(a));
  const bHash = Buffer.from(hash(b));

  return crypto.timingSafeEqual(aHash, bHash);
}

function getSessionToken() {
  const password = process.env.ADMIN_PASSWORD ?? "";
  const secret = process.env.ADMIN_SESSION_SECRET ?? password;

  return crypto
    .createHmac("sha256", secret)
    .update(`socialmediaautomator:${password}`)
    .digest("hex");
}

export async function isAdminAuthenticated() {
  if (!isAdminConfigured()) {
    return false;
  }

  const cookieStore = await cookies();
  const cookieValue = cookieStore.get(ADMIN_COOKIE_NAME)?.value;

  return Boolean(cookieValue && safeEqual(cookieValue, getSessionToken()));
}

export async function requireAdminPage() {
  if (!isAdminConfigured()) {
    redirect("/setup");
  }

  if (!(await isAdminAuthenticated())) {
    redirect("/login");
  }
}

export async function requireAdminAction() {
  if (!isAdminConfigured()) {
    redirect("/setup");
  }

  if (!(await isAdminAuthenticated())) {
    redirect("/login");
  }
}

export async function requireAdminRequest(request: Request) {
  if (!isAdminConfigured()) {
    return Response.json(
      { error: "ADMIN_PASSWORD não está configurado." },
      { status: 503 },
    );
  }

  const apiToken = process.env.ADMIN_API_TOKEN;
  const authorization = request.headers.get("authorization");
  const headerToken = request.headers.get("x-admin-token");
  const suppliedToken = authorization?.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : headerToken;

  if (apiToken && suppliedToken && safeEqual(suppliedToken, apiToken)) {
    return null;
  }

  if (!(await isAdminAuthenticated())) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  return null;
}

export async function setAdminSession() {
  const cookieStore = await cookies();

  cookieStore.set(ADMIN_COOKIE_NAME, getSessionToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export async function clearAdminSession() {
  const cookieStore = await cookies();

  cookieStore.delete(ADMIN_COOKIE_NAME);
}

export function verifyAdminPassword(input: string) {
  const expected = process.env.ADMIN_PASSWORD;

  if (!expected) {
    return false;
  }

  return safeEqual(input, expected);
}
