"use client";
// The one GraphQL client of the app (@mgpl-diagnostics/client). It owns the tokens: a 15-minute access
// JWT and a single-use refresh token, refreshed once for every tab (Web Locks), with this device's
// signals on login and refresh. Requests go to "/graphql" on this origin (proxy.ts forwards them), or
// straight to the api when the server sets MGPL_PUBLIC_API_URL (lib/api-url.ts, written into <head>).
import { createMgplGraphQLClient, createSessionManager, webSessionStorage, MgplGraphQLError } from "@mgpl-diagnostics/client";

declare global {
  interface Window {
    __MGPL_API_URL__?: string;
  }
}

const url = (typeof window !== "undefined" && window.__MGPL_API_URL__) || "/graphql";

export const session = createSessionManager({ url, storage: webSessionStorage({ key: "mgpl.dashboard.session" }) });
export const mgpl = createMgplGraphQLClient({ url, session });
export type Mgpl = typeof mgpl;

/** A message for people: the API's own message for known codes, a plain fallback otherwise. */
export function errorMessage(err: unknown): string {
  if (err instanceof MgplGraphQLError) {
    switch (err.code) {
      case "NETWORK_ERROR":
        return "Can't reach the server. Check the connection and try again";
      case "INTERNAL_SERVER_ERROR":
        return "The server hit a problem. Try again, and tell the admin if it keeps happening";
      case "FORBIDDEN":
        return "Your role doesn't allow this here";
      case "RATE_LIMITED":
        return "Too many attempts. Wait a minute and try again";
      default:
        return err.message;
    }
  }
  return err instanceof Error ? err.message : "Something went wrong";
}

export const errorCode = (err: unknown) => (err instanceof MgplGraphQLError ? err.code : undefined);
