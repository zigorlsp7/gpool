import { NextResponse } from "next/server";
import {
  clearAuthSession,
  consumePostLoginRedirectPath,
  createAuthSessionFromTransfer,
  getAuthSession,
} from "@/lib/auth-session";

type SessionBody = {
  transfer?: string;
  signature?: string;
};

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getAuthSession();
  if (!session) {
    return NextResponse.json({
      ok: true,
      authenticated: false,
    });
  }

  return NextResponse.json({
    ok: true,
    authenticated: true,
    user: session.user,
  });
}

export async function POST(request: Request) {
  let payload: SessionBody;
  try {
    payload = (await request.json()) as SessionBody;
  } catch {
    return NextResponse.json(
      {
        ok: false,
        authenticated: false,
        error: "Invalid request payload",
      },
      { status: 400 },
    );
  }

  const transfer = payload.transfer?.trim();
  const signature = payload.signature?.trim();
  if (!transfer || !signature) {
    return NextResponse.json(
      {
        ok: false,
        authenticated: false,
        error: "Missing transfer payload",
      },
      { status: 400 },
    );
  }

  const session = await createAuthSessionFromTransfer(transfer, signature);
  if (!session) {
    await clearAuthSession();
    return NextResponse.json(
      {
        ok: false,
        authenticated: false,
        error: "Failed to create session",
      },
      { status: 401 },
    );
  }

  return NextResponse.json({
    ok: true,
    authenticated: true,
    user: session.user,
    redirectPath: await consumePostLoginRedirectPath(),
  });
}

export async function DELETE() {
  await clearAuthSession();
  return NextResponse.json({
    ok: true,
    authenticated: false,
  });
}
