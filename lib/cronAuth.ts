import { NextRequest, NextResponse } from "next/server";

export function requireCronAccess(request: NextRequest): NextResponse | null {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json({ error: "CRON_SECRET is not configured." }, { status: 503 });
    }
    return null;
  }
  const authorization = request.headers.get("authorization") ?? "";
  if (authorization === `Bearer ${secret}`) return null;
  if (request.nextUrl.searchParams.get("secret") === secret) return null;
  return NextResponse.json({ error: "Unauthorized cron request." }, { status: 401 });
}
