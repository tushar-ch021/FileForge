import { Metadata } from "next";
import { notFound } from "next/navigation";
import { getToolBySlug } from "@/config/tools";
import { ToolPageLayout } from "@/components/tools/tool-page-layout";
import { WordToPdfTool } from "@/components/tools/pdf";
import { constructMetadata } from "@/lib/seo";

const SLUG = "word-to-pdf";
const tool = getToolBySlug(SLUG);

export const metadata: Metadata = tool
  ? constructMetadata({
      title: tool.seoTitle,
      description: tool.seoDescription,
      canonicalUrl: tool.route,
      keywords: tool.keywords,
    })
  : {};

export default function WordToPdfPage() {
  if (!tool) notFound();
  return (
    <ToolPageLayout tool={tool}>
      <WordToPdfTool />
    </ToolPageLayout>
  );
}
