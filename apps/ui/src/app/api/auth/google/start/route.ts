import { NextResponse } from "next/server";
import { getApiBaseUrl, sanitizeRedirectPath, setPostLoginRedirectPath } from "@/lib/auth-session";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const redirectPath = sanitizeRedirectPath(requestUrl.searchParams.get("redirect"));
  await setPostLoginRedirectPath(redirectPath);
  return NextResponse.redirect(`${getApiBaseUrl()}/auth/google`);
}

