import { NextResponse } from "next/server";
import { AUTH_COOKIE_NAME } from "../../../../lib/siteAuth";

function clearAccessCookie(response: NextResponse) {
  response.cookies.set({
    name: AUTH_COOKIE_NAME,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 0,
    path: "/"
  });
  return response;
}

export function GET(request: Request) {
  const url = new URL(request.url);
  const response = NextResponse.redirect(new URL("/access", url.origin));
  return clearAccessCookie(response);
}

export function POST() {
  return clearAccessCookie(NextResponse.json({ ok: true }));
}

