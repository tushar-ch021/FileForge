import { Metadata } from "next";
import { notFound } from "next/navigation";
import { getToolBySlug } from "@/config/tools";
import { ToolPageLayout } from "@/components/tools/tool-page-layout";
import { ResizeImageTool } from "@/components/tools/image/resize-image-tool";
import { constructMetadata } from "@/lib/seo";

const SLUG = "resize-image";
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
      <ResizeImageTool />
    </ToolPageLayout>
  );
}
