import React from "react";
import {
  FileText,
  Image,
  Code2,
  Minimize2,
  FilePlus2,
  Split,
  FileImage,
  Images,
  FileType,
  FileSpreadsheet,
  Table,
  Unlock,
  FileArchive,
  Maximize,
  RefreshCw,
  Scissors,
  Crop,
  FileCheck,
  ShieldCheck,
  Braces,
  CheckCircle2,
  KeyRound,
  Binary,
  Link2,
  Fingerprint,
  FileCode2,
  Clock,
  Palette,
  Shield,
  Wrench,
  LucideIcon,
} from "lucide-react";

const ICON_MAP: Record<string, LucideIcon> = {
  FileText,
  Image,
  Code2,
  Minimize2,
  FilePlus2,
  Split,
  FileImage,
  Images,
  FileType,
  FileSpreadsheet,
  Table,
  Unlock,
  FileArchive,
  Maximize,
  RefreshCw,
  Scissors,
  Crop,
  FileCheck,
  ShieldCheck,
  Braces,
  CheckCircle2,
  KeyRound,
  Binary,
  Link2,
  Fingerprint,
  FileCode2,
  Clock,
  Palette,
  Shield,
};

interface ToolIconProps {
  name: string;
  className?: string;
}

export function ToolIcon({ name, className = "h-5 w-5" }: ToolIconProps) {
  const IconComponent = ICON_MAP[name] || Wrench;
  return <IconComponent className={className} />;
}
