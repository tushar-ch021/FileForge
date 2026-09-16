import { Metadata } from "next";
import { notFound } from "next/navigation";
import { getToolBySlug } from "@/config/tools";
import { ToolPageLayout } from "@/components/tools/tool-page-layout";
import { MetadataCleanerTool } from "@/components/tools/image/metadata-cleaner-tool";
import { constructMetadata } from "@/lib/seo";

const SLUG = "metadata-cleaner";
const tool = getToolBySlug(SLUG);

export const metadata: Metadata = tool
  ? constructMetadata({
      title: tool.seoTitle,
      description: tool.seoDescription,
      canonicalUrl: tool.route,
      keywords: tool.keywords,
    })
  : {};

export default function MetadataCleanerPage() {
  if (!tool) notFound();
  return (
    <ToolPageLayout tool={tool}>
      <MetadataCleanerTool />
    </ToolPageLayout>
  );
}
