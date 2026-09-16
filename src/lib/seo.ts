import { Metadata } from "next";
import { SITE_CONFIG } from "./constants";
import { ToolMetadata } from "@/types/tools";

export function constructMetadata({
  title,
  description = SITE_CONFIG.description,
  canonicalUrl,
  keywords,
  noIndex = false,
}: {
  title: string;
  description?: string;
  canonicalUrl?: string;
  keywords?: string[];
  noIndex?: boolean;
}): Metadata {
  const fullTitle = `${title} | ${SITE_CONFIG.name}`;
  const url = canonicalUrl ? `${SITE_CONFIG.url}${canonicalUrl}` : SITE_CONFIG.url;

  return {
    title: fullTitle,
    description,
    keywords: keywords || [
      "free online tools",
      "pdf tools",
      "image converter",
      "developer utilities",
      "client-side file tools",
      "private pdf editor",
    ],
    authors: [{ name: SITE_CONFIG.author }],
    creator: SITE_CONFIG.name,
    metadataBase: new URL(SITE_CONFIG.url),
    alternates: {
      canonical: url,
    },
    openGraph: {
      type: "website",
      locale: "en_US",
      url,
      title: fullTitle,
      description,
      siteName: SITE_CONFIG.name,
    },
    twitter: {
      card: "summary_large_image",
      title: fullTitle,
      description,
    },
    robots: {
      index: !noIndex,
      follow: !noIndex,
      googleBot: {
        index: !noIndex,
        follow: !noIndex,
        "max-video-preview": -1,
        "max-image-preview": "large",
        "max-snippet": -1,
      },
    },
  };
}

export function generateToolJsonLd(tool: ToolMetadata) {
  const toolUrl = `${SITE_CONFIG.url}${tool.route}`;

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "SoftwareApplication",
        name: tool.title,
        applicationCategory: "UtilityApplication",
        operatingSystem: "Web Browser",
        offers: {
          "@type": "Offer",
          price: "0",
          priceCurrency: "USD",
        },
        description: tool.fullDescription,
        url: toolUrl,
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "Home",
            item: SITE_CONFIG.url,
          },
          {
            "@type": "ListItem",
            position: 2,
            name: tool.category.toUpperCase() + " Tools",
            item: `${SITE_CONFIG.url}/${tool.category}`,
          },
          {
            "@type": "ListItem",
            position: 3,
            name: tool.title,
            item: toolUrl,
          },
        ],
      },
      ...(tool.faqs.length > 0
        ? [
            {
              "@type": "FAQPage",
              mainEntity: tool.faqs.map((faq) => ({
                "@type": "Question",
                name: faq.question,
                acceptedAnswer: {
                  "@type": "Answer",
                  text: faq.answer,
                },
              })),
            },
          ]
        : []),
    ],
  };
}

export function generateCategoryJsonLd({
  categoryName,
  categoryRoute,
  description,
  tools,
}: {
  categoryName: string;
  categoryRoute: string;
  description: string;
  tools: ToolMetadata[];
}) {
  const categoryUrl = `${SITE_CONFIG.url}${categoryRoute}`;

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        name: categoryName,
        url: categoryUrl,
        description,
        mainEntity: {
          "@type": "ItemList",
          numberOfItems: tools.length,
          itemListElement: tools.map((tool, idx) => ({
            "@type": "ListItem",
            position: idx + 1,
            name: tool.title,
            url: `${SITE_CONFIG.url}${tool.route}`,
          })),
        },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "Home",
            item: SITE_CONFIG.url,
          },
          {
            "@type": "ListItem",
            position: 2,
            name: categoryName,
            item: categoryUrl,
          },
        ],
      },
    ],
  };
}

