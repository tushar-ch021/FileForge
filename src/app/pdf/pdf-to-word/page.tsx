import { Metadata } from "next";
import { notFound } from "next/navigation";
import { getToolBySlug } from "@/config/tools";
import { ToolPageLayout } from "@/components/tools/tool-page-layout";
import { PdfToWordTool } from "@/components/tools/pdf";
import { constructMetadata } from "@/lib/seo";

const SLUG = "pdf-to-word";
const tool = getToolBySlug(SLUG);

export const metadata: Metadata = tool
  ? constructMetadata({
      title: tool.seoTitle,
      description: tool.seoDescription,
      canonicalUrl: tool.route,
      keywords: tool.keywords,
    })
  : {};

export default function PdfToWordPage() {
  if (!tool) notFound();
  return (
    <ToolPageLayout tool={tool}>
      <PdfToWordTool />
    </ToolPageLayout>
  );
}
