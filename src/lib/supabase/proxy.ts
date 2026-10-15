import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "./database.types";
import { getSupabaseEnv, hasSupabaseEnv } from "./env";

// Pages anyone can open without logging in.
const PUBLIC_PATHS = ["/login", "/signup", "/forgot-password", "/auth/confirm"];
// Pages a logged-in user has no reason to see.
const LOGGED_OUT_ONLY = ["/login", "/signup", "/forgot-password"];

function matches(pathname: string, paths: string[]) {
  return paths.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

// Runs on every page request (see src/proxy.ts).
// 1. Refreshes the Supabase session cookies so logins don't expire.
// 2. Sends logged-out visitors to /login.
// Role checks (owner vs attendant) happen in the layouts via requireRole().
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  if (!hasSupabaseEnv()) return response;

  const { url, key } = getSupabaseEnv();
  const supabase = createServerClient<Database>(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
        // Stops CDNs from caching one user's session for another user.
        Object.entries(headers).forEach(([header, value]) =>
          response.headers.set(header, value),
        );
      },
    },
  });

  // Do not put code between createServerClient and getClaims():
  // getClaims() is what refreshes an expired session.
  const { data } = await supabase.auth.getClaims();
  const loggedIn = Boolean(data?.claims);
  const { pathname, searchParams } = request.nextUrl;

  // If Supabase sends an email link to the site root (it does this when the
  // redirect URL isn't on its allow list), finish the login at /auth/confirm.
  if (pathname === "/" && searchParams.has("code")) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/confirm";
    return NextResponse.redirect(url);
  }

  if (!loggedIn && !matches(pathname, PUBLIC_PATHS)) {
    return redirectKeepingCookies(request, response, "/login");
  }

  if (loggedIn && matches(pathname, LOGGED_OUT_ONLY)) {
    return redirectKeepingCookies(request, response, "/");
  }

  return response;
}

// A redirect must carry any refreshed session cookies, or the user is logged out.
function redirectKeepingCookies(
  request: NextRequest,
  response: NextResponse,
  pathname: string,
) {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  url.search = "";
  const redirect = NextResponse.redirect(url);
  response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
  response.headers.forEach((value, header) => {
    if (header.toLowerCase() !== "set-cookie") redirect.headers.set(header, value);
  });
  return redirect;
}
