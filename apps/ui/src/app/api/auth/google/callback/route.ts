import { NextResponse } from "next/server";
import {
  clearAuthSession,
  consumeGoogleOauthState,
  createAuthSessionFromTransfer,
  getApiBaseUrl,
  getGoogleOauthConfig,
  getRequestOrigin,
} from "@/lib/auth-session";

type GoogleTokenResponse = {
  access_token?: string;
};

type GoogleTransferResponse = {
  transfer?: string;
  signature?: string;
};

const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";

function callbackRedirect(base: string, path: string): NextResponse {
  return NextResponse.redirect(new URL(path, base));
}

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const requestOrigin = getRequestOrigin(request);
  const { state: expectedState, redirectPath } = await consumeGoogleOauthState();
  const config = getGoogleOauthConfig(request);

  if (!config) {
    return callbackRedirect(requestOrigin, "/login?error=google_auth_not_configured");
  }

  const code = requestUrl.searchParams.get("code");
  const state = requestUrl.searchParams.get("state");
  if (!code || !state || !expectedState || state !== expectedState) {
    return callbackRedirect(requestOrigin, "/login?error=invalid_oauth_state");
  }

  const tokenResponse = await fetch(GOOGLE_TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: config.redirectUri,
      grant_type: "authorization_code",
    }),
    cache: "no-store",
  });
  if (!tokenResponse.ok) {
    return callbackRedirect(requestOrigin, "/login?error=google_token_exchange_failed");
  }

  const tokenPayload = (await tokenResponse.json()) as GoogleTokenResponse;
  const accessToken = tokenPayload.access_token?.trim();
  if (!accessToken) {
    return callbackRedirect(requestOrigin, "/login?error=google_access_token_missing");
  }

  const transferResponse = await fetch(`${getApiBaseUrl()}/auth/google/transfer`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ accessToken }),
    cache: "no-store",
  });
  if (!transferResponse.ok) {
    return callbackRedirect(requestOrigin, "/login?error=google_profile_sync_failed");
  }

  const transferPayload = (await transferResponse.json()) as GoogleTransferResponse;
  const transfer = transferPayload.transfer?.trim();
  const signature = transferPayload.signature?.trim();
  if (!transfer || !signature) {
    return callbackRedirect(requestOrigin, "/login?error=session_transfer_missing");
  }

  const session = await createAuthSessionFromTransfer(transfer, signature);
  if (!session) {
    await clearAuthSession();
    return callbackRedirect(requestOrigin, "/login?error=session_creation_failed");
  }

  return callbackRedirect(requestOrigin, redirectPath);
}
