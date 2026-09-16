import { Metadata } from "next";
import { notFound } from "next/navigation";
import { getToolBySlug } from "@/config/tools";
import { ToolPageLayout } from "@/components/tools/tool-page-layout";
import { PdfToJpgTool } from "@/components/tools/pdf";
import { constructMetadata } from "@/lib/seo";

const SLUG = "pdf-to-jpg";
const tool = getToolBySlug(SLUG);

export const metadata: Metadata = tool
  ? constructMetadata({
      title: tool.seoTitle,
      description: tool.seoDescription,
      canonicalUrl: tool.route,
      keywords: tool.keywords,
    })
  : {};

export default function PdfToJpgPage() {
  if (!tool) notFound();
  return (
    <ToolPageLayout tool={tool}>
      <PdfToJpgTool />
    </ToolPageLayout>
  );
}
