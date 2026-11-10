import { publicApiUrl } from "./api-url";

/**
 * Content Security Policy, built per request in proxy.ts (not in next.config.ts, which is fixed at build
 * time) so that connect-src can name the api the browser calls when MGPL_PUBLIC_API_URL is set.
 * Everything the dashboard loads comes from this origin, and it talks only to "/graphql" here (or to that
 * one api origin), so a script injected by any bug can't load code from elsewhere or send the session
 * (kept in localStorage) to another host. 'unsafe-inline' for scripts is Next.js's inline bootstrap and the
 * api-url line in <head> (a nonce would need nonce plumbing through every render); Mantine writes inline
 * styles. PDFs open as blob: URLs. Dev mode (React Refresh) needs 'unsafe-eval' and a websocket.
 */
export function contentSecurityPolicy(dev = process.env.NODE_ENV === "development", apiUrl = publicApiUrl()): string {
  const api = apiUrl ? ` ${new URL(apiUrl).origin}` : "";
  return [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    `connect-src 'self'${api}${dev ? " ws: wss:" : ""}`,
    "frame-src 'self' blob:",
    "worker-src 'self' blob:",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");
}
