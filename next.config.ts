import type { NextConfig } from "next";
import pkg from "./package.json";

/**
 * The browser talks to "/graphql" on this app's own origin; proxy.ts forwards it to the api
 * (MGPL_API_URL, read when the server starts, so one Docker image works with any api address).
 * Same origin: no CORS, and the api URL never reaches the bundle.
 */
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
        ],
      },
    ];
  },
};

export default nextConfig;
