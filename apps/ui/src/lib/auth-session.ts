import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

export type AuthRole = "admin" | "user";

export type AuthUser = {
  userId: string;
  email: string;
  role: AuthRole;
  name: string | null;
  picture: string | null;
};

type AuthSession = {
  user: AuthUser;
  exp: number;
  ver: 1;
};

type AuthTransferPayload = {
  userId?: string;
  email?: string;
  role?: string;
  name?: string | null;
  picture?: string | null;
  exp?: number;
  ver?: number;
};

type GoogleOauthConfig = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
};

const SESSION_COOKIE_NAME = "gpool-auth-session";
const GOOGLE_STATE_COOKIE_NAME = "gpool-google-oauth-state";
const REDIRECT_COOKIE_NAME = "gpool-post-login-redirect";
const SESSION_TTL_SECONDS = 8 * 60 * 60;
const OAUTH_STATE_TTL_SECONDS = 10 * 60;
const DEFAULT_REDIRECT_PATH = "/pools";

function normalizeEmail(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function normalizeRole(value: string | null | undefined): AuthRole | null {
  if (value === "admin" || value === "user") return value;
  return null;
}

function readSessionSecret(): string | null {
  const configured = process.env.AUTH_SESSION_SECRET?.trim();
  return configured && configured.length > 0 ? configured : null;
}

function sign(value: string, secret: string): string {
  return createHmac("sha256", secret).update(value).digest("base64url");
}

function safeEqual(left: string, right: string): boolean {
  const leftBytes = Buffer.from(left);
  const rightBytes = Buffer.from(right);
  if (leftBytes.length !== rightBytes.length) return false;
  return timingSafeEqual(leftBytes, rightBytes);
}

function toSignedValue(payload: string, secret: string): string {
  return `${payload}.${sign(payload, secret)}`;
}

function readSignedPayload(raw: string | undefined, secret: string): string | null {
  if (!raw) return null;
  const parts = raw.split(".");
  if (parts.length !== 2) return null;

  const [payload, signature] = parts;
  if (!payload || !signature) return null;
  if (!safeEqual(signature, sign(payload, secret))) return null;
  return payload;
}

function parseTransferPayload(raw: string): AuthUser | null {
  let parsed: AuthTransferPayload;
  try {
    parsed = JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as AuthTransferPayload;
  } catch {
    return null;
  }

  if (parsed.ver !== 1) return null;
  if (typeof parsed.exp !== "number" || parsed.exp <= Math.floor(Date.now() / 1000)) return null;

  const userId = parsed.userId?.trim();
  const email = normalizeEmail(parsed.email);
  const role = normalizeRole(parsed.role);
  if (!userId || !email || !role) return null;

  return {
    userId,
    email,
    role,
    name: parsed.name?.trim() || null,
    picture: parsed.picture?.trim() || null,
  };
}

function parseSessionPayload(raw: string): AuthSession | null {
  let parsed: Partial<AuthSession>;
  try {
    parsed = JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as Partial<AuthSession>;
  } catch {
    return null;
  }

  if (parsed.ver !== 1 || typeof parsed.exp !== "number") return null;
  if (parsed.exp <= Math.floor(Date.now() / 1000)) return null;

  const user = parsed.user;
  const userId = user?.userId?.trim();
  const email = normalizeEmail(user?.email);
  const role = normalizeRole(user?.role);
  if (!userId || !email || !role) return null;

  return {
    user: {
      userId,
      email,
      role,
      name: user?.name?.trim() || null,
      picture: user?.picture?.trim() || null,
    },
    exp: parsed.exp,
    ver: 1,
  };
}

function apiHeaderPayload(session: AuthSession): string {
  return `${session.user.userId}\n${session.user.email}\n${session.user.role}\n${session.user.name ?? ""}\n${session.exp}`;
}

async function persistSession(session: AuthSession): Promise<void> {
  const secret = readSessionSecret();
  if (!secret) return;

  const payload = Buffer.from(JSON.stringify(session), "utf8").toString("base64url");
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, toSignedValue(payload, secret), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: Math.max(0, session.exp - Math.floor(Date.now() / 1000)),
  });
}

export function getApiBaseUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();
  const normalized = (explicit || "http://localhost:3010").replace(/\/+$/g, "");
  return normalized.endsWith("/api") ? normalized : `${normalized}/api`;
}

