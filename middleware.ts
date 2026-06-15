import { NextResponse, type NextRequest } from "next/server";
import { AUTH_COOKIE_NAME, getExpectedAccessToken, isPasswordGateEnabled } from "./lib/siteAuth";

const PUBLIC_PATHS = new Set(["/access", "/api/auth/login", "/api/auth/logout"]);
const PUBLIC_FILE = /\.(.*)$/;

function isPublicPath(pathname: string) {
  return (
    PUBLIC_PATHS.has(pathname) ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/images") ||
    pathname.startsWith("/assets") ||
    pathname === "/favicon.ico" ||
    pathname === "/robots.txt" ||
    pathname === "/sitemap.xml" ||
    PUBLIC_FILE.test(pathname)
  );
}

export async function middleware(request: NextRequest) {
  if (!isPasswordGateEnabled()) {
    return NextResponse.next();
  }

  const { pathname, search } = request.nextUrl;
  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  const expectedToken = await getExpectedAccessToken();
  const currentToken = request.cookies.get(AUTH_COOKIE_NAME)?.value;

  if (expectedToken && currentToken === expectedToken) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/")) {
    return NextResponse.json(
      {
        error: "unauthorized",
        message: "Momentum Terminal requires password access."
      },
      { status: 401 }
    );
  }

  const accessUrl = request.nextUrl.clone();
  accessUrl.pathname = "/access";
  accessUrl.search = "";
  accessUrl.searchParams.set("next", `${pathname}${search}`);
  return NextResponse.redirect(accessUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"]
};

