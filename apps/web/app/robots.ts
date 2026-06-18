import type { MetadataRoute } from "next";

/**
 * robots.txt (SECURITY-PLAN.md §5). The public gallery and asset detail pages
 * are crawlable (good for "<symbol> logo" SEO); the admin surface, API, and the
 * deep override image tree are disallowed so crawlers don't enumerate every URL.
 * Best-effort only — the real backstop for abuse is rate limiting (§3).
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/admin/", "/api/", "/overrides/"],
      },
    ],
  };
}
