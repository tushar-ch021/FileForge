import { Metadata } from "next";
import { notFound } from "next/navigation";
import { getToolBySlug } from "@/config/tools";
import { ToolPageLayout } from "@/components/tools/tool-page-layout";
import { CompressImageTool } from "@/components/tools/image/compress-image-tool";
import { constructMetadata } from "@/lib/seo";

const SLUG = "compress-image";
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
  return (
    <ToolPageLayout tool={tool}>
      <CompressImageTool />
    </ToolPageLayout>
  );
}
