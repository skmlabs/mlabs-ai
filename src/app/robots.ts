import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.mlabsdigital.org";
  return {
    rules: [
      { userAgent: "*", allow: ["/"], disallow: ["/dashboard/", "/api/", "/auth/"] },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
