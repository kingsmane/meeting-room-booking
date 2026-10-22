import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Pengecekan awal saja: ada cookie sesi atau tidak. Validasi tanda tangan, status user, dan izin
// dilakukan di lib/auth.ts oleh setiap halaman dan Server Action (proxy bukan batas keamanan).
export function proxy(request: NextRequest) {
  if (request.cookies.has("mrb_session")) return NextResponse.next();

  const url = new URL("/login", request.url);
  const { pathname, search } = request.nextUrl;
  if (pathname !== "/") url.searchParams.set("next", pathname + search);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/", "/book", "/notifications", "/bookings/:path*", "/admin/:path*"],
};
