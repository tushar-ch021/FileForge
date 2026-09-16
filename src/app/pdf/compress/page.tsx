import { Metadata } from "next";
import { notFound } from "next/navigation";
import { getToolBySlug } from "@/config/tools";
import { ToolPageLayout } from "@/components/tools/tool-page-layout";
import { CompressPdfTool } from "@/components/tools/pdf";
import { constructMetadata } from "@/lib/seo";

const SLUG = "compress";
const tool = getToolBySlug(SLUG);

export const metadata: Metadata = tool
  ? constructMetadata({
      title: tool.seoTitle,
      description: tool.seoDescription,
      canonicalUrl: tool.route,
      keywords: tool.keywords,
    })
  : {};

export default function CompressPdfPage() {
  if (!tool) notFound();
  return (
    <ToolPageLayout tool={tool}>
      <CompressPdfTool />
    </ToolPageLayout>
  );
}
