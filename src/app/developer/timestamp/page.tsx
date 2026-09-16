import { Metadata } from "next";
import { notFound } from "next/navigation";
import { getToolBySlug } from "@/config/tools";
import { ToolPageLayout } from "@/components/tools/tool-page-layout";
import { TimestampTool } from "@/components/tools/developer/timestamp-tool";
import { constructMetadata } from "@/lib/seo";

const SLUG = "timestamp";
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
      <TimestampTool />
    </ToolPageLayout>
  );
}
