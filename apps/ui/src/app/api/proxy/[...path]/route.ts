import { NextResponse } from "next/server";
import { buildApiAuthHeaders, getApiBaseUrl, getAuthSession } from "@/lib/auth-session";

type RouteContext = {
  params: {
    path?: string[];
  };
};

function pickResponseHeaders(upstream: Headers): Headers {
  const headers = new Headers();
  const contentType = upstream.get("content-type");
  if (contentType) headers.set("content-type", contentType);

  const requestId = upstream.get("x-request-id");
  if (requestId) headers.set("x-request-id", requestId);

  const cacheControl = upstream.get("cache-control");
  if (cacheControl) headers.set("cache-control", cacheControl);

  return headers;
}

async function handleProxy(request: Request, context: RouteContext): Promise<NextResponse> {
  const path = context.params.path ?? [];
  if (path.length === 0) {
    return NextResponse.json(
      {
        ok: false,
        error: "Missing proxy path",
      },
      { status: 400 },
    );
  }

  const session = await getAuthSession();
  if (!session) {
    return NextResponse.json(
      {
        ok: false,
        error: "Authentication required",
      },
      { status: 401 },
    );
  }

  const sourceUrl = new URL(request.url);
  const targetUrl = new URL(`${getApiBaseUrl()}/${path.join("/")}`);
  targetUrl.search = sourceUrl.search;

  const headers = new Headers();
  const accept = request.headers.get("accept");
  if (accept) headers.set("accept", accept);
  const contentType = request.headers.get("content-type");
  if (contentType) headers.set("content-type", contentType);
  const requestId = request.headers.get("x-request-id");
  if (requestId) headers.set("x-request-id", requestId);
  const authHeaders = buildApiAuthHeaders(session);
  if (!authHeaders) {
    return NextResponse.json(
      {
        ok: false,
        error: "Session signer is not configured",
      },
      { status: 500 },
    );
  }
  for (const [key, value] of Object.entries(authHeaders)) {
    headers.set(key, value);
  }

  const method = request.method.toUpperCase();
  const hasBody = method !== "GET" && method !== "HEAD";
  const body = hasBody ? await request.arrayBuffer() : undefined;

  const upstream = await fetch(targetUrl, {
    method,
    headers,
    body,
    cache: "no-store",
    redirect: "manual",
  });

  const responseHeaders = pickResponseHeaders(upstream.headers);
  const statusAllowsBody = upstream.status !== 204 && upstream.status !== 205 && upstream.status !== 304;
  const responseBody = method === "HEAD" || !statusAllowsBody ? null : await upstream.arrayBuffer();

  return new NextResponse(responseBody, {
    status: upstream.status,
    headers: responseHeaders,
  });
}

export const dynamic = "force-dynamic";

export async function GET(request: Request, context: RouteContext) {
  return handleProxy(request, context);
}

export async function POST(request: Request, context: RouteContext) {
  return handleProxy(request, context);
}

export async function PUT(request: Request, context: RouteContext) {
  return handleProxy(request, context);
}

export async function PATCH(request: Request, context: RouteContext) {
  return handleProxy(request, context);
}

export async function DELETE(request: Request, context: RouteContext) {
  return handleProxy(request, context);
}

export async function OPTIONS(request: Request, context: RouteContext) {
  return handleProxy(request, context);
}

export async function HEAD(request: Request, context: RouteContext) {
  return handleProxy(request, context);
}
