export type ToolCategory = "pdf" | "image" | "developer";

export interface ToolFaq {
  question: string;
  answer: string;
}

export interface ToolStep {
  title: string;
  description: string;
}

export interface ToolMetadata {
  id: string;
  slug: string;
  title: string;
  shortDescription: string;
  fullDescription: string;
  category: ToolCategory;
  route: string;
  iconName: string;
  badge?: "Popular" | "Client-Side" | "Essential" | "New";
  seoTitle: string;
  seoDescription: string;
  keywords: string[];
  steps: ToolStep[];
  features: string[];
  faqs: ToolFaq[];
  supportedFormats?: string[];
  maxFileSize?: string;
}

export interface CategoryMetadata {
  id: ToolCategory;
  name: string;
  title: string;
  route: string;
  description: string;
  iconName: string;
  count: number;
}
