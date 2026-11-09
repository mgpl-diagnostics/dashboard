import type { NextConfig } from "next";

/**
 * The browser talks to "/graphql" on this app's own origin, and Next forwards it to the api
 * (MGPL_API_URL, default http://localhost:4000). Same origin: no CORS, and the api URL never
 * reaches the bundle.
 */
const api = (process.env.MGPL_API_URL ?? "http://localhost:4000").replace(/\/+$/, "");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  turbopack: { root: __dirname },
  experimental: {
    optimizePackageImports: ["@mantine/core", "@mantine/hooks", "@phosphor-icons/react"],
  },
  async rewrites() {
    return [{ source: "/graphql", destination: `${api}/graphql` }];
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
