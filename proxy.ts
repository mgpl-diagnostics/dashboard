import { NextResponse, type NextRequest } from "next/server";

/**
 * "/graphql" on this origin → the api. MGPL_API_URL is read at run time (not baked in at build time, as
 * next.config rewrites are), so the published image takes the api address from its environment.
 * Default http://localhost:4000. Behind the docker-compose nginx, "/graphql" goes to the api directly and
 * never reaches this.
 */
export function proxy(request: NextRequest) {
  const api = (process.env.MGPL_API_URL || "http://localhost:4000").replace(/\/+$/, "");
  return NextResponse.rewrite(new URL(`${api}/graphql${request.nextUrl.search}`));
}

export const config = { matcher: "/graphql" };
