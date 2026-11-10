import { NextResponse, type NextRequest } from "next/server";
import { contentSecurityPolicy } from "@/lib/csp";

/**
 * Runs on the server for every request (not for /_next/static or /_next/image):
 * - "/graphql" on this origin → the api. MGPL_API_URL is read at run time (not baked in at build time, as
 *   next.config rewrites are), so the published image takes the api address from its environment.
 *   Default http://localhost:4000. Behind the docker-compose nginx, "/graphql" goes to the api directly and
 *   never reaches this.
 * - every other response gets the Content-Security-Policy (lib/csp.ts), built at run time so connect-src
 *   can include MGPL_PUBLIC_API_URL's origin.
 */
export function proxy(request: NextRequest) {
  if (request.nextUrl.pathname === "/graphql") {
    const api = (process.env.MGPL_API_URL || "http://localhost:4000").replace(/\/+$/, "");
    return NextResponse.rewrite(new URL(`${api}/graphql${request.nextUrl.search}`));
  }
  const response = NextResponse.next();
  response.headers.set("Content-Security-Policy", contentSecurityPolicy());
  return response;
}

export const config = { matcher: ["/graphql", "/((?!_next/static|_next/image).*)"] };
