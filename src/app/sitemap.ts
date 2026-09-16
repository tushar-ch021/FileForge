import { MetadataRoute } from "next";
import { SITE_CONFIG, CATEGORIES } from "@/lib/constants";
import { TOOLS } from "@/config/tools";

export default function sitemap(): MetadataRoute.Sitemap {
  const currentDate = new Date();

  // 1. Homepage
  const routes: MetadataRoute.Sitemap = [
    {
      url: SITE_CONFIG.url,
      lastModified: currentDate,
      changeFrequency: "daily",
      priority: 1.0,
    },
  ];

  // 2. Category Hub Pages
  for (const category of CATEGORIES) {
    routes.push({
      url: `${SITE_CONFIG.url}${category.route}`,
      lastModified: currentDate,
      changeFrequency: "daily",
      priority: 0.9,
    });
  }

  // 3. All 26 Individual Tool Pages
  for (const tool of TOOLS) {
    routes.push({
      url: `${SITE_CONFIG.url}${tool.route}`,
      lastModified: currentDate,
      changeFrequency: "weekly",
      priority: 0.8,
    });
  }

  return routes;
}
