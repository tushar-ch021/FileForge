import { Metadata } from "next";
import { notFound } from "next/navigation";
import { getToolBySlug } from "@/config/tools";
import { ToolPageLayout } from "@/components/tools/tool-page-layout";
import { ImageToPdfTool } from "@/components/tools/image/image-to-pdf-tool";
import { constructMetadata } from "@/lib/seo";

const SLUG = "image-to-pdf";
const tool = getToolBySlug(SLUG);

export const metadata: Metadata = tool
  ? constructMetadata({
      title: tool.seoTitle,
      description: tool.seoDescription,
      canonicalUrl: tool.route,
      keywords: tool.keywords,
    })
  : {};

export default function ImageToPdfPage() {
  if (!tool) notFound();
  return (
    <ToolPageLayout tool={tool}>
      <ImageToPdfTool />
    </ToolPageLayout>
  );
}
