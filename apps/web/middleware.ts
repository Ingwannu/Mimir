import { NextRequest, NextResponse } from "next/server";

const ADMIN_SESSION_COOKIE = "wickedhostbotai_session";
const apiBaseUrl = process.env.WEB_API_BASE_URL ?? "http://localhost:4000";

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api/proxy") ||
    pathname === "/favicon.ico"
  ) {
    return NextResponse.next();
  }

  const token = request.cookies.get(ADMIN_SESSION_COOKIE)?.value;
  const isAuthenticated = token
    ? (
        await fetch(`${apiBaseUrl}/v1/auth/session`, {
          headers: {
            authorization: `Bearer ${token}`,
          },
          cache: "no-store",
        })
      ).ok
    : false;

  if (pathname === "/login") {
    return NextResponse.next();
  }

  if (isAuthenticated) {
    return NextResponse.next();
  }

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set(
    "next",
    `${pathname}${request.nextUrl.search}`,
  );

  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
