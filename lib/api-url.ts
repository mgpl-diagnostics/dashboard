// Where the browser sends GraphQL. Default: "/graphql" on this origin (proxy.ts forwards it to MGPL_API_URL).
// MGPL_PUBLIC_API_URL (read when the server starts, like MGPL_API_URL) sends the browser straight to the
// api instead, e.g. https://api.example.in:8443/graphql: then the api's own TLS proxy sees the browser's
// TLS handshake (JA4 fingerprint) and its client IP. The api must list this app's origin in CORS_ORIGINS.

/** The value for the page, or null to keep "/graphql". Only absolute http(s) URLs are accepted. */
export function publicApiUrl(raw = process.env.MGPL_PUBLIC_API_URL): string | null {
  const value = raw?.trim();
  if (!value) return null;
  try {
    const u = new URL(value);
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    if (u.pathname === "/" || u.pathname === "") u.pathname = "/graphql";
    return u.toString().replace(/\/+$/, "");
  } catch {
    return null;
  }
}

/** Inline script for <head>: sets window.__MGPL_API_URL__ before any app code runs. */
export const apiUrlScript = (url: string) => `window.__MGPL_API_URL__=${JSON.stringify(url).replace(/</g, "\u003c")};`;
