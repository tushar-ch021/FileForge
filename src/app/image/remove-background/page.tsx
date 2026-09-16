import { Metadata } from "next";
import { notFound } from "next/navigation";
import { getToolBySlug } from "@/config/tools";
import { ToolPageLayout } from "@/components/tools/tool-page-layout";
import { RemoveBackgroundTool } from "@/components/tools/image/remove-background-tool";
import { constructMetadata } from "@/lib/seo";

const SLUG = "remove-background";
const tool = getToolBySlug(SLUG);

export const metadata: Metadata = tool
  ? constructMetadata({
      title: tool.seoTitle,
      description: tool.seoDescription,
      canonicalUrl: tool.route,
      keywords: tool.keywords,
    })
  : {};

export default function RemoveBackgroundPage() {
  if (!tool) notFound();
  return (
    <ToolPageLayout tool={tool}>
      <RemoveBackgroundTool />
    </ToolPageLayout>
  );
}