function normalizeOauthHostname(url: URL): URL {
  if (
    url.hostname === "0.0.0.0" ||
    url.hostname === "127.0.0.1" ||
    url.hostname === "[::]" ||
    url.hostname === "::"
  ) {
    url.hostname = "localhost";
  }
  return url;
}

export function getRequestOrigin(request: Request): string {
  const requestUrl = new URL(request.url);
  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();

  if (forwardedHost) {
    const proto = forwardedProto || requestUrl.protocol.replace(":", "");
    return normalizeOauthHostname(new URL(`${proto}://${forwardedHost}`)).origin;
  }

  const host = request.headers.get("host")?.trim();
  if (host) {
    requestUrl.host = host;
  }
  if (forwardedProto) {
    requestUrl.protocol = `${forwardedProto}:`;
  }

  return normalizeOauthHostname(requestUrl).origin;
}

export function getGoogleOauthConfig(request: Request): GoogleOauthConfig | null {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  const explicitRedirect = process.env.GOOGLE_OAUTH_REDIRECT_URI?.trim();
  if (!clientId || !clientSecret || !explicitRedirect) return null;

  let redirectUri: string;
  try {
    redirectUri = normalizeOauthHostname(new URL(explicitRedirect)).toString();
  } catch {
    return null;
  }

  return {
    clientId,
    clientSecret,
    redirectUri,
  };
}

export function sanitizeRedirectPath(value: string | null | undefined): string {
  if (!value) return DEFAULT_REDIRECT_PATH;
  if (!value.startsWith("/")) return DEFAULT_REDIRECT_PATH;
  if (value.startsWith("//")) return DEFAULT_REDIRECT_PATH;
  return value;
}

export async function setPostLoginRedirectPath(path: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(REDIRECT_COOKIE_NAME, sanitizeRedirectPath(path), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 10 * 60,
  });
}

export async function setGoogleOauthState(state: string, redirectPath: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(GOOGLE_STATE_COOKIE_NAME, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: OAUTH_STATE_TTL_SECONDS,
  });
  await setPostLoginRedirectPath(redirectPath);
}

export async function consumePostLoginRedirectPath(): Promise<string> {
  const cookieStore = await cookies();
  const redirectPath = sanitizeRedirectPath(cookieStore.get(REDIRECT_COOKIE_NAME)?.value);
  cookieStore.set(REDIRECT_COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return redirectPath;
}

export async function consumeGoogleOauthState(): Promise<{
  state: string | null;
  redirectPath: string;
}> {
  const cookieStore = await cookies();
  const state = cookieStore.get(GOOGLE_STATE_COOKIE_NAME)?.value ?? null;
  cookieStore.set(GOOGLE_STATE_COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });

  const redirectPath = await consumePostLoginRedirectPath();
  return { state, redirectPath };
}

export async function createAuthSessionFromTransfer(
  transferPayload: string,
  signature: string,
): Promise<AuthSession | null> {
  const secret = readSessionSecret();
  if (!secret) return null;

  const encoded = transferPayload.trim();
  const provided = signature.trim();
  if (!encoded || !provided) return null;
  if (!safeEqual(provided, sign(encoded, secret))) return null;

  const user = parseTransferPayload(encoded);
  if (!user) return null;

  const session: AuthSession = {
    user,
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
    ver: 1,
  };
  await persistSession(session);
  return session;
}

export async function getAuthSession(): Promise<AuthSession | null> {
  const secret = readSessionSecret();
  if (!secret) return null;

  const cookieStore = await cookies();
  const raw = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const payload = readSignedPayload(raw, secret);
  if (!payload) return null;
  return parseSessionPayload(payload);
}

export async function clearAuthSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

export function buildApiAuthHeaders(session: AuthSession): Record<string, string> | null {
  const secret = readSessionSecret();
  if (!secret) return null;
  const signature = sign(apiHeaderPayload(session), secret);
  return {
    "x-auth-user-id": session.user.userId,
    "x-auth-user-email": session.user.email,
    "x-auth-user-role": session.user.role,
    "x-auth-user-name": session.user.name ?? "",
    "x-auth-user-exp": String(session.exp),
    "x-auth-signature": signature,
  };
}
