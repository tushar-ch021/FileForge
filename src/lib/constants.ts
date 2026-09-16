export const SITE_CONFIG = {
  name: "FileForge",
  tagline: "Free, Fast & Private In-Browser Tools",
  description:
    "Production-grade all-in-one suite for PDF editing, image conversion, and developer utilities. 100% private, client-side processing with zero server uploads.",
  url: process.env.NEXT_PUBLIC_SITE_URL || "https://fileforge.app",
  author: "FileForge Team",
  links: {
    github: "https://github.com",
    twitter: "https://twitter.com",
  },
  privacyPledge: "Zero permanent server storage. Files are processed securely directly in your browser.",
};

export const CATEGORIES = [
  {
    id: "pdf",
    name: "PDF Tools",
    title: "Free PDF Tools — Edit, Merge, Split & Convert",
    route: "/pdf",
    description: "Compress, merge, split, convert, and unlock PDF files directly in your web browser with total privacy.",
    iconName: "FileText",
  },
  {
    id: "image",
    name: "Image Tools",
    title: "Free Image Tools — Compress, Convert, Resize & Crop",
    route: "/image",
    description: "Optimize, resize, crop, and convert image formats locally with high-fidelity algorithms.",
    iconName: "Image",
  },
  {
    id: "developer",
    name: "Developer Tools",
    title: "Free Developer Tools — Format, Validate, Encode & Test",
    route: "/developer",
    description: "Inspect JWTs, format JSON, test RegEx, generate UUIDs, encode Base64, and calculate cryptographic hashes.",
    iconName: "Code2",
  },
] as const;

export const NAV_LINKS = [
  { label: "PDF Tools", href: "/pdf", icon: "FileText" },
  { label: "Image Tools", href: "/image", icon: "Image" },
  { label: "Developer Tools", href: "/developer", icon: "Code2" },
];
