import fs from "fs";
import path from "path";

// Tool slugs matching user's exact route architecture
const tools = [
  // PDF (9)
  { category: "pdf", slug: "compress-pdf" },
  { category: "pdf", slug: "merge-pdf" },
  { category: "pdf", slug: "split-pdf" },
  { category: "pdf", slug: "jpg-to-pdf" },
  { category: "pdf", slug: "pdf-to-jpg" },
  { category: "pdf", slug: "word-to-pdf" },
  { category: "pdf", slug: "pdf-to-word" },
  { category: "pdf", slug: "pdf-to-excel" },
  { category: "pdf", slug: "pdf-unlock" },

  // Image (7)
  { category: "image", slug: "compress-image" },
  { category: "image", slug: "resize-image" },
  { category: "image", slug: "convert" },
  { category: "image", slug: "remove-background" },
  { category: "image", slug: "crop" },
  { category: "image", slug: "image-to-pdf" },
  { category: "image", slug: "metadata-cleaner" },

  // Developer (10)
  { category: "developer", slug: "json-formatter" },
  { category: "developer", slug: "json-validator" },
  { category: "developer", slug: "jwt-decoder" },
  { category: "developer", slug: "base64" },
  { category: "developer", slug: "url-encoder" },
  { category: "developer", slug: "uuid-generator" },
  { category: "developer", slug: "regex-tester" },
  { category: "developer", slug: "timestamp" },
  { category: "developer", slug: "color-converter" },
  { category: "developer", slug: "hash-generator" },
];

const baseAppDir = path.resolve("src/app");

for (const { category, slug } of tools) {
  const targetDir = path.join(baseAppDir, category, slug);
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  const content = `import { Metadata } from "next";
import { notFound } from "next/navigation";
import { getToolBySlug } from "@/config/tools";
import { ToolPageLayout } from "@/components/tools/tool-page-layout";
import { constructMetadata } from "@/lib/seo";

const SLUG = "${slug}";
const tool = getToolBySlug(SLUG);

export const metadata: Metadata = tool
  ? constructMetadata({
      title: tool.seoTitle,
      description: tool.seoDescription,
      canonicalUrl: tool.route,
      keywords: tool.keywords,
    })
  : {};

export default function ToolPage() {
  if (!tool) notFound();
  return <ToolPageLayout tool={tool} />;
}
`;

  const targetFile = path.join(targetDir, "page.tsx");
  fs.writeFileSync(targetFile, content, "utf-8");
  console.log(`Created: src/app/${category}/${slug}/page.tsx`);
}

console.log("Successfully scaffolded all 26 tool pages!");
