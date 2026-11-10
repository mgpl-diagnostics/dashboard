"use client";
// The one GraphQL client of the app (@mgpl-diagnostics/client), in cookie mode: the api keeps the
// 15-minute access JWT and the single-use refresh token in httpOnly cookies, so no script on the page
// (and no XSS bug) can read a token. Every request sends `x-mgpl-auth: cookie`, the api's CSRF check.
// localStorage holds only that a session exists, its expiry times and the user, so a reload stays signed
// in and tabs stay in step; the refresh still runs once for every tab (Web Locks), with this device's
// signals. Requests go to "/graphql" on this origin; proxy.ts (or nginx) forwards them.
import { createMgplGraphQLClient, createSessionManager, webSessionStorage, MgplGraphQLError } from "@mgpl-diagnostics/client";

const url = "/graphql";

// Before cookie sessions the tokens themselves lived under this key: remove them (people sign in once more).
try {
  globalThis.localStorage?.removeItem("mgpl.dashboard.session");
} catch {
  /* storage blocked: nothing to remove */
}

export const session = createSessionManager({ url, cookies: true, storage: webSessionStorage({ key: "mgpl.dashboard.session.v2" }) });
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
