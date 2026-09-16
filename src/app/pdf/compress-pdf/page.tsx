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
      canonicalUrl: "/pdf/compress",
      keywords: tool.keywords,
      noIndex: true,
    })
  : {};

export default function ToolPage() {
  if (!tool) notFound();
  return (
    <ToolPageLayout tool={tool}>
      <CompressPdfTool />
    </ToolPageLayout>
  );
}
