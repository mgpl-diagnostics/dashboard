import type { NextConfig } from "next";
import pkg from "./package.json";

/**
 * The browser talks to "/graphql" on this app's own origin; proxy.ts forwards it to the api
 * (MGPL_API_URL, read when the server starts, so one Docker image works with any api address).
 * Same origin: no CORS, and the api URL never reaches the bundle.
 */
const dev = process.env.NODE_ENV === "development";

/**
 * Content Security Policy. Everything the dashboard loads comes from this origin, and it talks only to
 * "/graphql" here, so a script injected by any bug can't load code from elsewhere or send the session
 * (kept in localStorage) to another host. 'unsafe-inline' for scripts is Next.js's inline bootstrap (a
 * nonce would make every page dynamic); Mantine writes inline styles. PDFs open as blob: URLs.
 * Dev mode (React Refresh) needs 'unsafe-eval' and a websocket.
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  `connect-src 'self'${dev ? " ws: wss:" : ""}`,
  "frame-src 'self' blob:",
  "worker-src 'self' blob:",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // the Docker image runs .next/standalone/server.js (no node_modules install at runtime)
  output: "standalone",
  // shown in the sidebar and sent to the api's update check (systemUpdates)
  env: { NEXT_PUBLIC_APP_VERSION: pkg.version },
  turbopack: { root: __dirname },
  experimental: {
    optimizePackageImports: ["@mantine/core", "@mantine/hooks", "@phosphor-icons/react"],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "same-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Content-Security-Policy", value: csp },
          { key: "Strict-Transport-Security", value: "max-age=31536000" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
