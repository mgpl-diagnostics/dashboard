import type { MetadataRoute } from "next";

/**
 * The dashboard is for lab staff only: nothing here belongs in a search engine or an AI index.
 * Every response also carries `X-Robots-Tag: noindex` (next.config.ts) and every page a robots
 * meta tag (app/layout.tsx), so a URL that is linked from elsewhere still stays out of results.
 * The public site is mgpl-diagnostics/website.
 */
export default function robots(): MetadataRoute.Robots {
  return { rules: [{ userAgent: "*", disallow: "/" }] };
}
