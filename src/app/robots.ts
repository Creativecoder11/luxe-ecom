import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const base = process.env.APP_URL ?? "http://localhost:3000";
  const production = process.env.APP_ENV === "production";
  return {
    // Non-production environments (staging, previews) are never indexed.
    rules: production
      ? { userAgent: "*", allow: "/", disallow: ["/admin", "/account", "/cart", "/checkout", "/search", "/styleguide", "/api/"] }
      : { userAgent: "*", disallow: "/" },
    sitemap: `${base}/sitemap.xml`,
  };
}
