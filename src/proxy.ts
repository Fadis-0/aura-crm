import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = ["/login", "/signup", "/auth"];

/** What a marketer is allowed to reach. Everything else is the admin app.
 *  An allowlist, so a route added later is protected by default rather than
 *  needing to be remembered here. */
const MARKETER_PATHS = ["/portal"];

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Not configured yet — let the app render its setup notice instead of looping.
  if (!url || !anon) return response;

  const supabase = createServerClient(url, anon, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        list.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        list.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isPublic = PUBLIC_PATHS.some((p) => path.startsWith(p));

  if (!user) {
    if (isPublic) return response;
    const redirect = request.nextUrl.clone();
    redirect.pathname = "/login";
    redirect.searchParams.set("next", path);
    return NextResponse.redirect(redirect);
  }

  // Signed in. One profile read decides which half of the app they get.
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, status")
    .eq("id", user.id)
    .maybeSingle();

  const role = (profile?.role as string | undefined) ?? "marketer";
  const status = (profile?.status as string | undefined) ?? "pending";
  // Same rule as lib/auth.ts: a suspended owner is not an admin.
  const isAdmin = (role === "owner" || role === "partner") && status === "active";
  const home = isAdmin ? "/" : "/portal";

  if (isPublic) {
    const redirect = request.nextUrl.clone();
    redirect.pathname = home;
    redirect.search = "";
    return NextResponse.redirect(redirect);
  }

  if (!isAdmin) {
    const allowed = MARKETER_PATHS.some(
      (p) => path === p || path.startsWith(`${p}/`),
    );

    if (!allowed) {
      const redirect = request.nextUrl.clone();
      redirect.pathname = "/portal";
      redirect.search = "";
      return NextResponse.redirect(redirect);
    }
  }

  return response;
}

export const config = {
  matcher: [
    // Everything except static assets and image files.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
