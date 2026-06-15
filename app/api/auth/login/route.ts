import { NextResponse } from "next/server";
import { AUTH_COOKIE_NAME, createAccessToken } from "../../../../lib/siteAuth";

const ONE_WEEK_SECONDS = 60 * 60 * 24 * 7;

export async function POST(request: Request) {
  const configuredPassword = process.env.SITE_PASSWORD?.trim();

  if (!configuredPassword) {
    return NextResponse.json(
      {
        error: "password_not_configured",
        message: "SITE_PASSWORD is not configured on this deployment."
      },
      { status: 500 }
    );
  }

  const body = (await request.json().catch(() => null)) as { password?: string } | null;
  const password = body?.password?.trim();

  if (!password || password !== configuredPassword) {
    return NextResponse.json(
      {
        error: "invalid_password",
        message: "That password did not unlock Momentum Terminal."
      },
      { status: 401 }
    );
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set({
    name: AUTH_COOKIE_NAME,
    value: await createAccessToken(configuredPassword),
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: ONE_WEEK_SECONDS,
    path: "/"
  });

  return response;
}

