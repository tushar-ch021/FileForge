import { Metadata } from "next";
import { notFound } from "next/navigation";
import { getToolBySlug } from "@/config/tools";
import { ToolPageLayout } from "@/components/tools/tool-page-layout";
import { CropImageTool } from "@/components/tools/image/crop-image-tool";
import { constructMetadata } from "@/lib/seo";

const SLUG = "crop-image";
const tool = getToolBySlug(SLUG);

export const metadata: Metadata = tool
  ? constructMetadata({
      title: tool.seoTitle,
      description: tool.seoDescription,
      canonicalUrl: tool.route,
      keywords: tool.keywords,
    })
  : {};

export default function CropImagePage() {
  if (!tool) notFound();
  return (
    <ToolPageLayout tool={tool}>
      <CropImageTool />
    </ToolPageLayout>
  );
}
