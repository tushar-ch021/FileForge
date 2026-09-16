import { Metadata } from "next";
import { notFound } from "next/navigation";
import { getToolBySlug } from "@/config/tools";
import { ToolPageLayout } from "@/components/tools/tool-page-layout";
import { ImageConverterTool } from "@/components/tools/image/image-converter-tool";
import { constructMetadata } from "@/lib/seo";

const SLUG = "convert-image";
const tool = getToolBySlug(SLUG);

export const metadata: Metadata = tool
  ? constructMetadata({
      title: tool.seoTitle,
      description: tool.seoDescription,
      canonicalUrl: tool.route,
      keywords: tool.keywords,
      noIndex: true,
    })
  : {};

export default function ToolPage() {
  if (!tool) notFound();
  return (
    <ToolPageLayout tool={tool}>
      <ImageConverterTool />
    </ToolPageLayout>
  );
}
